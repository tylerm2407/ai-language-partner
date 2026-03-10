// src/components/SRSReviewSession.tsx
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { type SRSCard, type SRSQuality, QUALITY_COLORS, reviewCard } from '@/lib/srs'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import {
  Eye, CheckCircle, XCircle, Lightbulb,
  ChevronLeft, Zap, BookOpen
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  cards: SRSCard[]
  onComplete: (results: { reviewed: number; correct: number; xpEarned: number }) => void
  onExit: () => void
}

type CardState = 'question' | 'revealed' | 'done'

export default function SRSReviewSession({ cards, onComplete, onExit }: Props) {
  const [queue, setQueue] = useState<SRSCard[]>([...cards])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [cardState, setCardState] = useState<CardState>('question')
  const [reviewed, setReviewed] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [xpEarned, setXpEarned] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [startMs, setStartMs] = useState(Date.now())
  const [showHint, setShowHint] = useState(false)
  const [sessionDone, setSessionDone] = useState(false)

  const currentCard = queue[currentIdx]
  const totalCards = cards.length
  const progressPct = totalCards > 0 ? Math.round((reviewed / totalCards) * 100) : 0

  useEffect(() => {
    setStartMs(Date.now())
    setShowHint(false)
  }, [currentIdx])

  const handleReveal = () => {
    setCardState('revealed')
  }

  const handleRate = useCallback(async (quality: SRSQuality) => {
    if (submitting || !currentCard) return
    setSubmitting(true)
    const responseMs = Date.now() - startMs
    const isCorrect = quality >= 3

    // Optimistic local update
    const newReviewed = reviewed + 1
    const newCorrect = correct + (isCorrect ? 1 : 0)
    const xp = isCorrect ? 5 : 2
    setReviewed(newReviewed)
    setCorrect(newCorrect)
    setXpEarned(prev => prev + xp)

    // DB update (non-blocking)
    reviewCard(currentCard.id, quality, responseMs).catch(() => {
      toast.error('Failed to save review — check connection')
    })

    // Re-queue failed cards (quality < 3) after 3 more cards
    let newQueue = [...queue]
    if (quality < 3 && newQueue.length < 50) {
      const requeue = { ...currentCard }
      newQueue.splice(currentIdx + 4, 0, requeue)
    }

    if (newReviewed >= totalCards || currentIdx + 1 >= newQueue.length) {
      setSessionDone(true)
      onComplete({ reviewed: newReviewed, correct: newCorrect, xpEarned: xpEarned + xp })
    } else {
      setQueue(newQueue)
      setCurrentIdx(prev => prev + 1)
      setCardState('question')
    }
    setSubmitting(false)
  }, [currentCard, submitting, reviewed, correct, xpEarned, queue, currentIdx, totalCards, onComplete, startMs])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (cardState === 'question' && e.code === 'Space') {
        e.preventDefault()
        handleReveal()
      } else if (cardState === 'revealed') {
        if (e.key === '1') handleRate(1)
        if (e.key === '2') handleRate(2)
        if (e.key === '3') handleRate(3)
        if (e.key === '4') handleRate(4)
        if (e.key === '5') handleRate(5)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [cardState, handleRate])

  if (sessionDone) {
    const accuracy = totalCards > 0 ? Math.round((correct / reviewed) * 100) : 0
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center min-h-[400px] text-center p-8"
      >
        <div className="text-6xl mb-4">
          {accuracy >= 80 ? '🎉' : accuracy >= 60 ? '👍' : '💪'}
        </div>
        <h2 className="text-2xl font-bold mb-2">Session Complete!</h2>
        <div className="grid grid-cols-3 gap-6 my-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-cyan-400">{reviewed}</div>
            <div className="text-xs text-muted-foreground">Cards reviewed</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-400">{accuracy}%</div>
            <div className="text-xs text-muted-foreground">Accuracy</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-400">+{xpEarned}</div>
            <div className="text-xs text-muted-foreground">XP earned</div>
          </div>
        </div>
        <Button onClick={onExit} size="lg">Back to Course</Button>
      </motion.div>
    )
  }

  if (!currentCard) return null

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" onClick={onExit}>
          <ChevronLeft className="w-4 h-4 mr-1" />Exit
        </Button>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{reviewed}/{totalCards}</span>
          <div className="flex items-center gap-1 text-yellow-400 text-sm">
            <Zap className="w-3.5 h-3.5" />
            +{xpEarned} XP
          </div>
        </div>
      </div>

      <Progress value={progressPct} className="mb-6 h-2" />

      {/* Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentCard.id + cardState}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
          className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden"
        >
          {/* Card type badge */}
          <div className="flex items-center gap-2 px-5 pt-4 pb-2">
            <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground capitalize">{currentCard.card_type}</span>
            {currentCard.ease_factor <= 1.5 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">Hard word</span>
            )}
            {currentCard.interval_days >= 21 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">Mastered</span>
            )}
          </div>

          {/* Front */}
          <div className="px-5 py-8 text-center">
            <p className="text-4xl font-bold mb-2">{currentCard.front.text}</p>
            {currentCard.front.hint && (
              <p className="text-sm text-muted-foreground">{currentCard.front.hint}</p>
            )}
            {currentCard.front.context && (
              <p className="text-sm text-muted-foreground/70 mt-2 italic">"{currentCard.front.context}"</p>
            )}
          </div>

          {/* Reveal / Answer */}
          {cardState === 'question' ? (
            <div className="px-5 pb-6 space-y-3">
              {showHint && currentCard.back.mnemonic && (
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-sm text-yellow-300">
                  <Lightbulb className="w-3.5 h-3.5 inline mr-1" />
                  {currentCard.back.mnemonic}
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={handleReveal} className="flex-1" size="lg">
                  <Eye className="w-4 h-4 mr-2" />
                  Reveal Answer
                  <span className="ml-2 text-xs opacity-60">[Space]</span>
                </Button>
                {currentCard.back.mnemonic && !showHint && (
                  <Button variant="outline" onClick={() => setShowHint(true)}>
                    <Lightbulb className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="px-5 pb-6 space-y-4">
              {/* Answer */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                <p className="text-2xl font-semibold text-cyan-400 mb-1">{currentCard.back.text}</p>
                {currentCard.back.explanation && (
                  <p className="text-sm text-muted-foreground mt-2">
                    <span className="font-medium text-foreground">Why: </span>
                    {currentCard.back.explanation}
                  </p>
                )}
                {currentCard.back.example && (
                  <p className="text-sm text-muted-foreground/80 mt-1 italic">{currentCard.back.example}</p>
                )}
                {currentCard.back.common_errors && (
                  <p className="text-xs text-orange-400 mt-2">
                    ⚠️ {currentCard.back.common_errors}
                  </p>
                )}
              </div>

              {/* Rating buttons — no punishment framing */}
              <div>
                <p className="text-xs text-muted-foreground text-center mb-2">
                  How well did you know this? (Honest self-assessment helps you learn faster)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    className={cn('text-sm', QUALITY_COLORS[1])}
                    onClick={() => handleRate(1)}
                    disabled={submitting}
                  >
                    <XCircle className="w-4 h-4 mr-1.5" />
                    Still learning <span className="ml-1 opacity-60">[1]</span>
                  </Button>
                  <Button
                    className={cn('text-sm', QUALITY_COLORS[2])}
                    onClick={() => handleRate(2)}
                    disabled={submitting}
                  >
                    Almost <span className="ml-1 opacity-60">[2]</span>
                  </Button>
                  <Button
                    className={cn('text-sm', QUALITY_COLORS[3])}
                    onClick={() => handleRate(3)}
                    disabled={submitting}
                  >
                    Got it (hard) <span className="ml-1 opacity-60">[3]</span>
                  </Button>
                  <Button
                    className={cn('text-sm', QUALITY_COLORS[4])}
                    onClick={() => handleRate(4)}
                    disabled={submitting}
                  >
                    <CheckCircle className="w-4 h-4 mr-1.5" />
                    Got it! <span className="ml-1 opacity-60">[4]</span>
                  </Button>
                </div>
                <Button
                  className={cn('w-full mt-2 text-sm', QUALITY_COLORS[5])}
                  onClick={() => handleRate(5)}
                  disabled={submitting}
                >
                  ⚡ Perfect — knew instantly <span className="ml-1 opacity-60">[5]</span>
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Keyboard hint */}
      <p className="text-center text-xs text-muted-foreground mt-3">
        {cardState === 'question' ? 'Press Space to reveal' : 'Press 1-5 to rate'}
      </p>
    </div>
  )
}
