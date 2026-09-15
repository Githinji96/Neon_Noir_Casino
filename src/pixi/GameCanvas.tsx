/**
 * GameCanvas — Slot machine reel renderer.
 *
 * Renders the 5×3 reel grid entirely in React/HTML/CSS using CSS
 * translateY animations for spin physics.
 *
 * Cell sizing is fully fluid — based on available container width —
 * so all 5 reels always fit without overflow on any screen size.
 */
import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { getSymbolsForGame, GAME_SYMBOLS } from '../config/symbols';
import type { SymbolId } from '../config/symbols';

// ── game alias map (unregistered IDs → nearest real game) ──────────────────
const GAME_ALIAS: Record<string, string> = {
  'solar-flare':    'electric-storm',
  'crystal-grid':   'quantum-vault',
  'midnight-heist': 'dark-matter-reels',
  'ocean-depths':   'neon-jungle-fruits',
  'dragon-forge':   'neon-samurai',
};
function resolveGame(id: string) { return GAME_ALIAS[id] ?? id; }

function getEmoji(gameId: string, symbolId: string): string {
  const syms = getSymbolsForGame(resolveGame(gameId));
  const s = syms.find((x) => x.id === symbolId);
  if (s) return s.emoji;
  for (const set of Object.values(GAME_SYMBOLS)) {
    const found = set.find((x) => x.id === symbolId);
    if (found) return found.emoji;
  }
  return '🎰';
}

function cellBg(symbolId: string) {
  if (symbolId === 'wild')    return '#1a0030';
  if (symbolId === 'scatter') return '#001a20';
  return '#0d0d1a';
}

const COLS = 5;
const ROWS = 3;
// Fluid sizing constants — actual px resolved at render time from container width
const PANEL_PAD_X = 8;   // px horizontal padding inside the panel (reduced for mobile)
const PANEL_PAD_Y = 6;   // px vertical padding inside the panel
const COL_GAP     = 4;   // px gap between columns
const ROW_GAP     = 4;   // px gap between rows

interface GameCanvasProps {
  gameId: string;
  animationSpeed?: 'slow' | 'normal' | 'fast';
  onSpinComplete?: () => void;
}

export default function GameCanvas({ gameId, animationSpeed = 'normal', onSpinComplete }: GameCanvasProps) {
  const reels      = useGameStore((s) => s.reels);
  const isSpinning = useGameStore((s) => s.isSpinning);
  const winResults = useGameStore((s) => s.winResults);
  const turboMode  = useGameStore((s) => s.turboMode);

  // Keep a ref to turboMode so the stop-timer effect (dep: [isSpinning])
  // always reads the current value — never a stale closure capture.
  const turboRef = useRef(turboMode);
  useEffect(() => { turboRef.current = turboMode; }, [turboMode]);

  // Same for animationSpeed — it comes from settingsStore via a parent prop.
  const animationSpeedRef = useRef(animationSpeed);
  useEffect(() => { animationSpeedRef.current = animationSpeed; }, [animationSpeed]);

  // Keep a stable ref to onSpinComplete so timer callbacks always call the
  // latest version even though the effect dep array only lists [isSpinning].
  const onSpinCompleteRef = useRef(onSpinComplete);
  useEffect(() => { onSpinCompleteRef.current = onSpinComplete; }, [onSpinComplete]);

  const outerRef  = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(60);

  // Measure the outer wrapper width to derive cell size
  useEffect(() => {
    const measure = () => {
      if (!outerRef.current) return;
      const availableW = outerRef.current.clientWidth;
      const panelInnerWidth = availableW - PANEL_PAD_X * 2;
      const computed = Math.floor((panelInnerWidth - COL_GAP * (COLS - 1)) / COLS);
      // Min 36px (Nokia 320px), max 72px (desktop)
      setCellSize(Math.max(36, Math.min(72, computed)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (outerRef.current) ro.observe(outerRef.current);
    return () => ro.disconnect();
  }, []);

  const [spinningCols, setSpinningCols] = useState<boolean[]>(Array(COLS).fill(false));
  const [displayReels, setDisplayReels] = useState<SymbolId[][]>(
    () => reels as SymbolId[][]
  );

  const prevSpinning = useRef(false);
  const stopTimers   = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!isSpinning) {
      setDisplayReels(reels as SymbolId[][]);
    }
  }, [reels, isSpinning]);

  useEffect(() => {
    if (isSpinning && !prevSpinning.current) {
      setSpinningCols(Array(COLS).fill(true));
      stopTimers.current.forEach(clearTimeout);
      stopTimers.current = [];

      // stopBase = when col 0 stops, stopGap = stagger between each column
      // turbo:  280ms base, 80ms gap  → last col at 280 + 4×80  = 600ms
      // fast:   700ms base, 150ms gap → last col at 700 + 4×150 = 1300ms
      // normal: 1200ms base, 220ms gap→ last col at 1200 + 4×220 = 2080ms
      // slow:   1800ms base, 300ms gap→ last col at 1800 + 4×300 = 3000ms
      const turbo = turboRef.current;
      const speed = animationSpeedRef.current;
      const stopBase = turbo ? 280  : speed === 'fast' ? 700  : speed === 'slow' ? 1800 : 1200;
      const stopGap  = turbo ? 80   : speed === 'fast' ? 150  : speed === 'slow' ? 300  : 220;

      let stoppedCount = 0;
      for (let c = 0; c < COLS; c++) {
        const t = setTimeout(() => {
          setSpinningCols((prev) => {
            const next = [...prev];
            next[c] = false;
            return next;
          });
          setDisplayReels((prev) => {
            const next = [...prev];
            next[c] = (reels as SymbolId[][])[c] ?? prev[c];
            return next;
          });
          stoppedCount++;
          if (stoppedCount === COLS) onSpinCompleteRef.current?.();
        }, stopBase + c * stopGap);
        stopTimers.current.push(t);
      }
    }
    prevSpinning.current = isSpinning;
  }, [isSpinning]); // eslint-disable-line react-hooks/exhaustive-deps

  const winRowsPerCol: number[][] = Array.from({ length: COLS }, () => []);
  if (!isSpinning) {
    for (const win of winResults) {
      for (const [col, row] of win.cells) {
        if (!winRowsPerCol[col].includes(row)) winRowsPerCol[col].push(row);
      }
    }
  }
  const hasWins = winResults.length > 0 && !isSpinning;

  // Exact panel width = grid content + horizontal padding
  const gridW = COLS * cellSize + (COLS - 1) * COL_GAP;
  const panelW = gridW + PANEL_PAD_X * 2;

  return (
    /* Outer: full-width for measurement, invisible */
    <div ref={outerRef} className="w-full" style={{ maxWidth: 520 }}>
      {/* Inner panel: exact width, centered */}
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: panelW,
          maxWidth: '100%',
          margin: '0 auto',
          padding: `${PANEL_PAD_Y}px ${PANEL_PAD_X}px`,
          background: '#080810',
          borderRadius: 14,
          border: '1px solid #2a2a3a',
          boxShadow: '0 0 30px rgba(0,0,0,0.8)',
          boxSizing: 'border-box',
        }}
      >
        {/* Gold top accent line */}
        <div style={{
          position: 'absolute', top: 0, left: PANEL_PAD_X, right: PANEL_PAD_X,
          height: 2, background: 'rgba(255,215,0,0.7)', borderRadius: 1,
        }} />

        {/* Reel grid — 5 equal fluid columns */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${COLS}, ${cellSize}px)`,
          columnGap: COL_GAP,
        }}>
          {Array.from({ length: COLS }, (_, col) => (
            <ReelColumn
              key={col}
              gameId={gameId}
              symbols={displayReels[col] ?? []}
              spinning={spinningCols[col] ?? false}
              turbo={turboMode}
              animationSpeed={animationSpeed}
              winRows={winRowsPerCol[col] ?? []}
              hasAnyWin={hasWins}
              cellSize={cellSize}
              rowGap={ROW_GAP}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Individual reel column ──────────────────────────────────────────────────

interface ReelColumnProps {
  gameId: string;
  symbols: SymbolId[];
  spinning: boolean;
  turbo: boolean;
  animationSpeed: 'slow' | 'normal' | 'fast';
  winRows: number[];
  hasAnyWin: boolean;
  cellSize: number;
  rowGap: number;
}

function ReelColumn({ gameId, symbols, spinning, turbo, animationSpeed, winRows, hasAnyWin, cellSize, rowGap }: ReelColumnProps) {
  const visH = ROWS * cellSize + (ROWS - 1) * rowGap;
  const step = -(cellSize + rowGap);

  // Reel strip animation duration — lower = faster visual spin
  // turbo: 0.08s (blur-fast), fast: 0.16s, normal: 0.40s, slow: 0.65s
  const spinDur = turbo ? '0.08s'
    : animationSpeed === 'fast'  ? '0.16s'
    : animationSpeed === 'slow'  ? '0.65s'
    : '0.40s';

  // animKey forces the browser to restart the CSS animation from scratch
  // whenever the speed mode changes. Without this, browsers keep running
  // the old animation-duration even after the prop updates.
  const animName = spinning ? `reelSpin${turbo ? 'Fast' : ''}` : '';
  const animKey  = `${animName}-${spinDur}`;

  return (
    <div style={{
      width: cellSize,
      height: visH,
      overflow: 'hidden',
      borderRadius: 8,
      position: 'relative',
      ['--reel-step' as string]: `${step}px`,
    }}>
      {/* Spinning strip — keyed by animKey so the browser restarts the CSS
          animation cleanly whenever turbo or speed mode changes. */}
      <div
        key={animKey}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: rowGap,
          animation: spinning
            ? `${animName} ${spinDur} linear infinite`
            : undefined,
          willChange: spinning ? 'transform' : undefined,
        }}
      >
        {/* Extra symbols above for seamless loop visual */}
        {spinning && symbols.map((sym, r) => (
          <SymbolCell key={`above-${r}`} gameId={gameId} symbolId={sym}
            isWin={false} isDim={false} size={cellSize} />
        ))}
        {/* Actual symbols */}
        {Array.from({ length: ROWS }, (_, row) => {
          const sym   = symbols[row] ?? symbols[0] ?? 'wild';
          const isWin = winRows.includes(row);
          const isDim = hasAnyWin && !isWin;
          return (
            <SymbolCell key={row} gameId={gameId} symbolId={sym}
              isWin={isWin} isDim={isDim} size={cellSize} />
          );
        })}
      </div>
    </div>
  );
}

// ── Single symbol cell ──────────────────────────────────────────────────────

interface SymbolCellProps {
  gameId: string;
  symbolId: string;
  isWin: boolean;
  isDim: boolean;
  size: number;
}

function SymbolCell({ gameId, symbolId, isWin, isDim, size }: SymbolCellProps) {
  const emoji = getEmoji(gameId, symbolId);
  const fs = Math.floor(size * 0.52);

  return (
    <div style={{
      width: size,
      height: size,
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      background: cellBg(symbolId),
      border: isWin
        ? '2px solid rgba(255,215,0,0.9)'
        : '1px solid rgba(255,215,0,0.15)',
      boxShadow: isWin ? '0 0 14px rgba(255,215,0,0.5), inset 0 0 8px rgba(255,215,0,0.1)' : 'none',
      opacity: isDim ? 0.35 : 1,
      fontSize: fs,
      lineHeight: 1,
      userSelect: 'none',
      animation: isWin ? 'symbolPulse 0.6s ease-in-out infinite alternate' : undefined,
      transition: 'opacity 0.2s, border-color 0.2s',
    }}>
      {emoji}
    </div>
  );
}
