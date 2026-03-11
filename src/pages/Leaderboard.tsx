import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Trophy, Flame, Star } from 'lucide-react'

type LeaderboardEntry = {
  id: string
  full_name: string | null
  username: string | null
  total_xp: number
  streak_days: number
  avatar_url: string | null
}

const TABS = [
  { key: 'xp', label: 'Total XP', icon: Star },
  { key: 'streak', label: 'Streak', icon: Flame },
] as const

export default function Leaderboard() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'xp' | 'streak'>('xp')

  useEffect(() => {
    setLoading(true)
    const orderCol = tab === 'xp' ? 'total_xp' : 'streak_days'
    supabase
      .from('profiles')
      .select('id, full_name, username, total_xp, streak_days, avatar_url')
      .order(orderCol, { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setEntries(data as LeaderboardEntry[])
        setLoading(false)
      })
  }, [tab])

  const userRank = entries.findIndex(e => e.id === user?.id)

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-5 sm:space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-primary" /> Leaderboard
          </h1>
          {userRank >= 0 && (
            <p className="text-muted-foreground text-sm mt-1">
              You're ranked <span className="text-primary font-bold">#{userRank + 1}</span>
            </p>
          )}
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 min-h-[44px]',
                tab === t.key
                  ? 'bg-primary/10 text-primary border border-primary/30'
                  : 'bg-secondary text-muted-foreground border border-border hover:border-primary/20'
              )}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Top 3 podium */}
        {!loading && entries.length >= 3 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="flex items-end justify-center gap-3 sm:gap-4 pt-4 pb-2"
          >
            {[1, 0, 2].map(idx => {
              const e = entries[idx]
              const height = idx === 0 ? 'h-24 sm:h-28' : idx === 1 ? 'h-18 sm:h-20' : 'h-14 sm:h-16'
              const medals = ['🥇', '🥈', '🥉']
              return (
                <div key={idx} className="flex flex-col items-center gap-1.5 sm:gap-2">
                  <div className="text-xl sm:text-2xl">{medals[idx]}</div>
                  <div className={cn(
                    'w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm',
                    e.id === user?.id ? 'bg-primary/20 text-primary border-2 border-primary/40' : 'bg-secondary text-foreground border border-border'
                  )}>
                    {(e.full_name || e.username || 'U')[0].toUpperCase()}
                  </div>
                  <span className="text-[10px] sm:text-xs font-medium truncate max-w-[60px] sm:max-w-[80px] text-center">
                    {e.full_name || e.username || 'Learner'}
                  </span>
                  <span className="text-[10px] sm:text-xs text-muted-foreground">
                    {tab === 'xp' ? `${e.total_xp.toLocaleString()} XP` : `${e.streak_days}d`}
                  </span>
                  <div className={cn('w-14 sm:w-16 rounded-t-lg bg-primary/10 border border-primary/20', height)} />
                </div>
              )
            })}
          </motion.div>
        )}

        {/* List */}
        <div className="space-y-2">
          {loading && Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 bg-secondary/50 rounded-xl animate-pulse" />
          ))}
          {!loading && entries.map((e, i) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02 }}
              className={cn(
                'flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 rounded-xl transition-all',
                e.id === user?.id
                  ? 'bg-primary/5 border border-primary/20'
                  : 'bg-card border border-border hover:border-primary/10'
              )}
            >
              <span className={cn(
                'w-7 sm:w-8 text-center text-sm font-bold flex-shrink-0',
                i < 3 ? 'text-primary' : 'text-muted-foreground'
              )}>
                {i + 1}
              </span>
              <div className={cn(
                'w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0',
                'bg-secondary text-foreground'
              )}>
                {(e.full_name || e.username || 'U')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {e.full_name || e.username || 'Learner'}
                  {e.id === user?.id && <span className="text-primary text-xs ml-1">(you)</span>}
                </div>
              </div>
              <div className="text-sm font-bold text-right flex-shrink-0">
                {tab === 'xp' ? (
                  <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-primary" />{e.total_xp.toLocaleString()}</span>
                ) : (
                  <span className="flex items-center gap-1"><Flame className="w-3.5 h-3.5 text-orange-400" />{e.streak_days}d</span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  )
}
