// Duolingo-inspired gamification system

export const LEAGUES = ['bronze', 'silver', 'gold', 'diamond', 'legendary'] as const
export type League = typeof LEAGUES[number]

export const LEAGUE_CONFIG: Record<League, { name: string; color: string; icon: string; minXP: number }> = {
  bronze: { name: 'Bronze', color: '#CD7F32', icon: '🥉', minXP: 0 },
  silver: { name: 'Silver', color: '#C0C0C0', icon: '🥈', minXP: 100 },
  gold: { name: 'Gold', color: '#FFD700', icon: '🥇', minXP: 300 },
  diamond: { name: 'Diamond', color: '#B9F2FF', icon: '💎', minXP: 500 },
  legendary: { name: 'Legendary', color: '#FF6B6B', icon: '👑', minXP: 1000 },
}

export function getLeagueInfo(league: League) {
  return LEAGUE_CONFIG[league] || LEAGUE_CONFIG.bronze
}

export function getNextLeague(league: League): League | null {
  const idx = LEAGUES.indexOf(league)
  return idx < LEAGUES.length - 1 ? LEAGUES[idx + 1] : null
}

// Streak multiplier calculation
export function getStreakMultiplier(streakDays: number): { multiplier: number; label: string } {
  if (streakDays >= 14) return { multiplier: 2.0, label: '2x XP' }
  if (streakDays >= 7) return { multiplier: 1.5, label: '1.5x XP' }
  if (streakDays >= 3) return { multiplier: 1.2, label: '1.2x XP' }
  return { multiplier: 1.0, label: '' }
}

// Heart regeneration
export function getHeartsInfo(hearts: number, maxHearts: number, lastRegenAt: string) {
  const now = Date.now()
  const lastRegen = new Date(lastRegenAt).getTime()
  const hoursElapsed = (now - lastRegen) / (1000 * 60 * 60)
  const heartsToRegen = Math.floor(hoursElapsed / 4)
  const currentHearts = Math.min(hearts + heartsToRegen, maxHearts)
  const nextRegenIn = heartsToRegen > 0 ? 0 : Math.max(0, 4 * 60 - Math.floor((hoursElapsed % 4) * 60))

  return {
    current: currentHearts,
    max: maxHearts,
    nextRegenMinutes: currentHearts >= maxHearts ? null : nextRegenIn,
    isFull: currentHearts >= maxHearts,
  }
}

// Quest display helpers
export const QUEST_TYPE_CONFIG: Record<string, { label: string; icon: string; unit: string }> = {
  complete_lessons: { label: 'Complete lessons', icon: '📚', unit: 'lessons' },
  earn_xp: { label: 'Earn XP', icon: '⚡', unit: 'XP' },
  practice_minutes: { label: 'Practice', icon: '⏱️', unit: 'minutes' },
  review_cards: { label: 'Review cards', icon: '🧠', unit: 'cards' },
  perfect_lesson: { label: 'Perfect lesson', icon: '🎯', unit: 'perfect' },
  conversation: { label: 'Have a conversation', icon: '💬', unit: 'conversations' },
  streak_maintain: { label: 'Maintain streak', icon: '🔥', unit: 'days' },
}

export function getQuestConfig(questType: string) {
  return QUEST_TYPE_CONFIG[questType] || { label: questType, icon: '❓', unit: '' }
}

// Gem shop items
export const GEM_SHOP_ITEMS = [
  { id: 'streak_freeze', name: 'Streak Freeze', description: 'Protects your streak for 1 missed day', cost: 200, icon: '🧊', maxOwnable: 2 },
  { id: 'heart_refill', name: 'Heart Refill', description: 'Instantly refill all hearts', cost: 100, icon: '❤️‍🩹', maxOwnable: null },
  { id: 'double_xp', name: 'Double XP', description: '2x XP boost for 1 hour', cost: 150, icon: '🚀', maxOwnable: null },
] as const

// Practice calendar helpers
export function getPracticeStreak(calendar: Array<{ practice_date: string; xp_earned: number }>): {
  currentStreak: number
  longestStreak: number
  thisWeekDays: number
} {
  if (calendar.length === 0) return { currentStreak: 0, longestStreak: 0, thisWeekDays: 0 }

  const today = new Date().toISOString().split('T')[0]
  const dates = new Set(calendar.map(c => c.practice_date))

  let currentStreak = 0
  let longestStreak = 0
  let tempStreak = 0
  const d = new Date(today)

  // Count current streak backwards from today
  while (dates.has(d.toISOString().split('T')[0])) {
    currentStreak++
    d.setDate(d.getDate() - 1)
  }

  // Count longest streak
  const sortedDates = [...dates].sort()
  for (let i = 0; i < sortedDates.length; i++) {
    if (i === 0) {
      tempStreak = 1
    } else {
      const prev = new Date(sortedDates[i - 1])
      const curr = new Date(sortedDates[i])
      const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
      tempStreak = diffDays === 1 ? tempStreak + 1 : 1
    }
    longestStreak = Math.max(longestStreak, tempStreak)
  }

  // This week
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)
  const thisWeekDays = calendar.filter(c => c.practice_date >= weekStart.toISOString().split('T')[0]).length

  return { currentStreak, longestStreak, thisWeekDays }
}
