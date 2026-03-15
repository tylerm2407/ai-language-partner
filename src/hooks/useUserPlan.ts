import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { productIdToPlan, isPaid, type Plan } from '@/lib/plan'
import { supabase } from '@/lib/supabase'

export function useUserPlan() {
  const { user, profile } = useAuth()
  const [plan, setPlan] = useState<Plan>('free')
  const [loading, setLoading] = useState(true)
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null)

  const checkSubscription = useCallback(async () => {
    if (!user) { setPlan('free'); setLoading(false); return }

    // Fast path: use cached subscription from profile
    if (profile?.subscription_plan && profile?.subscription_expires_at) {
      const expiresAt = new Date(profile.subscription_expires_at)
      if (expiresAt > new Date()) {
        setPlan(productIdToPlan(profile.subscription_plan))
        setSubscriptionEnd(profile.subscription_expires_at)
        setLoading(false)
        return
      }
    }

    // Slow path: check with Stripe via edge function
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
  }, [user, profile])

  useEffect(() => {
    checkSubscription()
    // Only poll every 5 minutes instead of 60 seconds (webhook handles real-time updates)
    const interval = setInterval(checkSubscription, 300_000)
    return () => clearInterval(interval)
  }, [checkSubscription])

  return { plan, isPaid: isPaid(plan), loading, subscriptionEnd, refresh: checkSubscription }
}
