import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export type Language = {
  id: string
  name: string
  native_name: string
  slug: string
  flag: string
  family: string | null
  difficulty: 'easy' | 'medium' | 'hard' | 'very_hard' | null
  speakers_millions: number | null
  is_active: boolean
  sort_order: number
}

// Static fallback data — used if DB isn't set up yet
const STATIC_LANGUAGES: Language[] = [
  { id: 'spanish', name: 'Spanish', native_name: 'Español', slug: 'spanish', flag: '🇪🇸', family: 'Indo-European', difficulty: 'easy', speakers_millions: 500, is_active: true, sort_order: 1 },
  { id: 'french', name: 'French', native_name: 'Français', slug: 'french', flag: '🇫🇷', family: 'Indo-European', difficulty: 'easy', speakers_millions: 280, is_active: true, sort_order: 2 },
  { id: 'german', name: 'German', native_name: 'Deutsch', slug: 'german', flag: '🇩🇪', family: 'Indo-European', difficulty: 'medium', speakers_millions: 100, is_active: true, sort_order: 3 },
  { id: 'italian', name: 'Italian', native_name: 'Italiano', slug: 'italian', flag: '🇮🇹', family: 'Indo-European', difficulty: 'easy', speakers_millions: 65, is_active: true, sort_order: 4 },
  { id: 'portuguese', name: 'Portuguese', native_name: 'Português', slug: 'portuguese', flag: '🇧🇷', family: 'Indo-European', difficulty: 'easy', speakers_millions: 250, is_active: true, sort_order: 5 },
  { id: 'dutch', name: 'Dutch', native_name: 'Nederlands', slug: 'dutch', flag: '🇳🇱', family: 'Indo-European', difficulty: 'medium', speakers_millions: 24, is_active: true, sort_order: 6 },
  { id: 'russian', name: 'Russian', native_name: 'Русский', slug: 'russian', flag: '🇷🇺', family: 'Indo-European', difficulty: 'hard', speakers_millions: 154, is_active: true, sort_order: 7 },
  { id: 'polish', name: 'Polish', native_name: 'Polski', slug: 'polish', flag: '🇵🇱', family: 'Indo-European', difficulty: 'hard', speakers_millions: 45, is_active: true, sort_order: 8 },
  { id: 'czech', name: 'Czech', native_name: 'Čeština', slug: 'czech', flag: '🇨🇿', family: 'Indo-European', difficulty: 'hard', speakers_millions: 10, is_active: true, sort_order: 9 },
  { id: 'swedish', name: 'Swedish', native_name: 'Svenska', slug: 'swedish', flag: '🇸🇪', family: 'Indo-European', difficulty: 'easy', speakers_millions: 10, is_active: true, sort_order: 10 },
  { id: 'norwegian', name: 'Norwegian', native_name: 'Norsk', slug: 'norwegian', flag: '🇳🇴', family: 'Indo-European', difficulty: 'easy', speakers_millions: 5, is_active: true, sort_order: 11 },
  { id: 'danish', name: 'Danish', native_name: 'Dansk', slug: 'danish', flag: '🇩🇰', family: 'Indo-European', difficulty: 'easy', speakers_millions: 6, is_active: true, sort_order: 12 },
  { id: 'finnish', name: 'Finnish', native_name: 'Suomi', slug: 'finnish', flag: '🇫🇮', family: 'Uralic', difficulty: 'hard', speakers_millions: 5, is_active: true, sort_order: 13 },
  { id: 'greek', name: 'Greek', native_name: 'Ελληνικά', slug: 'greek', flag: '🇬🇷', family: 'Indo-European', difficulty: 'hard', speakers_millions: 13, is_active: true, sort_order: 14 },
  { id: 'turkish', name: 'Turkish', native_name: 'Türkçe', slug: 'turkish', flag: '🇹🇷', family: 'Turkic', difficulty: 'hard', speakers_millions: 85, is_active: true, sort_order: 15 },
  { id: 'arabic', name: 'Arabic', native_name: 'العربية', slug: 'arabic', flag: '🇸🇦', family: 'Semitic', difficulty: 'very_hard', speakers_millions: 400, is_active: true, sort_order: 16 },
  { id: 'hebrew', name: 'Hebrew', native_name: 'עברית', slug: 'hebrew', flag: '🇮🇱', family: 'Semitic', difficulty: 'very_hard', speakers_millions: 9, is_active: true, sort_order: 17 },
  { id: 'persian', name: 'Persian', native_name: 'فارسی', slug: 'persian', flag: '🇮🇷', family: 'Indo-European', difficulty: 'hard', speakers_millions: 80, is_active: true, sort_order: 18 },
  { id: 'hindi', name: 'Hindi', native_name: 'हिन्दी', slug: 'hindi', flag: '🇮🇳', family: 'Indo-European', difficulty: 'hard', speakers_millions: 600, is_active: true, sort_order: 19 },
  { id: 'urdu', name: 'Urdu', native_name: 'اردو', slug: 'urdu', flag: '🇵🇰', family: 'Indo-European', difficulty: 'hard', speakers_millions: 230, is_active: true, sort_order: 20 },
  { id: 'bengali', name: 'Bengali', native_name: 'বাংলা', slug: 'bengali', flag: '🇧🇩', family: 'Indo-European', difficulty: 'hard', speakers_millions: 250, is_active: true, sort_order: 21 },
  { id: 'punjabi', name: 'Punjabi', native_name: 'ਪੰਜਾਬੀ', slug: 'punjabi', flag: '🇮🇳', family: 'Indo-European', difficulty: 'hard', speakers_millions: 125, is_active: true, sort_order: 22 },
  { id: 'gujarati', name: 'Gujarati', native_name: 'ગુજરાતી', slug: 'gujarati', flag: '🇮🇳', family: 'Indo-European', difficulty: 'hard', speakers_millions: 60, is_active: true, sort_order: 23 },
  { id: 'marathi', name: 'Marathi', native_name: 'मराठी', slug: 'marathi', flag: '🇮🇳', family: 'Indo-European', difficulty: 'hard', speakers_millions: 95, is_active: true, sort_order: 24 },
  { id: 'tamil', name: 'Tamil', native_name: 'தமிழ்', slug: 'tamil', flag: '🇮🇳', family: 'Dravidian', difficulty: 'very_hard', speakers_millions: 85, is_active: true, sort_order: 25 },
  { id: 'telugu', name: 'Telugu', native_name: 'తెలుగు', slug: 'telugu', flag: '🇮🇳', family: 'Dravidian', difficulty: 'very_hard', speakers_millions: 95, is_active: true, sort_order: 26 },
  { id: 'kannada', name: 'Kannada', native_name: 'ಕನ್ನಡ', slug: 'kannada', flag: '🇮🇳', family: 'Dravidian', difficulty: 'very_hard', speakers_millions: 55, is_active: true, sort_order: 27 },
  { id: 'malayalam', name: 'Malayalam', native_name: 'മലയാളം', slug: 'malayalam', flag: '🇮🇳', family: 'Dravidian', difficulty: 'very_hard', speakers_millions: 38, is_active: true, sort_order: 28 },
  { id: 'mandarin', name: 'Mandarin Chinese', native_name: '普通话', slug: 'mandarin', flag: '🇨🇳', family: 'Sino-Tibetan', difficulty: 'very_hard', speakers_millions: 1100, is_active: true, sort_order: 29 },
  { id: 'cantonese', name: 'Cantonese', native_name: '粤語', slug: 'cantonese', flag: '🇭🇰', family: 'Sino-Tibetan', difficulty: 'very_hard', speakers_millions: 80, is_active: true, sort_order: 30 },
  { id: 'japanese', name: 'Japanese', native_name: '日本語', slug: 'japanese', flag: '🇯🇵', family: 'Japonic', difficulty: 'very_hard', speakers_millions: 125, is_active: true, sort_order: 31 },
  { id: 'korean', name: 'Korean', native_name: '한국어', slug: 'korean', flag: '🇰🇷', family: 'Koreanic', difficulty: 'very_hard', speakers_millions: 80, is_active: true, sort_order: 32 },
  { id: 'vietnamese', name: 'Vietnamese', native_name: 'Tiếng Việt', slug: 'vietnamese', flag: '🇻🇳', family: 'Austroasiatic', difficulty: 'hard', speakers_millions: 95, is_active: true, sort_order: 33 },
  { id: 'thai', name: 'Thai', native_name: 'ภาษาไทย', slug: 'thai', flag: '🇹🇭', family: 'Kra-Dai', difficulty: 'very_hard', speakers_millions: 60, is_active: true, sort_order: 34 },
  { id: 'indonesian', name: 'Indonesian', native_name: 'Bahasa Indonesia', slug: 'indonesian', flag: '🇮🇩', family: 'Austronesian', difficulty: 'easy', speakers_millions: 200, is_active: true, sort_order: 35 },
  { id: 'malay', name: 'Malay', native_name: 'Bahasa Melayu', slug: 'malay', flag: '🇲🇾', family: 'Austronesian', difficulty: 'easy', speakers_millions: 80, is_active: true, sort_order: 36 },
  { id: 'tagalog', name: 'Tagalog', native_name: 'Tagalog', slug: 'tagalog', flag: '🇵🇭', family: 'Austronesian', difficulty: 'medium', speakers_millions: 90, is_active: true, sort_order: 37 },
  { id: 'swahili', name: 'Swahili', native_name: 'Kiswahili', slug: 'swahili', flag: '🇰🇪', family: 'Niger-Congo', difficulty: 'medium', speakers_millions: 200, is_active: true, sort_order: 38 },
  { id: 'amharic', name: 'Amharic', native_name: 'አማርኛ', slug: 'amharic', flag: '🇪🇹', family: 'Semitic', difficulty: 'hard', speakers_millions: 60, is_active: true, sort_order: 39 },
  { id: 'yoruba', name: 'Yoruba', native_name: 'Yorùbá', slug: 'yoruba', flag: '🇳🇬', family: 'Niger-Congo', difficulty: 'hard', speakers_millions: 50, is_active: true, sort_order: 40 },
  { id: 'igbo', name: 'Igbo', native_name: 'Igbo', slug: 'igbo', flag: '🇳🇬', family: 'Niger-Congo', difficulty: 'hard', speakers_millions: 45, is_active: true, sort_order: 41 },
  { id: 'hausa', name: 'Hausa', native_name: 'Hausa', slug: 'hausa', flag: '🇳🇬', family: 'Afro-Asiatic', difficulty: 'medium', speakers_millions: 70, is_active: true, sort_order: 42 },
  { id: 'zulu', name: 'Zulu', native_name: 'isiZulu', slug: 'zulu', flag: '🇿🇦', family: 'Niger-Congo', difficulty: 'hard', speakers_millions: 27, is_active: true, sort_order: 43 },
  { id: 'afrikaans', name: 'Afrikaans', native_name: 'Afrikaans', slug: 'afrikaans', flag: '🇿🇦', family: 'Indo-European', difficulty: 'easy', speakers_millions: 17, is_active: true, sort_order: 44 },
  { id: 'ukrainian', name: 'Ukrainian', native_name: 'Українська', slug: 'ukrainian', flag: '🇺🇦', family: 'Indo-European', difficulty: 'hard', speakers_millions: 45, is_active: true, sort_order: 45 },
  { id: 'romanian', name: 'Romanian', native_name: 'Română', slug: 'romanian', flag: '🇷🇴', family: 'Indo-European', difficulty: 'medium', speakers_millions: 24, is_active: true, sort_order: 46 },
  { id: 'hungarian', name: 'Hungarian', native_name: 'Magyar', slug: 'hungarian', flag: '🇭🇺', family: 'Uralic', difficulty: 'hard', speakers_millions: 13, is_active: true, sort_order: 47 },
  { id: 'catalan', name: 'Catalan', native_name: 'Català', slug: 'catalan', flag: '🏳️', family: 'Indo-European', difficulty: 'medium', speakers_millions: 10, is_active: true, sort_order: 48 },
  { id: 'latin', name: 'Latin', native_name: 'Latina', slug: 'latin', flag: '🏙️', family: 'Indo-European', difficulty: 'hard', speakers_millions: 0, is_active: true, sort_order: 49 },
  { id: 'esperanto', name: 'Esperanto', native_name: 'Esperanto', slug: 'esperanto', flag: '🌍', family: 'Constructed', difficulty: 'easy', speakers_millions: 2, is_active: true, sort_order: 50 },
]

export { STATIC_LANGUAGES }

export function useLanguages() {
  const [languages, setLanguages] = useState<Language[]>(STATIC_LANGUAGES)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('languages')
      .select('id, name, native_name, slug, flag, family, difficulty, speakers_millions, is_active, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        if (data && data.length > 0) setLanguages(data as Language[])
        // If DB not set up yet, STATIC_LANGUAGES remains as fallback
        setLoading(false)
      })
  }, [])

  return { languages, loading }
}

export function useLanguage(slug: string) {
  // Try static data first for instant render
  const staticMatch = STATIC_LANGUAGES.find(l => l.slug === slug) || null
  const [language, setLanguage] = useState<Language | null>(staticMatch)
  const [loading, setLoading] = useState(!staticMatch)

  useEffect(() => {
    if (!slug) return
    supabase
      .from('languages')
      .select('id, name, native_name, slug, flag, family, difficulty, speakers_millions, is_active, sort_order')
      .eq('slug', slug)
      .single()
      .then(({ data, error }) => {
        if (data) setLanguage(data as Language)
        setLoading(false)
      })
  }, [slug])

  return { language, loading }
}