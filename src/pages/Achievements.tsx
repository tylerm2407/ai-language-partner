import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { ACHIEVEMENTS, getLevelInfo, LEVELS, type Achievement } from '@/lib/achievements'
import DashboardLayout from '@/components/DashboardLayout'
import { motion } from 'framer-motion'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { Zap, Lock, CheckCircle, Trophy, Flame, BookOpen, MessageSquare, Star } from 'lucide-react'

const CATEGORY_META: Record<string, { label: string; icon: typeof Zap }> = {
  streak: { label: 'Streak', icon: Flame },
  conversation: { label: 'Conversation', icon: MessageSquare },
  lesson: { label: 'Lessons', icon: BookOpen },
  mastery: { label: 'Mastery', icon: Star },
  social: { label: 'Social', icon: Trophy },
}

export default function Achievements() {
  const { user, profile } = useAuth()
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    if (!user) return
    supabase
      .from('user_achievements')
      .select('achievement_id')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data) setUnlockedIds(new Set(data.map((d: any) => d.achievement_id)))
      })
  }, [user])

  const totalXP = profile?.total_xp ?? 0
  const levelInfo = getLevelInfo(totalXP)
  const unlockedCount = unlockedIds.size
  const totalCount = ACHIEVEMENTS.length
  const overallPercent = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0

  const categories = ['all', ...Object.keys(CATEGORY_META)]
  const filtered = filter === 'all' ? ACHIEVEMENTS : ACHIEVEMENTS.filter(a => a.category === filter)

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-5 sm:space-y-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-primary" /> Achievements
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            {unlockedCount} of {totalCount} unlocked ({overallPercent}%)
          </p>
        </motion.div>

        {/* Level card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="rounded-2xl border border-border bg-card p-4 sm:p-6"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className={cn('text-base sm:text-lg font-bold bg-gradient-to-r bg-clip-text text-transparent', levelInfo.level.color)}>
                {levelInfo.level.name}
              </span>
              <span className="text-muted-foreground text-xs sm:text-sm ml-2">Level {levelInfo.levelIndex}</span>
            </div>
            <span className="text-xs sm:text-sm font-medium">{totalXP.toLocaleString()} XP</span>
          </div>
          <Progress value={levelInfo.progressPercent} className="h-2 mb-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{levelInfo.progressInLevel.toLocaleString()} / {levelInfo.xpNeededForLevel.toLocaleString()} XP</span>
            {levelInfo.nextLevel && <span>Next: {levelInfo.nextLevel.name}</span>}
          </div>
        </motion.div>

        {/* Category filter — horizontally scrollable on mobile */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
          {categories.map(cat => {
            const meta = CATEGORY_META[cat]
            const Icon = meta?.icon
            return (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap min-h-[36px] flex-shrink-0',
                  filter === cat
                    ? 'bg-primary/10 text-primary border border-primary/30'
                    : 'bg-secondary text-muted-foreground border border-border hover:border-primary/20'
                )}
              >
                {Icon && <Icon className="w-3 h-3" />}
                {cat === 'all' ? 'All' : meta?.label}
              </button>
            )
          })}
        </div>

        {/* Achievement grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filtered.map((ach, i) => {
            const unlocked = unlockedIds.has(ach.id)
            return (
              <motion.div
                key={ach.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.03 }}
                className={cn(
                  'rounded-2xl border p-4 sm:p-5 transition-all relative overflow-hidden',
                  unlocked
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-border bg-card opacity-60'
                )}
              >
                {unlocked && (
                  <div className="absolute top-3 right-3">
                    <CheckCircle className="w-5 h-5 text-primary" />
                  </div>
                )}
                {!unlocked && (
                  <div className="absolute top-3 right-3">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
                <div className="text-2xl sm:text-3xl mb-2 sm:mb-3">{ach.icon}</div>
                <h3 className="font-semibold text-sm">{ach.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">{ach.description}</p>
                <div className="mt-2 sm:mt-3 flex items-center gap-1 text-xs">
                  <Zap className="w-3 h-3 text-primary" />
                  <span className="text-primary font-medium">+{ach.xp_reward} XP</span>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </DashboardLayout>
  )
}
