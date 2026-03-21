import { forwardRef, InputHTMLAttributes, useState } from 'react';
import InputField from './InputField';

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  error?: string;
  showStrength?: boolean;
  watchedValue?: string; // used only for strength meter, not passed to input
}

function getStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (password.length >= 12) score++;

  if (score <= 1) return { score, label: 'Weak', color: '#ef4444' };
  if (score <= 2) return { score, label: 'Fair', color: '#f97316' };
  if (score <= 3) return { score, label: 'Good', color: '#eab308' };
  return { score, label: 'Strong', color: '#22c55e' };
}

const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ label, error, showStrength, watchedValue = '', ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    const strength = showStrength ? getStrength(watchedValue) : null;

    return (
      <div className="flex flex-col gap-1">
        <InputField
          ref={ref}
          label={label}
          type={visible ? 'text' : 'password'}
          error={error}
          icon="🔒"
          rightElement={
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              className="text-gray-500 hover:text-gray-300 transition-colors text-sm"
              tabIndex={-1}
            >
              {visible ? '🙈' : '👁️'}
            </button>
          }
          {...props}
        />
        {showStrength && watchedValue.length > 0 && strength && (
          <div className="flex items-center gap-2 mt-1">
            <div className="flex gap-1 flex-1">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-1 flex-1 rounded-full transition-all duration-300"
                  style={{
                    background: i <= strength.score ? strength.color : 'rgba(255,255,255,0.1)',
                  }}
                />
              ))}
            </div>
            <span className="text-xs font-medium" style={{ color: strength.color }}>
              {strength.label}
            </span>
          </div>
        )}
      </div>
    );
  }
);

PasswordField.displayName = 'PasswordField';
export default PasswordField;
