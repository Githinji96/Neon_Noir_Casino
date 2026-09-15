import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
}: ConfirmModalProps) {
  const [loading, setLoading] = useState(false);

  // Reset loading state when modal opens
  useEffect(() => {
    if (isOpen) setLoading(false);
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !loading) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, loading, onClose]);

  async function handleConfirm() {
    if (loading) return;
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
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => !loading && onClose()}
          />

          {/* Dialog */}
          <motion.div
            className="relative z-10 w-full max-w-sm"
            style={{
              background: 'linear-gradient(160deg, #0d0d1a 0%, #060610 100%)',
              border: danger
                ? '1px solid rgba(239,68,68,0.3)'
                : '1px solid rgba(255,215,0,0.2)',
              borderRadius: '1rem',
              boxShadow: danger
                ? '0 0 40px rgba(239,68,68,0.15), 0 20px 60px rgba(0,0,0,0.8)'
                : '0 0 40px rgba(255,215,0,0.08), 0 20px 60px rgba(0,0,0,0.8)',
            }}
            initial={{ scale: 0.9, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          >
            <div className="p-6">
              {/* Icon + Title */}
              <div className="flex items-start gap-3 mb-3">
                <span className="text-2xl shrink-0 mt-0.5">
                  {danger ? '🗑️' : '⚠️'}
                </span>
                <h2
                  id="confirm-modal-title"
                  className="font-orbitron text-base font-bold tracking-wider"
                  style={{ color: danger ? '#f87171' : '#FFD700' }}
                >
                  {title}
                </h2>
              </div>

              {/* Message */}
              <p className="text-white/60 text-sm leading-relaxed mb-6 ml-9">
                {message}
              </p>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-white/8 text-white/70 hover:bg-white/15 hover:text-white text-sm transition-colors disabled:opacity-40 font-orbitron tracking-wider"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="px-5 py-2 rounded-lg text-sm font-bold font-orbitron tracking-wider transition-all
                    disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  style={danger ? {
                    background: loading ? 'rgba(220,38,38,0.4)' : 'linear-gradient(135deg,#dc2626,#991b1b)',
                    color: '#fff',
                    boxShadow: loading ? 'none' : '0 0 16px rgba(220,38,38,0.3)',
                  } : {
                    background: loading ? 'rgba(255,215,0,0.4)' : 'linear-gradient(135deg,#FFD700,#FFA500)',
                    color: '#000',
                    boxShadow: loading ? 'none' : '0 0 16px rgba(255,215,0,0.3)',
                  }}
                >
                  {loading && (
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  )}
                  {loading ? 'Processing...' : confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
