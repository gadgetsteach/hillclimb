import { Injectable, signal, computed } from '@angular/core';

export interface VehicleUpgrades {
  engine: number;      // 1 to 10
  suspension: number;  // 1 to 10
  tires: number;       // 1 to 10
  fourWheelDrive: number; // 1 to 10
}

export interface UpgradeInfo {
  id: keyof VehicleUpgrades;
  name: string;
  description: string;
  icon: string;
  level: number;
  maxLevel: number;
  cost: number;
  statLabel: string;
  statValue: string;
}

const STORAGE_KEY = 'hillclimb_save_data_v1';

@Injectable({
  providedIn: 'root'
})
export class GameStateService {
  private readonly defaultUpgrades: VehicleUpgrades = {
    engine: 1,
    suspension: 1,
    tires: 1,
    fourWheelDrive: 1
  };

  // Reactive signals
  readonly coins = signal<number>(150); // Start with some bonus coins for fun
  readonly highScore = signal<number>(0);
  readonly soundEnabled = signal<boolean>(true);
  readonly upgrades = signal<VehicleUpgrades>({ ...this.defaultUpgrades });

  // Current session stats
  readonly currentDistance = signal<number>(0);
  readonly sessionCoins = signal<number>(0);

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const dataStr = localStorage.getItem(STORAGE_KEY);
      if (dataStr) {
        const data = JSON.parse(dataStr);
        if (typeof data.coins === 'number') this.coins.set(data.coins);
        if (typeof data.highScore === 'number') this.highScore.set(data.highScore);
        if (typeof data.soundEnabled === 'boolean') this.soundEnabled.set(data.soundEnabled);
        if (data.upgrades) {
          this.upgrades.set({
            engine: Math.min(10, Math.max(1, data.upgrades.engine || 1)),
            suspension: Math.min(10, Math.max(1, data.upgrades.suspension || 1)),
            tires: Math.min(10, Math.max(1, data.upgrades.tires || 1)),
            fourWheelDrive: Math.min(10, Math.max(1, data.upgrades.fourWheelDrive || 1)),
          });
        }
      }
    } catch (e) {
      console.warn('Failed to load save data from localStorage:', e);
    }
  }

  saveToStorage() {
    try {
      const data = {
        coins: this.coins(),
        highScore: this.highScore(),
        soundEnabled: this.soundEnabled(),
        upgrades: this.upgrades(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
  }

  toggleSound(): boolean {
    const next = !this.soundEnabled();
    this.soundEnabled.set(next);
    this.saveToStorage();
    return next;
  }

  addCoins(amount: number) {
    this.coins.update(c => c + amount);
    this.sessionCoins.update(c => c + amount);
    this.saveToStorage();
  }

  recordDistance(meters: number) {
    this.currentDistance.set(meters);
    if (meters > this.highScore()) {
      this.highScore.set(meters);
      this.saveToStorage();
    }
  }

  resetSession() {
    this.currentDistance.set(0);
    this.sessionCoins.set(0);
  }

  getUpgradeCost(level: number): number {
    if (level >= 10) return 0;
    // Base 80, exponential ramp
    return Math.floor(80 * Math.pow(1.5, level - 1));
  }

  canUpgrade(type: keyof VehicleUpgrades): boolean {
    const currentLvl = this.upgrades()[type];
    if (currentLvl >= 10) return false;
    const cost = this.getUpgradeCost(currentLvl);
    return this.coins() >= cost;
  }

  upgrade(type: keyof VehicleUpgrades): boolean {
    if (!this.canUpgrade(type)) return false;
    const currentLvl = this.upgrades()[type];
    const cost = this.getUpgradeCost(currentLvl);

    this.coins.update(c => c - cost);
    this.upgrades.update(u => ({
      ...u,
      [type]: currentLvl + 1
    }));

    this.saveToStorage();
    return true;
  }

  getUpgradesList = computed<UpgradeInfo[]>(() => {
    const current = this.upgrades();
    return [
      {
        id: 'engine',
        name: 'Engine',
        description: 'Boosts horsepower, peak hill-climb torque, and top speed.',
        icon: '⚡',
        level: current.engine,
        maxLevel: 10,
        cost: this.getUpgradeCost(current.engine),
        statLabel: 'Torque Power',
        statValue: `${100 + (current.engine - 1) * 20}%`
      },
      {
        id: 'suspension',
        name: 'Suspension',
        description: 'Improves spring dampening, shock absorption, and rollover stability.',
        icon: '🧲',
        level: current.suspension,
        maxLevel: 10,
        cost: this.getUpgradeCost(current.suspension),
        statLabel: 'Dampening Rate',
        statValue: `${100 + (current.suspension - 1) * 15}%`
      },
      {
        id: 'tires',
        name: 'Tires',
        description: 'Sticky competition rubber for maximum friction on steep hills.',
        icon: '🛞',
        level: current.tires,
        maxLevel: 10,
        cost: this.getUpgradeCost(current.tires),
        statLabel: 'Tire Grip',
        statValue: `${100 + (current.tires - 1) * 18}%`
      },
      {
        id: 'fourWheelDrive',
        name: '4WD Drivetrain',
        description: 'Channels power evenly to both front and rear axles for vertical climbs.',
        icon: '⚙️',
        level: current.fourWheelDrive,
        maxLevel: 10,
        cost: this.getUpgradeCost(current.fourWheelDrive),
        statLabel: 'AWD Split',
        statValue: `${50 + (current.fourWheelDrive - 1) * 5}% Front`
      }
    ];
  });
}
