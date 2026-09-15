/**
 * SlotMachine — main PixiJS orchestrator.
 * Delegates layout to ReelContainer, win visuals to WinEffects,
 * animation sequencing to AnimationManager, and particles to ParticleManager.
 * All game logic stays in gameStore — this is rendering only.
 */
import { Application } from 'pixi.js';
import { ReelContainer } from './ReelContainer';
import { ParticleManager } from './ParticleManager';
import { WinEffects } from './WinEffects';
import { AnimationManager } from './AnimationManager';
import { loadGameAssets, clearCache } from './AssetLoader';
import type { SymbolId } from '../config/symbols';
import type { WinResult } from '../logic/paylines';

export interface SpinConfig {
  turbo: boolean;
  finalReels: SymbolId[][];   // [col][row]
  winResults: WinResult[];
  isJackpot: boolean;
  isBigWin: boolean;
  onReelStop: (col: number) => void;
  onAllStop: () => void;
}

export class SlotMachineRenderer {
  readonly app: Application;
  private reelContainer!: ReelContainer;
  private particles!: ParticleManager;
  private winEffects!: WinEffects;
  private animManager!: AnimationManager;
  private _initialised = false;

  private _gameId = 'cyber-strike-777';

  constructor() {
    this.app = new Application();
  }

  async init(canvas: HTMLCanvasElement, gameId: string) {
    this._gameId = gameId;
    await this.app.init({
      canvas,
      backgroundColor: 0x050505,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    // Assets need the renderer — load synchronously now that app.init is done
    loadGameAssets(this.app.renderer, gameId);

    // Build scene graph — textures are in cache from the line above
    this.reelContainer = new ReelContainer(gameId);
    this.particles     = new ParticleManager();
    this.winEffects    = new WinEffects(this.reelContainer, this.particles);
    this.animManager   = new AnimationManager(this.reelContainer, this.winEffects);

    this.app.stage.addChild(this.reelContainer);
    this.app.stage.addChild(this.winEffects);
    this.app.stage.addChild(this.particles);

    // Initial size
    const parent = canvas.parentElement;
    const w = (parent && parent.clientWidth  > 0) ? parent.clientWidth  : 500;
    const h = (parent && parent.clientHeight > 0) ? parent.clientHeight : 280;
    this.app.renderer.resize(w, h);
    this.reelContainer.fitInto(w, h);

    this._initialised = true;
  }

  resize(w: number, h: number) {
    if (!this._initialised) return;
    this.app.renderer.resize(w, h);
    this.reelContainer.fitInto(w, h);
  }

  async changeGame(gameId: string, initialSymbols: SymbolId[][]) {
    if (!this._initialised) return;
    this._gameId = gameId;
    loadGameAssets(this.app.renderer, gameId);
    await this.reelContainer.changeGame(gameId, initialSymbols);
  }

  setIdleSymbols(symbols: SymbolId[][], gameId?: string) {
    if (!this._initialised) return;
    this.winEffects.clear();
    this.reelContainer.setIdleSymbols(gameId ?? this._gameId, symbols);
  }

  spin(config: SpinConfig) {
    if (!this._initialised) return;
    this.animManager.spin({
      turbo:       config.turbo,
      finalReels:  config.finalReels,
      winResults:  config.winResults,
      isJackpot:   config.isJackpot,
      isBigWin:    config.isBigWin,
      onReelStop:  config.onReelStop,
      onAllStop:   config.onAllStop,
    });
  }

  destroy() {
    if (!this._initialised) return;
    this.animManager.reset();
    this.particles.destroy();
    clearCache();
    this.app.destroy(true, { children: true });
    this._initialised = false;
  }
}
