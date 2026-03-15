import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { getHeartsInfo, getStreakMultiplier } from '@/lib/gamification'

interface DailyQuest {
  id: string
  quest_type: string
  target_value: number
  current_value: number
  gem_reward: number
  xp_reward: number
  completed: boolean
  quest_date: string
}

interface GamificationState {
  gems: number
  hearts: number
  maxHearts: number
  heartsInfo: ReturnType<typeof getHeartsInfo>
  streakMultiplier: ReturnType<typeof getStreakMultiplier>
  league: string
  leagueXp: number
  streakFreezeCount: number
  quests: DailyQuest[]
  questsLoading: boolean
  practiceCalendar: Array<{ practice_date: string; xp_earned: number }>
}

export function useGamification() {
  const { profile } = useAuth()
  const [quests, setQuests] = useState<DailyQuest[]>([])
  const [questsLoading, setQuestsLoading] = useState(true)
  const [practiceCalendar, setPracticeCalendar] = useState<Array<{ practice_date: string; xp_earned: number }>>([])

  const fetchQuests = useCallback(async () => {
    if (!profile) return
    try {
      const { data } = await supabase.functions.invoke('daily-quests', {
        body: { action: 'get' },
      })
      if (data?.quests) setQuests(data.quests)
    } catch {
      // Silently fail — quests are not critical
    } finally {
      setQuestsLoading(false)
    }
  }, [profile])

  const fetchCalendar = useCallback(async () => {
    if (!profile) return
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data } = await supabase
      .from('practice_calendar')
      .select('practice_date, xp_earned')
      .eq('user_id', profile.id)
      .gte('practice_date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('practice_date', { ascending: false })

    if (data) setPracticeCalendar(data)
  }, [profile])

  const updateQuestProgress = useCallback(async (questId: string, progressDelta: number = 1) => {
    const { data } = await supabase.functions.invoke('daily-quests', {
      body: { action: 'update', quest_id: questId, progress_delta: progressDelta },
    })
    if (data?.quest) {
      setQuests(prev => prev.map(q => q.id === questId ? data.quest : q))
    }
    return data
  }, [])

  const purchaseItem = useCallback(async (purchaseType: string) => {
    const { data, error } = await supabase.functions.invoke('gems-transaction', {
      body: { action: 'purchase', purchase_type: purchaseType },
    })
    if (error) throw error
    return data
  }, [])

  useEffect(() => {
    fetchQuests()
    fetchCalendar()
  }, [fetchQuests, fetchCalendar])

  if (!profile) {
    return {
      gems: 0,
      hearts: 5,
      maxHearts: 5,
      heartsInfo: { current: 5, max: 5, nextRegenMinutes: null, isFull: true },
      streakMultiplier: { multiplier: 1.0, label: '' },
      league: 'bronze',
      leagueXp: 0,
      streakFreezeCount: 0,
      quests: [],
      questsLoading: false,
      practiceCalendar: [],
      fetchQuests,
      fetchCalendar,
      updateQuestProgress,
      purchaseItem,
    }
  }

  const heartsInfo = getHeartsInfo(
    profile.hearts ?? 5,
    5,
    profile.hearts_last_regen_at ?? new Date().toISOString()
  )

  const streakMultiplier = getStreakMultiplier(profile.streak_days ?? 0)

  return {
    gems: profile.gems ?? 0,
    hearts: heartsInfo.current,
    maxHearts: 5,
    heartsInfo,
    streakMultiplier,
    league: profile.league ?? 'bronze',
    leagueXp: profile.league_xp ?? 0,
    streakFreezeCount: profile.streak_freeze_count ?? 0,
    quests,
    questsLoading,
    practiceCalendar,
    fetchQuests,
    fetchCalendar,
    updateQuestProgress,
    purchaseItem,
  } as GamificationState & {
    fetchQuests: typeof fetchQuests
    fetchCalendar: typeof fetchCalendar
    updateQuestProgress: typeof updateQuestProgress
    purchaseItem: typeof purchaseItem
  }
}
