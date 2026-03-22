import { ButtonHTMLAttributes } from 'react';
import { motion } from 'framer-motion';

interface AuthButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: 'primary' | 'secondary';
}

export default function AuthButton({
  children,
  loading,
  variant = 'primary',
  disabled,
  ...props
}: AuthButtonProps) {
  const isPrimary = variant === 'primary';

  return (
    <motion.button
      whileHover={!disabled && !loading ? { scale: 1.02 } : {}}
      whileTap={!disabled && !loading ? { scale: 0.98 } : {}}
      disabled={disabled || loading}
      type={props.type ?? 'button'}
      onClick={props.onClick}
      onSubmit={props.onSubmit}
      form={props.form}
      name={props.name}
      value={props.value}
      aria-label={props['aria-label']}
      className={`w-full py-3 rounded-xl font-orbitron text-sm font-bold tracking-widest transition-all duration-200 flex items-center justify-center gap-2
        ${isPrimary
          ? 'text-black disabled:opacity-50'
          : 'border border-white/20 text-gray-300 hover:border-white/40 hover:text-white bg-transparent disabled:opacity-40'
        }`}
      style={isPrimary ? {
        background: disabled || loading
          ? 'rgba(255,215,0,0.4)'
          : 'linear-gradient(135deg, #FFD700, #FFA500)',
        boxShadow: disabled || loading ? 'none' : '0 0 20px rgba(255,215,0,0.3)',
      } : {}}
    >
      {loading ? (
        <>
          <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
          <span>LOADING...</span>
        </>
      ) : children}
    </motion.button>
  );
}
