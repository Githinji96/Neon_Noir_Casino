/**
 * AssetLoader — builds a per-game symbol texture atlas synchronously.
 *
 * HOW IT WORKS
 * ─────────────
 * 1. Draw every symbol emoji onto an off-screen Canvas 2D context.
 * 2. Call Texture.from() on that canvas AFTER the PixiJS Application has
 *    been initialised (so a WebGL context exists).
 * 3. Force an immediate GPU upload by calling renderer.prepare.upload().
 *    This eliminates the "lazy upload on first render" blank-frame that
 *    plagued every previous approach.
 * 4. Slice individual symbol textures from the atlas via Texture.from() +
 *    Rectangle frame — one draw-call per atlas instead of one per symbol.
 *
 * No async, no RenderTexture blit, no timing races.
 */
import { Texture, Rectangle } from 'pixi.js';
import type { Renderer } from 'pixi.js';
import { getSymbolsForGame, GAME_SYMBOLS } from '../config/symbols';

export const CELL_SIZE = 72;   // must match Symbol.ts CELL_SIZE
const COLS_PER_ROW = 5;        // symbols per row in atlas

/** Maps unregistered game IDs → nearest registered symbol set */
export const GAME_ALIAS: Record<string, string> = {
  'solar-flare':    'electric-storm',
  'crystal-grid':   'quantum-vault',
  'midnight-heist': 'dark-matter-reels',
  'ocean-depths':   'neon-jungle-fruits',
  'dragon-forge':   'neon-samurai',
};

export function resolveGameId(gameId: string): string {
  return GAME_ALIAS[gameId] ?? gameId;
}

// Per-symbol texture cache keyed by "gameId:symbolId"
const _texCache = new Map<string, Texture>();
// Per-game atlas canvas (kept alive so WebGL texture stays valid)
const _atlasCache = new Map<string, HTMLCanvasElement>();

/**
 * Pre-build all symbol textures for a game and force GPU upload.
 * Call after app.init() but before building any Reel/Symbol objects.
 */
export function loadGameAssets(renderer: Renderer, gameId: string): void {
  const resolved = resolveGameId(gameId);
  if (_atlasCache.has(resolved)) {
    // Already loaded for this symbol set — just alias the original key
    _aliasKeys(gameId, resolved);
    return;
  }

  const syms   = getSymbolsForGame(resolved);
  const rows   = Math.ceil(syms.length / COLS_PER_ROW);
  const aw     = COLS_PER_ROW * CELL_SIZE;
  const ah     = rows * CELL_SIZE;

  // ── 1. Draw atlas on a 2D canvas ─────────────────────────────────────────
  const cvs   = document.createElement('canvas');
  cvs.width   = aw;
  cvs.height  = ah;
  const ctx   = cvs.getContext('2d')!;
  const fs    = Math.floor(CELL_SIZE * 0.56);

  syms.forEach((sym, idx) => {
    const cx = (idx % COLS_PER_ROW) * CELL_SIZE;
    const cy = Math.floor(idx / COLS_PER_ROW) * CELL_SIZE;

    // Dark cell BG
    ctx.fillStyle = sym.id === 'wild' ? '#1a0030' : sym.id === 'scatter' ? '#001a20' : '#0d0d1a';
    ctx.beginPath();
    ctx.roundRect(cx + 1, cy + 1, CELL_SIZE - 2, CELL_SIZE - 2, 10);
    ctx.fill();

    // Gold border
    ctx.strokeStyle = 'rgba(255,215,0,0.22)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.roundRect(cx + 1, cy + 1, CELL_SIZE - 2, CELL_SIZE - 2, 10);
    ctx.stroke();

    // Emoji
    ctx.font         = `${fs}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(sym.emoji, cx + CELL_SIZE / 2, cy + CELL_SIZE / 2 + 2);
  });

  _atlasCache.set(resolved, cvs);

  // ── 2. Create base texture from the canvas ────────────────────────────────
  const baseTex = Texture.from(cvs);

  // ── 3. Force immediate GPU upload ────────────────────────────────────────
  //    renderer.prepare exists on WebGL/WebGPU renderers.
  //    The cast to any avoids TS complaints about the optional API.
  try {
    (renderer as any).prepare?.upload(baseTex);
  } catch {
    // Prepare API unavailable — texture will upload on first use (acceptable fallback)
  }

  // ── 4. Slice individual textures from atlas ───────────────────────────────
  syms.forEach((sym, idx) => {
    const fx = (idx % COLS_PER_ROW) * CELL_SIZE;
    const fy = Math.floor(idx / COLS_PER_ROW) * CELL_SIZE;
    const frame = new Rectangle(fx, fy, CELL_SIZE, CELL_SIZE);
    const sliced = new Texture({ source: baseTex.source, frame });

    const rk = `${resolved}:${sym.id}`;
    const ok = `${gameId}:${sym.id}`;
    _texCache.set(rk, sliced);
    if (ok !== rk) _texCache.set(ok, sliced);
  });
}

function _aliasKeys(gameId: string, resolved: string): void {
  const syms = getSymbolsForGame(resolved);
  for (const sym of syms) {
    const rk = `${resolved}:${sym.id}`;
    const ok = `${gameId}:${sym.id}`;
    if (ok !== rk && !_texCache.has(ok)) {
      const tex = _texCache.get(rk);
      if (tex) _texCache.set(ok, tex);
    }
  }
}

export function getSymbolTexture(gameId: string, symbolId: string): Texture {
  return (
    _texCache.get(`${gameId}:${symbolId}`) ??
    _texCache.get(`${resolveGameId(gameId)}:${symbolId}`) ??
    _fallbackTexture(symbolId)
  );
}

/** Fallback: scan all games for the symbol (handles shared wild/scatter) */
function _fallbackTexture(symbolId: string): Texture {
  for (const [gid] of _atlasCache) {
    const t = _texCache.get(`${gid}:${symbolId}`);
    if (t) return t;
  }
  return Texture.WHITE;
}

export function getSymbolEmoji(gameId: string, symbolId: string): string {
  const resolved = resolveGameId(gameId);
  const syms = getSymbolsForGame(resolved);
  const s = syms.find((x) => x.id === symbolId);
  if (s) return s.emoji;
  for (const set of Object.values(GAME_SYMBOLS)) {
    const found = set.find((x) => x.id === symbolId);
    if (found) return found.emoji;
  }
  return '🎰';
}

export function clearCache(): void {
  _texCache.forEach((t) => t.destroy(true));
  _texCache.clear();
  _atlasCache.clear();
}
