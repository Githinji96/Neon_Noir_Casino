import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { normalizeKenyanPhone } from '../services/authSchemas';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPolling: (checkoutId: string) => void;
}

type Status = 'idle' | 'loading' | 'error';

const SUPABASE_FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL.replace(
  '.supabase.co',
  '.supabase.co/functions/v1'
);

function formatDisplayPhone(normalized: string): string {
  const d = normalized.startsWith('254') ? normalized.slice(3) : normalized;
  if (d.length >= 9) return `+254 ${d[0]}${d[1]}${d[2]} ${d[3]}${d[4]}${d[5]} ${d[6]}${d[7]}${d[8]}`;
  return `+254 ${d}`;
}

export default function DepositModal({ isOpen, onClose, onPolling }: DepositModalProps) {
  const { profile } = useAuthStore();
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  // Derive the registered phone — never user-editable
  const registeredPhone = profile?.phone ? normalizeKenyanPhone(profile.phone) : '';
  const hasPhone        = !!registeredPhone && registeredPhone.length >= 12;
  const phoneDisplay    = hasPhone ? formatDisplayPhone(registeredPhone) : '';

  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setAmountError('');
      setStatus('idle');
      setMessage('');
    }
  }, [isOpen]);

  function validateAmount(val: string): string {
    if (!val.trim()) return 'Please enter a deposit amount.';
    const n = Number(val);
    if (isNaN(n) || !isFinite(n)) return 'Please enter a valid deposit amount.';
    if (n <= 0)      return 'Please enter a valid deposit amount.';
    if (n < 10)      return 'Minimum deposit amount is KES 10.';
    if (n > 150_000) return 'Maximum deposit amount is KES 150,000.';
    return '';
  }

  function handleAmountChange(val: string) {
    setAmount(val);
    if (amountError) setAmountError(validateAmount(val));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasPhone) {
      setStatus('error');
      setMessage('No M-Pesa number on your account. Add one in Account Settings first.');
      return;
    }

    const err = validateAmount(amount);
    if (err) {
      setAmountError(err);
      return;
    }
    setAmountError('');

    const amt = Number(amount);

    setStatus('loading');
    setMessage('');

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 20000)
    );

    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) { setStatus('error'); setMessage('You must be logged in to deposit.'); return; }

      const fetchPromise = fetch(`${SUPABASE_FUNCTIONS_URL}/mpesa-stk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ amount: amt }),
      });

      const res = await Promise.race([fetchPromise, timeoutPromise]);

      let data: { error?: string; checkoutRequestId?: string };
      try {
        data = await res.json();
      } catch {
        const text = await res.text().catch(() => 'No response body');
        setStatus('error');
        setMessage(`Server error (${res.status}): ${text.slice(0, 200)}`);
        return;
      }

      if (!res.ok) { setStatus('error'); setMessage(data.error ?? `Request failed (${res.status})`); return; }

      onPolling(data.checkoutRequestId ?? '');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setStatus('error');
      setMessage(
        msg === 'TIMEOUT'
          ? 'Request timed out. Check Supabase Edge Functions are deployed.'
          : `Network error: ${msg}`
      );
    }
  };

  const isLoading = status === 'loading';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end justify-center pb-[80px] sm:pb-0 sm:items-center sm:px-4"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', stiffness: 280, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5 sm:p-8 flex flex-col gap-4 sm:gap-6 overflow-y-auto scrollbar-none"
            style={{
              /* Mobile: constrained above BottomNav. Desktop: standard max-h */
              maxHeight: 'calc(100dvh - 88px)',
              background: 'linear-gradient(160deg, #0d0020 0%, #050010 100%)',
              border: '1px solid rgba(255,215,0,0.25)',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.05), 0 32px 80px rgba(0,0,0,0.9), 0 0 60px rgba(255,215,0,0.1)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-orbitron text-xs text-white/30 tracking-[0.3em] uppercase mb-1">
                  Neon Noir Casino
                </p>
                <h2 className="font-orbitron text-2xl font-bold tracking-widest"
                  style={{ color: '#FFD700', textShadow: '0 0 20px rgba(255,215,0,0.5)' }}>
                  M-PESA DEPOSIT
                </h2>
              </div>
              <button onClick={onClose}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all text-lg">
                ✕
              </button>
            </div>

            {/* Balance */}
            {profile && (
              <div className="rounded-xl px-4 py-3 flex items-center justify-between"
                style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.12)' }}>
                <span className="font-orbitron text-xs text-white/40 tracking-widest">CURRENT BALANCE</span>
                <span className="font-orbitron text-sm font-bold" style={{ color: '#FFD700' }}>
                  KES {profile.balance.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">

              {/* Registered phone — READ ONLY */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-orbitron text-sm text-white/60 tracking-widest uppercase">
                    Deposit To
                  </label>
                  {hasPhone && (
                    <span className="flex items-center gap-1 text-[10px] font-orbitron text-green-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      VERIFIED
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 rounded-xl px-4 py-3.5 border"
                  style={{
                    background: hasPhone ? 'rgba(0,255,136,0.04)' : 'rgba(255,68,68,0.05)',
                    borderColor: hasPhone ? 'rgba(0,255,136,0.2)' : 'rgba(255,68,68,0.25)',
                  }}>
                  <span className="text-lg shrink-0">{hasPhone ? '📱' : '⚠️'}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`font-orbitron text-sm font-bold ${hasPhone ? 'text-white' : 'text-red-400'}`}>
                      {hasPhone ? phoneDisplay : 'No M-Pesa number on file'}
                    </p>
                    <p className="text-white/30 text-[10px] mt-0.5">
                      {hasPhone
                        ? 'STK push will be sent to this number.'
                        : 'Add your M-Pesa number in Account Settings.'}
                    </p>
                  </div>
                  {hasPhone && <span className="text-green-400 text-sm shrink-0">✓</span>}
                </div>
              </div>

              {/* Amount */}
              <div className="flex flex-col gap-2">
                <label className="font-orbitron text-sm text-white/60 tracking-widest uppercase">
                  Amount (KES)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="Min. KES 10"
                  disabled={isLoading || !hasPhone}
                  className={`w-full rounded-xl px-5 py-4 text-base text-white placeholder-gray-600 outline-none transition-all bg-white/5 border focus:border-yellow-400/60 disabled:opacity-50 ${
                    amountError ? 'border-red-500/70' : 'border-white/10'
                  }`}
                />
                <p className="text-white/30 text-[11px] font-orbitron">
                  Minimum: KES 10 &nbsp;|&nbsp; Maximum: KES 150,000
                </p>
                {amountError && (
                  <p
                    data-testid="deposit-error"
                    className="text-red-400 text-xs font-orbitron flex items-center gap-1.5"
                    role="alert"
                  >
                    <span>⚠</span> {amountError}
                  </p>
                )}
                <div className="flex gap-2 mt-1">
                  {[100, 500, 1000, 5000].map((v) => (
                    <button key={v} type="button"
                      onClick={() => { setAmount(String(v)); setAmountError(''); }}
                      disabled={isLoading || !hasPhone}
                      className="flex-1 py-2 rounded-lg font-orbitron text-sm text-white/60 hover:text-white border border-white/10 hover:border-yellow-400/40 transition-all disabled:opacity-40">
                      {v >= 1000 ? `${v / 1000}K` : v}
                    </button>
                  ))}
                </div>
              </div>

              {status === 'error' && message && (
                <div
                  className="rounded-xl px-4 py-3 text-xs font-orbitron tracking-wider bg-red-500/10 border border-red-500/30 text-red-400"
                >
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !hasPhone || !!amountError}
                className="w-full py-3.5 rounded-xl font-orbitron text-sm font-bold tracking-wide sm:tracking-widest text-black transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                  boxShadow: isLoading ? 'none' : '0 0 20px rgba(255,215,0,0.3)',
                }}>
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
                    <span>SENDING...</span>
                  </>
                ) : (
                  <>
                    <span>📱</span>
                    <span className="sm:hidden">DEPOSIT VIA M-PESA</span>
                    <span className="hidden sm:inline">DEPOSIT VIA M-PESA</span>
                  </>
                )}
              </button>

              <p className="text-center text-white/20 text-xs">
                Secured by Safaricom Daraja API
              </p>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
