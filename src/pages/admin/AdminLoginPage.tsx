import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAdminStore } from '../../store/adminStore';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isTimeout = params.get('reason') === 'timeout';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. Check your internet connection.')), 15000)
      );
      const { data: authData, error: authError } = await Promise.race([
        supabase.auth.signInWithPassword({ email, password }),
        timeout,
      ]);

      if (authError) { setError(authError.message); setLoading(false); return; }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, admin_role')
        .eq('id', authData.user!.id)
        .single();

      if (profileError) {
        setError(`Profile fetch failed: ${profileError.message}`);
        setLoading(false);
        return;
      }

      if (!profile?.admin_role) {
        setError('Access denied: your account does not have admin privileges.');
        setLoading(false);
        return;
      }

      await useAdminStore.getState().init();
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8">
        <div className="text-center mb-8">
          <h1 className="font-orbitron text-3xl font-black text-[#FFD700] tracking-widest">NEON NOIR</h1>
          <p className="text-white/40 text-sm tracking-[0.3em] mt-1">ADMIN PANEL</p>
        </div>

        {isTimeout && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm">
            Session expired. Please sign in again.
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-white/50 text-xs uppercase tracking-widest">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-[#FFD700]/50 transition-colors text-sm"
              placeholder="admin@example.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-white/50 text-xs uppercase tracking-widest">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-[#FFD700]/50 transition-colors text-sm"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm px-1">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full py-3 rounded-xl bg-[#FFD700] text-black font-orbitron font-bold text-sm tracking-widest hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
            ) : 'SIGN IN'}
          </button>
        </form>
      </div>
    </div>
  );
}
