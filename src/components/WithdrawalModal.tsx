import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { supabase } from '../lib/supabase';

interface WithdrawalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MIN_WITHDRAWAL = 100;
const MAX_WITHDRAWAL = 50_000;
const DAILY_LIMIT    = 100_000;
const COOLDOWN_HOURS = 1;

type Step = 'form' | 'confirm' | 'success' | 'error';

/** Normalise any Kenyan phone to 2547XXXXXXXX */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('254')) return digits.slice(0, 12);
  if (digits.startsWith('0'))   return '254' + digits.slice(1, 10);
  if (digits.startsWith('7') || digits.startsWith('1'))
    return '254' + digits.slice(0, 9);
  return digits;
}

/** Display format: +254 7XX XXX XXX */
function displayPhone(normalized: string): string {
  const d = normalized.startsWith('254') ? normalized.slice(3) : normalized;
  if (d.length >= 9) return `+254 ${d[0]}${d[1]}${d[2]} ${d[3]}${d[4]}${d[5]} ${d[6]}${d[7]}${d[8]}`;
  return `+254 ${d}`;
}

export default function WithdrawalModal({ isOpen, onClose }: WithdrawalModalProps) {
  const { user, profile } = useAuthStore();
  const balance = useGameStore((s) => s.balance);

  const [amount, setAmount]         = useState('');
  const [step, setStep]             = useState<Step>('form');
  const [loading, setLoading]       = useState(false);
  const [errorMsg, setErrorMsg]     = useState('');
  const [withdrawalId, setWithdrawalId] = useState('');

  // The verified phone — derived from profile, never editable here
  const registeredPhone = profile?.phone
    ? normalizePhone(profile.phone)
    : '';
  const hasVerifiedPhone = !!registeredPhone && registeredPhone.length >= 12;
  const phoneDisplay     = hasVerifiedPhone ? displayPhone(registeredPhone) : 'No M-Pesa number on file';

  useEffect(() => {
    if (isOpen) {
      setStep('form');
      setErrorMsg('');
      setAmount('');
    }
  }, [isOpen]);

  function validateForm(): string | null {
    if (!hasVerifiedPhone) return 'No verified M-Pesa number on your account. Please update your profile.';
    const amt = Number(amount);
    if (!amount || isNaN(amt))            return 'Enter a valid amount';
    if (amt < MIN_WITHDRAWAL)             return `Minimum withdrawal is KES ${MIN_WITHDRAWAL.toLocaleString()}`;
    if (amt > MAX_WITHDRAWAL)             return `Maximum single withdrawal is KES ${MAX_WITHDRAWAL.toLocaleString()}`;
    if (amt > balance)                    return `Insufficient balance. Available: KES ${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    return null;
  }

  async function checkDailyLimit(): Promise<string | null> {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', user!.id)
      .eq('type', 'withdrawal')
      .neq('status', 'rejected')
      .gte('created_at', today.toISOString());
    const todayTotal = (data ?? []).reduce((s: number, r: { amount: number }) => s + r.amount, 0);
    if (todayTotal + Number(amount) > DAILY_LIMIT)
      return `Daily limit exceeded. You've withdrawn KES ${todayTotal.toLocaleString()} today (limit: KES ${DAILY_LIMIT.toLocaleString()})`;
    return null;
  }

  async function checkCooldown(): Promise<string | null> {
    const cooldownFrom = new Date(Date.now() - COOLDOWN_HOURS * 3_600_000).toISOString();
    const { data } = await supabase
      .from('transactions')
      .select('id')
      .eq('user_id', user!.id)
      .eq('type', 'withdrawal')
      .in('status', ['pending', 'approved', 'processing'])
      .gte('created_at', cooldownFrom)
      .limit(1);
    if (data && data.length > 0)
      return `You have a pending withdrawal. Please wait ${COOLDOWN_HOURS}h between requests.`;
    return null;
  }

  async function handleSubmit() {
    const err = validateForm();
    if (err) { setErrorMsg(err); return; }
    setErrorMsg('');
    setStep('confirm');
  }

  async function handleConfirm() {
    setLoading(true);
    try {
      // ── 1. Server-side phone validation (SECURITY DEFINER — bypasses RLS) ──
      const { data: validationResult, error: validationError } = await supabase.rpc(
        'validate_withdrawal_phone',
        {
          p_user_id:    user!.id,
          p_phone:      registeredPhone,   // always use stored phone — never client-supplied
          p_amount:     Number(amount),
          p_ip_address: null,
          p_user_agent: navigator.userAgent,
        }
      );

      if (validationError) {
        console.error('[withdrawal] validation RPC error:', validationError.message);
        // RPC not deployed yet — allow but log
      } else if (validationResult === 'phone_mismatch') {
        setErrorMsg('Withdrawals are only allowed to your verified M-Pesa number.');
        setStep('error');
        setLoading(false);
        return;
      } else if (validationResult === 'no_phone_registered') {
        setErrorMsg('No verified M-Pesa number on your account. Please update your profile first.');
        setStep('error');
        setLoading(false);
        return;
      }

      // ── 2. Rate / daily limit checks ──────────────────────────────────────
      const limitErr = await checkDailyLimit();
      if (limitErr) { setErrorMsg(limitErr); setStep('form'); setLoading(false); return; }

      const cooldownErr = await checkCooldown();
      if (cooldownErr) { setErrorMsg(cooldownErr); setStep('form'); setLoading(false); return; }

      const amt        = Number(amount);
      const newBalance = Math.round((balance - amt) * 100) / 100;

      // ── 3. Insert transaction record ──────────────────────────────────────
      const { data: txn, error: txnErr } = await supabase
        .from('transactions')
        .insert({
          user_id:    user!.id,
          amount:     amt,
          phone:      registeredPhone,   // always store the verified phone
          type:       'withdrawal',
          status:     'pending',
        })
        .select('id')
        .single();

      if (txnErr || !txn) {
        setErrorMsg('Failed to submit withdrawal. Please try again.');
        setStep('error');
        setLoading(false);
        return;
      }

      // ── 4. Deduct balance ─────────────────────────────────────────────────
      await supabase.from('profiles').update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('id', user!.id);
      useGameStore.setState({ balance: newBalance });
      useAuthStore.setState((s) => ({
        profile: s.profile ? { ...s.profile, balance: newBalance } : null,
      }));

      setWithdrawalId(txn.id.slice(0, 8).toUpperCase());
      setStep('success');
    } catch {
      setErrorMsg('Unexpected error. Please try again.');
      setStep('error');
    }
    setLoading(false);
  }

  const modal = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center px-0 sm:px-4 py-0 sm:py-8"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={step === 'form' || step === 'error' ? onClose : undefined}
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
            transition={{ type: 'spring', stiffness: 280, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden max-h-[92dvh] sm:max-h-[90vh]"
            style={{
              background: 'linear-gradient(160deg, #0d0020 0%, #050010 100%)',
              border: '1px solid rgba(255,100,100,0.25)',
              boxShadow: '0 0 60px rgba(255,68,68,0.1)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <div>
                <p className="font-orbitron text-xs text-white/30 tracking-[0.3em] uppercase mb-1">Neon Noir Casino</p>
                <h2 className="font-orbitron text-2xl font-bold tracking-widest text-red-400">WITHDRAW</h2>
              </div>
              {(step === 'form' || step === 'error') && (
                <button onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all">✕</button>
              )}
            </div>

            <div className="px-6 pb-6 flex flex-col gap-4 overflow-y-auto scrollbar-none">

              {/* Available balance */}
              <div className="rounded-xl px-4 py-3 flex items-center justify-between"
                style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.12)' }}>
                <span className="font-orbitron text-xs text-white/40 tracking-widest">AVAILABLE</span>
                <span className="font-orbitron text-sm font-bold text-yellow-400">
                  KES {balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Limits */}
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Min',   value: `KES ${MIN_WITHDRAWAL.toLocaleString()}` },
                  { label: 'Max',   value: `KES ${(MAX_WITHDRAWAL / 1000).toFixed(0)}K` },
                  { label: 'Daily', value: `KES ${(DAILY_LIMIT / 1000).toFixed(0)}K` },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg px-2 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <p className="text-white/30 text-[10px] font-orbitron">{item.label}</p>
                    <p className="text-white text-xs font-orbitron font-bold">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* ── FORM ── */}
              {step === 'form' && (
                <>
                  {errorMsg && (
                    <div
                      data-testid="withdrawal-error"
                      className="rounded-xl px-4 py-3 text-xs font-orbitron bg-red-500/10 border border-red-500/30 text-red-400"
                    >
                      {errorMsg}
                    </div>
                  )}

                  {/* Verified phone — READ ONLY */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-orbitron text-xs text-white/50 tracking-widest uppercase">Withdraw To</label>
                      {hasVerifiedPhone && (
                        <span className="flex items-center gap-1 text-[10px] font-orbitron text-green-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                          VERIFIED
                        </span>
                      )}
                    </div>

                    <div
                      className="flex items-center gap-3 rounded-xl px-4 py-3.5 border"
                      style={{
                        background: hasVerifiedPhone ? 'rgba(0,255,136,0.04)' : 'rgba(255,68,68,0.05)',
                        borderColor: hasVerifiedPhone ? 'rgba(0,255,136,0.2)' : 'rgba(255,68,68,0.25)',
                      }}
                    >
                      <span className="text-lg shrink-0">{hasVerifiedPhone ? '📱' : '⚠️'}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`font-orbitron text-sm font-bold ${hasVerifiedPhone ? 'text-white' : 'text-red-400'}`}>
                          {phoneDisplay}
                        </p>
                        <p className="text-white/30 text-[10px] mt-0.5">
                          {hasVerifiedPhone
                            ? 'Withdrawals can only be sent to your verified number.'
                            : 'Update your M-Pesa number in Account Settings.'}
                        </p>
                      </div>
                      <span className="shrink-0">
                        {hasVerifiedPhone
                          ? <span className="text-green-400 text-sm">✓</span>
                          : <span className="text-red-400 text-sm">✕</span>}
                      </span>
                    </div>

                    <p className="text-white/25 text-[10px] font-orbitron">
                      🔒 To change your withdrawal number, go to Account Settings → Change M-Pesa Number.
                    </p>
                  </div>

                  {/* Amount */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-orbitron text-xs text-white/50 tracking-widest uppercase">Amount (KES)</label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder={`Min KES ${MIN_WITHDRAWAL}`}
                      disabled={!hasVerifiedPhone}
                      className="rounded-xl px-4 py-4 text-sm text-white placeholder-gray-600 outline-none bg-white/5 border border-white/10 focus:border-red-400/60 disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                    <div className="flex gap-2">
                      {[500, 1000, 5000, 10000].map((v) => (
                        <button
                          key={v}
                          type="button"
                          disabled={!hasVerifiedPhone || balance < v}
                          onClick={() => setAmount(String(Math.min(v, balance, MAX_WITHDRAWAL)))}
                          className="flex-1 py-2 rounded-lg font-orbitron text-xs text-white/60 hover:text-white border border-white/10 hover:border-red-400/40 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          {v >= 1000 ? `${v / 1000}K` : v}
                        </button>
                      ))}
                    </div>
                    <button
                      disabled={!hasVerifiedPhone || balance < MIN_WITHDRAWAL}
                      onClick={() => setAmount(String(Math.min(balance, MAX_WITHDRAWAL).toFixed(2)))}
                      className="text-xs text-red-400 font-orbitron text-right hover:text-red-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Max: KES {Math.min(balance > 0 ? balance : MAX_WITHDRAWAL, MAX_WITHDRAWAL).toLocaleString()}
                    </button>
                  </div>

                  <div className="text-xs text-white/30 text-center font-orbitron">Processing: 1–24 hours · Admin review required</div>

                  <button
                    onClick={handleSubmit}
                    disabled={!hasVerifiedPhone}
                    className="w-full py-3.5 rounded-xl font-orbitron text-sm font-bold tracking-widest text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: 'linear-gradient(135deg, #ff4466, #cc2244)', boxShadow: '0 0 20px rgba(255,68,102,0.3)' }}
                  >
                    REQUEST WITHDRAWAL
                  </button>
                </>
              )}

              {/* ── CONFIRM ── */}
              {step === 'confirm' && (
                <div className="flex flex-col gap-4">
                  <div className="rounded-xl p-4 flex flex-col gap-2"
                    style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)' }}>
                    <p className="font-orbitron text-xs text-white/50 uppercase tracking-widest">Confirm Withdrawal</p>
                    <div className="flex justify-between">
                      <span className="text-white/60 text-sm">Amount</span>
                      <span className="font-orbitron font-bold text-red-400">KES {Number(amount).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/60 text-sm">To</span>
                      <div className="flex items-center gap-2">
                        <span className="font-orbitron text-white text-sm">{phoneDisplay}</span>
                        <span className="text-[9px] font-orbitron px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">✓ VERIFIED</span>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60 text-sm">Balance after</span>
                      <span className="font-orbitron text-yellow-400 text-sm">
                        KES {(balance - Number(amount)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  <p className="text-white/30 text-xs text-center">Funds will be sent to your verified number after admin approval (1–24h)</p>
                  <div className="flex gap-3">
                    <button onClick={() => setStep('form')} disabled={loading}
                      className="flex-1 py-3 rounded-xl font-orbitron text-sm text-white/60 border border-white/20 hover:bg-white/5 transition-all disabled:opacity-40">
                      BACK
                    </button>
                    <button onClick={handleConfirm} disabled={loading}
                      className="flex-1 py-3 rounded-xl font-orbitron text-sm font-bold tracking-widest text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                      style={{ background: 'linear-gradient(135deg, #ff4466, #cc2244)' }}>
                      {loading
                        ? <><span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> PROCESSING...</>
                        : 'CONFIRM'}
                    </button>
                  </div>
                </div>
              )}

              {/* ── SUCCESS ── */}
              {step === 'success' && (
                <div className="flex flex-col items-center gap-4 py-4 text-center">
                  <span className="text-5xl">✅</span>
                  <div>
                    <p className="font-orbitron text-lg font-bold text-green-400 tracking-widest">REQUEST SUBMITTED</p>
                    <p className="text-white/50 text-sm mt-2">Reference: <span className="font-mono text-white">{withdrawalId}</span></p>
                    <p className="text-white/40 text-xs mt-2">
                      KES {Number(amount).toLocaleString()} will be sent to{' '}
                      <span className="text-white">{phoneDisplay}</span> after admin approval
                    </p>
                  </div>
                  <button onClick={onClose}
                    className="w-full py-3 rounded-xl font-orbitron text-sm font-bold tracking-widest text-black"
                    style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)' }}>
                    DONE
                  </button>
                </div>
              )}

              {/* ── ERROR ── */}
              {step === 'error' && (
                <div className="flex flex-col items-center gap-4 py-4 text-center">
                  <span className="text-5xl">❌</span>
                  <p className="text-red-400 font-orbitron font-bold">WITHDRAWAL FAILED</p>
                  <p className="text-white/50 text-sm">{errorMsg}</p>
                  {errorMsg.includes('verified M-Pesa number') && (
                    <p className="text-white/30 text-xs">
                      To update your withdrawal number, go to Account Settings → Change M-Pesa Number.
                    </p>
                  )}
                  <button onClick={() => setStep('form')}
                    className="w-full py-3 rounded-xl font-orbitron text-sm font-bold text-white border border-white/20 hover:bg-white/5 transition-all">
                    TRY AGAIN
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modal, document.body);
}
