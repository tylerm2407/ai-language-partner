import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { BookOpen, Plus, ChevronRight, Globe, TrendingUp, MessageSquare, Clock } from 'lucide-react'

type LangRow = {
  id: string
  language_id: string
  approx_level: string
  words_read_count: number
  sessions_completed: number
  conversations_completed: number
  last_activity_at: string | null
  languages: { name: string; flag: string; slug: string }
}

export default function Learn() {
  const { user } = useAuth()
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

  function timeAgo(dateStr: string | null): string {
    if (!dateStr) return 'Never'
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days}d ago`
    return `${Math.floor(days / 7)}w ago`
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-primary" /> Learn
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Continue where you left off or start a new language.</p>
          </div>
          <Link to="/languages">
            <Button size="sm" variant="outline" className="gap-1 text-xs border-border hover:border-primary/40">
              <Plus className="w-3 h-3" /> Add language
            </Button>
          </Link>
        </motion.div>

        {loading && Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 bg-secondary/50 rounded-2xl animate-pulse" />
        ))}

        {!loading && langProgress.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-2xl border border-dashed border-border p-10 text-center space-y-3"
          >
            <Globe className="w-10 h-10 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground text-sm">You haven't started any languages yet.</p>
            <Link to="/languages">
              <Button className="bg-gradient-to-r from-primary to-accent text-primary-foreground gap-2">
                <Plus className="w-4 h-4" /> Pick a language
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
              className="rounded-2xl border border-border bg-card p-5 hover:border-primary/20 transition-all"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="text-3xl">{lang.flag}</div>
                  <div>
                    <div className="font-semibold">{lang.name}</div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                      <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> {lp.approx_level}</span>
                      <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {lp.words_read_count.toLocaleString()} words</span>
                      <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {lp.sessions_completed} sessions</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {timeAgo(lp.last_activity_at)}</span>
                    </div>
                  </div>
                </div>
                <Link to={`/learn/${lang.slug}`}>
                  <Button size="sm" className="gap-1 bg-gradient-to-r from-primary to-accent text-primary-foreground text-xs">
                    Continue <ChevronRight className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
            </motion.div>
          )
        })}
      </div>
    </DashboardLayout>
  )
}
