// src/components/SRSStatsWidget.tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSRSStats, type SRSStats } from '@/lib/srs'
import { Brain } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'

interface Props {
  languageSlug: string
  languageName: string
  languageFlag: string
}

export default function SRSStatsWidget({ languageSlug, languageName, languageFlag }: Props) {
  const [stats, setStats] = useState<SRSStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!languageSlug) return
    getSRSStats(languageSlug)
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false))
  }, [languageSlug])

  if (loading) return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 animate-pulse h-28" />
  )

  if (!stats || stats.total_cards === 0) return null

  const urgentDue = stats.due_now > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-4 ${
        urgentDue
          ? 'border-cyan-500/40 bg-cyan-500/5'
          : 'border-white/10 bg-white/5'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Brain className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-medium">{languageFlag} {languageName} Review</span>
          </div>
          <div className="flex gap-4 text-sm">
            {stats.due_now > 0 && (
              <span className="text-cyan-400 font-semibold">
                {stats.due_now} due now
              </span>
            )}
            <span className="text-muted-foreground">{stats.total_cards} total cards</span>
            {stats.mastered > 0 && (
              <span className="text-green-400">{stats.mastered} mastered</span>
            )}
          </div>
        </div>
        {stats.due_now > 0 && (
          <Button asChild size="sm" className="bg-cyan-500 hover:bg-cyan-400 text-black flex-shrink-0">
            <Link to={`/learn/${languageSlug}/review`}>
              Review ({stats.due_now})
            </Link>
          </Button>
        )}
      </div>
    </motion.div>
  )
}
