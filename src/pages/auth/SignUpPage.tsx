import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import AuthCard from '../../components/auth/AuthCard';
import InputField from '../../components/auth/InputField';
import PasswordField from '../../components/auth/PasswordField';
import AuthButton from '../../components/auth/AuthButton';
import AuthAlert from '../../components/auth/AuthAlert';
import SelectField from '../../components/auth/SelectField';
import { CURRENCIES } from '../../config/localeData';
import { useCountries } from '../../hooks/useCountries';
import { signUpSchema, type SignUpFormData } from '../../services/authSchemas';
import { useAuthStore } from '../../store/authStore';

export default function SignUpPage() {
  const navigate = useNavigate();
  const { signUp, signInWithOAuth } = useAuthStore();
  const { countries, loading: countriesLoading } = useCountries();
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'apple' | null>(null);

  const handleOAuth = async (provider: 'google' | 'apple') => {
    setServerError('');
    setOauthLoading(provider);
    const err = await signInWithOAuth(provider);
    setOauthLoading(null);
    if (err) setServerError(err);
  };

  const { register, handleSubmit, watch, control, setValue, formState: { errors } } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
  });

  const passwordValue = watch('password', '');

  const onSubmit = async (data: SignUpFormData) => {
    setServerError('');
    setLoading(true);
    const err = await signUp(data.email, data.password, data.username, data.phone ?? '');
    setLoading(false);
    if (err) {
      setServerError(err);
    } else {
      navigate('/');
    }
  };

  return (
    <AuthCard title="Create Account" subtitle="Join Neon Noir Casino and start playing">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {serverError && <AuthAlert type="error" message={serverError} />}

        <InputField
          label="Username"
          placeholder="CyberPlayer99"
          icon="👤"
          error={errors.username?.message}
          {...register('username')}
        />

        <InputField
          label="Email"
          type="email"
          placeholder="player@example.com"
          icon="✉️"
          error={errors.email?.message}
          {...register('email')}
        />

        <div className="flex flex-col gap-1">
          <label className="font-orbitron text-xs text-white/60 tracking-widest uppercase">Phone (M-Pesa)</label>
          <div className="flex items-center rounded-xl overflow-hidden border border-white/10 focus-within:border-yellow-400/60 transition-all bg-white/5">
            <span className="px-3 py-3 text-sm text-yellow-400 font-orbitron font-bold border-r border-white/10 shrink-0">+254</span>
            <input
              type="tel"
              placeholder="7XXXXXXXX"
              className="flex-1 px-3 py-3 text-sm text-white placeholder-gray-600 outline-none bg-transparent"
              {...register('phone')}
            />
          </div>
          {errors.phone && <p className="text-red-400 text-xs">{errors.phone.message}</p>}
          <p className="text-white/20 text-xs">Used to pre-fill M-Pesa deposits</p>
        </div>

        <PasswordField
          label="Password"
          placeholder="Min 8 chars, 1 number, 1 special"
          error={errors.password?.message}
          showStrength
          watchedValue={passwordValue}
          {...register('password')}
        />

        <PasswordField
          label="Confirm Password"
          placeholder="Repeat your password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        {/* Country + Currency */}
        <div className="grid grid-cols-2 gap-3">
          <Controller
            name="country"
            control={control}
            defaultValue=""
            render={({ field }) => (
              <SelectField
                label="Country"
                value={field.value ?? ''}
                onChange={(val) => {
                  field.onChange(val);
                  // Auto-set currency based on country
                  const country = countries.find((c) => c.value === val);
                  if (country?.currency) {
                    const match = CURRENCIES.find((c) => c.value === country.currency);
                    if (match) setValue('currency', match.value);
                  }
                }}
                options={countries}
                placeholder="Select country"
                searchable
                loading={countriesLoading}
              />
            )}
          />
          <Controller
            name="currency"
            control={control}
            defaultValue="USD"
            render={({ field }) => (
              <SelectField
                label="Currency"
                value={field.value ?? 'USD'}
                onChange={field.onChange}
                options={CURRENCIES}
                placeholder="Select currency"
                searchable
              />
            )}
          />
        </div>

        {/* Terms */}
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            {...register('terms')}
            className="w-4 h-4 mt-0.5 rounded accent-yellow-400 shrink-0"
          />
          <span className="text-gray-400 text-xs leading-relaxed">
            I have read and agree to the{' '}
            <Link
              to="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:opacity-80 transition-opacity"
              style={{ color: '#FFD700' }}
            >
              Terms & Conditions
            </Link>
            {' '}and{' '}
            <Link
              to="/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:opacity-80 transition-opacity"
              style={{ color: '#FFD700' }}
            >
              Privacy Policy
            </Link>
          </span>
        </label>
        {errors.terms && (
          <p className="text-red-400 text-xs -mt-2">⚠ {errors.terms.message}</p>
        )}

        <AuthButton type="submit" loading={loading}>
          CREATE ACCOUNT
        </AuthButton>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-gray-600 text-xs">OR</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <AuthButton
            type="button"
            variant="secondary"
            loading={oauthLoading === 'google'}
            disabled={!!oauthLoading || loading}
            onClick={() => handleOAuth('google')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google
          </AuthButton>
          <AuthButton
            type="button"
            variant="secondary"
            loading={oauthLoading === 'apple'}
            disabled={!!oauthLoading || loading}
            onClick={() => handleOAuth('apple')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            Apple
          </AuthButton>
        </div>

        <p className="text-center text-gray-500 text-xs">
          Already have an account?{' '}
          <Link to="/auth/login" className="font-semibold hover:opacity-80 transition-colors"
            style={{ color: '#FFD700' }}>
            Sign In
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
