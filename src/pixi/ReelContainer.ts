/**
 * ReelContainer — manages the 5-reel grid layout within the PixiJS stage.
 * Handles layout math, background panel, column separators, and
 * the overall container transform/scale for responsive resizing.
 */
import { Container, Graphics } from 'pixi.js';
import { Reel } from './Reel';
import { CELL_SIZE } from './Symbol';
import { resolveGameId } from './AssetLoader';
import { getSymbolsForGame } from '../config/symbols';
import type { SymbolId } from '../config/symbols';

const COLS = 5;
const ROWS = 3;
const GAP  = 8;

/** Total logical pixel dimensions of the reel area */
export const REEL_AREA_W = COLS * CELL_SIZE + (COLS - 1) * GAP;
export const REEL_AREA_H = ROWS * CELL_SIZE;

export class ReelContainer extends Container {
  private reels: Reel[] = [];

  constructor(gameId: string) {
    super();
    this._buildPanel();
    this._buildReels(gameId);
  }

  /** Responsive scale: fit inside (w × h) while preserving aspect ratio */
  fitInto(w: number, h: number) {
    const padding = 24;
    const scale = Math.min(
      w / (REEL_AREA_W + padding),
      h / (REEL_AREA_H + padding),
      2.0,
    );
    this.scale.set(scale);
    this.x = Math.round((w - REEL_AREA_W * scale) / 2);
    this.y = Math.round((h - REEL_AREA_H * scale) / 2);
  }

  getReels(): Reel[] {
    return this.reels;
  }

  /** Update all reels to idle symbols for a given game */
  setIdleSymbols(gameId: string, symbols: SymbolId[][]) {
    for (let c = 0; c < COLS; c++) {
      this.reels[c]?.setSymbols(gameId, symbols[c] ?? []);
    }
  }

  /** Rebuild reels for a new game theme */
  async changeGame(gameId: string, symbols: SymbolId[][]) {
    for (let c = 0; c < COLS; c++) {
      this.reels[c]?.setSymbols(gameId, symbols[c] ?? []);
    }
  }

  /** Centre X of reel column `col` in stage space */
  reelCentreX(col: number): number {
    return (col * (CELL_SIZE + GAP) + CELL_SIZE / 2) * this.scale.x + this.x;
  }

  /** Centre Y of the reel grid in stage space */
  reelCentreY(): number {
    return (REEL_AREA_H / 2) * this.scale.y + this.y;
  }

  private _buildPanel() {
    const panel = new Graphics()
      .roundRect(-14, -14, REEL_AREA_W + 28, REEL_AREA_H + 28, 18)
      .fill({ color: 0x080810 })
      .stroke({ color: 0x2a2a3a, width: 1.5 });
    this.addChild(panel);

    // Neon top edge accent
    const accent = new Graphics()
      .rect(-14, -14, REEL_AREA_W + 28, 3)
      .fill({ color: 0xffd700, alpha: 0.6 });
    this.addChild(accent);

    // Column separators (subtle neon lines between reels)
    for (let c = 1; c < COLS; c++) {
      const sx = c * (CELL_SIZE + GAP) - GAP / 2;
      const sep = new Graphics()
        .rect(sx - 0.75, -8, 1.5, REEL_AREA_H + 16)
        .fill({ color: 0x333355, alpha: 0.5 });
      this.addChild(sep);
    }
  }

  private _buildReels(gameId: string) {
    // Use the first symbol of the resolved game as the default idle symbol
    const resolved    = resolveGameId(gameId);
    const syms        = getSymbolsForGame(resolved);
    const firstSymId  = (syms[0]?.id ?? 'cherry') as SymbolId;
    const defaultSyms = Array(ROWS).fill(firstSymId) as SymbolId[];

    for (let c = 0; c < COLS; c++) {
      const reel = new Reel(gameId, defaultSyms, c);
      reel.x = c * (CELL_SIZE + GAP);
      reel.y = 0;
      this.addChild(reel);
      this.reels.push(reel);
    }
  }
}
