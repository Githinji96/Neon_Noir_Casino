import React, { createContext, useCallback, useContext, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = (id: string) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  const iconMap: Record<ToastType, string> = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
  };

  const colorMap: Record<ToastType, string> = {
    success: 'border-green-500/50 text-green-400',
    error: 'border-red-500/50 text-red-400',
    info: 'border-blue-500/50 text-blue-400',
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 80 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 80 }}
              transition={{ duration: 0.25 }}
              className={`pointer-events-auto flex items-center gap-3 rounded-xl border bg-[#111118]/90 backdrop-blur px-4 py-3 shadow-glass min-w-[260px] max-w-sm ${colorMap[t.type]}`}
            >
              <span className="text-lg">{iconMap[t.type]}</span>
              <p className="flex-1 text-sm text-white/90">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                className="text-white/40 hover:text-white/80 transition-colors text-xs"
              >
                ✕
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export default ToastProvider;
