type CardColor = 'yellow' | 'purple' | 'cyan' | 'green' | 'red';

interface Trend {
  value: number;
  label: string;
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  trend?: Trend;
  color?: CardColor;
}

const colorMap: Record<CardColor, string> = {
  yellow: '#FFD700',
  purple: '#A855F7',
  cyan: '#00FFFF',
  green: '#22C55E',
  red: '#EF4444',
};

export default function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = 'yellow',
}: StatCardProps) {
  const hex = colorMap[color];
  const isPositive = trend && trend.value >= 0;

  return (
    <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-white/50 text-xs uppercase tracking-widest">{title}</span>
        {icon && <span className="text-xl">{icon}</span>}
      </div>

      <div className="flex items-end justify-between gap-2">
        <span
          className="font-orbitron text-2xl font-bold leading-none"
          style={{ color: hex }}
        >
          {value}
        </span>

        {trend && (
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              isPositive
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
            }`}
          >
            {isPositive ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="text-white/40 text-xs">{subtitle}</p>
      )}
    </div>
  );
}
