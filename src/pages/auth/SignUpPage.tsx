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
  const { signUp } = useAuthStore();
  const { countries, loading: countriesLoading } = useCountries();
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, watch, control, setValue, formState: { errors } } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
  });

  const passwordValue = watch('password', '');

  const onSubmit = async (data: SignUpFormData) => {
    setServerError('');
    setSuccessMsg('');
    setLoading(true);
    const err = await signUp(data.email, data.password, data.username);
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
            I agree to the{' '}
            <span className="underline cursor-pointer" style={{ color: '#FFD700' }}>Terms & Conditions</span>
            {' '}and{' '}
            <span className="underline cursor-pointer" style={{ color: '#FFD700' }}>Privacy Policy</span>
          </span>
        </label>
        {errors.terms && (
          <p className="text-red-400 text-xs -mt-2">⚠ {errors.terms.message}</p>
        )}

        <AuthButton type="submit" loading={loading}>
          CREATE ACCOUNT
        </AuthButton>

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
