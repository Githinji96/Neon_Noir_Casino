/**
 * SlotSymbol — a single slot symbol cell backed by an atlas Sprite.
 *
 * Textures are pre-built in AssetLoader and GPU-uploaded before any
 * SlotSymbol is created, so sprites show from frame 1 without lazy-upload blanks.
 */
import { Container, Sprite, Graphics, Ticker, type TickerCallback } from 'pixi.js';
import { CELL_SIZE, getSymbolTexture } from './AssetLoader';
import { createDimFilter } from './Filters';
import type { SymbolId } from '../config/symbols';

// Re-export so Reel.ts / ReelContainer.ts can import CELL_SIZE from one place
export { CELL_SIZE };

export class SlotSymbol extends Container {
  private sprite:      Sprite;
  private glowBorder:  Graphics;
  private _pulseTicker: TickerCallback<unknown> | null = null;

  constructor(gameId: string, symbolId: SymbolId | string) {
    super();

    // The atlas texture is already GPU-resident — Sprite shows immediately
    this.sprite = new Sprite(getSymbolTexture(gameId, symbolId));
    this.sprite.width  = CELL_SIZE;
    this.sprite.height = CELL_SIZE;
    this.addChild(this.sprite);

    // Glow border (hidden at rest, shown on win)
    this.glowBorder = new Graphics();
    this.glowBorder.alpha = 0;
    this.addChild(this.glowBorder);
  }

  setSymbol(gameId: string, symbolId: SymbolId | string): void {
    this.sprite.texture = getSymbolTexture(gameId, symbolId);
    this.stopAllAnimations();
    this.alpha  = 1;
    this.scale.set(1);
    this.pivot.set(0);
    this.x = 0;
    this.y = 0;
    this.filters = [];
    this.glowBorder.clear();
    this.glowBorder.alpha = 0;
  }

  dim(): void {
    this.filters = [createDimFilter(0.3)];
  }

  startWinAnimation(): void {
    this.stopAllAnimations();
    this.filters = [];
    this._drawGlow(0xffd700);
    this.glowBorder.alpha = 1;

    this.pivot.set(CELL_SIZE / 2);
    this.x = CELL_SIZE / 2;
    this.y = CELL_SIZE / 2;

    let t = 0;
    const fn: TickerCallback<unknown> = (ticker) => {
      t += 0.07 * ticker.deltaTime;
      this.scale.set(1 + Math.sin(t) * 0.09);
      this.glowBorder.alpha = 0.55 + Math.sin(t * 1.6) * 0.45;
    };
    this._pulseTicker = fn;
    Ticker.shared.add(fn);
  }

  stopAllAnimations(): void {
    if (this._pulseTicker) {
      Ticker.shared.remove(this._pulseTicker);
      this._pulseTicker = null;
    }
    this.scale.set(1);
    this.pivot.set(0);
    this.x = 0;
    this.y = 0;
    this.glowBorder.alpha = 0;
  }

  private _drawGlow(color: number): void {
    this.glowBorder.clear();
    this.glowBorder
      .roundRect(2, 2, CELL_SIZE - 4, CELL_SIZE - 4, 10)
      .stroke({ color, width: 3, alpha: 1 });
  }

  destroy(options?: Parameters<Container['destroy']>[0]): void {
    this.stopAllAnimations();
    super.destroy(options);
  }
}
