import { useState } from 'react';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { register, handleSubmit, watch, formState: { errors } } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const passwordValue = watch('password', '');

  const onSubmit = async (data: ResetPasswordFormData) => {
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password: data.password });
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setSuccess('Password updated! Redirecting to sign in...');
      setTimeout(() => navigate('/auth/login'), 2500);
    }
  };

  return (
    <AuthCard title="New Password" subtitle="Choose a strong password for your account">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {error && <AuthAlert type="error" message={error} />}
        {success && <AuthAlert type="success" message={success} />}

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

        <AuthButton type="submit" loading={loading} disabled={!!success}>
          UPDATE PASSWORD
        </AuthButton>
      </form>
    </AuthCard>
  );
}
