/**
 * MiniGameHistoryPanel component — collapsible panel showing the last 20
 * completed rounds for a given mini game.
 * Task 5.1 — Mini Jackpot Games spec
 * Requirements: 12.1, 12.2
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMiniGameStore } from '../../store/miniGameStore';
import type { MiniGameId } from '../../types/miniGames';

// ---------------------------------------------------------------------------
// Relative-time helper (no external library)
// ---------------------------------------------------------------------------
function relativeTime(isoTimestamp: string): string {
  const diff = Math.floor((Date.now() - new Date(isoTimestamp).getTime()) / 1000);
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)} hr ago`;
  return new Date(isoTimestamp).toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface MiniGameHistoryPanelProps {
  gameId: MiniGameId;
  userId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function MiniGameHistoryPanel({
  gameId,
  userId,
}: MiniGameHistoryPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const loadHistory = useMiniGameStore((s) => s.loadHistory);
  const history     = useMiniGameStore((s) => s.gameHistory[gameId]);

  // Load history when the panel first opens (lazy load)
  useEffect(() => {
    if (isOpen) {
      void loadHistory(gameId, userId);
    }
  }, [isOpen, gameId, userId, loadHistory]);

  // Also load once on mount so data is ready when panel is expanded
  useEffect(() => {
    void loadHistory(gameId, userId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, userId]);

  return (
    <div
      className="mt-4 rounded-xl overflow-hidden"
      style={{
        border: '1px solid rgba(168,85,247,0.3)',
        background: 'rgba(5,0,16,0.9)',
      }}
    >
      {/* ---- Toggle header ---- */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
        aria-expanded={isOpen}
        aria-controls="history-table-region"
        style={{ background: 'rgba(168,85,247,0.08)' }}
      >
        <span
          className="font-orbitron font-bold uppercase tracking-widest text-xs"
          style={{ color: '#FFD700' }}
        >
          Recent Rounds
        </span>

        {/* Chevron */}
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-purple-400 text-lg leading-none"
          aria-hidden="true"
        >
          ▾
        </motion.span>
      </button>

      {/* ---- Collapsible table ---- */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id="history-table-region"
            key="history-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="overflow-x-auto">
              {history.length === 0 ? (
                <p
                  className="text-center text-sm py-6"
                  style={{ color: 'rgba(156,163,175,0.7)' }}
                >
                  No rounds played yet
                </p>
              ) : (
                <table className="w-full text-xs border-collapse min-w-[420px]">
                  <thead>
                    <tr
                      style={{
                        background: 'rgba(168,85,247,0.12)',
                        borderBottom: '1px solid rgba(168,85,247,0.25)',
                      }}
                    >
                      <th
                        scope="col"
                        className="font-orbitron text-left px-3 py-2 uppercase tracking-wider"
                        style={{ color: '#FFD700', fontWeight: 700, fontSize: '10px' }}
                      >
                        Round
                      </th>
                      <th
                        scope="col"
                        className="font-orbitron text-right px-3 py-2 uppercase tracking-wider"
                        style={{ color: '#FFD700', fontWeight: 700, fontSize: '10px' }}
                      >
                        Stake (KES)
                      </th>
                      <th
                        scope="col"
                        className="font-orbitron text-right px-3 py-2 uppercase tracking-wider"
                        style={{ color: '#FFD700', fontWeight: 700, fontSize: '10px' }}
                      >
                        Payout (KES)
                      </th>
                      <th
                        scope="col"
                        className="font-orbitron text-right px-3 py-2 uppercase tracking-wider"
                        style={{ color: '#FFD700', fontWeight: 700, fontSize: '10px' }}
                      >
                        Net (KES)
                      </th>
                      <th
                        scope="col"
                        className="font-orbitron text-right px-3 py-2 uppercase tracking-wider"
                        style={{ color: '#FFD700', fontWeight: 700, fontSize: '10px' }}
                      >
                        Time
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((entry, idx) => {
                      const netColor =
                        entry.netResult > 0
                          ? '#22c55e'   // green for profit
                          : entry.netResult < 0
                          ? '#ef4444'   // red for loss
                          : 'rgba(156,163,175,0.8)'; // grey for zero

                      const rowBg =
                        idx % 2 === 0
                          ? 'rgba(255,255,255,0.02)'
                          : 'transparent';

                      return (
                        <tr
                          key={entry.roundId}
                          style={{
                            background: rowBg,
                            borderBottom: '1px solid rgba(168,85,247,0.1)',
                          }}
                        >
                          {/* Round ID — first 8 chars */}
                          <td
                            className="px-3 py-2 font-mono"
                            style={{ color: 'rgba(34,211,238,0.85)' }}
                          >
                            {entry.roundId.slice(0, 8)}
                          </td>

                          {/* Stake */}
                          <td
                            className="px-3 py-2 text-right"
                            style={{ color: 'rgba(209,213,219,0.9)' }}
                          >
                            {entry.stake.toFixed(2)}
                          </td>

                          {/* Gross Payout */}
                          <td
                            className="px-3 py-2 text-right"
                            style={{ color: 'rgba(209,213,219,0.9)' }}
                          >
                            {entry.grossPayout.toFixed(2)}
                          </td>

                          {/* Net result — coloured */}
                          <td
                            className="px-3 py-2 text-right font-semibold"
                            style={{ color: netColor }}
                          >
                            {entry.netResult >= 0 ? '+' : ''}
                            {entry.netResult.toFixed(2)}
                          </td>

                          {/* Relative time */}
                          <td
                            className="px-3 py-2 text-right"
                            style={{ color: 'rgba(156,163,175,0.7)' }}
                          >
                            {relativeTime(entry.timestamp)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
