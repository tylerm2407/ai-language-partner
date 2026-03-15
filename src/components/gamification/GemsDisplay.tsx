import { motion } from 'framer-motion'

interface GemsDisplayProps {
  gems: number
  compact?: boolean
}

export default function GemsDisplay({ gems, compact }: GemsDisplayProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-sm">💎</span>
        <span className="text-sm font-bold text-amber-400">{gems.toLocaleString()}</span>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ scale: 0.9 }}
      animate={{ scale: 1 }}
      className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1.5"
    >
      <motion.span
        animate={{ rotate: [0, 10, -10, 0] }}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
        className="text-base"
      >
        💎
      </motion.span>
      <span className="text-sm font-bold text-amber-400">{gems.toLocaleString()}</span>
    </motion.div>
  )
}
