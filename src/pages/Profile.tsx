import { useAuth } from '@/contexts/AuthContext'
import { getLevelInfo } from '@/lib/achievements'
import { LANGUAGE_FLAGS } from '@/lib/claude'
import DashboardLayout from '@/components/DashboardLayout'
import { Progress } from '@/components/ui/progress'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Flame, Star, Zap, Heart, Crown, Target, Calendar } from 'lucide-react'

export default function Profile() {
  const { profile } = useAuth()

  const totalXP = profile?.total_xp ?? 0
  const levelInfo = getLevelInfo(totalXP)
  const isPro = profile?.subscription_tier === 'pro' || profile?.subscription_tier === 'family'
  const joinDate = profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : ''

  const stats = [
    { icon: Star, label: 'Total XP', value: totalXP.toLocaleString(), color: 'text-primary' },
    { icon: Flame, label: 'Day Streak', value: profile?.streak_days ?? 0, color: 'text-orange-400' },
    { icon: Target, label: 'Daily Goal', value: `${profile?.today_xp ?? 0}/${profile?.daily_goal_xp ?? 50}`, color: 'text-primary' },
    { icon: Heart, label: 'Hearts', value: isPro ? '∞' : (profile?.hearts ?? 5), color: 'text-destructive' },
  ]

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-5 sm:space-y-8">
        {/* Profile header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card p-5 sm:p-6 text-center"
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xl sm:text-2xl font-bold text-primary-foreground mx-auto mb-3 sm:mb-4">
            {(profile?.full_name || profile?.username || 'U')[0].toUpperCase()}
          </div>
          <h1 className="text-lg sm:text-xl font-bold flex items-center justify-center gap-2">
            {profile?.full_name || profile?.username || 'Learner'}
            {isPro && <Crown className="w-5 h-5 text-primary" />}
          </h1>
          {profile?.username && profile?.full_name && (
            <p className="text-muted-foreground text-sm">@{profile.username}</p>
          )}
          <div className="flex items-center justify-center gap-2 mt-2 text-sm text-muted-foreground flex-wrap">
            <span>{LANGUAGE_FLAGS[profile?.target_language || ''] || '🌐'} Learning {profile?.target_language}</span>
            <span>·</span>
            <span className="capitalize">{profile?.level}</span>
          </div>
          {joinDate && (
            <div className="flex items-center justify-center gap-1 mt-1 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" /> Joined {joinDate}
            </div>
          )}
        </motion.div>

        {/* Level progress */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="rounded-2xl border border-border bg-card p-4 sm:p-5"
        >
          <div className="flex items-center justify-between mb-2">
            <span className={cn('font-bold bg-gradient-to-r bg-clip-text text-transparent', levelInfo.level.color)}>
              {levelInfo.level.name}
            </span>
            <span className="text-sm text-muted-foreground">Level {levelInfo.levelIndex}</span>
          </div>
          <Progress value={levelInfo.progressPercent} className="h-2 mb-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{levelInfo.progressInLevel.toLocaleString()} / {levelInfo.xpNeededForLevel.toLocaleString()} XP</span>
            {levelInfo.nextLevel && <span>Next: {levelInfo.nextLevel.name}</span>}
          </div>
        </motion.div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.08 + i * 0.04 }}
              className="rounded-2xl border border-border bg-card p-3 sm:p-4 flex items-center gap-3"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                <s.icon className={cn('w-4 h-4 sm:w-5 sm:h-5', s.color)} />
              </div>
              <div className="min-w-0">
                <div className="text-lg sm:text-xl font-bold">{s.value}</div>
                <div className="text-[10px] sm:text-xs text-muted-foreground">{s.label}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Subscription */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="rounded-2xl border border-border bg-card p-4 sm:p-5"
        >
          <h2 className="font-semibold text-sm mb-2">Subscription</h2>
          <div className="flex items-center gap-2">
            <div className={cn(
              'px-3 py-1 rounded-full text-xs font-medium',
              isPro ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'
            )}>
              {isPro ? 'Pro' : 'Free'}
            </div>
            <span className="text-sm text-muted-foreground capitalize">{profile?.subscription_tier || 'free'} plan</span>
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  )
}
