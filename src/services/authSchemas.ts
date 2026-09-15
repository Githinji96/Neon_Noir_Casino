import { z } from 'zod';

// ─── Password policy ──────────────────────────────────────────────────────────

export const passwordRules = z
  .string()
  .min(8, 'At least 8 characters')
  .regex(/[A-Z]/, 'Must contain at least 1 uppercase letter')
  .regex(/[a-z]/, 'Must contain at least 1 lowercase letter')
  .regex(/[0-9]/, 'Must contain at least 1 number')
  .regex(/[^A-Za-z0-9]/, 'Must contain at least 1 special character');

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email:      z.string().min(1, 'Email is required').email('Invalid email address'),
  password:   z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

export const signUpSchema = z.object({
  firstName: z
    .string()
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must be under 50 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'First name contains invalid characters'),

  lastName: z
    .string()
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name must be under 50 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'Last name contains invalid characters'),

  username: z
    .string()
    .min(4, 'Username must be 4–20 characters')
    .max(20, 'Username must be 4–20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers and underscores'),

  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email address'),

  phone: z
    .string()
    .min(1, 'M-Pesa number is required')
    .regex(
      /^(?:\+254|254|0)?([71]\d{8})$/,
      'Enter a valid Kenyan M-Pesa number (e.g. 0712345678 or +254712345678)'
    ),

  dateOfBirth: z
    .string()
    .min(1, 'Date of birth is required')
    .refine((val) => {
      const dob = new Date(val);
      const today = new Date();
      const age = today.getFullYear() - dob.getFullYear()
        - (today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
      return age >= 18;
    }, 'You must be 18 years or older to register'),

  password:        passwordRules,
  confirmPassword: z.string().min(1, 'Please confirm your password'),

  terms: z
    .boolean()
    .refine((v) => v === true, { message: 'You must accept the Terms & Conditions and Privacy Policy' }),

  ageConfirm: z
    .boolean()
    .refine((v) => v === true, { message: 'You must confirm you are at least 18 years old' }),

}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  password:        passwordRules,
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type LoginFormData        = z.infer<typeof loginSchema>;
export type SignUpFormData        = z.infer<typeof signUpSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData  = z.infer<typeof resetPasswordSchema>;

/** Normalise any Kenyan phone to 2547XXXXXXXX */
export function normalizeKenyanPhone(raw: string): string {
  // Strip everything except digits
  const digits = raw.replace(/\D/g, '');
  // Already full international format
  if (digits.startsWith('254') && digits.length === 12) return digits;
  // Strip leading 254 if present but too long
  if (digits.startsWith('254')) return '254' + digits.slice(3, 12);
  // Strip leading 0
  if (digits.startsWith('0'))   return '254' + digits.slice(1, 10);
  // Just the 9-digit suffix
  return '254' + digits.slice(0, 9);
}
