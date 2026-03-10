// src/pages/SRSReviewPage.tsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLanguage } from '@/hooks/useLanguage'
import { getDueCards, type SRSCard } from '@/lib/srs'
import SRSReviewSession from '@/components/SRSReviewSession'
import DashboardLayout from '@/components/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Brain, BookOpen, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

export default function SRSReviewPage() {
  const { slug } = useParams<{ slug: string }>()
  const { language } = useLanguage(slug!)
  const navigate = useNavigate()
  const [cards, setCards] = useState<SRSCard[]>([])
  const [loading, setLoading] = useState(true)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    if (!slug) return
    getDueCards(slug, 30)
      .then(setCards)
      .catch(() => toast.error('Failed to load review cards'))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto p-8 animate-pulse text-muted-foreground">
          Loading your review cards...
        </div>
      </DashboardLayout>
    )
  }

  if (started && cards.length > 0) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto p-4 py-8">
          <SRSReviewSession
            cards={cards}
            onComplete={({ reviewed, correct, xpEarned }) => {
              toast.success(`Review complete! +${xpEarned} XP, ${correct}/${reviewed} correct`)
              navigate(`/learn/${slug}`)
            }}
            onExit={() => navigate(`/learn/${slug}`)}
          />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto p-4 py-12 text-center">
        <Button variant="ghost" className="mb-6" onClick={() => navigate(`/learn/${slug}`)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to {language?.name || slug}
        </Button>

        {cards.length === 0 ? (
          <div>
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold mb-2">All caught up!</h2>
            <p className="text-muted-foreground mb-6">
              No cards due for review right now. Complete lessons to add words to your review deck.
            </p>
            <Button onClick={() => navigate(`/learn/${slug}`)}>
              <BookOpen className="w-4 h-4 mr-2" />
              Go to Lessons
            </Button>
          </div>
        ) : (
          <div>
            <Brain className="w-16 h-16 text-cyan-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">
              {language?.flag} {cards.length} Cards Due
            </h2>
            <p className="text-muted-foreground mb-2">
              These words are scheduled for review today based on your memory curve.
            </p>
            <p className="text-sm text-muted-foreground mb-8">
              Reviewing at the right time = 85% long-term retention (vs 22% with cramming)
            </p>
            <div className="grid grid-cols-3 gap-4 mb-8 text-sm">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-2xl font-bold text-cyan-400">{cards.filter(c => c.repetitions === 0).length}</div>
                <div className="text-muted-foreground">New</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-2xl font-bold text-yellow-400">{cards.filter(c => c.repetitions > 0 && c.interval_days < 7).length}</div>
                <div className="text-muted-foreground">Learning</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-2xl font-bold text-green-400">{cards.filter(c => c.interval_days >= 7).length}</div>
                <div className="text-muted-foreground">Reviewing</div>
              </div>
            </div>
            <Button size="lg" onClick={() => setStarted(true)} className="px-12">
              <Brain className="w-4 h-4 mr-2" />
              Start Review Session
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
