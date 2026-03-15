import { useAuth } from '@/contexts/AuthContext'
import { getLevelInfo } from '@/lib/achievements'
import { LANGUAGE_FLAGS } from '@/lib/claude'
import { getLeagueInfo, getStreakMultiplier, type League } from '@/lib/gamification'
import AppShell from '@/components/AppShell'
import { Progress } from '@/components/ui/progress'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Flame, Star, Zap, Heart, Crown, Target, Calendar, Settings, LogOut, Shield, Gem } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export default function Profile() {
  const { profile, signOut } = useAuth()

  const totalXP = profile?.total_xp ?? 0
  const levelInfo = getLevelInfo(totalXP)
  const isPro = profile?.subscription_tier !== 'free' && !!profile?.subscription_tier
  const leagueInfo = profile?.league ? getLeagueInfo(profile.league as League) : null
  const streakMultiplier = getStreakMultiplier(profile?.streak_days ?? 0)
  const joinDate = profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : ''

  const stats = [
    { icon: Star, label: 'Total XP', value: totalXP.toLocaleString(), color: 'text-primary' },
    { icon: Flame, label: 'Day Streak', value: `${profile?.streak_days ?? 0}d`, color: 'text-orange-400' },
    { icon: Target, label: 'Daily Goal', value: `${profile?.today_xp ?? 0}/${profile?.daily_goal_xp ?? 50}`, color: 'text-primary' },
    { icon: Heart, label: 'Hearts', value: isPro ? '∞' : (profile?.hearts ?? 5), color: 'text-destructive' },
    { icon: Gem, label: 'Gems', value: (profile?.gems ?? 0).toLocaleString(), color: 'text-amber-400' },
    { icon: Shield, label: 'Streak Freezes', value: profile?.streak_freeze_count ?? 0, color: 'text-blue-400' },
  ]

  return (
    <AppShell title="Profile">
      <div className="py-4 space-y-4">
        {/* Profile header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card p-5 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xl font-bold text-primary-foreground mx-auto mb-3">
            {(profile?.full_name || profile?.username || 'U')[0].toUpperCase()}
          </div>
          <h2 className="text-lg font-bold flex items-center justify-center gap-2">
            {profile?.full_name || profile?.username || 'Learner'}
            {isPro && <Crown className="w-5 h-5 text-primary" />}
          </h2>
          {profile?.username && profile?.full_name && (
            <p className="text-muted-foreground text-sm">@{profile.username}</p>
          )}
          <div className="flex items-center justify-center gap-2 mt-2 text-sm text-muted-foreground flex-wrap">
            <span>{LANGUAGE_FLAGS[profile?.target_language || ''] || '🌐'} Learning {profile?.target_language}</span>
            <span>·</span>
            <span className="capitalize">{profile?.level}</span>
          </div>
          <div className="flex items-center justify-center gap-3 mt-2">
            {leagueInfo && (
              <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full border', leagueInfo.color.replace('text-', 'border-').replace('400', '400/30'), leagueInfo.color, `bg-${leagueInfo.color.replace('text-', '').replace('-400', '-400/10')}`)}>
                {leagueInfo.icon} {leagueInfo.name} League
              </span>
            )}
            {streakMultiplier > 1 && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full border border-orange-400/30 text-orange-400 bg-orange-400/10">
                {streakMultiplier}x XP
              </span>
            )}
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
          className="rounded-2xl border border-border bg-card p-4"
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
        <div className="grid grid-cols-2 gap-3">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.08 + i * 0.04 }}
              className="rounded-2xl border border-border bg-card p-3 flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                <s.icon className={cn('w-4 h-4', s.color)} />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-bold">{s.value}</div>
                <div className="text-[10px] text-muted-foreground">{s.label}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Subscription */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="rounded-2xl border border-border bg-card p-4"
        >
          <h2 className="font-semibold text-sm mb-2">Subscription</h2>
          <div className="flex items-center gap-2">
            <div className={cn(
              'px-3 py-1 rounded-full text-xs font-medium',
              isPro ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'
            )}>
              {profile?.subscription_tier ? profile.subscription_tier.charAt(0).toUpperCase() + profile.subscription_tier.slice(1) : 'Free'}
            </div>
            <span className="text-sm text-muted-foreground capitalize">{profile?.subscription_tier || 'free'} plan</span>
          </div>
        </motion.div>

        {/* Quick links */}
        <div className="space-y-2">
          <Link to="/settings">
            <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3 hover:bg-secondary/50 active:bg-secondary transition-colors min-h-[48px]">
              <Settings className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium text-sm flex-1">Settings</span>
              <span className="text-muted-foreground text-xs">›</span>
            </div>
          </Link>
          <Link to="/achievements">
            <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3 hover:bg-secondary/50 active:bg-secondary transition-colors min-h-[48px]">
              <Star className="w-5 h-5 text-yellow-400" />
              <span className="font-medium text-sm flex-1">Achievements</span>
              <span className="text-muted-foreground text-xs">›</span>
            </div>
          </Link>
          <button
            onClick={() => signOut()}
            className="w-full rounded-2xl border border-destructive/20 bg-card p-4 flex items-center gap-3 hover:bg-destructive/10 active:bg-destructive/20 transition-colors min-h-[48px]"
          >
            <LogOut className="w-5 h-5 text-destructive" />
            <span className="font-medium text-sm text-destructive">Sign Out</span>
          </button>
        </div>
      </div>
    </AppShell>
  )
}
