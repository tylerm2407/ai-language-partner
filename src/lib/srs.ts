// src/lib/srs.ts
// SM-2 Spaced Repetition System — client-side types and helpers

import { supabase } from './supabase'

export type SRSQuality = 0 | 1 | 2 | 3 | 4 | 5
// 0 = complete blackout
// 1 = wrong, familiar
// 2 = wrong but recalled on seeing answer
// 3 = correct, hard
// 4 = correct, normal
// 5 = correct, instant

export const QUALITY_LABELS: Record<SRSQuality, string> = {
  0: 'Forgot completely',
  1: 'Wrong',
  2: 'Wrong but close',
  3: 'Correct (hard)',
  4: 'Correct',
  5: 'Perfect!',
}

export const QUALITY_COLORS: Record<SRSQuality, string> = {
  0: 'bg-red-600 hover:bg-red-500 text-white',
  1: 'bg-red-500 hover:bg-red-400 text-white',
  2: 'bg-orange-500 hover:bg-orange-400 text-white',
  3: 'bg-yellow-500 hover:bg-yellow-400 text-black',
  4: 'bg-green-500 hover:bg-green-400 text-white',
  5: 'bg-emerald-500 hover:bg-emerald-400 text-white',
}

export interface SRSCard {
  id: string
  user_id: string
  language_slug: string
  language_id: string | null
  card_type: 'vocab' | 'grammar' | 'phrase' | 'sentence' | 'cultural'
  front: {
    text: string
    context?: string       // example sentence containing the word
    hint?: string          // grammatical hint e.g. "(noun, masculine)"
  }
  back: {
    text: string           // translation / answer
    explanation?: string   // WHY: grammar rule, usage note
    example?: string       // full example sentence with translation
    common_errors?: string // "Don't confuse with..."
    mnemonic?: string      // memory trick
  }
  ease_factor: number
  interval_days: number
  repetitions: number
  next_review_at: string
  last_reviewed_at: string | null
  source?: string
  created_at: string
}

export interface SRSStats {
  total_cards: number
  due_now: number
  due_today: number
  new_cards: number
  mastered: number
}

// ── API calls ──────────────────────────────────────────────────────────────

export async function getDueCards(languageSlug: string, limit = 20): Promise<SRSCard[]> {
  const { data, error } = await supabase
    .rpc('get_due_srs_cards', { p_language_slug: languageSlug, p_limit: limit })
  if (error) throw error
  return (data || []) as SRSCard[]
}

export async function reviewCard(
  cardId: string,
  quality: SRSQuality,
  responseMs?: number
): Promise<{ new_interval: number; next_review_at: string; xp_awarded: number }> {
  const { data, error } = await supabase
    .rpc('srs_review_card', {
      p_card_id: cardId,
      p_quality: quality,
      p_response_ms: responseMs ?? null,
    })
  if (error) throw error
  return data
}

export async function getSRSStats(languageSlug: string): Promise<SRSStats> {
  const { data, error } = await supabase
    .rpc('get_srs_stats', { p_language_slug: languageSlug })
  if (error) throw error
  return data as SRSStats
}

export async function addCardsFromLesson(
  languageSlug: string,
  languageId: string,
  cards: Array<{ front: SRSCard['front']; back: SRSCard['back']; card_type?: SRSCard['card_type'] }>,
  sourceId?: string
): Promise<number> {
  const { data, error } = await supabase.rpc('add_srs_cards_from_lesson', {
    p_language_slug: languageSlug,
    p_language_id: languageId,
    p_cards: cards,
    p_source_id: sourceId ?? null,
  })
  if (error) throw error
  return data as number
}

// ── Local SM-2 simulation (for instant UI feedback before DB sync) ─────────
export function localSM2(card: SRSCard, quality: SRSQuality) {
  let { ease_factor, interval_days, repetitions } = card
  let newEF = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  if (newEF < 1.3) newEF = 1.3

  let newInterval: number
  let newReps: number

  if (quality >= 3) {
    if (repetitions === 0) newInterval = 1
    else if (repetitions === 1) newInterval = 6
    else newInterval = Math.round(interval_days * ease_factor)
    newReps = repetitions + 1
  } else {
    newInterval = 0
    newReps = 0
  }

  const nextReview = new Date()
  if (newInterval === 0) nextReview.setMinutes(nextReview.getMinutes() + 10)
  else nextReview.setDate(nextReview.getDate() + newInterval)

  return { newEF, newInterval, newReps, nextReview }
}

// ── Card generation helpers ───────────────────────────────────────────────
// Generate SRS cards from vocab list (used in LessonPage)
export function vocabToSRSCards(
  words: Array<{ target: string; native: string; transliteration?: string }>,
  languageName: string
): Array<{ front: SRSCard['front']; back: SRSCard['back']; card_type: SRSCard['card_type'] }> {
  return words.map(w => ({
    card_type: 'vocab' as const,
    front: {
      text: w.target,
      hint: w.transliteration ? `(${w.transliteration})` : undefined,
    },
    back: {
      text: w.native,
      explanation: `This is a key vocabulary word in ${languageName}.`,
      example: `Practice using "${w.target}" in a sentence with your AI tutor.`,
    },
  }))
}
