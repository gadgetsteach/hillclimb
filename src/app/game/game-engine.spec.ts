import { GameEngine } from './game-engine';
import { VehicleUpgrades } from '../services/game-state.service';

describe('GameEngine Physics and Mechanics', () => {
  const defaultUpgrades: VehicleUpgrades = {
    engine: 1,
    suspension: 1,
    tires: 1,
    fourWheelDrive: 1
  };

  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine(defaultUpgrades);
  });

  it('should initialize vehicle bodies and suspension constraints', () => {
    expect(engine.chassis).toBeDefined();
    expect(engine.rearWheel).toBeDefined();
    expect(engine.frontWheel).toBeDefined();
    expect(engine.driverHead).toBeDefined();
    expect(engine.rearSuspension).toBeDefined();
    expect(engine.frontSuspension).toBeDefined();

    expect(engine.chassis.label).toBe('chassis');
    expect(engine.driverHead.label).toBe('driverHead');
    expect(engine.rearWheel.label).toBe('rearWheel');
    expect(engine.frontWheel.label).toBe('frontWheel');
  });

  it('should generate initial procedural terrain chunks and collectibles', () => {
    expect(engine.chunks.length).toBeGreaterThanOrEqual(3);
    const firstChunk = engine.chunks[0];
    expect(firstChunk.points.length).toBeGreaterThan(10);
    expect(firstChunk.bodies.length).toBeGreaterThan(0);
  });

  it('should calculate terrain height smoothly without NaN', () => {
    const h0 = engine.getTerrainHeight(0);
    const h500 = engine.getTerrainHeight(500);
    const h1000 = engine.getTerrainHeight(1000);

    expect(Number.isNaN(h0)).toBe(false);
    expect(Number.isNaN(h500)).toBe(false);
    expect(Number.isNaN(h1000)).toBe(false);
    expect(h0).toBe(520); // flat starting zone
  });

  it('should drain fuel when driving', () => {
    const initialFuel = engine.fuel;
    engine.isGas = true;
    engine.step(0.1); // step 100ms
    expect(engine.fuel).toBeLessThan(initialFuel);
  });

  it('should trigger crash and spawn debris when head collides', () => {
    let crashCallbackTriggered = false;
    engine.onCrash = () => {
      crashCallbackTriggered = true;
    };

    engine.triggerCrash();

    expect(engine.isGameOver).toBe(true);
    expect(engine.gameOverReason).toBe('crashed');
    expect(crashCallbackTriggered).toBe(true);
    expect(engine.particles.length).toBeGreaterThan(0);
  });

  it('should trigger out-of-fuel game over', () => {
    let gameOverReason = '';
    engine.onGameOver = (reason) => {
      gameOverReason = reason;
    };

    engine.triggerFuelOut();

    expect(engine.isGameOver).toBe(true);
    expect(engine.gameOverReason).toBe('fuel');
    expect(gameOverReason).toBe('fuel');
  });

  it('should reset engine to starting state', () => {
    engine.fuel = 20;
    engine.isGameOver = true;
    engine.gameOverReason = 'crashed';

    engine.reset(defaultUpgrades);

    expect(engine.fuel).toBe(100);
    expect(engine.isGameOver).toBe(false);
    expect(engine.gameOverReason).toBe('');
    expect(engine.coinsCollected).toBe(0);
  });

  it('should return telemetry with non-negative distance and valid speed', () => {
    const telem = engine.getTelemetry();
    expect(telem.distance).toBeGreaterThanOrEqual(0);
    expect(telem.speed).toBeGreaterThanOrEqual(0);
    expect(telem.fuel).toBe(100);
    expect(telem.rpm).toBeGreaterThanOrEqual(1000);
  });
});
