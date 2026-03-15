import { useState, useEffect, useRef, useCallback } from 'react'
import { useUserPlan } from './useUserPlan'
import { PLAN_FEATURES } from '@/lib/plan'

const STORAGE_KEY = 'ai_chat_usage'

interface DailyUsage {
  date: string
  secondsUsed: number
}

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function loadUsage(): DailyUsage {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DailyUsage
      if (parsed.date === getTodayKey()) return parsed
    }
  } catch {}
  return { date: getTodayKey(), secondsUsed: 0 }
}

function saveUsage(usage: DailyUsage) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(usage))
}

export function useAiTimeLimit() {
  const { plan } = useUserPlan()
  const features = PLAN_FEATURES[plan]
  const limitSeconds = features.dailyAiMinutes * 60

  const [usage, setUsage] = useState<DailyUsage>(loadUsage)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [isActive, setIsActive] = useState(false)

  const secondsUsed = usage.date === getTodayKey() ? usage.secondsUsed : 0
  const secondsRemaining = Math.max(0, limitSeconds - secondsUsed)
  const minutesRemaining = Math.ceil(secondsRemaining / 60)
  const isLimitReached = secondsRemaining <= 0
  const percentUsed = limitSeconds > 0 ? Math.min(100, (secondsUsed / limitSeconds) * 100) : 0

  // Tick every second when active
  useEffect(() => {
    if (isActive && !isLimitReached) {
      timerRef.current = setInterval(() => {
        setUsage(prev => {
          const today = getTodayKey()
          const updated: DailyUsage = {
            date: today,
            secondsUsed: (prev.date === today ? prev.secondsUsed : 0) + 1,
          }
          saveUsage(updated)
          return updated
        })
      }, 1000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isActive, isLimitReached])

  const startTimer = useCallback(() => setIsActive(true), [])
  const stopTimer = useCallback(() => setIsActive(false), [])

  return {
    minutesRemaining,
    secondsRemaining,
    isLimitReached,
    percentUsed,
    dailyLimitMinutes: features.dailyAiMinutes,
    startTimer,
    stopTimer,
    plan,
  }
}
