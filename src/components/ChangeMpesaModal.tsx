import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { normalizeKenyanPhone } from '../services/authSchemas';

interface ChangeMpesaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newPhone: string) => void;
}

type Step = 'form' | 'success';

const MPESA_REGEX = /^(?:\+254|254|0)?([71]\d{8})$/;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS   = 15 * 60 * 1000; // 15 minutes

/** Display format: +254 7XX XXX XXX */
function displayPhone(normalized: string): string {
  const d = normalized.startsWith('254') ? normalized.slice(3) : normalized;
  if (d.length >= 9) return `+254 ${d[0]}${d[1]}${d[2]} ${d[3]}${d[4]}${d[5]} ${d[6]}${d[7]}${d[8]}`;
  return `+254 ${d}`;
}

export default function ChangeMpesaModal({ isOpen, onClose, onSuccess }: ChangeMpesaModalProps) {
  const { user, profile } = useAuthStore();

  const [newPhone, setNewPhone]       = useState('');
  const [confirmPhone, setConfirmPhone] = useState('');
  const [password, setPassword]       = useState('');
  const [showPw, setShowPw]           = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [step, setStep]               = useState<Step>('form');

  // Rate limiting — stored in component state (resets on page refresh, sufficient for UX layer)
  const [attempts, setAttempts]       = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

  const currentPhone = profile?.phone ? normalizeKenyanPhone(profile.phone) : '';

  useEffect(() => {
    if (isOpen) {
      setNewPhone('');
      setConfirmPhone('');
      setPassword('');
      setShowPw(false);
      setError('');
      setStep('form');
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  function isLocked(): boolean {
    if (!lockedUntil) return false;
    if (Date.now() < lockedUntil) return true;
    setLockedUntil(null);
    setAttempts(0);
    return false;
  }

  function lockoutRemaining(): string {
    if (!lockedUntil) return '';
    const ms = lockedUntil - Date.now();
    if (ms <= 0) return '';
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}m ${s}s`;
  }

  async function handleSubmit() {
    setError('');

    // ── Lockout check ─────────────────────────────────────────────────────
    if (isLocked()) {
      setError(`Too many failed attempts. Try again in ${lockoutRemaining()}.`);
      return;
    }

    // ── Client-side validation ────────────────────────────────────────────
    if (!password)       { setError('Password is required.'); return; }
    if (!newPhone)       { setError('New M-Pesa number is required.'); return; }
    if (!confirmPhone)   { setError('Please confirm your new number.'); return; }
    if (!MPESA_REGEX.test(newPhone.replace(/\s/g, ''))) {
      setError('Enter a valid Kenyan M-Pesa number (e.g. 0712345678 or +254712345678).');
      return;
    }

    const normalizedNew = normalizeKenyanPhone(newPhone.replace(/\s/g, ''));
    const normalizedConfirm = normalizeKenyanPhone(confirmPhone.replace(/\s/g, ''));

    if (normalizedNew !== normalizedConfirm) {
      setError('Phone numbers do not match.');
      return;
    }
    if (currentPhone && normalizedNew === currentPhone) {
      setError('Your new M-Pesa number must be different from the current one.');
      return;
    }

    setLoading(true);
    try {
      // ── 1. Verify password by re-authenticating ───────────────────────
      const email = user?.email;
      if (!email) { setError('Session expired. Please log in again.'); setLoading(false); return; }

      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        if (newAttempts >= MAX_ATTEMPTS) {
          setLockedUntil(Date.now() + LOCKOUT_MS);
          setError(`Too many failed attempts. Account locked for 15 minutes.`);
        } else {
          setError(`Incorrect password. Please try again. (${MAX_ATTEMPTS - newAttempts} attempts remaining)`);
        }
        setLoading(false);
        return;
      }

      // Reset attempt counter on success
      setAttempts(0);
      setShowPw(false);

      // ── 2. Check uniqueness — no other account using this number ──────
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', normalizedNew)
        .neq('id', user!.id)
        .maybeSingle();

      if (existing) {
        setError('This phone number is already linked to another account.');
        setLoading(false);
        return;
      }

      // ── 3. Update profile ─────────────────────────────────────────────
      const now = new Date().toISOString();
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({
          phone:          normalizedNew,
          phone_verified: true,
          updated_at:     now,
        })
        .eq('id', user!.id);

      if (updateErr) {
        setError(`Failed to update: ${updateErr.message}`);
        setLoading(false);
        return;
      }

      // ── 4. Write audit log ────────────────────────────────────────────
      await supabase.from('mpesa_change_log').insert({
        user_id:          user!.id,
        previous_phone:   currentPhone,
        new_phone:        normalizedNew,
        password_verified: true,
        user_agent:       navigator.userAgent,
        ip_address:       null, // IP only available server-side
      });

      // ── 5. Update local store ─────────────────────────────────────────
      useAuthStore.setState((s) => ({
        profile: s.profile ? { ...s.profile, phone: normalizedNew } : null,
      }));

      setStep('success');
      onSuccess(normalizedNew);

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unexpected error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[300] flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          role="dialog" aria-modal="true" aria-label="Change M-Pesa Number"
        >
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            className="relative z-10 w-full max-w-md flex flex-col rounded-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(160deg, #0d0020 0%, #050010 100%)',
              border: '1px solid rgba(255,215,0,0.2)',
              boxShadow: '0 0 60px rgba(255,215,0,0.08), 0 24px 80px rgba(0,0,0,0.8)',
            }}
            initial={{ scale: 0.92, y: 12, opacity: 0 }}
            animate={{ scale: 1,    y: 0,  opacity: 1 }}
            exit={{ scale: 0.92,    y: 12, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
              <div>
                <p className="font-orbitron text-xs text-white/30 tracking-widest uppercase mb-0.5">Account Settings</p>
                <h2 className="font-orbitron text-lg font-bold text-yellow-400 tracking-wider">
                  Change M-Pesa Number
                </h2>
              </div>
              <button onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-all">
                ✕
              </button>
            </div>

            {step === 'success' ? (
              /* ── Success ── */
              <div className="px-6 py-8 flex flex-col items-center text-center gap-4">
                <span className="text-5xl">✅</span>
                <div>
                  <p className="font-orbitron text-base font-bold text-green-400 tracking-wider mb-2">
                    NUMBER UPDATED
                  </p>
                  <p className="text-white/60 text-sm leading-relaxed">
                    Your M-Pesa number has been updated to{' '}
                    <span className="text-white font-semibold">
                      {displayPhone(normalizeKenyanPhone(newPhone))}
                    </span>
                  </p>
                </div>
                <div
                  className="w-full rounded-xl px-4 py-3 text-xs text-yellow-400/80 font-orbitron text-center"
                  style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.15)' }}
                >
                  ⏳ For your security, withdrawals to the new number will be enabled after 24 hours.
                </div>
                <div
                  className="w-full rounded-xl px-4 py-3 text-xs text-white/50 text-center"
                  style={{ background: 'rgba(255,68,68,0.06)', border: '1px solid rgba(255,68,68,0.15)' }}
                >
                  If you did not authorise this change, contact support immediately.
                </div>
                <button
                  onClick={onClose}
                  className="w-full py-3 rounded-xl font-orbitron text-sm font-bold tracking-widest text-black transition-all hover:brightness-110"
                  style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)' }}
                >
                  DONE
                </button>
              </div>
            ) : (
              <div className="px-6 py-5 flex flex-col gap-4">

                {/* Current number — read only display */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-orbitron text-xs text-white/40 tracking-widest uppercase">
                    Current M-Pesa Number
                  </label>
                  <div
                    className="flex items-center gap-3 rounded-xl px-4 py-3 border"
                    style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}
                  >
                    <span className="text-white/70 text-sm flex-1">
                      {currentPhone ? displayPhone(currentPhone) : '—'}
                    </span>
                    {currentPhone && (
                      <span className="text-[10px] font-orbitron px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 shrink-0">
                        ✓ VERIFIED
                      </span>
                    )}
                  </div>
                </div>

                {/* New number */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="mpesa-new-phone" className="font-orbitron text-xs text-white/50 tracking-widest uppercase">
                    New M-Pesa Number <span className="text-yellow-400">*</span>
                  </label>
                  <div className="flex items-center rounded-xl overflow-hidden border border-white/10 focus-within:border-yellow-400/60 transition-all duration-200" style={{ background: 'rgba(13,0,32,0.85)' }}>
                    <span className="px-3 py-3 text-sm text-yellow-400 font-orbitron font-bold border-r border-white/10 shrink-0 select-none">+254</span>
                    <input
                      id="mpesa-new-phone"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      name="mpesa-new-phone-field"
                      value={newPhone}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '').slice(0, 9);
                        setNewPhone(digits);
                        setError('');
                      }}
                      placeholder="712 345 678"
                      maxLength={9}
                      className="flex-1 px-3 py-3 text-sm text-white placeholder-gray-600 outline-none bg-transparent"
                    />
                  </div>
                </div>

                {/* Confirm new number */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="mpesa-confirm-phone" className="font-orbitron text-xs text-white/50 tracking-widest uppercase">
                    Confirm New Number <span className="text-yellow-400">*</span>
                  </label>
                  <div className="flex items-center rounded-xl overflow-hidden border border-white/10 focus-within:border-yellow-400/60 transition-all duration-200" style={{ background: 'rgba(13,0,32,0.85)' }}>
                    <span className="px-3 py-3 text-sm text-yellow-400 font-orbitron font-bold border-r border-white/10 shrink-0 select-none">+254</span>
                    <input
                      id="mpesa-confirm-phone"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      name="mpesa-confirm-phone-field"
                      value={confirmPhone}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '').slice(0, 9);
                        setConfirmPhone(digits);
                        setError('');
                      }}
                      placeholder="712 345 678"
                      maxLength={9}
                      className="flex-1 px-3 py-3 text-sm text-white placeholder-gray-600 outline-none bg-transparent"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="mpesa-current-password"
                    className="font-orbitron text-xs text-white/50 tracking-widest uppercase"
                  >
                    Current Password <span className="text-yellow-400" aria-hidden="true">*</span>
                  </label>

                  <div
                    className={`pw-field-wrap flex items-center rounded-xl border transition-all duration-200
                      ${error && error.toLowerCase().includes('password')
                        ? 'border-red-500/60 shadow-[0_0_0_2px_rgba(239,68,68,0.15)]'
                        : 'border-white/10 focus-within:border-yellow-400/70 focus-within:shadow-[0_0_0_2px_rgba(255,215,0,0.12)]'
                      }`}
                    style={{ background: 'rgba(13,0,32,0.85)' }}
                  >
                    {/* Lock icon */}
                    <span
                      className="flex items-center justify-center w-11 h-11 shrink-0 text-gray-500 transition-colors duration-200"
                      aria-hidden="true"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                    </span>

                    {/* Input */}
                    <input
                      id="mpesa-current-password"
                      type={showPw ? 'text' : 'password'}
                      autoComplete="new-password"
                      name="mpesa-password-field"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(''); }}
                      placeholder="Enter your password to confirm"
                      disabled={loading}
                      aria-required="true"
                      aria-invalid={error && error.toLowerCase().includes('password') ? 'true' : 'false'}
                      aria-describedby="pw-helper pw-error"
                      className="pw-input flex-1 min-w-0 py-3 text-sm text-white placeholder-gray-600 outline-none bg-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                    />

                    {/* Show/hide toggle */}
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      disabled={loading}
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                      aria-pressed={showPw}
                      className="flex items-center justify-center w-11 h-11 shrink-0 text-gray-500 hover:text-yellow-400 focus-visible:text-yellow-400 focus-visible:outline-none transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50"
                    >
                      {showPw ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      )}
                    </button>
                  </div>

                  <p id="pw-helper" className="flex items-center gap-1.5 text-white/30 text-[10px] font-orbitron mt-0.5">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    Your password is required to authorise this change.
                  </p>

                  {error && error.toLowerCase().includes('password') && (
                    <p id="pw-error" className="flex items-center gap-1.5 text-red-400 text-[10px] font-orbitron" role="alert">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      {error}
                    </p>
                  )}
                </div>

                {/* Non-password errors */}
                {error && !error.toLowerCase().includes('password') && (
                  <div className="rounded-xl px-4 py-3 text-xs font-orbitron bg-red-500/10 border border-red-500/30 text-red-400" role="alert">
                    {error}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    className="flex-1 py-3 rounded-xl font-orbitron text-sm text-white/60 border border-white/15 hover:bg-white/5 transition-all disabled:opacity-40"
                  >
                    CANCEL
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSubmit()}
                    disabled={loading || isLocked() || !password.trim()}
                    className="flex-1 py-3 rounded-xl font-orbitron text-sm font-bold tracking-widest text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:brightness-110"
                    style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)', boxShadow: loading ? 'none' : '0 0 16px rgba(255,215,0,0.3)' }}
                  >
                    {loading && <span className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />}
                    {loading ? 'VERIFYING...' : 'UPDATE NUMBER'}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
