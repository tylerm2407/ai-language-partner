import { useAuth } from '@/contexts/AuthContext'
import { Link } from 'react-router-dom'
import AppShell from '@/components/AppShell'
import { getLevelInfo } from '@/lib/achievements'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { Flame, Zap, MessageSquare, BookOpen, Trophy, Brain, ChevronRight } from 'lucide-react'
import { STATIC_LANGUAGES } from '@/hooks/useLanguage'

export default function Dashboard() {
  const { profile } = useAuth()

  if (!profile) return null

  const levelInfo = getLevelInfo(profile.total_xp)
  const dailyPct = Math.min((profile.today_xp / profile.daily_goal_xp) * 100, 100)
  const isPro = profile.subscription_tier === 'pro' || profile.subscription_tier === 'family'
  const xpToNext = levelInfo.xpNeededForLevel - levelInfo.progressInLevel

  const targetLang = STATIC_LANGUAGES.find(l =>
    l.name.toLowerCase() === profile.target_language?.toLowerCase() ||
    l.slug === profile.target_language?.toLowerCase()
  )

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <AppShell>
      <div className="py-5 space-y-5">
        {/* Greeting */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-muted-foreground text-sm">{greeting()},</p>
          <h1 className="text-2xl font-bold">{profile.full_name?.split(' ')[0] || profile.username || 'Learner'} 👋</h1>
        </motion.div>

        {/* Stats row — stack on very small screens */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-3 gap-2 sm:gap-3"
        >
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-3 text-center">
            <Flame className="w-5 h-5 text-orange-400 mx-auto mb-1" />
            <div className="text-lg sm:text-xl font-bold text-orange-400">{profile.streak_days}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">Day streak</div>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-3 text-center">
            <Zap className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
            <div className="text-lg sm:text-xl font-bold text-yellow-400">{profile.today_xp}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">XP today</div>
          </div>
          <div className="bg-primary/10 border border-primary/20 rounded-2xl p-3 text-center">
            <Trophy className="w-5 h-5 text-primary mx-auto mb-1" />
            <div className="text-lg sm:text-xl font-bold text-primary">{profile.total_xp.toLocaleString()}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">Total XP</div>
          </div>
        </motion.div>

        {/* Daily goal */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-2xl p-4"
        >
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Daily Goal</span>
            <span className="text-sm text-muted-foreground">{profile.today_xp} / {profile.daily_goal_xp} XP</span>
          </div>
          <Progress value={dailyPct} className="h-3" />
          {dailyPct >= 100 && (
            <p className="text-xs text-green-400 mt-1.5 font-medium">🎉 Goal complete! Keep going!</p>
          )}
        </motion.div>

        {/* Level progress */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="bg-card border border-border rounded-2xl p-4"
        >
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-sm font-medium">{levelInfo.level.name}</span>
            <span className="text-xs text-muted-foreground">{xpToNext.toLocaleString()} XP to next level</span>
          </div>
          <Progress value={levelInfo.progressPercent} className="h-2" />
        </motion.div>

        {/* Continue learning */}
        {targetLang && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Continue Learning</h2>
            <Link to={`/learn/${targetLang.slug}`}>
              <div className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:bg-secondary/50 active:bg-secondary transition-colors">
                <span className="text-4xl">{targetLang.flag}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{targetLang.name}</p>
                  <p className="text-sm text-muted-foreground">Tap to continue course</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              </div>
            </Link>
          </motion.div>
        )}

        {/* Quick actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Quick Practice</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/conversation">
              <div className="p-4 rounded-2xl border border-border bg-card hover:bg-secondary/50 active:bg-secondary transition-colors min-h-[88px]">
                <MessageSquare className="w-6 h-6 text-primary mb-2" />
                <p className="font-medium text-sm">AI Chat</p>
                <p className="text-xs text-muted-foreground">Free conversation</p>
              </div>
            </Link>
            <Link to="/practice">
              <div className="p-4 rounded-2xl border border-border bg-card hover:bg-secondary/50 active:bg-secondary transition-colors min-h-[88px]">
                <Brain className="w-6 h-6 text-purple-400 mb-2" />
                <p className="font-medium text-sm">Review Cards</p>
                <p className="text-xs text-muted-foreground">Spaced repetition</p>
              </div>
            </Link>
            <Link to="/learn">
              <div className="p-4 rounded-2xl border border-border bg-card hover:bg-secondary/50 active:bg-secondary transition-colors min-h-[88px]">
                <BookOpen className="w-6 h-6 text-green-400 mb-2" />
                <p className="font-medium text-sm">Browse Languages</p>
                <p className="text-xs text-muted-foreground">50 languages</p>
              </div>
            </Link>
            <Link to="/leaderboard">
              <div className="p-4 rounded-2xl border border-border bg-card hover:bg-secondary/50 active:bg-secondary transition-colors min-h-[88px]">
                <Trophy className="w-6 h-6 text-yellow-400 mb-2" />
                <p className="font-medium text-sm">Leaderboard</p>
                <p className="text-xs text-muted-foreground">See rankings</p>
              </div>
            </Link>
          </div>
        </motion.div>

        {/* Upgrade banner for free users */}
        {!isPro && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 rounded-2xl p-4"
          >
            <p className="font-semibold mb-1">✨ Upgrade to Pro</p>
            <p className="text-sm text-muted-foreground mb-3">Unlock AI tutor, writing feedback, driving mode & more.</p>
            <Button asChild size="sm" className="bg-gradient-to-r from-primary to-accent text-primary-foreground border-0">
              <Link to="/pricing">See Plans — from $4.99/mo</Link>
            </Button>
          </motion.div>
        )}
      </div>
    </AppShell>
  )
}
