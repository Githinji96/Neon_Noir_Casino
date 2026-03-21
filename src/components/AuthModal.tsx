import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const { signIn, signUp } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    let err: string | null = null;
    if (mode === 'signin') {
      err = await signIn(email, password);
    } else {
      if (!username.trim()) { setError('Username is required'); setLoading(false); return; }
      err = await signUp(email, password, username);
      if (!err) setSuccess('Check your email to confirm your account.');
    }

    setLoading(false);
    if (err) { setError(err); return; }
    if (mode === 'signin') onClose();
  };

  const inputClass =
    'w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-yellow-400/60 transition-colors';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-sm bg-gray-900 border border-white/10 rounded-2xl p-6 shadow-2xl"
            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-orbitron text-xl font-bold text-yellow-300 tracking-widest text-center mb-6">
              {mode === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}
            </h2>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {mode === 'signup' && (
                <input
                  className={inputClass}
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                />
              )}
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
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                required
              />

              {error && <p className="text-red-400 text-xs text-center">{error}</p>}
              {success && <p className="text-green-400 text-xs text-center">{success}</p>}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full py-2.5 rounded-lg font-orbitron text-sm font-bold tracking-widest bg-yellow-400 text-black hover:bg-yellow-300 disabled:opacity-50 transition-colors"
              >
                {loading ? '...' : mode === 'signin' ? 'SIGN IN' : 'SIGN UP'}
              </button>
            </form>

            <p className="text-center text-gray-500 text-xs mt-4">
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <button
                className="text-yellow-400 hover:text-yellow-300 transition-colors"
                onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setSuccess(''); }}
              >
                {mode === 'signin' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
