import { forwardRef, InputHTMLAttributes, ReactNode } from 'react';

interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  icon?: ReactNode;
  rightElement?: ReactNode;
}

const InputField = forwardRef<HTMLInputElement, InputFieldProps>(
  ({ label, error, icon, rightElement, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="font-orbitron text-xs text-gray-400 tracking-wider uppercase">
          {label}
        </label>
        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            {...props}
            className={`w-full rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 outline-none transition-all duration-200
              ${icon ? 'pl-10' : ''}
              ${rightElement ? 'pr-12' : ''}
              ${error
                ? 'border border-red-500/60 bg-red-500/5 focus:border-red-400 focus:shadow-[0_0_0_2px_rgba(239,68,68,0.15)]'
                : 'border border-white/10 bg-white/5 focus:border-yellow-400/60 focus:shadow-[0_0_0_2px_rgba(255,215,0,0.1)] focus:bg-white/8'
              }`}
          />
          {rightElement && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {rightElement}
            </span>
          )}
        </div>
        {error && (
          <p className="text-red-400 text-xs flex items-center gap-1">
            <span>⚠</span> {error}
          </p>
        )}
      </div>
    );
  }
);

InputField.displayName = 'InputField';
export default InputField;
