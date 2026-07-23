import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface ResetConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  message: string;
  confirmLabel: string;
  /** What will be reset — shown as a bullet list under the message */
  resets: string[];
  /** What will NOT be touched */
  preserves: string[];
}

export default function ResetConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  resets,
  preserves,
}: ResetConfirmModalProps) {
  const [typed, setTyped] = useState('');
  const [loading, setLoading] = useState(false);

  // Reset state whenever modal opens
  useEffect(() => {
    if (isOpen) { setTyped(''); setLoading(false); }
  }, [isOpen]);

  const canConfirm = typed.trim().toUpperCase() === 'RESET' && !loading;

  async function handleConfirm() {
    if (!canConfirm) return;
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

          <motion.div
            className="relative z-10 w-full max-w-lg bg-[#0f0f1a] border border-rose-500/30 rounded-2xl p-6 shadow-2xl flex flex-col gap-4"
            initial={{ scale: 0.92, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Header */}
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5">⚠️</span>
              <div>
                <h2 className="font-orbitron text-lg font-bold text-rose-400">{title}</h2>
                <p className="text-white/60 text-sm mt-1">{message}</p>
              </div>
            </div>

            {/* What gets reset */}
            <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.2)' }}>
              <div>
                <p className="text-rose-400 text-xs font-semibold uppercase tracking-widest mb-1.5">Will be reset to 0:</p>
                <ul className="flex flex-col gap-1">
                  {resets.map((r) => (
                    <li key={r} className="flex items-center gap-2 text-white/70 text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-green-400 text-xs font-semibold uppercase tracking-widest mb-1.5">Will NOT be affected:</p>
                <ul className="flex flex-col gap-1">
                  {preserves.map((p) => (
                    <li key={p} className="flex items-center gap-2 text-white/50 text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-600 shrink-0" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Typed confirmation */}
            <div className="flex flex-col gap-1.5">
              <label className="text-white/50 text-xs uppercase tracking-widest">
                Type <span className="text-rose-400 font-bold font-mono">RESET</span> to confirm
              </label>
              <input
                type="text"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                placeholder="RESET"
                autoFocus
                className="bg-white/5 border border-white/10 focus:border-rose-500/60 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none transition-colors font-mono tracking-widest"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-1">
              <button
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-white/10 text-white/70 hover:bg-white/15 hover:text-white text-sm transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={!canConfirm}
                className="px-5 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
                style={canConfirm ? { background: 'linear-gradient(135deg,#e11d48,#9f1239)', color: '#fff', boxShadow: '0 0 16px rgba(225,29,72,0.4)' } : { background: 'rgba(225,29,72,0.2)', color: 'rgba(255,255,255,0.4)' }}
              >
                {loading && <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
