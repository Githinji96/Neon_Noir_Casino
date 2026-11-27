/**
 * MiniGameConfigPanel — Admin configuration panel for Mini Jackpot Games.
 * Task 13.1 — Mini Jackpot Games spec
 *
 * Requirements: 11.1–11.7
 *
 * Role guard: only renders for super_admin or game_manager.
 * Per-game accordion: enabled toggle, min/max bet, prize tiers table editor
 * (label, multiplier %, probability %, add/remove rows, max 20),
 * probability sum indicator (red if ≠ 100%), maintenance toggle,
 * game-specific rules JSON editor (collapsible), save button.
 * On save: calls update_mini_game_config RPC; shows field-level inline errors;
 * shows success toast on save; retains previous config on infrastructure error.
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAdminStore } from '../../store/adminStore';
import { useToast } from './ToastProvider';
import type { MiniGameId, MiniGameConfig, PrizeTier } from '../../types/miniGames';

// ── Constants ─────────────────────────────────────────────────────────────────

const MINI_GAME_IDS: MiniGameId[] = [
  'lucky-wheel',
  'scratch-cards',
  'treasure-chest',
  'mini-slot',
  'mystery-multiplier',
  'crystal-match',
];

const GAME_DISPLAY_NAMES: Record<MiniGameId, string> = {
  'lucky-wheel': 'Neon Lucky Wheel',
  'scratch-cards': 'Neon Scratch Cards',
  'treasure-chest': 'Cyber Treasure Chest',
  'mini-slot': 'Mini Slot Jackpot',
  'mystery-multiplier': 'Mystery Multiplier',
  'crystal-match': 'Crystal Match',
};

const GAME_ICONS: Record<MiniGameId, string> = {
  'lucky-wheel': '🎡',
  'scratch-cards': '🎟️',
  'treasure-chest': '💰',
  'mini-slot': '🎰',
  'mystery-multiplier': '✨',
  'crystal-match': '💎',
};

const MAX_PRIZE_TIERS = 20;

// ── Types ─────────────────────────────────────────────────────────────────────

/** Editable prize tier row — strings for controlled inputs, parsed on save */
interface TierRow {
  label: string;
  multiplier: string;   // display as % (e.g. "200" for 2x)
  probability: string;  // display as % (e.g. "30" for 0.30)
  symbol: string;
}

interface GameFormState {
  enabled: boolean;
  min_bet: string;
  max_bet: string;
  tiers: TierRow[];
  maintenance: boolean;
  game_specific_rules: string; // raw JSON string
  rulesExpanded: boolean;
  // Field-level errors from RPC or client validation
  errors: Record<string, string>;
  saving: boolean;
}

type FormsState = Record<MiniGameId, GameFormState>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function configToFormState(config: MiniGameConfig | null): GameFormState {
  const tiers: TierRow[] = (config?.prize_tiers ?? []).map((t) => ({
    label: t.label,
    multiplier: String(Math.round(t.multiplier * 100)),   // fraction → %
    probability: String(Math.round(t.probability * 10000) / 100), // fraction → %
    symbol: t.symbol ?? '',
  }));

  // Start with one empty row if no tiers exist
  const tiersOrDefault: TierRow[] = tiers.length > 0
    ? tiers
    : [{ label: '', multiplier: '', probability: '', symbol: '' }];

  return {
    enabled: config?.enabled ?? false,
    min_bet: config ? String(config.min_bet) : '10',
    max_bet: config ? String(config.max_bet) : '1000',
    tiers: tiersOrDefault,
    maintenance: config?.maintenance ?? false,
    game_specific_rules: config?.game_specific_rules
      ? JSON.stringify(config.game_specific_rules, null, 2)
      : '{}',
    rulesExpanded: false,
    errors: {},
    saving: false,
  };
}

/** Sum of probability inputs (as %). */
function sumProbabilities(tiers: TierRow[]): number {
  return tiers.reduce((sum, t) => {
    const v = parseFloat(t.probability);
    return sum + (isNaN(v) ? 0 : v);
  }, 0);
}

/**
 * Map RPC exception messages to field keys.
 * The RPC raises exceptions with these exact messages (from the design doc).
 */
function mapRpcErrorToField(message: string): { field: string; text: string } {
  const lower = message.toLowerCase();
  if (lower.includes('min_bet')) {
    return { field: 'min_bet', text: message };
  }
  if (lower.includes('max_bet')) {
    return { field: 'max_bet', text: message };
  }
  if (lower.includes('probabilities') || lower.includes('probability')) {
    return { field: 'probability_sum', text: message };
  }
  if (lower.includes('multiplier')) {
    return { field: 'multipliers', text: message };
  }  if (lower.includes('prize_tiers') || lower.includes('20')) {
    return { field: 'prize_tiers_count', text: message };
  }
  return { field: 'general', text: message };
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MiniGameConfigPanel() {
  const { adminProfile } = useAdminStore();
  const { toast } = useToast();

  const [configs, setConfigs] = useState<Record<MiniGameId, MiniGameConfig | null>>(
    () => Object.fromEntries(MINI_GAME_IDS.map((id) => [id, null])) as Record<MiniGameId, MiniGameConfig | null>
  );
  const [forms, setForms] = useState<FormsState>(
    () => Object.fromEntries(MINI_GAME_IDS.map((id) => [id, configToFormState(null)])) as FormsState
  );
  const [loadingConfigs, setLoadingConfigs] = useState(true);
  const [expandedGame, setExpandedGame] = useState<MiniGameId | null>(null);

  // ── Role guard ──────────────────────────────────────────────────────────────

  const canAccess =
    adminProfile?.admin_role === 'super_admin' ||
    adminProfile?.admin_role === 'game_manager';

  // ── Load configs ────────────────────────────────────────────────────────────

  const loadConfigs = useCallback(async () => {
    setLoadingConfigs(true);
    const { data, error } = await supabase.from('mini_game_config').select('*');
    if (!error && data) {
      const newConfigs = { ...configs };
      for (const row of data) {
        const gameId = row.game_id as MiniGameId;
        if (MINI_GAME_IDS.includes(gameId)) {
          newConfigs[gameId] = row as MiniGameConfig;
        }
      }
      setConfigs(newConfigs);
      // Reset form states to reflect loaded data (only for non-expanded forms to
      // avoid clobbering unsaved edits)
      setForms((prev) => {
        const next = { ...prev };
        for (const id of MINI_GAME_IDS) {
          if (id !== expandedGame) {
            next[id] = configToFormState(newConfigs[id]);
          }
        }
        return next;
      });
    }
    setLoadingConfigs(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadConfigs();
  }, [loadConfigs]);

  // ── Form helpers ─────────────────────────────────────────────────────────────

  function updateForm(gameId: MiniGameId, patch: Partial<GameFormState>) {
    setForms((prev) => ({
      ...prev,
      [gameId]: { ...prev[gameId], ...patch },
    }));
  }

  function updateTier(gameId: MiniGameId, index: number, patch: Partial<TierRow>) {
    setForms((prev) => {
      const tiers = [...prev[gameId].tiers];
      tiers[index] = { ...tiers[index], ...patch };
      return { ...prev, [gameId]: { ...prev[gameId], tiers } };
    });
  }

  function addTier(gameId: MiniGameId) {
    setForms((prev) => {
      if (prev[gameId].tiers.length >= MAX_PRIZE_TIERS) return prev;
      const tiers = [...prev[gameId].tiers, { label: '', multiplier: '', probability: '', symbol: '' }];
      return { ...prev, [gameId]: { ...prev[gameId], tiers } };
    });
  }

  function removeTier(gameId: MiniGameId, index: number) {
    setForms((prev) => {
      const tiers = prev[gameId].tiers.filter((_, i) => i !== index);
      // Always keep at least one row
      const finalTiers = tiers.length > 0 ? tiers : [{ label: '', multiplier: '', probability: '', symbol: '' }];
      return { ...prev, [gameId]: { ...prev[gameId], tiers: finalTiers } };
    });
  }

  // ── Save handler ─────────────────────────────────────────────────────────────

  async function saveConfig(gameId: MiniGameId) {
    const form = forms[gameId];

    // Client-side validation
    const errors: Record<string, string> = {};

    const minBet = parseFloat(form.min_bet);
    const maxBet = parseFloat(form.max_bet);

    if (isNaN(minBet) || minBet <= 0) {
      errors.min_bet = 'min_bet must be greater than 0';
    }
    if (isNaN(maxBet) || maxBet <= minBet) {
      errors.max_bet = 'max_bet must be greater than min_bet';
    }

    // Validate prize tiers
    const hasInvalidMultiplier = form.tiers.some((t) => {
      const m = parseFloat(t.multiplier);
      return isNaN(m) || m < 0;
    });
    if (hasInvalidMultiplier) {
      errors.multipliers = 'All multipliers must be 0 or greater (0 = losing outcome)';
    }

    const probSum = sumProbabilities(form.tiers);
    if (Math.abs(probSum - 100) > 0.01) {
      errors.probability_sum = `Outcome probabilities must sum to 100% (currently ${probSum.toFixed(2)}%)`;
    }

    if (form.tiers.length > MAX_PRIZE_TIERS) {
      errors.prize_tiers_count = `prize_tiers cannot exceed ${MAX_PRIZE_TIERS} entries`;
    }

    // Validate JSON
    let parsedRules: Record<string, unknown> = {};
    try {
      parsedRules = JSON.parse(form.game_specific_rules) as Record<string, unknown>;
    } catch {
      errors.game_specific_rules = 'Game-specific rules must be valid JSON';
    }

    if (Object.keys(errors).length > 0) {
      updateForm(gameId, { errors });
      return;
    }

    // Build prize_tiers payload (convert % → fractions for server)
    const prizeTiers: PrizeTier[] = form.tiers.map((t) => ({
      label: t.label,
      multiplier: parseFloat(t.multiplier) / 100,  // % → multiplier fraction
      probability: parseFloat(t.probability) / 100, // % → probability fraction
      symbol: t.symbol || undefined,
    }));

    const configPayload = {
      enabled: form.enabled,
      min_bet: minBet,
      max_bet: maxBet,
      prize_tiers: prizeTiers,
      outcome_probabilities: {},
      maintenance: form.maintenance,
      game_specific_rules: parsedRules,
    };

    updateForm(gameId, { errors: {}, saving: true });

    const { error } = await supabase.rpc('update_mini_game_config', {
      p_game_id: gameId,
      p_config: configPayload,
    });

    if (error) {
      const mapped = mapRpcErrorToField(error.message);
      updateForm(gameId, {
        saving: false,
        errors: { [mapped.field]: mapped.text },
      });
      // Requirement 11.7: retain previous config on infrastructure error
      return;
    }

    updateForm(gameId, { saving: false, errors: {} });
    toast(`${GAME_DISPLAY_NAMES[gameId]} configuration saved.`, 'success');
    // Reload to sync displayed config with the DB
    void loadConfigs();
  }

  // ── Accordion toggle ──────────────────────────────────────────────────────────

  function toggleAccordion(gameId: MiniGameId) {
    if (expandedGame === gameId) {
      setExpandedGame(null);
    } else {
      // Reset form to current DB config when opening a fresh accordion row
      setForms((prev) => ({
        ...prev,
        [gameId]: configToFormState(configs[gameId]),
      }));
      setExpandedGame(gameId);
    }
  }

  // ── Render guard ──────────────────────────────────────────────────────────────

  if (!canAccess) {
    return null;
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      {/* Section header */}
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
        <div>
          <h3 className="text-white/60 text-xs uppercase tracking-widest">Mini Jackpot Games</h3>
          <p className="text-white/40 text-xs mt-0.5">Configure prize tiers, bet limits, and availability</p>
        </div>
        {loadingConfigs && (
          <span className="text-white/30 text-xs animate-pulse">Loading…</span>
        )}
      </div>

      {/* Accordion rows */}
      <div className="divide-y divide-white/5">
        {MINI_GAME_IDS.map((gameId) => {
          const form = forms[gameId];
          const isOpen = expandedGame === gameId;
          const probSum = sumProbabilities(form.tiers);
          const probOk = Math.abs(probSum - 100) < 0.01;

          return (
            <div key={gameId}>
              {/* Accordion header */}
              <button
                type="button"
                onClick={() => toggleAccordion(gameId)}
                className="w-full px-5 py-4 flex items-center gap-4 hover:bg-white/5 transition-colors text-left"
                aria-expanded={isOpen}
              >
                <span className="text-2xl flex-shrink-0">{GAME_ICONS[gameId]}</span>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-white text-sm">{GAME_DISPLAY_NAMES[gameId]}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    {/* Status badges */}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase ${
                      configs[gameId]?.enabled
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-white/10 text-white/40'
                    }`}>
                      {configs[gameId]?.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    {configs[gameId]?.maintenance && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold uppercase bg-yellow-500/20 text-yellow-400">
                        Maintenance
                      </span>
                    )}
                    {configs[gameId] && (
                      <span className="text-white/30 text-xs">
                        KES {configs[gameId]!.min_bet} – {configs[gameId]!.max_bet}
                      </span>
                    )}
                  </div>
                </div>
                <span className={`text-white/40 transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>

              {/* Accordion body */}
              {isOpen && (
                <div className="px-5 pb-6 pt-2 space-y-5">

                  {/* Row 1: Enabled + Maintenance toggles */}
                  <div className="flex flex-wrap gap-6">
                    <div className="flex items-center gap-3">
                      <label className="text-white/60 text-xs uppercase tracking-widest" htmlFor={`${gameId}-enabled`}>
                        Enabled
                      </label>
                      <button
                        id={`${gameId}-enabled`}
                        type="button"
                        role="switch"
                        aria-checked={form.enabled}
                        onClick={() => updateForm(gameId, { enabled: !form.enabled })}
                        className={`relative w-10 h-5 rounded-full transition-colors ${form.enabled ? 'bg-[#FFD700]' : 'bg-white/20'}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="text-white/60 text-xs uppercase tracking-widest" htmlFor={`${gameId}-maintenance`}>
                        Maintenance Mode
                      </label>
                      <button
                        id={`${gameId}-maintenance`}
                        type="button"
                        role="switch"
                        aria-checked={form.maintenance}
                        onClick={() => updateForm(gameId, { maintenance: !form.maintenance })}
                        className={`relative w-10 h-5 rounded-full transition-colors ${form.maintenance ? 'bg-yellow-500' : 'bg-white/20'}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.maintenance ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Min Bet / Max Bet */}
                  <div className="flex flex-wrap gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-white/40 text-xs uppercase tracking-widest" htmlFor={`${gameId}-minbet`}>
                        Min Bet (KES)
                      </label>
                      <input
                        id={`${gameId}-minbet`}
                        type="number"
                        min="1"
                        step="0.01"
                        value={form.min_bet}
                        onChange={(e) => updateForm(gameId, { min_bet: e.target.value })}
                        className={`bg-white/5 border rounded-lg px-3 py-2 text-sm text-white w-32 focus:outline-none focus:border-[#FFD700]/50 ${
                          form.errors.min_bet ? 'border-red-500/60' : 'border-white/10'
                        }`}
                      />
                      {form.errors.min_bet && (
                        <p className="text-red-400 text-xs">{form.errors.min_bet}</p>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-white/40 text-xs uppercase tracking-widest" htmlFor={`${gameId}-maxbet`}>
                        Max Bet (KES)
                      </label>
                      <input
                        id={`${gameId}-maxbet`}
                        type="number"
                        min="1"
                        step="0.01"
                        value={form.max_bet}
                        onChange={(e) => updateForm(gameId, { max_bet: e.target.value })}
                        className={`bg-white/5 border rounded-lg px-3 py-2 text-sm text-white w-32 focus:outline-none focus:border-[#FFD700]/50 ${
                          form.errors.max_bet ? 'border-red-500/60' : 'border-white/10'
                        }`}
                      />
                      {form.errors.max_bet && (
                        <p className="text-red-400 text-xs">{form.errors.max_bet}</p>
                      )}
                    </div>
                  </div>

                  {/* Row 3: Prize Tiers table editor */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <label className="text-white/60 text-xs uppercase tracking-widest">
                          Prize Tiers
                        </label>
                        <span className="text-white/30 text-xs">({form.tiers.length}/{MAX_PRIZE_TIERS})</span>
                      </div>
                      {/* Probability sum indicator */}
                      <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded ${
                        probOk
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400 animate-pulse'
                      }`}>
                        Σ {probSum.toFixed(2)}% {probOk ? '✓' : '≠ 100%'}
                      </span>
                    </div>

                    {/* Table errors */}
                    {form.errors.probability_sum && (
                      <p className="text-red-400 text-xs">{form.errors.probability_sum}</p>
                    )}
                    {form.errors.multipliers && (
                      <p className="text-red-400 text-xs">{form.errors.multipliers}</p>
                    )}
                    {form.errors.prize_tiers_count && (
                      <p className="text-red-400 text-xs">{form.errors.prize_tiers_count}</p>
                    )}

                    {/* Tiers table */}
                    <div className="overflow-x-auto rounded-lg border border-white/10">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-white/5 border-b border-white/10">
                            <th className="px-3 py-2 text-left text-xs text-white/40 uppercase tracking-widest">Label</th>
                            <th className="px-3 py-2 text-left text-xs text-white/40 uppercase tracking-widest">Symbol</th>
                            <th className="px-3 py-2 text-left text-xs text-white/40 uppercase tracking-widest">
                              Multiplier
                              <span className="normal-case font-normal text-white/30 ml-1">(% of stake)</span>
                            </th>
                            <th className="px-3 py-2 text-left text-xs text-white/40 uppercase tracking-widest">
                              Probability %
                            </th>
                            <th className="px-3 py-2 w-10" />
                          </tr>
                        </thead>
                        <tbody>
                          {form.tiers.map((tier, idx) => (
                            <tr key={idx} className="border-b border-white/5 last:border-0">
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  placeholder="e.g. 2x"
                                  value={tier.label}
                                  onChange={(e) => updateTier(gameId, idx, { label: e.target.value })}
                                  className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white w-20 focus:outline-none focus:border-[#FFD700]/50"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  placeholder="💎"
                                  value={tier.symbol}
                                  onChange={(e) => updateTier(gameId, idx, { symbol: e.target.value })}
                                  className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white w-14 focus:outline-none focus:border-[#FFD700]/50"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    placeholder="200"
                                    value={tier.multiplier}
                                    onChange={(e) => updateTier(gameId, idx, { multiplier: e.target.value })}
                                    className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white w-20 focus:outline-none focus:border-[#FFD700]/50"
                                  />
                                  <span className="text-white/30 text-xs">%</span>
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="0.01"
                                    max="100"
                                    step="0.01"
                                    placeholder="30"
                                    value={tier.probability}
                                    onChange={(e) => updateTier(gameId, idx, { probability: e.target.value })}
                                    className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white w-20 focus:outline-none focus:border-[#FFD700]/50"
                                  />
                                  <span className="text-white/30 text-xs">%</span>
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <button
                                  type="button"
                                  onClick={() => removeTier(gameId, idx)}
                                  className="text-red-400/60 hover:text-red-400 transition-colors text-sm"
                                  aria-label={`Remove tier ${idx + 1}`}
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Add row button */}
                    {form.tiers.length < MAX_PRIZE_TIERS && (
                      <button
                        type="button"
                        onClick={() => addTier(gameId)}
                        className="text-xs text-[#FFD700] hover:text-yellow-300 transition-colors flex items-center gap-1"
                      >
                        + Add Tier
                      </button>
                    )}
                    {form.tiers.length >= MAX_PRIZE_TIERS && (
                      <p className="text-white/30 text-xs">Maximum of {MAX_PRIZE_TIERS} prize tiers reached.</p>
                    )}
                  </div>

                  {/* Row 4: Game-Specific Rules JSON editor (collapsible) */}
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => updateForm(gameId, { rulesExpanded: !form.rulesExpanded })}
                      className="text-white/40 text-xs uppercase tracking-widest flex items-center gap-2 hover:text-white/60 transition-colors"
                    >
                      <span className={`transition-transform duration-200 ${form.rulesExpanded ? 'rotate-90' : ''}`}>▶</span>
                      Game-Specific Rules (JSON)
                    </button>

                    {form.rulesExpanded && (
                      <div className="space-y-1">
                        <textarea
                          value={form.game_specific_rules}
                          onChange={(e) => updateForm(gameId, { game_specific_rules: e.target.value })}
                          rows={6}
                          spellCheck={false}
                          className={`w-full bg-black/30 border rounded-lg px-3 py-2 text-xs text-white/80 font-mono focus:outline-none focus:border-[#FFD700]/50 resize-y ${
                            form.errors.game_specific_rules ? 'border-red-500/60' : 'border-white/10'
                          }`}
                          aria-label="Game-specific rules JSON"
                        />
                        {form.errors.game_specific_rules && (
                          <p className="text-red-400 text-xs">{form.errors.game_specific_rules}</p>
                        )}
                        <p className="text-white/20 text-xs">
                          Valid JSON object — e.g. segment_count, chest_count, grid_size, wild_enabled
                        </p>
                      </div>
                    )}
                  </div>

                  {/* General RPC error */}
                  {form.errors.general && (
                    <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3">
                      <p className="text-red-400 text-sm">{form.errors.general}</p>
                    </div>
                  )}

                  {/* Save button */}
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => saveConfig(gameId)}
                      disabled={form.saving}
                      className="px-5 py-2 rounded-lg bg-[#FFD700] text-black text-sm font-semibold hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {form.saving ? (
                        <>
                          <span className="w-3 h-3 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                          Saving…
                        </>
                      ) : (
                        'Save'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
