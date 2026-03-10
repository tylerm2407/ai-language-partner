import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export type LanguageProgress = {
  language_id: string
  approx_level: string
  words_read_count: number
  sessions_completed: number
  conversations_completed: number
  last_activity_at: string | null
}

export function useLanguageProgress(languageId?: string) {
  const { user } = useAuth()
  const [progress, setProgress] = useState<LanguageProgress | null>(null)
  const [allProgress, setAllProgress] = useState<LanguageProgress[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!user) { setLoading(false); return }
    if (languageId) {
      const { data } = await supabase
        .from('user_language_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('language_id', languageId)
        .single()
      setProgress(data as LanguageProgress)
    } else {
      const { data } = await supabase
        .from('user_language_progress')
        .select('*')
        .eq('user_id', user.id)
      if (data) setAllProgress(data as LanguageProgress[])
    }
    setLoading(false)
  }, [user, languageId])

  useEffect(() => { fetch() }, [fetch])

  const updateProgress = async (delta: { words?: number; sessions?: number; convos?: number }) => {
    if (!user || !languageId) return
    await supabase.rpc('upsert_language_progress', {
      p_user_id: user.id,
      p_language_id: languageId,
      p_words_delta: delta.words || 0,
      p_sessions_delta: delta.sessions || 0,
      p_convos_delta: delta.convos || 0,
    })
    fetch()
  }

  return { progress, allProgress, loading, updateProgress, refresh: fetch }
}
