import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface CelebrationOverlayProps {
  show: boolean
  title: string
  subtitle?: string
  emoji?: string
  onComplete?: () => void
}

export default function CelebrationOverlay({ show, title, subtitle, emoji = '🎉', onComplete }: CelebrationOverlayProps) {
  const [visible, setVisible] = useState(show)

  useEffect(() => {
    if (show) {
      setVisible(true)
      const timer = setTimeout(() => {
        setVisible(false)
        onComplete?.()
      }, 2500)
      return () => clearTimeout(timer)
    }
  }, [show, onComplete])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => { setVisible(false); onComplete?.() }}
        >
          {/* Confetti particles */}
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{
                x: 0,
                y: 0,
                scale: 0,
                rotate: 0,
              }}
              animate={{
                x: (Math.random() - 0.5) * 400,
                y: (Math.random() - 0.5) * 400,
                scale: [0, 1, 0.5],
                rotate: Math.random() * 720,
              }}
              transition={{ duration: 1.5, delay: Math.random() * 0.3 }}
              className="absolute w-3 h-3 rounded-sm"
              style={{
                backgroundColor: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181', '#AA96DA'][i % 6],
              }}
            />
          ))}

          <motion.div
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', damping: 10, stiffness: 200 }}
            className="text-center"
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.5, repeat: 2 }}
              className="text-6xl mb-4"
            >
              {emoji}
            </motion.div>
            <h2 className="text-2xl font-bold text-white mb-1">{title}</h2>
            {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
