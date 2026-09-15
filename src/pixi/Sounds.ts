/**
 * Sounds — PixiJS-synchronised audio events for the slot machine.
 * Wraps the existing Web Audio engine (src/utils/audio.ts) and adds
 * event-driven hooks so PixiJS animations can fire sounds at exact frames.
 *
 * All sounds are procedurally generated — no external files required.
 */
import {
  playSpinSound,
  playReelStop,
  playWinSound,
  playFreeSpinsTrigger,
} from '../utils/audio';

type SoundEvent =
  | 'spin_start'
  | 'reel_stop'
  | 'small_win'
  | 'big_win'
  | 'jackpot'
  | 'free_spins_trigger'
  | 'scatter_land';

let _enabled = true;

/** Enable or disable all sounds (mirrors gameStore.soundEnabled) */
export function setSoundEnabled(enabled: boolean) {
  _enabled = enabled;
}

/**
 * Fire a named sound event.
 * Safe to call even when sound is disabled — it will no-op.
 */
export function playEvent(event: SoundEvent, delayMs = 0) {
  if (!_enabled) return;

  switch (event) {
    case 'spin_start':
      playSpinSound();
      break;

    case 'reel_stop':
      playReelStop(delayMs);
      break;

    case 'small_win':
      if (delayMs > 0) setTimeout(() => playWinSound(false), delayMs);
      else playWinSound(false);
      break;

    case 'big_win':
      if (delayMs > 0) setTimeout(() => playWinSound(true), delayMs);
      else playWinSound(true);
      break;

    case 'jackpot':
      // Layered jackpot sequence: big win fanfare + short delay for second hit
      if (delayMs > 0) {
        setTimeout(() => {
          playWinSound(true);
          setTimeout(() => playWinSound(true), 400);
        }, delayMs);
      } else {
        playWinSound(true);
        setTimeout(() => playWinSound(true), 400);
      }
      break;

    case 'free_spins_trigger':
      if (delayMs > 0) setTimeout(() => playFreeSpinsTrigger(), delayMs);
      else playFreeSpinsTrigger();
      break;

    case 'scatter_land':
      // Short rising tick for scatter appearance
      playReelStop(delayMs);
      break;
  }
}

/**
 * Called at spin start — fires spin sound and pre-schedules reel stop clicks.
 * @param turbo Whether turbo mode is active (affects timing)
 */
export function onSpinStart(turbo: boolean) {
  if (!_enabled) return;
  playEvent('spin_start');

  const stopBaseDelay = turbo ? 300 : 1200;
  const stopGap       = turbo ? 120 : 300;
  for (let c = 0; c < 5; c++) {
    playEvent('reel_stop', stopBaseDelay + c * stopGap);
  }
}

/**
 * Called when all reels have stopped.
 * @param winCount Number of winning paylines
 * @param isJackpot True if jackpot was triggered
 * @param isBigWin True if win >= 10× bet
 * @param triggerFreeSpins True if free spins were triggered
 */
export function onSpinComplete(
  winCount: number,
  isJackpot: boolean,
  isBigWin: boolean,
  triggerFreeSpins: boolean,
) {
  if (!_enabled) return;

  if (isJackpot) {
    playEvent('jackpot');
  } else if (isBigWin) {
    playEvent('big_win');
  } else if (winCount > 0) {
    playEvent('small_win');
  }

  if (triggerFreeSpins) {
    playEvent('free_spins_trigger', 600);
  }
}
