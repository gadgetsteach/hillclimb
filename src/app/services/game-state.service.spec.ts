import { TestBed } from '@angular/core/testing';
import { GameStateService } from './game-state.service';

describe('GameStateService', () => {
  let service: GameStateService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [GameStateService]
    });
    service = TestBed.inject(GameStateService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should initialize with default state and coins', () => {
    expect(service.coins()).toBeGreaterThanOrEqual(100);
    expect(service.highScore()).toBe(0);
    expect(service.soundEnabled()).toBe(true);
    expect(service.upgrades().engine).toBe(1);
    expect(service.upgrades().suspension).toBe(1);
    expect(service.upgrades().tires).toBe(1);
    expect(service.upgrades().fourWheelDrive).toBe(1);
  });

  it('should add coins and update session coins', () => {
    const initialCoins = service.coins();
    service.addCoins(50);
    expect(service.coins()).toBe(initialCoins + 50);
    expect(service.sessionCoins()).toBe(50);
  });

  it('should record distance and update high score', () => {
    service.recordDistance(120);
    expect(service.currentDistance()).toBe(120);
    expect(service.highScore()).toBe(120);

    // Lower distance should not lower high score
    service.recordDistance(80);
    expect(service.currentDistance()).toBe(80);
    expect(service.highScore()).toBe(120);

    // Higher distance updates high score
    service.recordDistance(250);
    expect(service.highScore()).toBe(250);
  });

  it('should reset session stats', () => {
    service.addCoins(100);
    service.recordDistance(300);
    expect(service.sessionCoins()).toBe(100);
    expect(service.currentDistance()).toBe(300);

    service.resetSession();
    expect(service.sessionCoins()).toBe(0);
    expect(service.currentDistance()).toBe(0);
  });

  it('should toggle sound setting and persist', () => {
    expect(service.soundEnabled()).toBe(true);
    const toggled = service.toggleSound();
    expect(toggled).toBe(false);
    expect(service.soundEnabled()).toBe(false);
  });

  it('should allow upgrading vehicle parts when player has enough coins', () => {
    // Give player enough coins
    service.addCoins(1000);
    const initialEngineLevel = service.upgrades().engine;
    expect(service.canUpgrade('engine')).toBe(true);

    const success = service.upgrade('engine');
    expect(success).toBe(true);
    expect(service.upgrades().engine).toBe(initialEngineLevel + 1);
  });

  it('should prevent upgrade if coins are insufficient', () => {
    // Drain coins
    service.coins.set(5);
    expect(service.canUpgrade('engine')).toBe(false);
    const success = service.upgrade('engine');
    expect(success).toBe(false);
  });

  it('should list all 4 upgrades with proper info', () => {
    const list = service.getUpgradesList();
    expect(list.length).toBe(4);
    const ids = list.map(u => u.id);
    expect(ids).toContain('engine');
    expect(ids).toContain('suspension');
    expect(ids).toContain('tires');
    expect(ids).toContain('fourWheelDrive');
  });
});
