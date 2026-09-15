/**
 * AnimationManager — coordinates the full spin animation lifecycle.
 *
 * Sequence:
 *  1. Start all reels spinning (staggered by column)
 *  2. Stop reels sequentially with per-reel callbacks
 *  3. Apply win effects after all reels stop
 *  4. Fire completion callback
 *
 * This module owns timing only — no business logic.
 */
import type { ReelContainer } from './ReelContainer';
import type { WinEffects } from './WinEffects';
import type { SymbolId } from '../config/symbols';
import type { WinResult } from '../logic/paylines';

const COLS = 5;

export interface SpinRequest {
  turbo: boolean;
  finalReels: SymbolId[][];
  winResults: WinResult[];
  isJackpot: boolean;
  isBigWin: boolean;
  onReelStop: (col: number) => void;
  onAllStop: () => void;
}

export class AnimationManager {
  private reelContainer: ReelContainer;
  private winEffects: WinEffects;

  constructor(reelContainer: ReelContainer, winEffects: WinEffects) {
    this.reelContainer = reelContainer;
    this.winEffects    = winEffects;
  }

  /** Kick off a full spin animation cycle */
  spin(req: SpinRequest) {
    const { turbo, finalReels, winResults, isJackpot, isBigWin, onReelStop, onAllStop } = req;
    const reels = this.reelContainer.getReels();

    // Clear previous win state immediately
    this.winEffects.clear();

    // Timing constants
    const spinStartGap  = turbo ?  60 : 200;   // ms between reel spin starts
    const stopBaseDelay = turbo ? 300 : 1200;   // ms before first reel stops
    const stopGap       = turbo ? 120 : 300;    // ms between sequential reel stops

    let stoppedCount = 0;

    for (let c = 0; c < COLS; c++) {
      // Stagger spin start per column
      reels[c].spin(turbo, c * spinStartGap);

      // Schedule the stop signal for this reel
      const stopDelay = stopBaseDelay + c * stopGap;
      setTimeout(() => {
        reels[c].stopAt(finalReels[c] ?? [], () => {
          onReelStop(c);
          stoppedCount++;

          if (stoppedCount === COLS) {
            // All reels stopped — show win effects then fire callback
            if (winResults.length > 0) {
              this.winEffects.showWins(winResults, isJackpot, isBigWin);
            }
            onAllStop();
          }
        });
      }, stopDelay);
    }
  }

  /** Immediately reset all animations (e.g. on unmount) */
  reset() {
    this.winEffects.clear();
  }
}
