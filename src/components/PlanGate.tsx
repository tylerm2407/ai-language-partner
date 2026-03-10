import { useUserPlan } from '@/hooks/useUserPlan'
import { Link } from 'react-router-dom'
import { Crown, Lock } from 'lucide-react'
import { Button } from './ui/button'
import { motion } from 'framer-motion'

type Props = {
  children: React.ReactNode
  feature?: string
  fallback?: React.ReactNode
}

export default function PlanGate({ children, feature = 'this feature', fallback }: Props) {
  const { isPaid, loading } = useUserPlan()

  if (loading) return null

  if (isPaid) return <>{children}</>

  if (fallback) return <>{fallback}</>

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-2xl border border-yellow-400/30 bg-gradient-to-br from-yellow-400/5 to-orange-400/5 p-8 text-center"
    >
      <div className="w-16 h-16 rounded-full bg-yellow-400/10 flex items-center justify-center mx-auto mb-4">
        <Lock className="w-8 h-8 text-yellow-400" />
      </div>
      <h3 className="text-xl font-bold mb-2">Pro Feature</h3>
      <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
        Upgrade to Pro to unlock {feature} and get unlimited access to your personal AI tutor.
      </p>
      <Link to="/pricing">
        <Button className="bg-gradient-to-r from-yellow-400 to-orange-400 text-background font-bold">
          <Crown className="w-4 h-4 mr-2" /> Upgrade to Pro
        </Button>
      </Link>
    </motion.div>
  )
}
