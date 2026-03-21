import { motion, AnimatePresence } from 'framer-motion';

interface AuthAlertProps {
  type: 'error' | 'success';
  message: string;
}

export default function AuthAlert({ type, message }: AuthAlertProps) {
  if (!message) return null;

  const isError = type === 'error';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="rounded-xl px-4 py-3 text-sm flex items-start gap-2"
        style={{
          background: isError ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
          border: `1px solid ${isError ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
          color: isError ? '#fca5a5' : '#86efac',
        }}
      >
        <span>{isError ? '⚠️' : '✅'}</span>
        <span>{message}</span>
      </motion.div>
    </AnimatePresence>
  );
}
