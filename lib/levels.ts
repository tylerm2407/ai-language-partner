/**
 * XP levels and league tiers.
 *
 * XP thresholds: L1=0, L2=100, L5=700, L10=2500, L25=15000, L50=75000, L100=500000
 * Uses a smooth polynomial curve between these anchor points.
 *
 * Tiers: Bronze(1-10), Silver(11-25), Gold(26-50), Platinum(51-75), Diamond(76-100)
 */

export type LeagueTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

/** Pre-computed XP thresholds for all 100 levels */
const XP_THRESHOLDS: number[] = [];

// Anchor points: [level, xp]
const ANCHORS: [number, number][] = [
  [1, 0],
  [2, 100],
  [5, 700],
  [10, 2500],
  [25, 15000],
  [50, 75000],
  [100, 500000],
];

// Interpolate thresholds using piecewise linear between anchors
function buildThresholds(): void {
  for (let level = 1; level <= 100; level++) {
    let lower = ANCHORS[0];
    let upper = ANCHORS[ANCHORS.length - 1];
    for (let i = 0; i < ANCHORS.length - 1; i++) {
      if (level >= ANCHORS[i][0] && level <= ANCHORS[i + 1][0]) {
        lower = ANCHORS[i];
        upper = ANCHORS[i + 1];
        break;
      }
    }
    const t = (level - lower[0]) / (upper[0] - lower[0]);
    XP_THRESHOLDS[level] = Math.round(lower[1] + t * (upper[1] - lower[1]));
  }
}
buildThresholds();

/**
 * Get level from total XP. Returns 1-100.
 */
export function getLevelFromXp(totalXp: number): number {
  for (let level = 100; level >= 1; level--) {
    if (totalXp >= XP_THRESHOLDS[level]) return level;
  }
  return 1;
}

/**
 * Get XP progress within current level.
 */
export function getXpProgress(totalXp: number): {
  level: number;
  currentLevelXp: number;
  xpInLevel: number;
  xpToNextLevel: number;
  progress: number;
} {
  const level = getLevelFromXp(totalXp);
  const currentLevelXp = XP_THRESHOLDS[level];
  const nextLevelXp = level < 100 ? XP_THRESHOLDS[level + 1] : XP_THRESHOLDS[100];
  const xpInLevel = totalXp - currentLevelXp;
  const xpToNextLevel = nextLevelXp - currentLevelXp;
  const progress = level >= 100 ? 1 : xpToNextLevel > 0 ? xpInLevel / xpToNextLevel : 0;

  return { level, currentLevelXp, xpInLevel, xpToNextLevel, progress };
}

/**
 * Get league tier from level.
 */
export function getLeagueTier(level: number): LeagueTier {
  if (level >= 76) return 'diamond';
  if (level >= 51) return 'platinum';
  if (level >= 26) return 'gold';
  if (level >= 11) return 'silver';
  return 'bronze';
}

/**
 * XP threshold for a specific level.
 */
export function getXpForLevel(level: number): number {
  return XP_THRESHOLDS[Math.max(1, Math.min(level, 100))];
}

export const LEAGUE_TIERS: { tier: LeagueTier; label: string; color: string; minLevel: number; maxLevel: number }[] = [
  { tier: 'bronze', label: 'Bronze', color: '#CD7F32', minLevel: 1, maxLevel: 10 },
  { tier: 'silver', label: 'Silver', color: '#C0C0C0', minLevel: 11, maxLevel: 25 },
  { tier: 'gold', label: 'Gold', color: '#FFD700', minLevel: 26, maxLevel: 50 },
  { tier: 'platinum', label: 'Platinum', color: '#A78BFA', minLevel: 51, maxLevel: 75 },
  { tier: 'diamond', label: 'Diamond', color: '#38BDF8', minLevel: 76, maxLevel: 100 },
];

/**
 * Get league config for display.
 */
export function getLeagueConfig(tier: LeagueTier) {
  return LEAGUE_TIERS.find((t) => t.tier === tier) ?? LEAGUE_TIERS[0];
}
