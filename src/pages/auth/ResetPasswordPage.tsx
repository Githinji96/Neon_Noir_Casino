import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import AuthCard from '../../components/auth/AuthCard';
import PasswordField from '../../components/auth/PasswordField';
import AuthButton from '../../components/auth/AuthButton';
import AuthAlert from '../../components/auth/AuthAlert';
import { resetPasswordSchema, type ResetPasswordFormData } from '../../services/authSchemas';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [success, setSuccess]           = useState('');
  const [sessionReady, setSessionReady] = useState(false);
  const [linkExpired, setLinkExpired]   = useState(false);

  // Track whether the user completed the reset — used in the cleanup to decide
  // whether to sign them out when they leave this page.
  const completedReset = useRef(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const passwordValue = watch('password', '');

  // Exchange the code/token from the URL on mount so the session is ready.
  // This effect intentionally has NO cleanup — the code exchange is a one-shot
  // operation and should not be interfered with by React StrictMode remounting.
  useEffect(() => {
    let cancelled = false;

    const href   = window.location.href;
    const hash   = window.location.hash;
    const search = window.location.search;

    const hasCode        = search.includes('code=');
    const hasAccessToken = hash.includes('access_token=') || href.includes('access_token=');

    if (hasCode) {
      supabase.auth.exchangeCodeForSession(href)
        .then(({ error: err }) => {
          if (cancelled) return;
          if (err) {
            console.warn('[ResetPasswordPage] exchangeCodeForSession failed:', err.message);
            setLinkExpired(true);
          } else {
            setSessionReady(true);
          }
        })
        .catch(() => { if (!cancelled) setLinkExpired(true); });
    } else if (hasAccessToken) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (cancelled) return;
        if (session) setSessionReady(true);
        else setLinkExpired(true);
      });
    } else {
      setLinkExpired(true);
    }

    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Security: once the session IS established, register an unmount handler
  // that signs the user out if they leave without completing the reset.
  // Separating this from the exchange effect prevents the StrictMode
  // double-invoke from signing out during the initial code exchange.
  useEffect(() => {
    if (!sessionReady) return;  // only arm after session is confirmed

    return () => {
      if (!completedReset.current) {
        // Sign out asynchronously — best effort, do not block navigation
        supabase.auth.signOut().catch(() => {});
      }
    };
  }, [sessionReady]);

  const onSubmit = async (data: ResetPasswordFormData) => {
    setError('');
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password: data.password });
      if (err) {
        setError(err.message);
      } else {
        completedReset.current = true;
        setSuccess('Password updated successfully! Redirecting to login...');
        // Clear store synchronously so Navbar reflects logged-out immediately
        useAuthStore.setState({ user: null, profile: null, loading: false });
        // Sign out on Supabase side (async)
        supabase.auth.signOut().catch(() => {});
        setTimeout(() => navigate('/auth/login', { replace: true }), 2000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    // Clear store first (synchronous) so the Navbar shows logged-out immediately
    useAuthStore.setState({ user: null, profile: null, loading: false });
    completedReset.current = true; // prevent double sign-out from cleanup
    // Then sign out on Supabase side (async, best-effort)
    supabase.auth.signOut().catch(() => {});
    navigate('/auth/login', { replace: true });
  };

  return (
    <AuthCard title="New Password" subtitle="Choose a strong password for your account">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {linkExpired && !success && (
          <AuthAlert
            type="error"
            message="This reset link has expired or is invalid. Please request a new one."
          />
        )}
        {error && <AuthAlert type="error" message={error} />}
        {success && <AuthAlert type="success" message={success} />}

        {!sessionReady && !linkExpired && !success && (
          <div className="flex items-center justify-center py-4 gap-3">
            <div className="w-5 h-5 rounded-full border-2 border-yellow-400 border-t-transparent animate-spin" />
            <span className="text-gray-400 text-sm font-orbitron">Verifying link...</span>
          </div>
        )}

        {(sessionReady || linkExpired) && (
          <>
            <PasswordField
              label="New Password"
              placeholder="Min 8 chars, 1 number, 1 special"
              error={errors.password?.message}
              showStrength
              watchedValue={passwordValue}
              {...register('password')}
            />

            <PasswordField
              label="Confirm New Password"
              placeholder="Repeat your new password"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />

            <AuthButton
              type="submit"
              loading={loading}
              disabled={!!success || linkExpired}
            >
              UPDATE PASSWORD
            </AuthButton>

            {/* Cancel button — signs out and returns to login */}
            {!success && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={loading}
                className="text-center text-xs font-orbitron tracking-wider text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-40"
              >
                Cancel — return to login
              </button>
            )}

            {linkExpired && (
              <a
                href="/auth/forgot-password"
                className="text-center text-xs font-orbitron tracking-wider transition-colors hover:opacity-80"
                style={{ color: '#FFD700' }}
              >
                Request a new reset link →
              </a>
            )}
          </>
        )}
      </form>
    </AuthCard>
  );
}
