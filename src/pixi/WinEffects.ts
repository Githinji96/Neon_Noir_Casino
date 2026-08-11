/**
 * WinEffects — GPU-accelerated win animations for the PixiJS slot machine.
 * Draws animated payline overlays and coordinates per-symbol win states
 * across the reel grid. Delegates particle bursts to ParticleManager.
 */
import { Container, Graphics, Ticker, type TickerCallback } from 'pixi.js';
import type { WinResult } from '../logic/paylines';
import { CELL_SIZE } from './Symbol';
import { ParticleManager } from './ParticleManager';
import type { ReelContainer } from './ReelContainer';

const COLS = 5;
const GAP  = 8;

interface PaylineOverlay {
  gfx: Graphics;
  color: number;
}

export class WinEffects extends Container {
  private overlays: PaylineOverlay[] = [];
  private particles: ParticleManager;
  private reelContainer: ReelContainer;
  private _tickerFn: TickerCallback<unknown> | null = null;
  private _t = 0;

  // Neon payline colours — one per payline index, cycling if needed
  private static readonly PAYLINE_COLORS = [
    0xffd700, // gold
    0x00ffff, // cyan
    0xff00ff, // magenta
    0x00ff88, // neon green
    0xff6600, // orange
    0xaa00ff, // purple
    0xff3366, // pink
    0x00aaff, // sky blue
    0xffff00, // yellow
    0xff9900, // amber
  ];

  constructor(reelContainer: ReelContainer, particles: ParticleManager) {
    super();
    this.reelContainer = reelContainer;
    this.particles = particles;
  }

  /**
   * Show win effects: payline traces + symbol animations + particles.
   * isJackpot / isBigWin control particle intensity.
   */
  showWins(wins: WinResult[], isJackpot: boolean, isBigWin: boolean) {
    this.clear();
    if (wins.length === 0) return;

    // Per-column winning rows for symbol animations
    const winRowsPerCol: number[][] = Array.from({ length: COLS }, () => []);
    for (const win of wins) {
      for (const [col, row] of win.cells) {
        if (!winRowsPerCol[col].includes(row)) winRowsPerCol[col].push(row);
      }
    }

    const reels = this.reelContainer.getReels();
    for (let c = 0; c < COLS; c++) {
      reels[c].applyWinState(winRowsPerCol[c], false);
    }

    // Draw payline traces
    wins.forEach((win) => {
      const color = WinEffects.PAYLINE_COLORS[win.paylineIndex % WinEffects.PAYLINE_COLORS.length];
      this._drawPayline(win, color);
    });

    // Start pulsing animation for overlay lines
    this._startOverlayPulse();

    // Particle effects based on win magnitude
    const cx = this.reelContainer.reelCentreX(Math.floor(COLS / 2));
    const cy = this.reelContainer.reelCentreY();
    if (isJackpot) {
      this.particles.jackpotBurst(cx, cy);
    } else if (isBigWin) {
      this.particles.burstCoins(cx, cy, 50);
      this.particles.sparkRing(cx, cy, 60, 24);
    } else if (wins.length >= 2) {
      this.particles.burstCoins(cx, cy, 25);
    } else {
      this.particles.burstCoins(cx, cy, 12);
    }
  }

  /** Reset all win animations — call before a new spin */
  clear() {
    this._stopOverlayPulse();
    for (const o of this.overlays) o.gfx.destroy();
    this.overlays = [];
    this.particles.clear();
    const reels = this.reelContainer.getReels();
    for (const reel of reels) reel.applyWinState([], true);
  }

  private _drawPayline(win: WinResult, color: number) {
    const gfx = new Graphics();
    this.addChild(gfx);

    // Build polyline through cell centres
    const pts: { x: number; y: number }[] = win.cells.map(([col, row]) => {
      // Position in stage space relative to this container's parent (app.stage)
      const lx = col * (CELL_SIZE + GAP) + CELL_SIZE / 2;
      const ly = row * CELL_SIZE + CELL_SIZE / 2;
      // Transform into our container's local space (we're added to app.stage directly)
      return {
        x: lx * this.reelContainer.scale.x + this.reelContainer.x,
        y: ly * this.reelContainer.scale.y + this.reelContainer.y,
      };
    });

    if (pts.length < 2) return;

    // Draw glow line (thick, semi-transparent)
    gfx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) gfx.lineTo(pts[i].x, pts[i].y);
    gfx.stroke({ color, width: 4, alpha: 0.35 });

    // Draw core line (thin, opaque)
    gfx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) gfx.lineTo(pts[i].x, pts[i].y);
    gfx.stroke({ color, width: 1.5, alpha: 0.9 });

    // Cell highlight dots at each winning cell
    for (const pt of pts) {
      gfx.circle(pt.x, pt.y, 5).fill({ color, alpha: 0.8 });
    }

    this.overlays.push({ gfx, color });
  }

  private _startOverlayPulse() {
    if (this._tickerFn) return;
    this._t = 0;
    const fn: TickerCallback<unknown> = (ticker) => {
      this._t += 0.05 * ticker.deltaTime;
      const alpha = 0.4 + Math.sin(this._t * 2) * 0.35;
      for (const o of this.overlays) o.gfx.alpha = alpha;
    };
    this._tickerFn = fn;
    Ticker.shared.add(fn);
  }

  private _stopOverlayPulse() {
    if (this._tickerFn) {
      Ticker.shared.remove(this._tickerFn);
      this._tickerFn = null;
    }
    for (const o of this.overlays) o.gfx.alpha = 1;
  }

  destroy(options?: any) {
    this._stopOverlayPulse();
    for (const o of this.overlays) o.gfx.destroy();
    this.overlays = [];
    super.destroy(options);
  }
}
