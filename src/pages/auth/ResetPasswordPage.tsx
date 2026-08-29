import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import AuthCard from '../../components/auth/AuthCard';
import PasswordField from '../../components/auth/PasswordField';
import AuthButton from '../../components/auth/AuthButton';
import AuthAlert from '../../components/auth/AuthAlert';
import { resetPasswordSchema, type ResetPasswordFormData } from '../../services/authSchemas';
import { supabase } from '../../lib/supabase';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');
  const [sessionReady, setSessionReady] = useState(false);
  const [linkExpired, setLinkExpired]   = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const passwordValue = watch('password', '');

  // Exchange the code/token from the URL on mount so the session is ready
  useEffect(() => {
    const href   = window.location.href;
    const hash   = window.location.hash;
    const search = window.location.search;

    const hasCode        = search.includes('code=');
    const hasAccessToken = hash.includes('access_token=') || href.includes('access_token=');

    if (hasCode) {
      // PKCE flow — exchange code for session
      supabase.auth.exchangeCodeForSession(href)
        .then(({ error: err }) => {
          if (err) {
            console.warn('[ResetPasswordPage] exchangeCodeForSession failed:', err.message);
            setLinkExpired(true);
          } else {
            setSessionReady(true);
          }
        })
        .catch(() => setLinkExpired(true));
    } else if (hasAccessToken) {
      // Implicit flow — Supabase JS detects the hash token automatically via
      // detectSessionInUrl: true. Verify the session loaded correctly.
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setSessionReady(true);
        } else {
          setLinkExpired(true);
        }
      });
    } else {
      // No token in URL — likely navigated here directly or link is malformed
      setLinkExpired(true);
    }
  }, []);

  const onSubmit = async (data: ResetPasswordFormData) => {
    setError('');
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password: data.password });
      if (err) {
        setError(err.message);
      } else {
        setSuccess('Password updated successfully! Redirecting...');
        setTimeout(() => navigate('/auth/login'), 2000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
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
