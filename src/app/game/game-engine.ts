import Matter from 'matter-js';
import { VehicleUpgrades } from '../services/game-state.service';

export interface Collectible {
  id: number;
  x: number;
  y: number;
  type: 'coin' | 'fuel';
  value: number; // coin value or fuel refill %
  collected: boolean;
  radius: number;
}

export interface TerrainChunk {
  index: number;
  startX: number;
  endX: number;
  points: { x: number; y: number }[];
  bodies: Matter.Body[];
  collectibles: Collectible[];
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: 'smoke' | 'dirt' | 'sparkle' | 'debris';
}

export interface StuntEvent {
  type: 'backflip' | 'frontflip' | 'airtime';
  message: string;
  bonus: number;
  time: number;
}

export interface GameTelemetry {
  distance: number;
  speed: number;
  rpm: number;
  fuel: number;
  coins: number;
  isAirborne: boolean;
  airTimeSeconds: number;
  isGameOver: boolean;
  gameOverReason: 'crashed' | 'fuel' | '';
  activeStunts: StuntEvent[];
}

export class GameEngine {
  // Matter.js components
  public engine: Matter.Engine;
  public world: Matter.World;

  // Vehicle components
  public chassis!: Matter.Body;
  public driverHead!: Matter.Body;
  public rearWheel!: Matter.Body;
  public frontWheel!: Matter.Body;
  public rearSuspension!: Matter.Constraint;
  public frontSuspension!: Matter.Constraint;
  public vehicleComposite!: Matter.Composite;

  // Wheel contact tracking
  public rearWheelGrounded: boolean = false;
  public frontWheelGrounded: boolean = false;

  // Terrain chunks
  public chunks: TerrainChunk[] = [];
  public nextChunkIndex: number = 0;
  public readonly CHUNK_WIDTH = 1600;
  public readonly SEGMENT_STEP = 35;

  // Collectibles & Particles
  public particles: Particle[] = [];
  private nextCollectibleId: number = 1;

  // Controls state
  public isGas: boolean = false;
  public isBrake: boolean = false;

  // Upgrades
  public upgrades!: VehicleUpgrades;

  // Telemetry & State
  public fuel: number = 100;
  public coinsCollected: number = 0;
  public maxDistance: number = 0;
  public isAirborne: boolean = false;
  public airTime: number = 0;
  public isGameOver: boolean = false;
  public gameOverReason: 'crashed' | 'fuel' | '' = '';
  public recentStunts: StuntEvent[] = [];

  // Air flip tracking
  private previousChassisAngle: number = 0;
  private cumulativeAirRotation: number = 0;
  private coastTimerAfterFuelOut: number = 0;

  // Callbacks
  public onCoinCollected?: (value: number) => void;
  public onFuelCollected?: () => void;
  public onStuntAwarded?: (stunt: StuntEvent) => void;
  public onCrash?: () => void;
  public onGameOver?: (reason: 'crashed' | 'fuel', distance: number, coins: number) => void;

  constructor(upgrades: VehicleUpgrades) {
    this.upgrades = upgrades;
    this.engine = Matter.Engine.create({
      enableSleeping: false,
      gravity: { x: 0, y: 1.25, scale: 0.001 }
    });
    this.world = this.engine.world;

    this.setupCollisionEvents();
    this.initTerrain();
    this.buildVehicle(180, 420);
  }

  public getTerrainHeight(x: number): number {
    // Gentle flat starting zone
    if (x < 450) {
      return 520;
    }

    const dist = x - 450;
    const progressFactor = Math.min(2.0, 1 + dist * 0.00008);

    // Multi-octave harmonic landscape
    let y = Math.sin(dist * 0.0018) * 110 * progressFactor;
    y += Math.sin(dist * 0.0042 + 1.2) * 65 * progressFactor;
    y += Math.sin(dist * 0.011 + 2.8) * 22;

    // Rolling hill peaks and occasional crests
    const longWave = Math.sin(dist * 0.0006);
    if (longWave > 0.3) {
      y += (longWave - 0.3) * 180 * progressFactor;
    }

    // Occasional dips
    const dipWave = Math.sin(dist * 0.0009 + 3.0);
    if (dipWave < -0.6) {
      y -= (dipWave + 0.6) * 140;
    }

    return 520 + y;
  }

  private initTerrain() {
    // Clear any existing chunks
    for (const chunk of this.chunks) {
      for (const b of chunk.bodies) {
        Matter.Composite.remove(this.world, b);
      }
    }
    this.chunks = [];
    this.nextChunkIndex = 0;

    // Generate initial 3 chunks (approx 4800px)
    for (let i = 0; i < 3; i++) {
      this.generateChunk();
    }
  }

  private generateChunk() {
    const chunkIdx = this.nextChunkIndex++;
    const startX = chunkIdx * this.CHUNK_WIDTH;
    const endX = startX + this.CHUNK_WIDTH;

    const points: { x: number; y: number }[] = [];
    for (let x = startX; x <= endX; x += this.SEGMENT_STEP) {
      points.push({ x, y: this.getTerrainHeight(x) });
    }
    // ensure last point is exactly at endX
    if (points[points.length - 1].x < endX) {
      points.push({ x: endX, y: this.getTerrainHeight(endX) });
    }

    const chunkBodies: Matter.Body[] = [];
    const collectibles: Collectible[] = [];

    // Create trapezoid static bodies between points
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      const thickness = 280;

      // Segment centered at midX, midY + thickness/2
      const body = Matter.Bodies.rectangle(midX, midY + thickness / 2 - 2, length + 2, thickness, {
        isStatic: true,
        angle: angle,
        friction: 1.0,
        restitution: 0.05,
        label: 'terrain',
        collisionFilter: {
          category: 0x0001,
          mask: 0xffff
        }
      });
      chunkBodies.push(body);
      Matter.Composite.add(this.world, body);

      // Procedurally generate collectibles (skip starting 500m)
      if (p1.x > 600 && i % 3 === 0) {
        const rand = Math.random();
        // Coin spawn
        if (rand < 0.45) {
          collectibles.push({
            id: this.nextCollectibleId++,
            x: midX,
            y: midY - 32,
            type: 'coin',
            value: rand < 0.08 ? 50 : (rand < 0.2 ? 25 : 5),
            collected: false,
            radius: 14
          });
        }
      }
    }

    // Fuel canister spawn: one per ~250m chunk
    if (startX >= 1200) {
      const fuelX = startX + this.CHUNK_WIDTH * (0.35 + Math.random() * 0.3);
      const fuelY = this.getTerrainHeight(fuelX) - 34;
      collectibles.push({
        id: this.nextCollectibleId++,
        x: fuelX,
        y: fuelY,
        type: 'fuel',
        value: 45,
        collected: false,
        radius: 18
      });
    }

    this.chunks.push({
      index: chunkIdx,
      startX,
      endX,
      points,
      bodies: chunkBodies,
      collectibles
    });
  }

  public updateTerrainChunks(cameraX: number) {
    // Generate new chunks ahead
    const lastChunk = this.chunks[this.chunks.length - 1];
    if (lastChunk && lastChunk.endX < cameraX + 2600) {
      this.generateChunk();
    }

    // Recycle chunks far behind camera
    while (this.chunks.length > 2 && this.chunks[0].endX < cameraX - 2200) {
      const oldChunk = this.chunks.shift()!;
      for (const b of oldChunk.bodies) {
        Matter.Composite.remove(this.world, b);
      }
    }
  }

  public buildVehicle(startX: number, startY: number) {
    if (this.vehicleComposite) {
      Matter.Composite.remove(this.world, this.vehicleComposite);
    }

    const collisionGroup = Matter.Body.nextGroup(true); // negative group: vehicle parts won't self-collide

    // 1. Chassis Body
    this.chassis = Matter.Bodies.rectangle(startX, startY, 110, 36, {
      mass: 4.5,
      density: 0.0035,
      friction: 0.5,
      restitution: 0.1,
      label: 'chassis',
      collisionFilter: {
        group: collisionGroup,
        category: 0x0002,
        mask: 0x0001 // collides with terrain
      }
    });

    // 2. Driver Head Hitbox (triggers crash on ground contact)
    this.driverHead = Matter.Bodies.circle(startX - 10, startY - 32, 13, {
      mass: 0.4,
      density: 0.001,
      label: 'driverHead',
      collisionFilter: {
        group: collisionGroup,
        category: 0x0004,
        mask: 0x0001 // collides only with terrain
      }
    });

    // Pin head rigidly to chassis
    const headPin = Matter.Constraint.create({
      bodyA: this.chassis,
      pointA: { x: -10, y: -32 },
      bodyB: this.driverHead,
      pointB: { x: 0, y: 0 },
      stiffness: 0.95,
      damping: 0.1,
      length: 0
    });

    // 3. Wheels
    // Suspension tuning based on upgrade (critically damped)
    const suspLvl = this.upgrades.suspension;
    const suspStiffness = 0.14 + (suspLvl - 1) * 0.015;
    const suspDamping = 0.16 + (suspLvl - 1) * 0.02;

    // Tire grip based on upgrade
    const tireLvl = this.upgrades.tires;
    const tireFriction = 0.9 + (tireLvl - 1) * 0.13;

    const wheelRadius = 22;
    const wheelYOffset = 26;
    const rearXOffset = -38;
    const frontXOffset = 38;

    this.rearWheel = Matter.Bodies.circle(startX + rearXOffset, startY + wheelYOffset, wheelRadius, {
      mass: 1.8,
      density: 0.004,
      friction: tireFriction,
      frictionStatic: tireFriction * 1.3,
      restitution: 0.12,
      label: 'rearWheel',
      collisionFilter: {
        group: collisionGroup,
        category: 0x0002,
        mask: 0x0001
      }
    });

    this.frontWheel = Matter.Bodies.circle(startX + frontXOffset, startY + wheelYOffset, wheelRadius, {
      mass: 1.8,
      density: 0.004,
      friction: tireFriction,
      frictionStatic: tireFriction * 1.3,
      restitution: 0.12,
      label: 'frontWheel',
      collisionFilter: {
        group: collisionGroup,
        category: 0x0002,
        mask: 0x0001
      }
    });

    // 4. Suspension Springs
    this.rearSuspension = Matter.Constraint.create({
      bodyA: this.chassis,
      pointA: { x: rearXOffset, y: 12 },
      bodyB: this.rearWheel,
      pointB: { x: 0, y: 0 },
      stiffness: suspStiffness,
      damping: suspDamping,
      length: 22
    });

    this.frontSuspension = Matter.Constraint.create({
      bodyA: this.chassis,
      pointA: { x: frontXOffset, y: 12 },
      bodyB: this.frontWheel,
      pointB: { x: 0, y: 0 },
      stiffness: suspStiffness,
      damping: suspDamping,
      length: 22
    });

    // Secondary stabilizer constraints to prevent extreme wheel dislocation
    const rearStabilizer = Matter.Constraint.create({
      bodyA: this.chassis,
      pointA: { x: rearXOffset, y: -6 },
      bodyB: this.rearWheel,
      pointB: { x: 0, y: 0 },
      stiffness: suspStiffness * 0.45,
      damping: suspDamping,
      length: 36
    });

    const frontStabilizer = Matter.Constraint.create({
      bodyA: this.chassis,
      pointA: { x: frontXOffset, y: -6 },
      bodyB: this.frontWheel,
      pointB: { x: 0, y: 0 },
      stiffness: suspStiffness * 0.45,
      damping: suspDamping,
      length: 36
    });

    this.vehicleComposite = Matter.Composite.create();
    Matter.Composite.add(this.vehicleComposite, [
      this.chassis,
      this.driverHead,
      headPin,
      this.rearWheel,
      this.frontWheel,
      this.rearSuspension,
      this.frontSuspension,
      rearStabilizer,
      frontStabilizer
    ]);

    Matter.Composite.add(this.world, this.vehicleComposite);

    this.previousChassisAngle = this.chassis.angle;
    this.cumulativeAirRotation = 0;
  }

  private setupCollisionEvents() {
    Matter.Events.on(this.engine, 'collisionStart', (event) => {
      for (const pair of event.pairs) {
        // Head collision with terrain
        if (
          (pair.bodyA.label === 'driverHead' && pair.bodyB.label === 'terrain') ||
          (pair.bodyB.label === 'driverHead' && pair.bodyA.label === 'terrain')
        ) {
          this.triggerCrash();
        }

        // Wheel ground contacts
        if (pair.bodyA.label === 'terrain' || pair.bodyB.label === 'terrain') {
          if (pair.bodyA.label === 'rearWheel' || pair.bodyB.label === 'rearWheel') {
            this.rearWheelGrounded = true;
          }
          if (pair.bodyA.label === 'frontWheel' || pair.bodyB.label === 'frontWheel') {
            this.frontWheelGrounded = true;
          }
        }
      }
    });

    Matter.Events.on(this.engine, 'collisionEnd', (event) => {
      for (const pair of event.pairs) {
        if (pair.bodyA.label === 'terrain' || pair.bodyB.label === 'terrain') {
          if (pair.bodyA.label === 'rearWheel' || pair.bodyB.label === 'rearWheel') {
            this.rearWheelGrounded = false;
          }
          if (pair.bodyA.label === 'frontWheel' || pair.bodyB.label === 'frontWheel') {
            this.frontWheelGrounded = false;
          }
        }
      }
    });
  }

  public triggerCrash() {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.gameOverReason = 'crashed';

    // Spawn crash debris particles
    const headPos = this.driverHead.position;
    for (let i = 0; i < 24; i++) {
      this.particles.push({
        x: headPos.x,
        y: headPos.y,
        vx: (Math.random() - 0.5) * 12,
        vy: -Math.random() * 9 - 2,
        life: 0,
        maxLife: 45 + Math.random() * 25,
        size: 3 + Math.random() * 5,
        color: ['#e74c3c', '#f39c12', '#7f8c8d', '#2c3e50', '#ffffff'][Math.floor(Math.random() * 5)],
        type: 'debris'
      });
    }

    if (this.onCrash) this.onCrash();
    if (this.onGameOver) this.onGameOver('crashed', Math.floor(this.maxDistance), this.coinsCollected);
  }

  public triggerFuelOut() {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.gameOverReason = 'fuel';
    if (this.onGameOver) this.onGameOver('fuel', Math.floor(this.maxDistance), this.coinsCollected);
  }

  public step(deltaTimeSec: number) {
    if (this.isGameOver) {
      Matter.Engine.update(this.engine, 1000 / 60);
      this.updateParticles();
      return;
    }

    // 1. Distance tracking
    const currentMeters = Math.max(0, Math.floor((this.chassis.position.x - 180) / 10));
    if (currentMeters > this.maxDistance) {
      this.maxDistance = currentMeters;
    }

    // 2. Fuel consumption
    if (this.fuel > 0) {
      let consumption = 0.7 * deltaTimeSec; // base idle
      if (this.isGas) consumption += 2.8 * deltaTimeSec; // throttle drain
      this.fuel = Math.max(0, this.fuel - consumption);

      if (this.fuel <= 0) {
        this.fuel = 0;
      }
    } else {
      // Out of fuel coasting check
      const speed = Math.abs(this.chassis.velocity.x) + Math.abs(this.chassis.velocity.y);
      if (speed < 0.4) {
        this.coastTimerAfterFuelOut += deltaTimeSec;
        if (this.coastTimerAfterFuelOut > 1.2) {
          this.triggerFuelOut();
        }
      } else {
        this.coastTimerAfterFuelOut += deltaTimeSec * 0.4;
        if (this.coastTimerAfterFuelOut > 5.0) {
          this.triggerFuelOut();
        }
      }
    }

    // 3. Grounded / Airborne state
    const grounded = this.rearWheelGrounded || this.frontWheelGrounded;
    this.isAirborne = !grounded;

    if (this.isAirborne) {
      this.airTime += deltaTimeSec;

      // Track flips
      const deltaAngle = this.chassis.angle - this.previousChassisAngle;
      this.cumulativeAirRotation += deltaAngle;

      // Check for full 360 rotation (approx 6.0 radians)
      if (this.cumulativeAirRotation > 5.8) {
        this.cumulativeAirRotation -= Math.PI * 2;
        this.awardStunt('frontflip', 'FRONTFLIP! +500', 500);
      } else if (this.cumulativeAirRotation < -5.8) {
        this.cumulativeAirRotation += Math.PI * 2;
        this.awardStunt('backflip', 'BACKFLIP! +500', 500);
      }
    } else {
      // Landed
      if (this.airTime > 1.5) {
        const airBonus = Math.floor(this.airTime * 75);
        this.awardStunt('airtime', `AIR TIME! +${airBonus}`, airBonus);
      }
      this.airTime = 0;
      this.cumulativeAirRotation = 0;
    }
    this.previousChassisAngle = this.chassis.angle;

    // 4. Vehicle Physics application
    const engineLvl = this.upgrades.engine;
    const torqueBase = 0.045 + (engineLvl - 1) * 0.009; // Engine power
    const awdLvl = this.upgrades.fourWheelDrive;
    const frontPowerSplit = 0.45 + (awdLvl - 1) * 0.06; // 4WD ratio

    if (this.fuel > 0) {
      if (grounded) {
        if (this.isGas) {
          // Accelerate wheels clockwise
          Matter.Body.setAngularVelocity(this.rearWheel, this.rearWheel.angularVelocity + torqueBase);
          Matter.Body.setAngularVelocity(this.frontWheel, this.frontWheel.angularVelocity + torqueBase * frontPowerSplit);

          // Spawn tire dirt roost
          if (this.rearWheelGrounded && Math.random() < 0.6) {
            this.spawnDirtParticle(this.rearWheel.position.x, this.rearWheel.position.y + 20, -1);
          }
          if (this.frontWheelGrounded && Math.random() < 0.4) {
            this.spawnDirtParticle(this.frontWheel.position.x, this.frontWheel.position.y + 20, -1);
          }
        } else if (this.isBrake) {
          // Brake / Reverse wheels
          Matter.Body.setAngularVelocity(this.rearWheel, this.rearWheel.angularVelocity - torqueBase * 0.7);
          Matter.Body.setAngularVelocity(this.frontWheel, this.frontWheel.angularVelocity - torqueBase * 0.7 * frontPowerSplit);
        }
      } else {
        // Air control (Airborne pitch)
        const airTorque = 0.07;
        if (this.isGas) {
          // Gas in air rotates car nose down (clockwise)
          this.chassis.torque += airTorque;
        }
        if (this.isBrake) {
          // Brake in air rotates car nose up (counter-clockwise)
          this.chassis.torque -= airTorque;
        }
      }
    }

    // 5. Exhaust smoke from tailpipe
    if (Math.random() < (this.isGas ? 0.85 : 0.25)) {
      this.spawnExhaustSmoke();
    }

    // 6. Collectibles collision detection
    this.checkCollectibles();

    // 7. Step physics
    Matter.Engine.update(this.engine, 1000 / 60);

    // 8. Update chunks and particles
    this.updateTerrainChunks(this.chassis.position.x);
    this.updateParticles();

    // Cleanup old stunts from UI list
    const now = Date.now();
    this.recentStunts = this.recentStunts.filter(s => now - s.time < 2200);
  }

  private awardStunt(type: 'backflip' | 'frontflip' | 'airtime', message: string, bonus: number) {
    const stunt: StuntEvent = {
      type,
      message,
      bonus,
      time: Date.now()
    };
    this.recentStunts.push(stunt);
    this.coinsCollected += bonus;
    if (this.onStuntAwarded) this.onStuntAwarded(stunt);
  }

  private checkCollectibles() {
    const carX = this.chassis.position.x;
    const carY = this.chassis.position.y;
    const pickupDistSq = 56 * 56;

    for (const chunk of this.chunks) {
      for (const item of chunk.collectibles) {
        if (item.collected) continue;

        const dx = item.x - carX;
        const dy = item.y - carY;
        if (dx * dx + dy * dy < pickupDistSq) {
          item.collected = true;

          if (item.type === 'coin') {
            this.coinsCollected += item.value;
            this.spawnSparkleParticles(item.x, item.y, '#f1c40f');
            if (this.onCoinCollected) this.onCoinCollected(item.value);
          } else if (item.type === 'fuel') {
            this.fuel = Math.min(100, this.fuel + item.value);
            this.spawnSparkleParticles(item.x, item.y, '#e74c3c');
            if (this.onFuelCollected) this.onFuelCollected();
          }
        }
      }
    }
  }

  private spawnExhaustSmoke() {
    // Tailpipe relative to chassis center
    const angle = this.chassis.angle;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const pipeX = this.chassis.position.x + (-52 * cos - (-8 * sin));
    const pipeY = this.chassis.position.y + (-52 * sin + (-8 * cos));

    this.particles.push({
      x: pipeX,
      y: pipeY,
      vx: -cos * (1.5 + Math.random() * 2) + (Math.random() - 0.5),
      vy: -sin * 2 - Math.random() * 1.5,
      life: 0,
      maxLife: 30 + Math.random() * 20,
      size: 4 + Math.random() * 4,
      color: this.isGas ? 'rgba(120, 120, 120, 0.7)' : 'rgba(200, 200, 200, 0.4)',
      type: 'smoke'
    });
  }

  private spawnDirtParticle(x: number, y: number, dir: number) {
    this.particles.push({
      x: x + (Math.random() - 0.5) * 8,
      y: y,
      vx: dir * (2 + Math.random() * 5),
      vy: -Math.random() * 4 - 1,
      life: 0,
      maxLife: 20 + Math.random() * 15,
      size: 3 + Math.random() * 3,
      color: ['#8B5A2B', '#A0522D', '#5C4033', '#CD853F'][Math.floor(Math.random() * 4)],
      type: 'dirt'
    });
  }

  private spawnSparkleParticles(x: number, y: number, color: string) {
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12 + (Math.random() - 0.5) * 0.3;
      const speed = 2 + Math.random() * 4.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 25 + Math.random() * 15,
        size: 3.5 + Math.random() * 3,
        color,
        type: 'sparkle'
      });
    }
  }

  private updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life++;
      p.x += p.vx;
      p.y += p.vy;

      if (p.type === 'smoke') {
        p.size += 0.25;
        p.vy -= 0.04; // buoyant drift
      } else if (p.type === 'dirt' || p.type === 'debris') {
        p.vy += 0.28; // gravity
      }

      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
      }
    }
  }

  public getTelemetry(): GameTelemetry {
    const vx = this.chassis.velocity.x;
    const vy = this.chassis.velocity.y;
    const speed = Math.sqrt(vx * vx + vy * vy) * 3.6; // convert to approx km/h
    const rpm = Math.min(8000, 1000 + speed * 120 + (this.isGas ? 2500 : 0));

    return {
      distance: Math.floor(this.maxDistance),
      speed: Math.round(speed),
      rpm: Math.round(rpm),
      fuel: Math.max(0, Math.round(this.fuel)),
      coins: this.coinsCollected,
      isAirborne: this.isAirborne,
      airTimeSeconds: Number(this.airTime.toFixed(1)),
      isGameOver: this.isGameOver,
      gameOverReason: this.gameOverReason,
      activeStunts: this.recentStunts
    };
  }

  public reset(upgrades: VehicleUpgrades) {
    this.upgrades = upgrades;
    this.fuel = 100;
    this.coinsCollected = 0;
    this.maxDistance = 0;
    this.isAirborne = false;
    this.airTime = 0;
    this.isGameOver = false;
    this.gameOverReason = '';
    this.recentStunts = [];
    this.particles = [];
    this.coastTimerAfterFuelOut = 0;

    this.initTerrain();
    this.buildVehicle(180, 420);
  }
}
