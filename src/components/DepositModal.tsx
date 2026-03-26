import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPolling: (checkoutId: string) => void; // notify parent to start polling
}

type Status = 'idle' | 'loading' | 'error';

const SUPABASE_FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL.replace(
  '.supabase.co',
  '.supabase.co/functions/v1'
);

export default function DepositModal({ isOpen, onClose, onPolling }: DepositModalProps) {
  const { user, profile } = useAuthStore();
  const [phone, setPhone] = useState('254');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPhone('254');
      setAmount('');
      setStatus('idle');
      setMessage('');
    }
  }, [isOpen]);

  const validate = (p: string): string | null => {
    if (!/^2547\d{8}$/.test(p)) return `Invalid number (got: ${p}). Use 07XXXXXXXX or 7XXXXXXXX`;
    const amt = Number(amount);
    if (!amt || amt < 10) return 'Minimum deposit is KES 10';
    if (amt > 150000) return 'Maximum deposit is KES 150,000';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Normalize phone before validation — ensure it's 2547XXXXXXXX
    const normalizedPhone = phone.replace(/\D/g, '');
    const finalPhone = normalizedPhone.startsWith('254') ? normalizedPhone : '254' + normalizedPhone;
    
    const err = validate(finalPhone);
    if (err) { setStatus('error'); setMessage(err); return; }

    setStatus('loading');
    setMessage('');

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 20000)
    );

    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        setStatus('error');
        setMessage('You must be logged in to deposit.');
        return;
      }

      const url = `${SUPABASE_FUNCTIONS_URL}/mpesa-stk`;
      console.log('[deposit] calling:', url);

      const fetchPromise = fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ phone: finalPhone, amount: Number(amount), userId: user?.id }),
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

      if (!res.ok) {
        setStatus('error');
        setMessage(data.error ?? `Request failed (${res.status})`);
        return;
      }

      // Hand off polling to parent, then close
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
          className="fixed inset-0 z-50 flex items-end sm:items-start justify-center px-0 sm:px-4 py-0 sm:py-16"
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
            className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 flex flex-col gap-5 sm:gap-6 overflow-y-auto"
            style={{
              maxHeight: '90vh',
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
                <h2
                  className="font-orbitron text-2xl font-bold tracking-widest"
                  style={{ color: '#FFD700', textShadow: '0 0 20px rgba(255,215,0,0.5)' }}
                >
                  M-PESA DEPOSIT
                </h2>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all text-lg"
              >
                ✕
              </button>
            </div>

            {/* Balance */}
            {profile && (
              <div
                className="rounded-xl px-4 py-3 flex items-center justify-between"
                style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.12)' }}
              >
                <span className="font-orbitron text-xs text-white/40 tracking-widest">CURRENT BALANCE</span>
                <span className="font-orbitron text-sm font-bold" style={{ color: '#FFD700' }}>
                  KES {profile.balance.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="font-orbitron text-sm text-white/60 tracking-widest uppercase">
                  Phone Number
                </label>
                <div className="flex items-center rounded-xl overflow-hidden border border-white/10 focus-within:border-yellow-400/60 transition-all bg-white/5">
                  <span className="px-3 py-4 text-base text-yellow-400 font-orbitron font-bold border-r border-white/10 shrink-0 select-none">
                    +254
                  </span>
                  <input
                    type="tel"
                    value={phone.startsWith('254') ? phone.slice(3) : phone}
                    onChange={(e) => {
                      // strip non-digits
                      let raw = e.target.value.replace(/\D/g, '');
                      // if user typed 07... convert to 7...
                      if (raw.startsWith('0')) raw = raw.slice(1);
                      // cap at 9 digits (7XXXXXXXX)
                      raw = raw.slice(0, 9);
                      setPhone('254' + raw);
                    }}
                    placeholder="7XXXXXXXX"
                    disabled={isLoading}
                    className="flex-1 px-3 py-4 text-base text-white placeholder-gray-600 outline-none bg-transparent disabled:opacity-50"
                  />
                </div>
                <p className="text-white/30 text-xs">Enter 07XXXXXXXX or 7XXXXXXXX</p>
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-orbitron text-sm text-white/60 tracking-widest uppercase">
                  Amount (KES)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Min. KES 10"
                  min={10}
                  max={150000}
                  disabled={isLoading}
                  className="w-full rounded-xl px-5 py-4 text-base text-white placeholder-gray-600 outline-none transition-all bg-white/5 border border-white/10 focus:border-yellow-400/60 disabled:opacity-50"
                />
                <div className="flex gap-2 mt-1">
                  {[100, 500, 1000, 5000].map((v) => (
                    <button
                      key={v} type="button"
                      onClick={() => setAmount(String(v))}
                      disabled={isLoading}
                      className="flex-1 py-2 rounded-lg font-orbitron text-sm text-white/60 hover:text-white border border-white/10 hover:border-yellow-400/40 transition-all disabled:opacity-40"
                    >
                      {v >= 1000 ? `${v / 1000}K` : v}
                    </button>
                  ))}
                </div>
              </div>

              {status === 'error' && message && (
                <div className="rounded-xl px-4 py-3 text-xs font-orbitron tracking-wider bg-red-500/10 border border-red-500/30 text-red-400">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-xl font-orbitron text-sm font-bold tracking-widest text-black transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                  boxShadow: isLoading ? 'none' : '0 0 20px rgba(255,215,0,0.3)',
                }}
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
                    SENDING...
                  </>
                ) : (
                  '📱 DEPOSIT VIA M-PESA'
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
