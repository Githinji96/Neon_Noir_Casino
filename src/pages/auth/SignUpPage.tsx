import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import AuthCard from '../../components/auth/AuthCard';
import InputField from '../../components/auth/InputField';
import PasswordField from '../../components/auth/PasswordField';
import AuthButton from '../../components/auth/AuthButton';
import AuthAlert from '../../components/auth/AuthAlert';
import { signUpSchema, type SignUpFormData, normalizeKenyanPhone } from '../../services/authSchemas';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';

export default function SignUpPage() {
  const navigate   = useNavigate();
  const { signUp } = useAuthStore();

  const [serverError, setServerError] = useState('');
  const [success, setSuccess]         = useState(false);
  const [loading, setLoading]         = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    mode: 'onChange', // validate on every keystroke for real-time feedback
  });

  const passwordValue = watch('password', '');

  // ── Max date for DOB — must be 18+ ─────────────────────────────────────
  const maxDOB = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d.toISOString().split('T')[0];
  })();

  const onSubmit = async (data: SignUpFormData) => {
    setServerError('');
    setLoading(true);

    // Normalise phone to 2547XXXXXXXX before saving
    const normalizedPhone = normalizeKenyanPhone(data.phone);

    const err = await signUp(
      data.email.toLowerCase().trim(),
      data.password,
      data.username.trim(),
      normalizedPhone,
      data.firstName.trim(),
      data.lastName.trim(),
      data.dateOfBirth,
    );

    setLoading(false);
    if (err) {
      setServerError(err);
      return;
    }

    // Phone is written by the DB trigger via raw_user_meta_data.
    // As a belt-and-braces fallback, also write it directly once the
    // session is established. We use signInWithPassword immediately after
    // signUp (Supabase auto-confirms in dev; in prod with email confirm the
    // session won't exist yet so the update is a no-op and that's fine).
    if (normalizedPhone) {
      try {
        // Give the trigger up to 3 seconds to create the profile row
        for (let attempt = 0; attempt < 3; attempt++) {
          await new Promise((r) => setTimeout(r, 800));
          const { data: { user: sessionUser } } = await supabase.auth.getUser();
          if (!sessionUser?.id) continue;

          const { error: phoneErr } = await supabase
            .from('profiles')
            .update({ phone: normalizedPhone, phone_verified: true })
            .eq('id', sessionUser.id)
            .is('phone', null);   // only patch if phone is still null (avoid overwriting)

          if (!phoneErr) break;
        }
      } catch {
        // silent — phone will be backfilled on next login via refreshBalance
      }
    }

    setSuccess(true);
    setTimeout(() => navigate('/'), 2500);
  };

  // ── Success screen ──────────────────────────────────────────────────────
  if (success) {
    return (
      <AuthCard title="" subtitle="">
        <div className="flex flex-col items-center text-center gap-5 py-4">
          <span className="text-6xl">🎉</span>
          <div>
            <h2 className="font-orbitron text-2xl font-bold text-yellow-400 tracking-wider mb-2">
              WELCOME TO NEON NOIR!
            </h2>
            <p className="text-white/70 text-sm leading-relaxed">
              Your account has been created successfully.<br />
              Redirecting you to the casino…
            </p>
          </div>
          <div className="w-8 h-8 rounded-full border-2 border-yellow-400 border-t-transparent animate-spin" />
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Create Account" subtitle="Join Neon Noir Casino — it's free">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>

        {serverError && <AuthAlert type="error" message={serverError} />}

        {/* First + Last name */}
        <div className="grid grid-cols-2 gap-3">
          <InputField
            label="First Name"
            placeholder="John"
            icon="👤"
            error={errors.firstName?.message}
            {...register('firstName')}
          />
          <InputField
            label="Last Name"
            placeholder="Doe"
            icon="👤"
            error={errors.lastName?.message}
            {...register('lastName')}
          />
        </div>

        {/* Username */}
        <InputField
          label="Username"
          placeholder="CyberPlayer99"
          icon="🎮"
          error={errors.username?.message}
          {...register('username')}
        />

        {/* Email */}
        <InputField
          label="Email Address"
          type="email"
          placeholder="player@example.com"
          icon="✉️"
          error={errors.email?.message}
          {...register('email')}
        />

        {/* Phone — M-Pesa */}
        <div className="flex flex-col gap-1.5">
          <label className="font-orbitron text-xs text-gray-400 tracking-wider uppercase">
            M-Pesa Number <span className="text-yellow-400">*</span>
          </label>
          <div className={`flex items-center rounded-xl overflow-hidden border transition-all bg-white/5
            ${errors.phone
              ? 'border-red-500/60'
              : 'border-white/10 focus-within:border-yellow-400/60'}`}>
            <span className="px-3 py-3 text-sm text-yellow-400 font-orbitron font-bold border-r border-white/10 shrink-0">
              +254
            </span>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="712 345 678"
              className="flex-1 px-3 py-3 text-sm text-white placeholder-gray-600 outline-none bg-transparent"
              {...register('phone')}
            />
          </div>
          {errors.phone
            ? <p className="text-red-400 text-xs flex items-center gap-1"><span>⚠</span> {errors.phone.message}</p>
            : <p className="text-white/25 text-xs">This becomes your verified withdrawal number</p>}
        </div>

        {/* Date of Birth */}
        <div className="flex flex-col gap-1.5">
          <label className="font-orbitron text-xs text-gray-400 tracking-wider uppercase">
            Date of Birth <span className="text-yellow-400">*</span>
          </label>
          <input
            type="date"
            max={maxDOB}
            className={`w-full rounded-xl px-4 py-3 text-sm text-white outline-none transition-all
              bg-white/5 border focus:bg-white/8
              ${errors.dateOfBirth
                ? 'border-red-500/60 focus:border-red-400'
                : 'border-white/10 focus:border-yellow-400/60'}`}
            style={{ colorScheme: 'dark' }}
            {...register('dateOfBirth')}
          />
          {errors.dateOfBirth && (
            <p className="text-red-400 text-xs flex items-center gap-1">
              <span>⚠</span> {errors.dateOfBirth.message}
            </p>
          )}
        </div>

        {/* Password */}
        <PasswordField
          label="Password"
          placeholder="Min 8 chars, uppercase, number, symbol"
          error={errors.password?.message}
          showStrength
          watchedValue={passwordValue}
          {...register('password')}
        />

        {/* Confirm password */}
        <PasswordField
          label="Confirm Password"
          placeholder="Repeat your password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        {/* Age confirmation */}
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            {...register('ageConfirm')}
            className="w-4 h-4 mt-0.5 rounded accent-yellow-400 shrink-0"
          />
          <span className="text-gray-400 text-xs leading-relaxed">
            I confirm that I am at least <span className="text-white font-semibold">18 years old</span>
          </span>
        </label>
        {errors.ageConfirm && (
          <p className="text-red-400 text-xs -mt-2">⚠ {errors.ageConfirm.message}</p>
        )}

        {/* Terms */}
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            {...register('terms')}
            className="w-4 h-4 mt-0.5 rounded accent-yellow-400 shrink-0"
          />
          <span className="text-gray-400 text-xs leading-relaxed">
            I have read and agree to the{' '}
            <Link to="/terms" target="_blank" rel="noopener noreferrer"
              className="underline hover:opacity-80 transition-opacity" style={{ color: '#FFD700' }}>
              Terms & Conditions
            </Link>
            {' '}and{' '}
            <Link to="/privacy-policy" target="_blank" rel="noopener noreferrer"
              className="underline hover:opacity-80 transition-opacity" style={{ color: '#FFD700' }}>
              Privacy Policy
            </Link>
          </span>
        </label>
        {errors.terms && (
          <p className="text-red-400 text-xs -mt-2">⚠ {errors.terms.message}</p>
        )}

        {/* Submit — disabled until all fields valid */}
        <AuthButton type="submit" loading={loading} disabled={!isValid || loading}>
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
