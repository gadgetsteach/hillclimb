import { GameEngine, Collectible, Particle } from './game-engine';

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;

  // Camera state with smooth interpolation
  public camX: number = 0;
  public camY: number = 0;
  private targetCamX: number = 0;
  private targetCamY: number = 0;

  // Wheel rotation visual angle tracking
  private rearWheelVisualAngle: number = 0;
  private frontWheelVisualAngle: number = 0;

  // Driver head inertia tilt
  private driverTilt: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = (canvas.getContext ? canvas.getContext('2d', { alpha: false }) : null) as CanvasRenderingContext2D;
  }

  public render(engine: GameEngine) {
    const ctx = this.ctx;
    if (!ctx) return;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // 1. Update Camera
    const carX = engine.chassis.position.x;
    const carY = engine.chassis.position.y;
    const vx = engine.chassis.velocity.x;

    // Look-ahead camera
    this.targetCamX = carX - width * 0.35 + vx * 16;
    this.targetCamY = carY - height * 0.62;

    this.camX += (this.targetCamX - this.camX) * 0.12;
    this.camY += (this.targetCamY - this.camY) * 0.08;

    // 2. Draw Sky & Sun
    this.drawSky(width, height);

    // 3. Parallax Mountains (Distant, 0.08x)
    this.drawDistantMountains(width, height);

    // 4. Parallax Hills with Pine Trees (Midground, 0.25x)
    this.drawMidgroundHills(width, height);

    // 5. World transform (Game Coordinate Space)
    ctx.save();
    ctx.translate(-this.camX, -this.camY);

    // 6. Draw Procedural Terrain
    this.drawTerrain(engine);

    // 7. Draw Collectibles (Coins & Fuel)
    this.drawCollectibles(engine);

    // 8. Draw Particles (Behind & In Front)
    this.drawParticles(engine.particles);

    // 9. Draw Vehicle (Suspension, Wheels, Chassis, Driver)
    this.drawVehicle(engine);

    ctx.restore();

    // 10. Post-processing vignette
    this.drawVignette(width, height);
  }

  private drawSky(width: number, height: number) {
    const ctx = this.ctx;
    // Scenic alpine twilight / dusk gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, '#1c2438');   // Deep twilight navy
    skyGrad.addColorStop(0.45, '#3b4261'); // Dusty purple-blue
    skyGrad.addColorStop(0.75, '#e07a5f'); // Warm sunset coral
    skyGrad.addColorStop(1.0, '#f4a261');  // Golden horizon
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Sun / Moon on horizon
    const sunX = width * 0.78 - (this.camX * 0.02) % (width * 1.5);
    const sunY = height * 0.38;
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 140);
    sunGrad.addColorStop(0, 'rgba(255, 245, 215, 0.85)');
    sunGrad.addColorStop(0.3, 'rgba(244, 162, 97, 0.45)');
    sunGrad.addColorStop(1, 'rgba(244, 162, 97, 0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 140, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawDistantMountains(width: number, height: number) {
    const ctx = this.ctx;
    ctx.save();
    const speed = 0.06;
    const offsetX = -(this.camX * speed) % 1200;

    ctx.fillStyle = '#2f354f';
    ctx.beginPath();
    ctx.moveTo(0, height);

    // Continuous jagged mountain silhouettes
    for (let x = -200; x <= width + 400; x += 150) {
      const worldX = x - offsetX;
      const peakHeight = 220 + Math.sin(worldX * 0.003) * 90 + Math.sin(worldX * 0.007) * 45;
      ctx.lineTo(x, height - peakHeight);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    // Mountain snowy highlights
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fill();
    ctx.restore();
  }

  private drawMidgroundHills(width: number, height: number) {
    const ctx = this.ctx;
    ctx.save();
    const speed = 0.22;
    const offsetX = -(this.camX * speed) % 1400;

    // Rolling pine-covered ridge
    ctx.fillStyle = '#1e2d2f';
    ctx.beginPath();
    ctx.moveTo(0, height);

    const step = 60;
    for (let x = -100; x <= width + 200; x += step) {
      const worldX = x - offsetX;
      const hillY = height - (140 + Math.sin(worldX * 0.004) * 60 + Math.sin(worldX * 0.009) * 35);
      ctx.lineTo(x, hillY);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    // Silhouetted pine trees on the hill ridge
    ctx.fillStyle = '#142022';
    for (let x = -60; x <= width + 100; x += 45) {
      const worldX = x - offsetX;
      const hillY = height - (140 + Math.sin(worldX * 0.004) * 60 + Math.sin(worldX * 0.009) * 35);
      this.drawPineTree(x, hillY, 22 + (Math.sin(worldX) * 8));
    }
    ctx.restore();
  }

  private drawPineTree(x: number, y: number, height: number) {
    const ctx = this.ctx;
    const width = height * 0.45;
    ctx.beginPath();
    ctx.moveTo(x, y - height);
    ctx.lineTo(x + width, y);
    ctx.lineTo(x - width, y);
    ctx.closePath();
    ctx.fill();
  }

  private drawTerrain(engine: GameEngine) {
    const ctx = this.ctx;
    const chunks = engine.chunks;
    if (chunks.length === 0) return;

    // Collect visible points across active chunks
    const visiblePoints: { x: number; y: number }[] = [];
    for (const chunk of chunks) {
      for (const p of chunk.points) {
        visiblePoints.push(p);
      }
    }
    if (visiblePoints.length < 2) return;

    // 1. Draw Deep Earth Bedrock / Subsurface
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(visiblePoints[0].x, visiblePoints[0].y);

    for (let i = 1; i < visiblePoints.length; i++) {
      ctx.lineTo(visiblePoints[i].x, visiblePoints[i].y);
    }

    const lastX = visiblePoints[visiblePoints.length - 1].x;
    const deepBottom = this.camY + this.canvas.height + 600;
    ctx.lineTo(lastX, deepBottom);
    ctx.lineTo(visiblePoints[0].x, deepBottom);
    ctx.closePath();

    // Earthy stratified gradient
    const terrainGrad = ctx.createLinearGradient(0, this.camY, 0, deepBottom);
    terrainGrad.addColorStop(0, '#5a3d28');   // Top rich soil
    terrainGrad.addColorStop(0.35, '#3d281a'); // Dark clay
    terrainGrad.addColorStop(0.7, '#241a12');  // Hard bedrock
    terrainGrad.addColorStop(1, '#110d0a');
    ctx.fillStyle = terrainGrad;
    ctx.fill();

    // 2. Geological strata pattern (Horizontal subtle bands)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 4;
    for (let bandY = 400; bandY < 1800; bandY += 55) {
      ctx.beginPath();
      ctx.moveTo(visiblePoints[0].x, bandY);
      ctx.lineTo(lastX, bandY);
      ctx.stroke();
    }

    // 3. Top Lush Grass Layer
    ctx.beginPath();
    ctx.moveTo(visiblePoints[0].x, visiblePoints[0].y);
    for (let i = 1; i < visiblePoints.length; i++) {
      ctx.lineTo(visiblePoints[i].x, visiblePoints[i].y);
    }
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#2d6a4f'; // Deep grass
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Bright grass highlight edge
    ctx.beginPath();
    ctx.moveTo(visiblePoints[0].x, visiblePoints[0].y - 3);
    for (let i = 1; i < visiblePoints.length; i++) {
      ctx.lineTo(visiblePoints[i].x, visiblePoints[i].y - 3);
    }
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#52b788'; // Vibrant lime edge
    ctx.stroke();

    // Grass blade tufts on crests
    ctx.fillStyle = '#74c69d';
    for (let i = 0; i < visiblePoints.length; i += 3) {
      const p = visiblePoints[i];
      if (p.x >= this.camX - 50 && p.x <= this.camX + this.canvas.width + 50) {
        ctx.fillRect(p.x - 2, p.y - 7, 3, 5);
        ctx.fillRect(p.x + 3, p.y - 9, 2.5, 7);
      }
    }

    ctx.restore();
  }

  private drawCollectibles(engine: GameEngine) {
    const ctx = this.ctx;
    const time = Date.now() * 0.005;

    for (const chunk of engine.chunks) {
      for (const item of chunk.collectibles) {
        if (item.collected) continue;
        if (item.x < this.camX - 100 || item.x > this.camX + this.canvas.width + 100) continue;

        const bob = Math.sin(time + item.id) * 4;

        if (item.type === 'coin') {
          this.drawCoin(item.x, item.y + bob, item.value, time);
        } else if (item.type === 'fuel') {
          this.drawFuelCan(item.x, item.y + bob);
        }
      }
    }
  }

  private drawCoin(x: number, y: number, value: number, time: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);

    // Subtle 3D coin spin squish
    const spin = Math.cos(time * 3);
    ctx.scale(Math.abs(spin) * 0.5 + 0.5, 1);

    // Glow
    ctx.shadowColor = '#f39c12';
    ctx.shadowBlur = 12;

    // Coin body outer
    const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, 16);
    grad.addColorStop(0, '#fff3b0');
    grad.addColorStop(0.6, '#f1c40f');
    grad.addColorStop(1, '#d35400');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();

    // Inner rim
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#b7950b';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.stroke();

    // Star icon inside
    ctx.fillStyle = '#ffffff';
    this.drawStar(0, 0, 5, 6.5, 3.2);

    ctx.restore();
  }

  private drawStar(cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number) {
    const ctx = this.ctx;
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
  }

  private drawFuelCan(x: number, y: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);

    // Glow
    ctx.shadowColor = '#e74c3c';
    ctx.shadowBlur = 10;

    // Red Canister Main Body
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.roundRect(-13, -15, 26, 30, 4);
    ctx.fill();

    ctx.shadowBlur = 0;

    // Body highlight
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.roundRect(-11, -13, 10, 26, 2);
    ctx.fill();

    // Jerry-can indentations
    ctx.strokeStyle = '#922b21';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-8, -9, 16, 18);

    // Spout / Cap
    ctx.fillStyle = '#f39c12';
    ctx.fillRect(4, -20, 6, 6);

    // Handle
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(-8, -21, 14, 5);

    // White Fuel Drop Icon
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 3, 4, 0, Math.PI);
    ctx.lineTo(0, -5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  private drawVehicle(engine: GameEngine) {
    const ctx = this.ctx;
    const chassis = engine.chassis;
    const rearWheel = engine.rearWheel;
    const frontWheel = engine.frontWheel;
    const driverHead = engine.driverHead;

    // 1. Suspension Struts / Springs (connected to chassis)
    this.drawSuspensionStrut(chassis, -38, 12, rearWheel.position);
    this.drawSuspensionStrut(chassis, 38, 12, frontWheel.position);

    // 2. Wheels
    this.drawWheel(rearWheel, engine.isGas);
    this.drawWheel(frontWheel, engine.isGas);

    // 3. Driver & Chassis in local transform
    ctx.save();
    ctx.translate(chassis.position.x, chassis.position.y);
    ctx.rotate(chassis.angle);

    // Driver Body & Head
    this.drawDriver(engine, driverHead);

    // Chassis Off-Road Buggy Body
    this.drawChassisBody(engine);

    ctx.restore();
  }

  private drawSuspensionStrut(chassis: Matter.Body, anchorRelX: number, anchorRelY: number, wheelPos: { x: number; y: number }) {
    const ctx = this.ctx;
    const cos = Math.cos(chassis.angle);
    const sin = Math.sin(chassis.angle);
    const anchorX = chassis.position.x + (anchorRelX * cos - anchorRelY * sin);
    const anchorY = chassis.position.y + (anchorRelX * sin + anchorRelY * cos);

    ctx.save();
    // Heavy duty chrome suspension piston
    ctx.strokeStyle = '#95a5a6';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(anchorX, anchorY);
    ctx.lineTo(wheelPos.x, wheelPos.y);
    ctx.stroke();

    // Red coil spring wrap
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 3.5;
    const steps = 6;
    const dx = (wheelPos.x - anchorX) / steps;
    const dy = (wheelPos.y - anchorY) / steps;
    const perpX = -dy * 0.4;
    const perpY = dx * 0.4;

    ctx.beginPath();
    ctx.moveTo(anchorX, anchorY);
    for (let i = 1; i < steps; i++) {
      const sign = i % 2 === 0 ? 1 : -1;
      ctx.lineTo(anchorX + dx * i + perpX * sign, anchorY + dy * i + perpY * sign);
    }
    ctx.lineTo(wheelPos.x, wheelPos.y);
    ctx.stroke();
    ctx.restore();
  }

  private drawWheel(wheel: Matter.Body, isGas: boolean) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(wheel.position.x, wheel.position.y);
    ctx.rotate(wheel.angle);

    const radius = 22;

    // 1. Deep rubber tire with knobby tread
    ctx.fillStyle = '#1c1e21';
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Tread knobs around the perimeter
    ctx.fillStyle = '#2c3036';
    const lugs = 10;
    for (let i = 0; i < lugs; i++) {
      const a = (i / lugs) * Math.PI * 2;
      const lx = Math.cos(a) * (radius - 2);
      const ly = Math.sin(a) * (radius - 2);
      ctx.fillRect(lx - 2.5, ly - 2.5, 5, 5);
    }

    // 2. Alloy Mag Rim
    const rimGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, radius * 0.68);
    rimGrad.addColorStop(0, '#f1c40f'); // Golden rim hub
    rimGrad.addColorStop(0.5, '#d4ac0d');
    rimGrad.addColorStop(1, '#2c3e50');
    ctx.fillStyle = rimGrad;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.65, 0, Math.PI * 2);
    ctx.fill();

    // 3. Alloy 5-star spokes
    ctx.strokeStyle = '#ecf0f1';
    ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * (radius * 0.58), Math.sin(a) * (radius * 0.58));
      ctx.stroke();
    }

    // 4. Center hub cap & lug nuts
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawDriver(engine: GameEngine, driverHead: Matter.Body) {
    const ctx = this.ctx;
    // Calculate inertia tilt based on vehicle acceleration & gas
    const targetTilt = engine.isGas ? -0.15 : (engine.isBrake ? 0.2 : 0);
    this.driverTilt += (targetTilt - this.driverTilt) * 0.15;

    // Driver Torso (seated at driver position)
    ctx.save();
    ctx.translate(-10, -12);
    ctx.rotate(this.driverTilt);

    // Torso Racing Jacket (Cyan/Orange rally jacket)
    ctx.fillStyle = '#2980b9';
    ctx.fillRect(-10, -14, 20, 24);

    // Racing stripe on torso
    ctx.fillStyle = '#f39c12';
    ctx.fillRect(-2, -14, 5, 24);

    // Arms stretched out holding steering wheel
    ctx.strokeStyle = '#2980b9';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(4, -6);
    ctx.lineTo(24, -2);
    ctx.stroke();

    // Hands
    ctx.fillStyle = '#f5b041';
    ctx.beginPath();
    ctx.arc(25, -2, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Driver Head / Helmet
    ctx.translate(0, -22);

    // Helmet (Warm yellow rally helmet)
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();

    // Helmet visor / goggles (Glossy cyan)
    ctx.fillStyle = '#3498db';
    ctx.beginPath();
    ctx.roundRect(2, -6, 12, 10, 3);
    ctx.fill();

    // Visor glass sheen
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.fillRect(4, -4, 4, 3);

    // Helmet chin strap
    ctx.strokeStyle = '#34495e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0.4, 1.4);
    ctx.stroke();

    ctx.restore();
  }

  private drawChassisBody(engine: GameEngine) {
    const ctx = this.ctx;

    // 1. Heavy roll cage tubular steel
    ctx.strokeStyle = '#f39c12';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Front roll cage A-pillar to rear roll cage
    ctx.beginPath();
    ctx.moveTo(-45, -12);
    ctx.lineTo(-26, -38);
    ctx.lineTo(15, -38);
    ctx.lineTo(38, -12);
    ctx.stroke();

    // Diagonal brace
    ctx.beginPath();
    ctx.moveTo(-26, -38);
    ctx.lineTo(10, -12);
    ctx.stroke();

    // 2. Off-Road Jeep / Buggy Body Shell
    const bodyGrad = ctx.createLinearGradient(-50, -16, 50, 16);
    bodyGrad.addColorStop(0, '#e74c3c'); // Racing Red
    bodyGrad.addColorStop(0.6, '#c0392b');
    bodyGrad.addColorStop(1, '#922b21');
    ctx.fillStyle = bodyGrad;

    ctx.beginPath();
    // Custom buggy contours
    ctx.moveTo(-52, -10); // Rear spoiler top
    ctx.lineTo(-44, 12);  // Rear wheel arch top
    ctx.lineTo(-24, 14);  // Rear rocker
    ctx.lineTo(24, 14);   // Front rocker
    ctx.lineTo(44, 12);   // Front wheel arch
    ctx.lineTo(54, 4);    // Front bumper
    ctx.lineTo(52, -10);  // Hood nose
    ctx.lineTo(22, -14);  // Windshield base
    ctx.lineTo(-52, -14); // Tail
    ctx.closePath();
    ctx.fill();

    // White racing racing number circle & decal
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-8, -2, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#2c3e50';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('07', -8, -1);

    // Front Headlight with glow
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(52, -4, 5, 0, Math.PI * 2);
    ctx.fill();

    // Headlight light cone
    const beamGrad = ctx.createLinearGradient(54, -4, 200, 10);
    beamGrad.addColorStop(0, 'rgba(255, 255, 200, 0.45)');
    beamGrad.addColorStop(1, 'rgba(255, 255, 200, 0)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(54, -6);
    ctx.lineTo(200, -25);
    ctx.lineTo(200, 45);
    ctx.lineTo(54, -2);
    ctx.closePath();
    ctx.fill();

    // Chrome Exhaust pipe at rear
    ctx.fillStyle = '#7f8c8d';
    ctx.fillRect(-56, -6, 8, 5);
    ctx.fillStyle = engine.isGas ? '#e67e22' : '#34495e';
    ctx.fillRect(-58, -5, 3, 3);
  }

  private drawParticles(particles: Particle[]) {
    const ctx = this.ctx;
    for (const p of particles) {
      ctx.save();
      const alpha = 1 - p.life / p.maxLife;

      if (p.type === 'smoke') {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha * 0.45;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'dirt') {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'sparkle') {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'debris') {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.restore();
    }
  }

  private drawVignette(width: number, height: number) {
    const ctx = this.ctx;
    const vigGrad = ctx.createRadialGradient(
      width / 2,
      height / 2,
      width * 0.35,
      width / 2,
      height / 2,
      width * 0.65
    );
    vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vigGrad.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, width, height);
  }
}
