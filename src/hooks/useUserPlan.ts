import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getUserPlan, isPaid, type Plan } from '@/lib/plan'

export function useUserPlan() {
  const { user } = useAuth()
  const [plan, setPlan] = useState<Plan>('free')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setPlan('free'); setLoading(false); return }
    getUserPlan(user.id).then(p => { setPlan(p); setLoading(false) })
  }, [user])

  return { plan, isPaid: isPaid(plan), loading }
}
