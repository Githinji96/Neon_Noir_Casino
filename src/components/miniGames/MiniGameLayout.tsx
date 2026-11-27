/**
 * MiniGameLayout — shared game wrapper.
 *
 * Mobile layout  (< sm / 640px):
 *   ┌─────────────────────────────┐
 *   │  Balance bar                │
 *   ├─────────────────────────────┤
 *   │  Game visual (scrollable)   │
 *   ├─────────────────────────────┤
 *   │  Bet controls + action btn  │  ← sticky at bottom
 *   └─────────────────────────────┘
 *
 * Desktop layout  (≥ sm / 640px):
 *   ┌──────────────────┬──────────┐
 *   │  Game visual     │ Controls │
 *   └──────────────────┴──────────┘
 *   History panel below both columns
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMiniGameStore } from '../../store/miniGameStore';
import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import MiniGameHistoryPanel from './MiniGameHistoryPanel';
import type { MiniGameId, MiniGameConfig } from '../../types/miniGames';

export interface MiniGameLayoutProps {
  gameId: MiniGameId;
  config: MiniGameConfig;
  userId: string;
  actionLabel: string;
  /** Called when the player presses the main action button.
   *  Receives the current validated stake so games don't have to read it
   *  from currentRound (which is null after resetRound). */
  onAction: (stake: number) => void;
  children?: React.ReactNode;
  resultContent?: React.ReactNode;
}

function getBetStep(_minBet: number): number {
  // Always increment/decrement by 1
  return 1;
}

// ---------------------------------------------------------------------------
// Controls panel — extracted so it can be shared between mobile/desktop
// ---------------------------------------------------------------------------
interface ControlsPanelProps {
  config:          MiniGameConfig;
  stake:           number;
  submittedStake:  number;   // actual bet from currentRound — used for result math
  betError:        string | null;
  isProcessing:    boolean;
  isRestricted:    boolean;
  isActionDisabled: boolean;
  actionLabel:     string;
  balance:         number;
  roundPhase:      string;
  roundError:      string | null;
  hasActed:        boolean;
  payout:          number | null;
  resultContent:   React.ReactNode;
  onDecrement:     () => void;
  onIncrement:     () => void;
  onStakeChange:   (v: number) => void;
  onAction:        (stake: number) => void;
  onReset:         () => void;
  onSetHasActed:   () => void;
}

function ControlsPanel({
  config, stake, submittedStake, betError, isProcessing, isRestricted, isActionDisabled,
  actionLabel, balance, roundPhase, roundError, hasActed,
  payout, resultContent, onDecrement, onIncrement, onStakeChange,
  onAction, onReset, onSetHasActed,
}: ControlsPanelProps) {
  // Local display string so user can freely type without the field snapping back
  const [inputVal, setInputVal] = React.useState(stake.toString());

  // Keep input in sync when stake changes from outside (e.g. +/- buttons)
  React.useEffect(() => {
    setInputVal(stake.toString());
  }, [stake]);

  const resultGlow =
    payout !== null && payout > submittedStake ? '0 0 20px rgba(34,197,94,0.3)'
    : payout !== null && payout < submittedStake ? '0 0 20px rgba(239,68,68,0.3)'
    : undefined;

  return (
    <div className="flex flex-col gap-0" style={{ background: '#040010' }}>

      {/* Balance */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ borderBottom: '1px solid rgba(168,85,247,0.2)' }}
      >
        <span className="font-orbitron uppercase tracking-widest text-[0.6rem]" style={{ color: 'rgba(156,163,175,0.5)' }}>
          Balance
        </span>
        <span
          className="font-orbitron font-bold text-xs"
          style={{ color: '#FFD700' }}
          aria-live="polite"
          aria-label={`Balance: KES ${balance.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        >
          KES {balance.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>

      {/* Account restricted */}
      <AnimatePresence>
        {isRestricted && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="px-4 py-1.5 text-xs font-semibold text-center"
            style={{ background: 'rgba(239,68,68,0.15)', borderBottom: '1px solid rgba(239,68,68,0.4)', color: '#ef4444' }}
            role="alert"
          >
            Account restricted
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bet controls */}
      <div className="px-4 py-3 flex flex-col gap-2">
        <label
          htmlFor="mini-game-bet-input"
          className="font-orbitron uppercase tracking-widest text-[0.6rem]"
          style={{ color: 'rgba(156,163,175,0.7)' }}
        >
          Bet
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDecrement}
            disabled={isProcessing || stake <= config.min_bet}
            aria-label="Decrease bet"
            className="flex items-center justify-center w-9 h-9 rounded-lg font-bold text-lg shrink-0 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.4)', color: '#a855f7' }}
          >
            −
          </button>
          <input
            id="mini-game-bet-input"
            type="number"
            inputMode="decimal"
            min={config.min_bet}
            max={config.max_bet}
            step="1"
            value={inputVal}
            disabled={isProcessing}
            onChange={(e) => {
              const raw = e.target.value;
              setInputVal(raw);           // allow free typing
              const parsed = parseFloat(raw);
              if (!isNaN(parsed) && parsed > 0) {
                onStakeChange(parsed);   // update store in real-time for valid values
              }
            }}
            onBlur={(e) => {
              const parsed = parseFloat(e.target.value);
              const clamped = isNaN(parsed) || parsed < config.min_bet
                ? config.min_bet
                : parsed > config.max_bet
                ? config.max_bet
                : Math.round(parsed * 100) / 100;
              onStakeChange(clamped);
              setInputVal(clamped.toString());   // snap display to valid clamped value
            }}
            aria-label={`Bet amount: KES ${stake.toFixed(2)}`}
            className="flex-1 text-center font-orbitron font-bold rounded-lg py-2 no-spinner focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-60"
            style={{
              background: 'rgba(168,85,247,0.08)',
              border: '1px solid rgba(168,85,247,0.3)',
              color: '#FFD700',
              fontSize: '0.8rem',
              minWidth: 0,
              /* Remove browser arrows on number input */
              MozAppearance: 'textfield',
            } as React.CSSProperties}
          />
          <button
            type="button"
            onClick={onIncrement}
            disabled={isProcessing || stake >= config.max_bet}
            aria-label="Increase bet"
            className="flex items-center justify-center w-9 h-9 rounded-lg font-bold text-lg shrink-0 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.4)', color: '#a855f7' }}
          >
            +
          </button>
        </div>
        <p className="text-[0.6rem]" style={{ color: 'rgba(156,163,175,0.4)' }}>
          Min {config.min_bet.toLocaleString()} · Max {config.max_bet.toLocaleString()}
        </p>
        <AnimatePresence>
          {betError && (
            <motion.p
              key="bet-error"
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="text-xs" style={{ color: '#ef4444', fontSize: '0.65rem' }} role="alert"
            >
              {betError}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Action button */}
      <div className="px-4 pb-3">
        <motion.button
          type="button"
          onClick={() => { onSetHasActed(); onAction(stake); }}
          disabled={isActionDisabled}
          whileHover={isActionDisabled ? {} : { scale: 1.02 }}
          whileTap={isActionDisabled ? {} : { scale: 0.97 }}
          className="w-full py-3 rounded-xl font-orbitron font-bold tracking-widest uppercase transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: isActionDisabled ? 'rgba(107,114,128,0.3)' : 'linear-gradient(135deg, #FFD700, #FFA500)',
            color: isActionDisabled ? 'rgba(156,163,175,0.7)' : '#000',
            boxShadow: isActionDisabled ? 'none' : '0 0 16px rgba(255,215,0,0.4)',
            fontSize: '0.8rem',
            letterSpacing: '0.1em',
          }}
          aria-disabled={isActionDisabled}
        >
          {actionLabel}
        </motion.button>
      </div>

      {/* Processing */}
      {isProcessing && (
        <div
          style={{ borderTop: '1px solid rgba(168,85,247,0.15)', pointerEvents: 'none' }}
          className="flex items-center justify-center gap-2 px-4 py-2"
          role="status" aria-live="polite" aria-label="Processing round"
        >
          <motion.div
            animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
            className="w-3.5 h-3.5 rounded-full shrink-0"
            style={{ border: '2px solid rgba(168,85,247,0.25)', borderTopColor: '#a855f7' }}
            aria-hidden="true"
          />
          <span className="font-orbitron uppercase tracking-wider text-[0.6rem]" style={{ color: '#a855f7' }}>
            Processing…
          </span>
        </div>
      )}

      {/* Result */}
      {roundPhase === 'result' && (
        <div
          className="mx-3 mb-3 rounded-xl p-3 flex flex-col items-center gap-2"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(168,85,247,0.3)', boxShadow: resultGlow }}
          role="region" aria-label="Round result"
        >
          {payout !== null && (
            <div className="text-center">
              <p
                className="font-orbitron font-bold"
                style={{ fontSize: '0.9rem', color: payout > submittedStake ? '#22c55e' : payout < submittedStake ? '#ef4444' : '#FFD700' }}
              >
                {payout > submittedStake
                  ? `+KES ${(payout - submittedStake).toFixed(2)}`
                  : payout < submittedStake
                  ? `-KES ${(submittedStake - payout).toFixed(2)}`
                  : 'Stake returned'}
              </p>
              <p style={{ fontSize: '0.6rem', color: 'rgba(156,163,175,0.7)', marginTop: 2 }}>
                Payout: KES {payout.toFixed(2)}
              </p>
            </div>
          )}
          {resultContent}
          <button
            type="button"
            onClick={onReset}
            className="px-5 py-1.5 rounded-lg font-orbitron font-bold uppercase tracking-widest transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            style={{ background: 'rgba(168,85,247,0.2)', border: '1px solid rgba(168,85,247,0.5)', color: '#a855f7', fontSize: '0.65rem', cursor: 'pointer' }}
          >
            Play Again
          </button>
        </div>
      )}

      {/* Error */}
      {roundPhase === 'error' && roundError && hasActed && (
        <div
          className="mx-3 mb-3 px-3 py-2.5 rounded-lg text-center"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444', fontSize: '0.65rem' }}
          role="alert"
        >
          {(() => {
            const isSchemaCache =
              roundError.includes('schema cache') ||
              (roundError.includes('function') && roundError.includes('does not exist')) ||
              roundError.includes('PGRST202');
            if (isSchemaCache) return (
              <>
                <p className="font-orbitron uppercase tracking-wider mb-1" style={{ color: '#f97316', fontSize: '0.6rem' }}>Backend not set up</p>
                <p style={{ color: 'rgba(156,163,175,0.8)', wordBreak: 'break-all' }}>{roundError}</p>
                <button type="button" onClick={onReset} className="block mx-auto mt-1.5 underline" style={{ color: '#f97316', fontSize: '0.65rem', cursor: 'pointer' }}>Dismiss</button>
              </>
            );
            if (roundError.includes('Game not')) return (
              <>
                <p className="font-orbitron uppercase tracking-wider mb-1" style={{ color: '#f97316', fontSize: '0.6rem' }}>Game not enabled</p>
                <p style={{ color: 'rgba(156,163,175,0.8)' }}>Enable this game in the Admin panel.</p>
                <button type="button" onClick={onReset} className="block mx-auto mt-1.5 underline" style={{ color: '#f97316', fontSize: '0.65rem', cursor: 'pointer' }}>Dismiss</button>
              </>
            );
            return (
              <>
                <p style={{ wordBreak: 'break-all' }}>{roundError}</p>
                <button type="button" onClick={onReset} className="block mx-auto mt-1.5 underline" style={{ color: '#ef4444', fontSize: '0.65rem', cursor: 'pointer' }}>Try again</button>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main layout  (v2 — editable bet input, +1/-1 steps)
// ---------------------------------------------------------------------------
export default function MiniGameLayout({
  gameId, config, userId, actionLabel, onAction, children, resultContent,
}: MiniGameLayoutProps) {
  const roundPhase   = useMiniGameStore((s) => s.roundPhase);
  const currentRound = useMiniGameStore((s) => s.currentRound);
  const roundError   = useMiniGameStore((s) => s.roundError);
  const setBet       = useMiniGameStore((s) => s.setBet);
  const resetRound   = useMiniGameStore((s) => s.resetRound);

  const authBalance   = useAuthStore((s) => s.profile?.balance);
  const gameBalance   = useGameStore((s) => s.balance);
  const balance       = authBalance ?? gameBalance;
  const accountStatus = useAuthStore((s) => s.profile?.account_status);

  const [stake, setStake]     = useState<number>(config.min_bet);
  const [betError, setBetError] = useState<string | null>(null);
  const [hasActed, setHasActed] = useState(false);

  const step         = getBetStep(config.min_bet);
  const isProcessing = roundPhase === 'processing';
  const isRestricted = accountStatus === 'banned' || accountStatus === 'suspended';
  const isActionDisabled = isProcessing || isRestricted || (betError !== null && roundPhase === 'idle');
  const payout       = currentRound?.payout ?? null;
  // Use the stake that was actually submitted for this round, not the current
  // UI input value — these can differ if the user changed the bet after submitting.
  const submittedStake = currentRound?.stake ?? stake;

  useEffect(() => { if (roundPhase === 'idle') setHasActed(false); }, [roundPhase]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setBet(config.min_bet); }, [config.min_bet]);

  useEffect(() => {
    if (stake < config.min_bet) setBetError(`Min bet is KES ${config.min_bet}`);
    else if (stake > config.max_bet) setBetError(`Max bet is KES ${config.max_bet}`);
    else setBetError(null);
  }, [stake, config.min_bet, config.max_bet]);

  const handleDecrement  = () => { const n = Math.max(config.min_bet, stake - step); setStake(n); setBet(n); };
  const handleIncrement  = () => { const n = Math.min(config.max_bet, stake + step); setStake(n); setBet(n); };
  const handleStakeChange = (v: number) => {
    const clamped = Math.max(config.min_bet, Math.min(config.max_bet, v));
    setStake(clamped);
    setBet(clamped);
  };

  const controlsProps: ControlsPanelProps = {
    config, stake, betError, isProcessing, isRestricted, isActionDisabled,
    actionLabel, balance, roundPhase, roundError, hasActed, payout, resultContent,
    onDecrement: handleDecrement,
    onIncrement: handleIncrement,
    onStakeChange: handleStakeChange,
    onAction,
    onReset: resetRound,
    onSetHasActed: () => setHasActed(true),
    submittedStake,
  };

  return (
    <div className="flex flex-col w-full overflow-hidden" style={{ background: '#050010' }}>

      <div className="flex flex-col sm:flex-row w-full">

        {/* Game visual */}
        {children && (
          <div
            className="w-full sm:flex-1 sm:min-w-0 p-3"
          >
            <div className="flex items-center justify-center">
              {children}
            </div>
          </div>
        )}

        {/* Controls */}
        <div
          className={[
            'w-full sm:w-56 sm:shrink-0',
            children ? 'border-t border-t-purple-900/40 sm:border-t-0 sm:border-l sm:border-l-purple-900/40' : '',
          ].join(' ')}
        >
          <ControlsPanel {...controlsProps} />
        </div>
      </div>

      {/* History panel */}
      <div className="px-3 pb-3">
        <MiniGameHistoryPanel gameId={gameId} userId={userId} />
      </div>
    </div>
  );
}
