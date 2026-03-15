import { motion } from 'framer-motion'
import { Flame } from 'lucide-react'

interface XPMultiplierBannerProps {
  multiplier: number
  label: string
  streakDays: number
}

export default function XPMultiplierBanner({ multiplier, label, streakDays }: XPMultiplierBannerProps) {
  if (multiplier <= 1) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-2xl px-4 py-2"
    >
      <motion.div
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <Flame className="w-5 h-5 text-orange-400" />
      </motion.div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-orange-400">{label} Streak Bonus!</p>
        <p className="text-xs text-muted-foreground">{streakDays}-day streak active</p>
      </div>
    </motion.div>
  )
}
