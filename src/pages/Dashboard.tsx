import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { motion } from 'framer-motion'
import {
  Flame, Star, Target, Plus, BookOpen, MessageSquare,
  Clock, TrendingUp, ChevronRight, Globe,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type LangRow = {
  id: string
  language_id: string
  approx_level: string
  words_read_count: number
  sessions_completed: number
  conversations_completed: number
  last_activity_at: string | null
  languages: {
    name: string
    flag: string
    slug: string
  }
}

export default function Dashboard() {
  const { user, profile } = useAuth()
  const [langProgress, setLangProgress] = useState<LangRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase
      .from('user_language_progress')
      .select('*, languages(name, flag, slug)')
      .eq('user_id', user.id)
      .order('last_activity_at', { ascending: false })
      .then(({ data }) => {
        if (data) setLangProgress(data as LangRow[])
        setLoading(false)
      })
  }, [user])

  const streakDays = profile?.streak_days ?? 0
  const totalXp = profile?.total_xp ?? 0
  const todayXp = profile?.today_xp ?? 0
  const dailyGoalXp = profile?.daily_goal_xp ?? 50
  const dailyPercent = Math.min(100, dailyGoalXp > 0 ? (todayXp / dailyGoalXp) * 100 : 0)

  function timeAgo(dateStr: string | null): string {
    if (!dateStr) return 'Never'
    const diff = Date.now() - new Date(dateStr).getTime()
    const days = Math.floor(diff / 86400000)
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days}d ago`
    return `${Math.floor(days / 7)}w ago`
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto p-6 space-y-8">

        {/* Welcome */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold">
            Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Here's your learning overview.</p>
        </motion.div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="grid grid-cols-3 gap-4"
        >
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-400/10 flex items-center justify-center">
              <Flame className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <div className="text-xl font-bold">{streakDays}</div>
              <div className="text-xs text-muted-foreground">Day streak</div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-400/10 flex items-center justify-center">
              <Star className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <div className="text-xl font-bold">{totalXp.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Total XP</div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-muted-foreground">Daily goal</span>
              <span className="ml-auto text-xs font-medium">{todayXp}/{dailyGoalXp} XP</span>
            </div>
            <Progress value={dailyPercent} className="h-2" />
          </div>
        </motion.div>

        {/* Languages section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Globe className="w-4 h-4" /> Languages You're Studying
            </h2>
            <Link to="/languages">
              <Button size="sm" variant="outline" className="gap-1 text-xs border-white/10 hover:border-cyan-400/40">
                <Plus className="w-3 h-3" /> Add language
              </Button>
            </Link>
          </div>

          {loading && (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="animate-pulse h-24 bg-white/5 rounded-2xl" />
              ))}
            </div>
          )}

          {!loading && langProgress.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="rounded-2xl border border-dashed border-white/10 p-10 text-center space-y-3"
            >
              <Globe className="w-10 h-10 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground text-sm">You haven't started any languages yet.</p>
              <Link to="/languages">
                <Button className="bg-gradient-to-r from-cyan-500 to-pink-500 text-white gap-2">
                  <Plus className="w-4 h-4" /> Pick a language to start
                </Button>
              </Link>
            </motion.div>
          )}

          {!loading && langProgress.map((lp, i) => {
            const lang = lp.languages
            return (
              <motion.div
                key={lp.id}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:border-white/20 transition-all"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="text-3xl">{lang.flag}</div>
                    <div>
                      <div className="font-semibold">{lang.name}</div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" /> {lp.approx_level}
                        </span>
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3 h-3" /> {lp.words_read_count.toLocaleString()} words
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" /> {lp.sessions_completed} sessions
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {timeAgo(lp.last_activity_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Link to={`/learn/${lang.slug}`}>
                    <Button size="sm" className={cn(
                      'gap-1 bg-gradient-to-r from-cyan-500 to-pink-500 text-white text-xs',
                    )}>
                      Continue <ChevronRight className="w-3 h-3" />
                    </Button>
                  </Link>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Quick actions */}
        {langProgress.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            className="grid grid-cols-2 sm:grid-cols-3 gap-3"
          >
            <Link to="/leaderboard" className="rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/8 transition-all text-center text-sm font-medium">
              Leaderboard
            </Link>
            <Link to="/achievements" className="rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/8 transition-all text-center text-sm font-medium">
              Achievements
            </Link>
            <Link to="/profile" className="rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/8 transition-all text-center text-sm font-medium">
              Profile
            </Link>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  )
}
