import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { productIdToPlan, isPaid, type Plan } from '@/lib/plan'
import { supabase } from '@/lib/supabase'

export function useUserPlan() {
  const { user } = useAuth()
  const [plan, setPlan] = useState<Plan>('free')
  const [loading, setLoading] = useState(true)
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null)

  const checkSubscription = useCallback(async () => {
    if (!user) { setPlan('free'); setLoading(false); return }
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription')
      if (error) throw error
      if (data?.subscribed && data?.product_id) {
        setPlan(productIdToPlan(data.product_id))
        setSubscriptionEnd(data.subscription_end)
      } else {
        setPlan('free')
        setSubscriptionEnd(null)
      }
    } catch {
      setPlan('free')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    checkSubscription()
    const interval = setInterval(checkSubscription, 60000)
    return () => clearInterval(interval)
  }, [checkSubscription])

  return { plan, isPaid: isPaid(plan), loading, subscriptionEnd, refresh: checkSubscription }
}
