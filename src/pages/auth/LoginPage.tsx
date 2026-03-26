import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import AuthCard from '../../components/auth/AuthCard';
import InputField from '../../components/auth/InputField';
import PasswordField from '../../components/auth/PasswordField';
import AuthButton from '../../components/auth/AuthButton';
import AuthAlert from '../../components/auth/AuthAlert';
import { loginSchema, type LoginFormData } from '../../services/authSchemas';
import { useAuthStore } from '../../store/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuthStore();
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  // Where to go after successful login — default to home
  const from = (location.state as { from?: { pathname: string; state?: unknown } } | null)?.from;

  const { register, handleSubmit, watch, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const passwordValue = watch('password', '');

  const onSubmit = async (data: LoginFormData) => {
    setServerError('');
    setLoading(true);
    const err = await signIn(data.email, data.password);
    setLoading(false);
    if (err) {
      setServerError(err);
    } else {
      // Navigate back to where the user was trying to go, preserving state
      if (from) {
        navigate(from.pathname, { state: from.state, replace: true });
      } else {
        navigate('/');
      }
    }
  };

  return (
    <AuthCard title="Welcome Back" subtitle="Sign in to your account to continue playing">
      <form onSubmit={handleSubmit(onSubmit)} autoComplete="off" className="flex flex-col gap-4">
        {serverError && <AuthAlert type="error" message={serverError} />}

        <InputField
          label="Email"
          type="email"
          placeholder="player@example.com"
          icon="✉️"
          autoComplete="off"
          error={errors.email?.message}
          {...register('email')}
        />

        <PasswordField
          label="Password"
          placeholder="Enter your password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />

        {/* Remember me + Forgot password */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              {...register('rememberMe')}
              className="w-4 h-4 rounded accent-yellow-400"
            />
            <span className="text-gray-400 text-xs">Remember me</span>
          </label>
          <Link
            to="/auth/forgot-password"
            className="text-xs font-orbitron tracking-wider transition-colors"
            style={{ color: '#FFD700' }}
          >
            Forgot Password?
          </Link>
        </div>

        <AuthButton type="submit" loading={loading}>
          SIGN IN
        </AuthButton>

        {/* Divider */}
        <div className="flex items-center gap-3 my-1">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-gray-600 text-xs">OR</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Social login */}
        <div className="grid grid-cols-2 gap-3">
          <AuthButton type="button" variant="secondary">
            <span>G</span> Google
          </AuthButton>
          <AuthButton type="button" variant="secondary">
            <span>🍎</span> Apple
          </AuthButton>
        </div>

        <p className="text-center text-gray-500 text-xs mt-2">
          Don't have an account?{' '}
          <Link to="/auth/signup" className="font-semibold transition-colors hover:opacity-80"
            style={{ color: '#FFD700' }}>
            Sign Up
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
