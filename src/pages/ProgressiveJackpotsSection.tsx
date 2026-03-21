import { useEffect, useState } from 'react';
import JackpotCard from '../components/JackpotCard';
import { JACKPOT_DATA } from '../config/mockData';

interface ProgressiveJackpotsSectionProps {
  onSpinNow: () => void;
}

export default function ProgressiveJackpotsSection({ onSpinNow }: ProgressiveJackpotsSectionProps) {
  const [amounts, setAmounts] = useState<Record<string, number>>(
    () => Object.fromEntries(JACKPOT_DATA.map((j) => [j.id, j.baseAmount]))
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setAmounts((prev) => {
        const next = { ...prev };
        for (const j of JACKPOT_DATA) {
          next[j.id] = prev[j.id] + (Math.random() * 2.99 + 0.01);
        }
        return next;
      });
    }, 150);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-8">
      {/* Title — constrained to match other sections */}
      <div className="max-w-7xl mx-auto px-4 mb-6">
        <h2 className="font-orbitron font-bold text-xl tracking-widest text-white uppercase">
          Progressive Jackpots
        </h2>
        <div className="mt-2 h-0.5 w-16 bg-neon-yellow" style={{ boxShadow: '0 0 8px #FFD700' }} />
      </div>

      {/* Full-width scrollable row with padding so first/last cards align with content */}
      <div
        className="flex gap-4 overflow-x-auto pb-4 px-4"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          scrollSnapType: 'x mandatory',
          paddingLeft: 'max(1rem, calc((100vw - 80rem) / 2 + 1rem))',
          paddingRight: 'max(1rem, calc((100vw - 80rem) / 2 + 1rem))',
        }}
      >
        {JACKPOT_DATA.map((jackpot) => (
          <JackpotCard
            key={jackpot.id}
            name={jackpot.name}
            amount={amounts[jackpot.id]}
            tags={jackpot.tags}
            onSpinNow={onSpinNow}
          />
        ))}
      </div>
    </section>
  );
}
