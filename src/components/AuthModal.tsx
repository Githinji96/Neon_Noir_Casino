import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after a successful login, before the modal closes. */
  onSuccess?: () => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const { signIn } = useAuthStore();
  const navigate   = useNavigate();

  // Clear credentials and errors every time the modal opens or closes
  useEffect(() => {
    if (!isOpen) {
      setEmail('');
      setPassword('');
      setError('');
      setLoading(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const err = await signIn(email, password);

    setLoading(false);
    if (err) { setError(err); return; }

    // Clear fields before success callback / close so they aren't visible
    setEmail('');
    setPassword('');

    if (onSuccess) {
      onSuccess();
    } else {
      onClose();
    }
  };

  const inputClass =
    'w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm ' +
    'placeholder-gray-500 focus:outline-none focus:border-yellow-400/60 transition-colors';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative w-full max-w-sm bg-gray-900 border border-white/10 rounded-2xl p-6 shadow-2xl"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Close (✕) button ─────────────────────────────────────── */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close sign-in modal"
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                width={16}
                height={16}
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <h2 className="font-orbitron text-xl font-bold text-yellow-300 tracking-widest text-center mb-6">
              SIGN IN
            </h2>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input
                className={inputClass}
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
              <input
                className={inputClass}
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />

              {error && <p className="text-red-400 text-xs text-center">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full py-2.5 rounded-lg font-orbitron text-sm font-bold tracking-widest bg-yellow-400 text-black hover:bg-yellow-300 disabled:opacity-50 transition-colors"
              >
                {loading ? 'SIGNING IN…' : 'SIGN IN'}
              </button>
            </form>

            <p className="text-center text-gray-500 text-xs mt-4">
              Don&apos;t have an account?{' '}
              <button
                className="text-yellow-400 hover:text-yellow-300 transition-colors"
                onClick={() => { navigate('/auth/signup'); onClose(); }}
              >
                Sign up
              </button>
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
