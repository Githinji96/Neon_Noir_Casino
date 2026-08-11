/**
 * Filters — PixiJS v8 filter factory matching the Neon Noir cyberpunk theme.
 * Uses only pixi.js v8 built-in filters (BlurFilter, ColorMatrixFilter).
 * The @pixi/filter-glow and @pixi/filter-drop-shadow packages in package.json
 * are v5/v7 and are NOT compatible with pixi.js v8 — they are intentionally
 * unused here to avoid runtime errors.
 */
import { BlurFilter, ColorMatrixFilter, type Filter } from 'pixi.js';

/**
 * Simulated neon glow — applies a strong blur that creates a glow halo.
 * In PixiJS v8, true GlowFilter requires pixi-filters v6+ (not yet installed).
 * This blur-based approach is GPU-accelerated and visually effective.
 */
export function createGlowFilter(strength = 8): Filter {
  return new BlurFilter({ strength: strength * 0.6, quality: 4 }) as unknown as Filter;
}

/** Motion blur for spinning reels — vertical axis blur */
export function createMotionBlur(strength = 12): BlurFilter {
  return new BlurFilter({ strength, quality: 2 });
}

/** Dim filter for non-winning symbols (darkens by reducing brightness) */
export function createDimFilter(brightness = 0.35): ColorMatrixFilter {
  const f = new ColorMatrixFilter();
  f.brightness(brightness, false);
  return f;
}

/** Win flash — bright saturated pulse for winning symbols */
export function createFlashFilter(): ColorMatrixFilter {
  const f = new ColorMatrixFilter();
  f.brightness(1.8, false);
  f.saturate(0.6, false);
  return f;
}

/** Gold tint — applied to jackpot symbols */
export function createGoldTintFilter(): ColorMatrixFilter {
  const f = new ColorMatrixFilter();
  f.tint(0xffd700, false);
  return f;
}

/** Neon cyan tint — applied to scatter/bonus symbols */
export function createCyanTintFilter(): ColorMatrixFilter {
  const f = new ColorMatrixFilter();
  f.tint(0x00ffff, false);
  return f;
}
