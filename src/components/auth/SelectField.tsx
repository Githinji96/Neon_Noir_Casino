import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Option {
  value: string;
  label: string;
  flag?: string;
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  searchable?: boolean;
  loading?: boolean;
}

export default function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select...',
  searchable = false,
  loading = false,
}: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = searchable
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(search.toLowerCase()) ||
          o.value.toLowerCase().includes(search.toLowerCase())
      )
    : options;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      <label className="font-orbitron text-xs text-gray-400 tracking-wider uppercase">
        {label}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => { if (!loading) { setOpen((o) => !o); setSearch(''); } }}
          className="w-full rounded-xl px-4 py-3 text-sm text-left outline-none transition-all duration-200 flex items-center justify-between gap-2"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: open ? '1px solid rgba(255,215,0,0.6)' : '1px solid rgba(255,255,255,0.1)',
            boxShadow: open ? '0 0 0 2px rgba(255,215,0,0.1)' : 'none',
            color: selected ? '#fff' : '#4b5563',
          }}
        >
          <span className="flex items-center gap-2 truncate min-w-0">
            {selected?.flag && <span className="text-base shrink-0">{selected.flag}</span>}
            <span className="truncate">
              {loading ? 'Loading...' : selected ? selected.label : placeholder}
            </span>
          </span>
          <span
            className="text-gray-500 shrink-0 transition-transform duration-200"
            style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            ▾
          </span>
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -8, scaleY: 0.95 }}
              animate={{ opacity: 1, y: 0, scaleY: 1 }}
              exit={{ opacity: 0, y: -8, scaleY: 0.95 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                right: 0,
                zIndex: 100,
                background: '#0f0f1a',
                border: '1px solid rgba(255,215,0,0.2)',
                borderRadius: '12px',
                boxShadow: '0 16px 48px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05)',
                overflow: 'hidden',
                transformOrigin: 'top',
              }}
            >
              {searchable && (
                <div className="p-2 border-b border-white/10">
                  <input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search..."
                    className="w-full bg-white/5 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none border border-white/10 focus:border-yellow-400/40"
                  />
                </div>
              )}
              <div className="overflow-y-auto" style={{ maxHeight: '220px' }}>
                {filtered.length === 0 ? (
                  <p className="text-gray-500 text-xs text-center py-4">No results</p>
                ) : (
                  filtered.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { onChange(opt.value); setOpen(false); setSearch(''); }}
                      className="w-full text-left px-4 py-2.5 text-sm transition-colors duration-150 flex items-center gap-2"
                      style={{
                        color: opt.value === value ? '#FFD700' : '#d1d5db',
                        background: opt.value === value ? 'rgba(255,215,0,0.08)' : 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (opt.value !== value)
                          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)';
                      }}
                      onMouseLeave={(e) => {
                        if (opt.value !== value)
                          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                      }}
                    >
                      {opt.flag && <span className="text-base shrink-0">{opt.flag}</span>}
                      <span className="truncate">{opt.label}</span>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
