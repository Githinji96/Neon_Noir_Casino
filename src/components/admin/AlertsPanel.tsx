import { AdminAlert } from '../../store/adminStore';

interface AlertsPanelProps {
  alerts: AdminAlert[];
  onDismiss: (id: string) => void;
}

const severityBadge: Record<AdminAlert['severity'], string> = {
  high: 'bg-red-500/20 text-red-400 border border-red-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  low: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
};

const typeIcon: Record<AdminAlert['type'], string> = {
  rtp_deviation: '⚠️',
  large_payout: '💰',
  fraud_flag: '🚨',
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AlertsPanel({ alerts, onDismiss }: AlertsPanelProps) {
  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2 text-white/40">
        <span className="text-3xl">✅</span>
        <p className="text-sm">No active alerts</p>
      </div>
    );
  }

  return (
    <div className="max-h-96 overflow-y-auto flex flex-col gap-2 pr-1">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl p-3"
        >
          <span className="text-xl mt-0.5">{typeIcon[alert.type]}</span>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide ${severityBadge[alert.severity]}`}>
                {alert.severity}
              </span>
              <span className="text-white/30 text-xs">{relativeTime(alert.created_at)}</span>
            </div>
            <p className="text-white/80 text-sm leading-snug">{alert.message}</p>
          </div>

          <button
            onClick={() => onDismiss(alert.id)}
            className="text-white/30 hover:text-white/70 transition-colors text-sm mt-0.5 shrink-0"
            aria-label="Dismiss alert"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
