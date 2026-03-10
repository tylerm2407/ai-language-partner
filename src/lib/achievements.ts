export type Achievement = {
  id: string
  title: string
  description: string
  icon: string
  xp_reward: number
  category: 'streak' | 'conversation' | 'lesson' | 'mastery' | 'social'
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'streak_3', title: '3-Day Streak', description: 'Practice 3 days in a row', icon: '🔥', xp_reward: 25, category: 'streak' },
  { id: 'streak_7', title: 'Week Warrior', description: 'Practice 7 days in a row', icon: '🔥', xp_reward: 75, category: 'streak' },
  { id: 'streak_14', title: 'Fortnight Force', description: 'Practice 14 days in a row', icon: '⚡', xp_reward: 150, category: 'streak' },
  { id: 'streak_30', title: 'Monthly Master', description: 'Practice 30 days in a row', icon: '🏆', xp_reward: 300, category: 'streak' },
  { id: 'streak_100', title: 'Century Club', description: 'Practice 100 days in a row', icon: '💎', xp_reward: 1000, category: 'streak' },
  { id: 'first_convo', title: 'First Words', description: 'Complete your first conversation', icon: '💬', xp_reward: 50, category: 'conversation' },
  { id: 'convo_10', title: 'Chatterbox', description: 'Complete 10 conversations', icon: '🗣️', xp_reward: 100, category: 'conversation' },
  { id: 'convo_50', title: 'Conversationalist', description: 'Complete 50 conversations', icon: '🎙️', xp_reward: 250, category: 'conversation' },
  { id: 'convo_100', title: 'Fluent Speaker', description: 'Complete 100 conversations', icon: '🌟', xp_reward: 500, category: 'conversation' },
  { id: 'long_convo', title: 'Deep Diver', description: 'Have a conversation over 10 minutes', icon: '⏱️', xp_reward: 75, category: 'conversation' },
  { id: 'perfect_convo', title: 'Flawless', description: 'Complete a conversation with no corrections', icon: '✨', xp_reward: 100, category: 'conversation' },
  { id: 'multilingual', title: 'Multilingual', description: 'Have conversations in 3 different languages', icon: '🌍', xp_reward: 200, category: 'conversation' },
  { id: 'xp_500', title: 'Rising Star', description: 'Earn 500 total XP', icon: '⭐', xp_reward: 25, category: 'mastery' },
  { id: 'xp_2000', title: 'Scholar', description: 'Earn 2,000 total XP', icon: '📚', xp_reward: 50, category: 'mastery' },
  { id: 'xp_10000', title: 'Linguist', description: 'Earn 10,000 total XP', icon: '🎓', xp_reward: 200, category: 'mastery' },
  { id: 'xp_50000', title: 'Polyglot', description: 'Earn 50,000 total XP', icon: '🌐', xp_reward: 1000, category: 'mastery' },
  { id: 'daily_goal', title: 'Goal Getter', description: 'Hit your daily XP goal for the first time', icon: '🎯', xp_reward: 30, category: 'mastery' },
  { id: 'daily_goal_7', title: 'On a Roll', description: 'Hit your daily XP goal 7 days in a row', icon: '🎯', xp_reward: 100, category: 'mastery' },
  { id: 'first_lesson', title: 'Student', description: 'Complete your first lesson', icon: '📖', xp_reward: 20, category: 'lesson' },
  { id: 'lesson_10', title: 'Dedicated', description: 'Complete 10 lessons', icon: '📝', xp_reward: 75, category: 'lesson' },
  { id: 'lesson_50', title: 'Committed', description: 'Complete 50 lessons', icon: '🏅', xp_reward: 200, category: 'lesson' },
  { id: 'perfect_lesson', title: 'Perfectionist', description: 'Get 100% on a lesson', icon: '💯', xp_reward: 50, category: 'lesson' },
]

export const LEVELS = [
  { name: 'Novice', minXP: 0, maxXP: 500, color: 'from-gray-400 to-gray-500' },
  { name: 'Apprentice', minXP: 500, maxXP: 1500, color: 'from-green-400 to-green-500' },
  { name: 'Explorer', minXP: 1500, maxXP: 3000, color: 'from-blue-400 to-blue-500' },
  { name: 'Scholar', minXP: 3000, maxXP: 6000, color: 'from-purple-400 to-purple-500' },
  { name: 'Expert', minXP: 6000, maxXP: 12000, color: 'from-yellow-400 to-yellow-500' },
  { name: 'Master', minXP: 12000, maxXP: 25000, color: 'from-orange-400 to-orange-500' },
  { name: 'Grandmaster', minXP: 25000, maxXP: 50000, color: 'from-red-400 to-red-500' },
  { name: 'Legendary', minXP: 50000, maxXP: Infinity, color: 'from-cyan-400 to-pink-500' },
]

export function getLevelInfo(totalXP: number) {
  const level = [...LEVELS].reverse().find(l => totalXP >= l.minXP) || LEVELS[0]
  const levelIndex = LEVELS.indexOf(level)
  const nextLevel = LEVELS[levelIndex + 1]
  const progressInLevel = totalXP - level.minXP
  const xpNeededForLevel = (nextLevel?.minXP ?? level.maxXP) - level.minXP
  const progressPercent = Math.min((progressInLevel / xpNeededForLevel) * 100, 100)
  return { level, levelIndex: levelIndex + 1, nextLevel, progressPercent, progressInLevel, xpNeededForLevel }
}
