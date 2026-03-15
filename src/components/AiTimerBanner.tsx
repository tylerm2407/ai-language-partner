import { motion } from 'framer-motion'
import { Clock, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'

interface AiTimerBannerProps {
  minutesRemaining: number
  dailyLimitMinutes: number
  percentUsed: number
  isLimitReached: boolean
  plan: string
}

export default function AiTimerBanner({ minutesRemaining, dailyLimitMinutes, percentUsed, isLimitReached, plan }: AiTimerBannerProps) {
  const navigate = useNavigate()
  const isWarning = percentUsed >= 75 && !isLimitReached

  if (isLimitReached) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-3 mt-2 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-center space-y-2"
      >
        <p className="text-sm font-semibold text-destructive">Daily AI time limit reached</p>
        <p className="text-xs text-muted-foreground">
          You've used all {dailyLimitMinutes} minutes on the {plan} plan today. Come back tomorrow or upgrade for more time.
        </p>
        {plan !== 'vip' && (
          <button
            onClick={() => navigate('/pricing')}
            className="text-xs font-medium text-primary hover:underline flex items-center gap-1 mx-auto"
          >
            <Zap className="w-3 h-3" /> Upgrade plan
          </button>
        )}
      </motion.div>
    )
  }

  return (
    <div className={cn(
      'mx-3 mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs',
      isWarning
        ? 'bg-orange-500/10 border border-orange-500/20 text-orange-500'
        : 'bg-muted/50 text-muted-foreground'
    )}>
      <Clock className="w-3 h-3 flex-shrink-0" />
      <span>{minutesRemaining} min remaining today</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden ml-1">
        <div
          className={cn('h-full rounded-full transition-all', isWarning ? 'bg-orange-500' : 'bg-primary')}
          style={{ width: `${percentUsed}%` }}
        />
      </div>
    </div>
  )
}
