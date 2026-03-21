import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import AuthCard from '../../components/auth/AuthCard';
import InputField from '../../components/auth/InputField';
import AuthButton from '../../components/auth/AuthButton';
import AuthAlert from '../../components/auth/AuthAlert';
import { forgotPasswordSchema, type ForgotPasswordFormData } from '../../services/authSchemas';
import { supabase } from '../../lib/supabase';

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const { register, handleSubmit, getValues, formState: { errors } } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setSent(true);
    }
  };

  return (
    <AuthCard
      title="Reset Password"
      subtitle="Enter your email and we'll send you a reset link"
    >
      <AnimatePresence mode="wait">
        {sent ? (
          <motion.div
            key="sent"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4 py-4 text-center"
          >
            <div className="text-5xl">📧</div>
            <div>
              <p className="font-orbitron text-white font-bold tracking-wider">Check Your Email</p>
              <p className="text-gray-400 text-sm mt-2">
                We sent a reset link to{' '}
                <span style={{ color: '#FFD700' }}>{getValues('email')}</span>
              </p>
              <p className="text-gray-500 text-xs mt-3">
                Didn't receive it? Check your spam folder or try again.
              </p>
            </div>
            <button
              onClick={() => setSent(false)}
              className="text-xs font-orbitron tracking-wider transition-colors hover:opacity-80"
              style={{ color: '#FFD700' }}
            >
              Try Again
            </button>
            <Link
              to="/auth/login"
              className="text-gray-500 text-xs hover:text-gray-300 transition-colors"
            >
              ← Back to Sign In
            </Link>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            {error && <AuthAlert type="error" message={error} />}

            <InputField
              label="Email"
              type="email"
              placeholder="player@example.com"
              icon="✉️"
              error={errors.email?.message}
              {...register('email')}
            />

            <AuthButton type="submit" loading={loading}>
              SEND RESET LINK
            </AuthButton>

            <Link
              to="/auth/login"
              className="text-center text-gray-500 text-xs hover:text-gray-300 transition-colors"
            >
              ← Back to Sign In
            </Link>
          </motion.form>
        )}
      </AnimatePresence>
    </AuthCard>
  );
}
