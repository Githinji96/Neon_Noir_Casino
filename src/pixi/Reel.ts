/**
 * Reel — single vertical reel strip with realistic casino physics.
 * Symbols are Graphics+Text (no textures) so they render from frame 1.
 *
 * Strip layout:
 *   indices 0 .. STRIP_EXTRA-1          ← above-window padding
 *   indices STRIP_EXTRA .. STRIP_EXTRA+ROWS-1  ← VISIBLE rows
 *   indices STRIP_EXTRA+ROWS .. end     ← below-window padding
 *
 *   strip.y resting position = -STRIP_EXTRA * CELL_SIZE
 *   → visible symbols sit exactly inside the mask (y=0 .. ROWS*CELL_SIZE)
 */
import { Container, Graphics, Ticker, type TickerCallback } from 'pixi.js';
import { SlotSymbol, CELL_SIZE } from './Symbol';
import type { SymbolId } from '../config/symbols';

const STRIP_EXTRA  = 2;           // padding rows above and below visible area
const ROWS         = 3;           // visible rows
const STRIP_LENGTH = ROWS + STRIP_EXTRA * 2;   // total symbols in strip = 7
const REST_Y       = -STRIP_EXTRA * CELL_SIZE; // strip.y when at rest

type ReelState = 'idle' | 'accelerating' | 'spinning' | 'decelerating' | 'bouncing';

export class Reel extends Container {
  private strip:    Container;
  private symbols:  SlotSymbol[] = [];
  private maskRect: Graphics;
  private _gameId:  string;

  private state:     ReelState = 'idle';
  private velocity   = 0;
  private _onStop:   (() => void) | null = null;
  private _tickerFn: TickerCallback<unknown> | null = null;
  private _turbo     = false;
  private _finalSyms: SymbolId[] = [];
  private _pendingStop = false;

  readonly colIndex: number;

  constructor(gameId: string, initialSymbols: SymbolId[], colIndex: number) {
    super();
    this._gameId  = gameId;
    this.colIndex = colIndex;

    // Clipping mask — exactly covers the 3 visible rows
    this.maskRect = new Graphics()
      .rect(0, 0, CELL_SIZE, ROWS * CELL_SIZE)
      .fill({ color: 0xffffff });
    this.addChild(this.maskRect);

    // Strip — scrolls up during spin, masked to 3 rows
    this.strip = new Container();
    this.strip.mask = this.maskRect;
    this.addChild(this.strip);

    // Populate strip: symbol positions are 0, CELL_SIZE, 2*CELL_SIZE, ...
    const placeholder = initialSymbols[0] ?? ('wild' as SymbolId);
    for (let i = 0; i < STRIP_LENGTH; i++) {
      const sym = new SlotSymbol(gameId, placeholder);
      sym.x = 0;
      sym.y = i * CELL_SIZE;
      this.strip.addChild(sym);
      this.symbols.push(sym);
    }

    // Place strip so visible rows (STRIP_EXTRA..STRIP_EXTRA+ROWS-1) show through mask
    this.strip.y = REST_Y;

    // Immediately show correct idle symbols
    this._applySymbols(initialSymbols);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  spin(turbo: boolean, delayMs: number): void {
    this._turbo = turbo;
    if (delayMs > 0) {
      setTimeout(() => this._beginSpin(), delayMs);
    } else {
      this._beginSpin();
    }
  }

  stopAt(finalSymbols: SymbolId[], onStop: () => void): void {
    this._onStop    = onStop;
    this._finalSyms = finalSymbols;
    if (this.state === 'spinning') {
      this.state = 'decelerating';
    } else {
      // Not yet fully spinning — flag for decel once speed is reached
      this._pendingStop = true;
    }
  }

  setSymbols(gameId: string, symbols: SymbolId[]): void {
    this._gameId = gameId;
    this._applySymbols(symbols);
  }

  applyWinState(winningRows: number[], isSpinning: boolean): void {
    for (let row = 0; row < ROWS; row++) {
      const sym = this.symbols[row + STRIP_EXTRA];
      if (!sym) continue;
      sym.stopAllAnimations();
      if (isSpinning) {
        sym.filters = [];
      } else if (winningRows.includes(row)) {
        sym.startWinAnimation();
      } else if (winningRows.length > 0) {
        sym.dim();
      }
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _beginSpin(): void {
    if (this.state !== 'idle') return;
    this.state    = 'accelerating';
    this.velocity = 0;

    const maxSpeed  = this._turbo ? 55 : 28;
    const accel     = this._turbo ? 16 : 7;
    const decel     = this._turbo ? 20 : 9;

    const fn: TickerCallback<unknown> = (ticker) => {
      const dt = ticker.deltaTime;

      // ── Accelerate ─────────────────────────────────────────────────────────
      if (this.state === 'accelerating') {
        this.velocity = Math.min(this.velocity + accel * dt, maxSpeed);
        if (this.velocity >= maxSpeed * 0.95) this.state = 'spinning';
      }

      // ── Check for pending stop ─────────────────────────────────────────────
      if (this.state === 'spinning' && this._pendingStop) {
        this._pendingStop = false;
        this.state = 'decelerating';
      }

      // ── Decelerate ─────────────────────────────────────────────────────────
      if (this.state === 'decelerating') {
        this.velocity = Math.max(this.velocity - decel * dt, 0);
        if (this.velocity <= 0) {
          this.state = 'bouncing';
          this._removeTicker();
          this._snapToFinal();
          return;
        }
      }

      // ── Scroll strip ───────────────────────────────────────────────────────
      if (this.state === 'accelerating' || this.state === 'spinning' || this.state === 'decelerating') {
        this.strip.y -= this.velocity * dt;
        this._wrapStrip();
      }
    };

    this._tickerFn = fn;
    Ticker.shared.add(fn);
  }

  private _removeTicker(): void {
    if (this._tickerFn) {
      Ticker.shared.remove(this._tickerFn);
      this._tickerFn = null;
    }
  }

  private _snapToFinal(): void {
    this._applySymbols(this._finalSyms);
    this.strip.y = REST_Y;

    const bounce = this._turbo ? 5 : 12;
    let t = 0;

    const bounceFn: TickerCallback<unknown> = (ticker) => {
      t += 0.22 * ticker.deltaTime;
      this.strip.y = REST_Y + Math.sin(t * Math.PI) * bounce * Math.max(0, 1 - t);
      if (t >= 1) {
        this.strip.y = REST_Y;
        Ticker.shared.remove(bounceFn);
        this._finish();
      }
    };
    Ticker.shared.add(bounceFn);
  }

  private _finish(): void {
    this.state    = 'idle';
    this.velocity = 0;
    this.strip.y  = REST_Y;
    this._onStop?.();
    this._onStop = null;
  }

  private _wrapStrip(): void {
    // Wrap when the entire strip has scrolled past (prevents y from growing unboundedly)
    const totalH = STRIP_LENGTH * CELL_SIZE;
    if (this.strip.y < REST_Y - totalH) {
      this.strip.y += totalH;
    }
  }

  /**
   * Assign symbols to the strip.
   * Visible slots (STRIP_EXTRA .. STRIP_EXTRA+ROWS-1) get the provided symbols.
   * Padding slots above/below get random picks from visible for seamless loop.
   */
  private _applySymbols(visible: SymbolId[]): void {
    if (!visible.length) return;
    const pad = Array.from({ length: STRIP_EXTRA }, () =>
      visible[Math.floor(Math.random() * visible.length)]
    );
    const all = [...pad, ...visible.slice(0, ROWS), ...pad];

    for (let i = 0; i < Math.min(all.length, this.symbols.length); i++) {
      this.symbols[i].setSymbol(this._gameId, all[i] ?? visible[0]);
    }
  }

  destroy(options?: Parameters<Container['destroy']>[0]): void {
    this._removeTicker();
    super.destroy(options);
  }
}
