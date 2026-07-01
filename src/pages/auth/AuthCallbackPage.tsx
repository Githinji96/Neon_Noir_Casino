/**
 * OAuth Callback Page
 * Supabase redirects here after Google/Apple sign-in.
 * The onAuthStateChange listener in authStore handles the session automatically.
 * We just need to redirect the user to the right place.
 */
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Exchange the code in the URL for a session
    supabase.auth.exchangeCodeForSession(window.location.href).then(({ error }) => {
      if (error) {
        navigate('/auth/login?error=' + encodeURIComponent(error.message), { replace: true });
        return;
      }
      // Redirect to intended destination or home
      const params = new URLSearchParams(location.search);
      const next = params.get('next') ?? '/';
      navigate(next, { replace: true });
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-yellow-400 border-t-transparent animate-spin" />
        <span className="font-orbitron text-yellow-300 tracking-widest text-sm">SIGNING IN...</span>
      </div>
    </div>
  );
}
