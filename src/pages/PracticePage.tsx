import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Link } from 'react-router-dom'
import AppShell from '@/components/AppShell'
import { getDueCards, getSRSStats, type SRSCard, type SRSStats } from '@/lib/srs'
import SRSReviewSession from '@/components/SRSReviewSession'
import { Button } from '@/components/ui/button'
import { Brain, BookOpen, ChevronRight, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { STATIC_LANGUAGES } from '@/hooks/useLanguage'
import { motion } from 'framer-motion'

export default function PracticePage() {
  const { profile } = useAuth()
  const [cards, setCards] = useState<SRSCard[]>([])
  const [stats, setStats] = useState<SRSStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [started, setStarted] = useState(false)

  const targetSlug = STATIC_LANGUAGES.find(l =>
    l.name.toLowerCase() === profile?.target_language?.toLowerCase()
  )?.slug || profile?.target_language?.toLowerCase() || ''

  useEffect(() => {
    if (!targetSlug) { setLoading(false); return }
    Promise.all([
      getDueCards(targetSlug, 30),
      getSRSStats(targetSlug),
    ]).then(([c, s]) => {
      setCards(c)
      setStats(s)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [targetSlug])

  if (started && cards.length > 0) {
    return (
      <AppShell title="Review Session" showBack noBottomNav>
        <div className="py-4">
          <SRSReviewSession
            cards={cards}
            onComplete={({ reviewed, correct, xpEarned }: { reviewed: number; correct: number; xpEarned: number }) => {
              toast.success(`+${xpEarned} XP — ${correct}/${reviewed} correct!`)
              setStarted(false)
            }}
            onExit={() => setStarted(false)}
          />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="Practice">
      <div className="py-5 space-y-5">
        {loading ? (
          <div className="space-y-3">
            <div className="h-32 rounded-2xl bg-white/5 animate-pulse" />
            <div className="h-24 rounded-2xl bg-white/5 animate-pulse" />
          </div>
        ) : (
          <>
            {/* SRS Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl border p-5 ${
                cards.length > 0
                  ? 'border-cyan-500/30 bg-cyan-500/5'
                  : 'border-white/10 bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-cyan-400/10 flex items-center justify-center">
                  <Brain className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h2 className="font-bold">Flashcard Review</h2>
                  <p className="text-sm text-muted-foreground">Spaced repetition</p>
                </div>
              </div>

              {cards.length > 0 ? (
                <>
                  <div className="grid grid-cols-3 gap-3 mb-4 text-center text-sm">
                    <div>
                      <div className="text-2xl font-bold text-cyan-400">{cards.filter(c => c.repetitions === 0).length}</div>
                      <div className="text-xs text-muted-foreground">New</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-yellow-400">{cards.filter(c => c.repetitions > 0 && c.interval_days < 7).length}</div>
                      <div className="text-xs text-muted-foreground">Learning</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-400">{stats?.mastered || 0}</div>
                      <div className="text-xs text-muted-foreground">Mastered</div>
                    </div>
                  </div>
                  <Button onClick={() => setStarted(true)} className="w-full h-12" size="lg">
                    <Brain className="w-5 h-5 mr-2" />
                    Start Review ({cards.length} cards)
                  </Button>
                </>
              ) : (
                <div className="text-center py-2">
                  <p className="text-2xl mb-2">🎉</p>
                  <p className="font-medium">All caught up!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    No cards due. Complete lessons to add words to your deck.
                  </p>
                  {stats && stats.total_cards > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats.total_cards} total cards · {stats.mastered} mastered
                    </p>
                  )}
                </div>
              )}
            </motion.div>

            {/* AI Conversation */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Link to="/conversation">
                <div className="flex items-center gap-4 p-4 rounded-2xl border border-white/10 bg-white/5 active:bg-white/10 hover:bg-white/[0.08] transition-colors">
                  <div className="w-12 h-12 rounded-2xl bg-purple-400/10 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-6 h-6 text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">AI Conversation</p>
                    <p className="text-sm text-muted-foreground">Chat freely, get corrections</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </Link>
            </motion.div>

            {/* Go to lessons */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Link to="/learn">
                <div className="flex items-center gap-4 p-4 rounded-2xl border border-white/10 bg-white/5 active:bg-white/10 hover:bg-white/[0.08] transition-colors">
                  <div className="w-12 h-12 rounded-2xl bg-green-400/10 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-6 h-6 text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">Lessons</p>
                    <p className="text-sm text-muted-foreground">Complete lessons to add more review cards</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </Link>
            </motion.div>
          </>
        )}
      </div>
    </AppShell>
  )
}
