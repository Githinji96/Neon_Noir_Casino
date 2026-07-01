export type VIPLevel = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface VIPTier {
  level: VIPLevel;
  label: string;
  minPoints: number;
  cashbackRate: number;    // % of net losses returned
  depositBonus: number;    // % bonus on deposits
  withdrawalPriority: 'standard' | 'fast' | 'instant';
  personalManager: boolean;
  color: string;
  glowColor: string;
  icon: string;
  pointsPerBetKES: number;     // points per KES bet
  pointsPerDepositKES: number; // points per KES deposited
}

export const VIP_TIERS: VIPTier[] = [
  {
    level: 'bronze',
    label: 'Bronze',
    minPoints: 0,
    cashbackRate: 1,
    depositBonus: 10,
    withdrawalPriority: 'standard',
    personalManager: false,
    color: '#CD7F32',
    glowColor: 'rgba(205,127,50,0.4)',
    icon: '🥉',
    pointsPerBetKES: 0.1,
    pointsPerDepositKES: 0.05,
  },
  {
    level: 'silver',
    label: 'Silver',
    minPoints: 1000,
    cashbackRate: 2,
    depositBonus: 25,
    withdrawalPriority: 'standard',
    personalManager: false,
    color: '#C0C0C0',
    glowColor: 'rgba(192,192,192,0.4)',
    icon: '🥈',
    pointsPerBetKES: 0.1,
    pointsPerDepositKES: 0.05,
  },
  {
    level: 'gold',
    label: 'Gold',
    minPoints: 5000,
    cashbackRate: 5,
    depositBonus: 50,
    withdrawalPriority: 'fast',
    personalManager: false,
    color: '#FFD700',
    glowColor: 'rgba(255,215,0,0.4)',
    icon: '🥇',
    pointsPerBetKES: 0.12,
    pointsPerDepositKES: 0.06,
  },
  {
    level: 'platinum',
    label: 'Platinum',
    minPoints: 20000,
    cashbackRate: 8,
    depositBonus: 75,
    withdrawalPriority: 'fast',
    personalManager: true,
    color: '#E5E4E2',
    glowColor: 'rgba(229,228,226,0.4)',
    icon: '💎',
    pointsPerBetKES: 0.15,
    pointsPerDepositKES: 0.08,
  },
  {
    level: 'diamond',
    label: 'Diamond',
    minPoints: 100000,
    cashbackRate: 12,
    depositBonus: 100,
    withdrawalPriority: 'instant',
    personalManager: true,
    color: '#B9F2FF',
    glowColor: 'rgba(185,242,255,0.5)',
    icon: '👑',
    pointsPerBetKES: 0.20,
    pointsPerDepositKES: 0.10,
  },
];

export function getTierForPoints(points: number): VIPTier {
  const sorted = [...VIP_TIERS].reverse();
  return sorted.find((t) => points >= t.minPoints) ?? VIP_TIERS[0];
}

export function getNextTier(current: VIPLevel): VIPTier | null {
  const idx = VIP_TIERS.findIndex((t) => t.level === current);
  return VIP_TIERS[idx + 1] ?? null;
}
