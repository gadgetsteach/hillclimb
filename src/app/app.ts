import {
  Component,
  ElementRef,
  ViewChild,
  NgZone,
  OnInit,
  OnDestroy,
  HostListener,
  signal,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameEngine, GameTelemetry, StuntEvent } from './game/game-engine';
import { CanvasRenderer } from './game/canvas-renderer';
import { GameStateService, UpgradeInfo, VehicleUpgrades } from './services/game-state.service';
import { AudioService } from './services/audio.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  @ViewChild('gameCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  public gameState = inject(GameStateService);
  public audio = inject(AudioService);
  private ngZone = inject(NgZone);

  private engine!: GameEngine;
  private renderer!: CanvasRenderer;
  private animationFrameId: number | null = null;
  private lastTime: number = 0;
  private telemetryFrameCounter: number = 0;

  // Angular Signals for UI
  readonly isRunning = signal<boolean>(false);
  readonly isPaused = signal<boolean>(false);
  readonly isGameOver = signal<boolean>(false);
  readonly gameOverReason = signal<'crashed' | 'fuel' | ''>('');
  readonly isGarageOpen = signal<boolean>(false);

  readonly distance = signal<number>(0);
  readonly speed = signal<number>(0);
  readonly rpm = signal<number>(1000);
  readonly fuel = signal<number>(100);
  readonly coins = signal<number>(0);
  readonly isAirborne = signal<boolean>(false);
  readonly activeStunt = signal<StuntEvent | null>(null);

  // Pedal visual active states
  readonly gasActive = signal<boolean>(false);
  readonly brakeActive = signal<boolean>(false);

  ngOnInit() {
    this.initCanvasSize();
    this.initGame();
  }

  ngOnDestroy() {
    this.stopGameLoop();
    this.audio.stopEngine();
  }

  private initCanvasSize() {
    const canvas = this.canvasRef.nativeElement;
    canvas.width = 1280;
    canvas.height = 720;
  }

  private initGame() {
    const canvas = this.canvasRef.nativeElement;
    this.renderer = new CanvasRenderer(canvas);
    this.engine = new GameEngine(this.gameState.upgrades());

    // Connect Engine Callbacks to Sound & Angular State
    this.engine.onCoinCollected = (val) => {
      this.audio.playCoinSound();
      this.ngZone.run(() => {
        this.gameState.addCoins(val);
      });
    };

    this.engine.onFuelCollected = () => {
      this.audio.playFuelSound();
    };

    this.engine.onStuntAwarded = (stunt) => {
      this.audio.playFlipSound();
      this.ngZone.run(() => {
        this.gameState.addCoins(stunt.bonus);
        this.activeStunt.set(stunt);
        setTimeout(() => {
          if (this.activeStunt() === stunt) {
            this.activeStunt.set(null);
          }
        }, 1800);
      });
    };

    this.engine.onCrash = () => {
      this.audio.playCrashSound();
      this.audio.stopEngine();
    };

    this.engine.onGameOver = (reason, dist, earnedCoins) => {
      this.audio.stopEngine();
      this.ngZone.run(() => {
        this.isGameOver.set(true);
        this.gameOverReason.set(reason);
        this.gameState.recordDistance(dist);
      });
    };

    // Start engine sound and loop outside Angular
    this.audio.setMuted(!this.gameState.soundEnabled());
    this.audio.startEngine();
    this.isRunning.set(true);

    this.ngZone.runOutsideAngular(() => {
      this.startGameLoop();
    });
  }

  private startGameLoop() {
    this.lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
      this.lastTime = currentTime;

      if (!this.isPaused()) {
        // Step physics
        this.engine.step(dt);

        // Update sound engine pitch
        const vx = this.engine.chassis.velocity.x;
        this.audio.updateEngine(this.engine.isGas ? 1 : 0, Math.abs(vx));

        // Throttle UI signal updates to ~20Hz to keep 60 FPS Canvas completely smooth
        this.telemetryFrameCounter++;
        if (this.telemetryFrameCounter % 3 === 0) {
          const telem = this.engine.getTelemetry();
          this.ngZone.run(() => {
            this.distance.set(telem.distance);
            this.speed.set(telem.speed);
            this.rpm.set(telem.rpm);
            this.fuel.set(telem.fuel);
            this.coins.set(this.gameState.coins());
            this.isAirborne.set(telem.isAirborne);
          });
        }
      }

      // Render to HTML5 Canvas
      this.renderer.render(this.engine);

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  private stopGameLoop() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  // --- Controls Handling ---

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    if (event.repeat) return;

    if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D' || event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') {
      this.pressGas();
    } else if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A' || event.key === 'ArrowDown' || event.key === 's' || event.key === 'S' || event.code === 'Space') {
      this.pressBrake();
    } else if (event.key === 'p' || event.key === 'P') {
      this.togglePause();
    } else if (event.key === 'r' || event.key === 'R') {
      this.restartGame();
    }
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent) {
    if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D' || event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') {
      this.releaseGas();
    } else if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A' || event.key === 'ArrowDown' || event.key === 's' || event.key === 'S' || event.code === 'Space') {
      this.releaseBrake();
    }
  }

  pressGas() {
    if (this.isGameOver() || this.isPaused()) return;
    this.engine.isGas = true;
    this.gasActive.set(true);
  }

  releaseGas() {
    this.engine.isGas = false;
    this.gasActive.set(false);
  }

  pressBrake() {
    if (this.isGameOver() || this.isPaused()) return;
    this.engine.isBrake = true;
    this.brakeActive.set(true);
  }

  releaseBrake() {
    this.engine.isBrake = false;
    this.brakeActive.set(false);
  }

  togglePause() {
    if (this.isGameOver()) return;
    this.audio.playClickSound();
    const next = !this.isPaused();
    this.isPaused.set(next);
    if (next) {
      this.audio.stopEngine();
    } else {
      this.audio.startEngine();
    }
  }

  toggleSound() {
    const enabled = this.gameState.toggleSound();
    this.audio.setMuted(!enabled);
    if (enabled && !this.isGameOver() && !this.isPaused()) {
      this.audio.startEngine();
    }
  }

  openGarage() {
    this.audio.playClickSound();
    this.isGarageOpen.set(true);
    if (!this.isPaused()) {
      this.isPaused.set(true);
      this.audio.stopEngine();
    }
  }

  closeGarage() {
    this.audio.playClickSound();
    this.isGarageOpen.set(false);
    this.isPaused.set(false);
    this.audio.startEngine();
  }

  upgradePart(type: keyof VehicleUpgrades) {
    const success = this.gameState.upgrade(type);
    if (success) {
      this.audio.playCoinSound();
      // Apply immediately to engine
      this.engine.upgrades = this.gameState.upgrades();
      // Update suspension constraints
      const suspLvl = this.engine.upgrades.suspension;
      const k = 0.14 + (suspLvl - 1) * 0.015;
      const d = 0.16 + (suspLvl - 1) * 0.02;
      this.engine.rearSuspension.stiffness = k;
      this.engine.rearSuspension.damping = d;
      this.engine.frontSuspension.stiffness = k;
      this.engine.frontSuspension.damping = d;

      // Update tire friction
      const tireLvl = this.engine.upgrades.tires;
      const f = 0.9 + (tireLvl - 1) * 0.13;
      this.engine.rearWheel.friction = f;
      this.engine.frontWheel.friction = f;
    }
  }

  restartGame() {
    this.audio.playClickSound();
    this.isGameOver.set(false);
    this.gameOverReason.set('');
    this.isPaused.set(false);
    this.activeStunt.set(null);
    this.gameState.resetSession();

    this.engine.reset(this.gameState.upgrades());
    this.audio.startEngine();
  }
}
