import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export type Language = {
  id: string
  name: string
  code: string
  slug: string
  flag: string
  description: string
  is_active: boolean
  learner_count: number
}

export function useLanguages() {
  const [languages, setLanguages] = useState<Language[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('languages')
      .select('*')
      .eq('is_active', true)
      .order('learner_count', { ascending: false })
      .then(({ data }) => {
        if (data) setLanguages(data as Language[])
        setLoading(false)
      })
  }, [])

  return { languages, loading }
}

export function useLanguage(slug: string) {
  const [language, setLanguage] = useState<Language | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) return
    supabase
      .from('languages')
      .select('*')
      .eq('slug', slug)
      .single()
      .then(({ data }) => {
        if (data) setLanguage(data as Language)
        setLoading(false)
      })
  }, [slug])

  return { language, loading }
}
