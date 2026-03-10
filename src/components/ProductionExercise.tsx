// src/components/ProductionExercise.tsx
// Production exercises: user must PRODUCE language, not just recognize
// Research: output hypothesis (Swain 1985) — production forces deeper processing

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { CheckCircle, XCircle, Lightbulb, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ExerciseType = 'fill_blank' | 'translate_to_target' | 'translate_to_native' | 'arrange_words'

export interface Exercise {
  id: string
  type: ExerciseType
  prompt: string              // The question / instruction
  sentence?: string           // Sentence with blank: "I ___ to school"
  targetWord?: string         // The word that fills the blank
  correctAnswer: string       // Exact or accepted answer
  acceptedAnswers?: string[]  // Alternative correct answers
  hint?: string
  explanation: string         // WHY the answer is correct
  xpReward: number
}

interface Props {
  exercise: Exercise
  languageName: string
  onComplete: (correct: boolean, userAnswer: string) => void
  onSkip: () => void
}

type State = 'answering' | 'correct' | 'incorrect'

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/[.,!?;:]/g, '')
}

function checkAnswer(userAnswer: string, exercise: Exercise): boolean {
  const user = normalize(userAnswer)
  const correct = normalize(exercise.correctAnswer)
  if (user === correct) return true
  if (exercise.acceptedAnswers?.some(a => normalize(a) === user)) return true
  // Allow minor typos (Levenshtein distance 1 for answers > 4 chars)
  if (correct.length > 4 && levenshtein(user, correct) <= 1) return true
  return false
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
  )
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
  return dp[m][n]
}

export default function ProductionExercise({ exercise, languageName, onComplete, onSkip }: Props) {
  const [answer, setAnswer] = useState('')
  const [state, setState] = useState<State>('answering')
  const [showHint, setShowHint] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    setAnswer('')
    setState('answering')
    setShowHint(false)
    setTimeout(() => (inputRef.current as HTMLInputElement | null)?.focus(), 100)
  }, [exercise.id])

  const handleSubmit = () => {
    if (!answer.trim()) return
    const isCorrect = checkAnswer(answer, exercise)
    setState(isCorrect ? 'correct' : 'incorrect')
    onComplete(isCorrect, answer)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && state === 'answering') {
      e.preventDefault()
      handleSubmit()
    }
  }

  const isMultiLine = exercise.type === 'translate_to_target' || exercise.type === 'translate_to_native'

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
      {/* Exercise type label */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {exercise.type === 'fill_blank' ? '✏️ Fill in the blank' :
           exercise.type === 'translate_to_target' ? `🌍 Translate to ${languageName}` :
           exercise.type === 'translate_to_native' ? '🏠 Translate to English' :
           '🔀 Arrange the words'}
        </span>
        <Button variant="ghost" size="sm" className="text-xs" onClick={onSkip}>
          Skip
        </Button>
      </div>

      {/* Prompt */}
      <div>
        <p className="text-lg font-medium mb-2">{exercise.prompt}</p>
        {exercise.sentence && (
          <p className="text-xl text-center p-4 rounded-lg bg-white/5 border border-white/10 font-medium">
            {exercise.sentence}
          </p>
        )}
      </div>

      {/* Input */}
      {state === 'answering' && (
        <div className="space-y-2">
          {isMultiLine ? (
            <Textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your answer..."
              rows={3}
              className="resize-none"
            />
          ) : (
            <Input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your answer..."
            />
          )}

          {showHint && exercise.hint && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="p-2 rounded bg-yellow-500/10 border border-yellow-500/20 text-sm text-yellow-300"
            >
              <Lightbulb className="w-3.5 h-3.5 inline mr-1" />
              {exercise.hint}
            </motion.div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleSubmit} disabled={!answer.trim()} className="flex-1">
              Check Answer
              <span className="ml-2 text-xs opacity-60">[Enter]</span>
            </Button>
            {exercise.hint && !showHint && (
              <Button variant="outline" onClick={() => setShowHint(true)}>
                <Lightbulb className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Result */}
      <AnimatePresence>
        {state !== 'answering' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'p-4 rounded-xl border space-y-3',
              state === 'correct'
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-orange-500/10 border-orange-500/30'
            )}
          >
            <div className="flex items-center gap-2">
              {state === 'correct'
                ? <CheckCircle className="w-5 h-5 text-green-400" />
                : <XCircle className="w-5 h-5 text-orange-400" />
              }
              <span className={cn('font-semibold', state === 'correct' ? 'text-green-400' : 'text-orange-400')}>
                {state === 'correct'
                  ? `Correct! +${exercise.xpReward} XP`
                  : 'Not quite — keep going!'}
              </span>
            </div>

            {state === 'incorrect' && (
              <div>
                <p className="text-sm text-muted-foreground">
                  Your answer: <span className="text-foreground line-through">{answer}</span>
                </p>
                <p className="text-sm">
                  Correct answer: <span className="font-medium text-green-400">{exercise.correctAnswer}</span>
                </p>
              </div>
            )}

            {/* Always show explanation — this is the learning moment */}
            <div className="text-sm">
              <span className="font-medium">Why: </span>
              <span className="text-muted-foreground">{exercise.explanation}</span>
            </div>

            <Button
              onClick={() => onComplete(state === 'correct', answer)}
              size="sm"
              variant={state === 'correct' ? 'default' : 'outline'}
            >
              Continue <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
