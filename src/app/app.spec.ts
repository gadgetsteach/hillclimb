import { TestBed, ComponentFixture } from '@angular/core/testing';
import { App } from './app';
import { GameStateService } from './services/game-state.service';
import { AudioService } from './services/audio.service';

describe('App Component', () => {
  let fixture: ComponentFixture<App>;
  let app: App;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [GameStateService, AudioService]
    }).compileComponents();

    fixture = TestBed.createComponent(App);
    app = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create the app component and initialize signals', () => {
    expect(app).toBeTruthy();
    expect(app.isRunning()).toBe(true);
    expect(app.isPaused()).toBe(false);
    expect(app.isGameOver()).toBe(false);
    expect(app.distance()).toBe(0);
    expect(app.fuel()).toBe(100);
  });

  it('should activate gas and dismiss tutorial banner on pressGas()', () => {
    expect(app.showTutorialBanner()).toBe(true);
    app.pressGas();
    expect(app.gasActive()).toBe(true);
    expect(app.showTutorialBanner()).toBe(false);

    app.releaseGas();
    expect(app.gasActive()).toBe(false);
  });

  it('should activate brake on pressBrake() and deactivate on releaseBrake()', () => {
    app.pressBrake();
    expect(app.brakeActive()).toBe(true);

    app.releaseBrake();
    expect(app.brakeActive()).toBe(false);
  });

  it('should toggle pause state', () => {
    expect(app.isPaused()).toBe(false);
    app.togglePause();
    expect(app.isPaused()).toBe(true);

    app.togglePause();
    expect(app.isPaused()).toBe(false);
  });

  it('should open and close the garage modal', () => {
    expect(app.isGarageOpen()).toBe(false);
    app.openGarage();
    expect(app.isGarageOpen()).toBe(true);
    expect(app.isPaused()).toBe(true);

    app.closeGarage();
    expect(app.isGarageOpen()).toBe(false);
    expect(app.isPaused()).toBe(false);
  });

  it('should open and close the help controls modal', () => {
    expect(app.isHelpOpen()).toBe(false);
    app.openHelp();
    expect(app.isHelpOpen()).toBe(true);
    expect(app.isPaused()).toBe(true);

    app.closeHelp();
    expect(app.isHelpOpen()).toBe(false);
    expect(app.isPaused()).toBe(false);
  });

  it('should handle keyboard keydown and keyup events', () => {
    // Gas keydown
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(app.gasActive()).toBe(true);

    // Gas keyup
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight' }));
    expect(app.gasActive()).toBe(false);

    // Brake keydown
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(app.brakeActive()).toBe(true);

    // Brake keyup
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft' }));
    expect(app.brakeActive()).toBe(false);

    // Pause toggle
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' }));
    expect(app.isPaused()).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' }));
    expect(app.isPaused()).toBe(false);

    // Help toggle
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h' }));
    expect(app.isHelpOpen()).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h' }));
    expect(app.isHelpOpen()).toBe(false);
  });

  it('should restart game run and reset states', () => {
    app.distance.set(500);
    app.isGameOver.set(true);
    app.gameOverReason.set('crashed');

    app.restartGame();

    expect(app.isGameOver()).toBe(false);
    expect(app.gameOverReason()).toBe('');
    expect(app.distance()).toBe(0);
  });
});
