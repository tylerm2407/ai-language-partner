/**
 * Paul Nation's Four Strands (research.md §14.3).
 *
 * A balanced language course spends ~25% of time in each strand:
 *   1. Meaning-focused input   — listening/reading, focus on comprehension
 *   2. Meaning-focused output  — writing/speaking, focus on communication
 *   3. Language-focused learning — explicit study of form (grammar, vocab drills)
 *   4. Fluency development     — improving automaticity on known material
 *
 * This module maps exercise types to their primary strand so we can measure
 * balance in `daily_stats` / a future dashboard (improvements.md §A.14.2).
 * Each exercise is classified under exactly one strand — the one it best
 * exercises — even though some types touch multiple strands.
 */

import type { ExerciseType } from '../types';

export type Strand =
  | 'meaning_input'
  | 'meaning_output'
  | 'language_focus'
  | 'fluency';

export const STRAND_LABELS: Record<Strand, string> = {
  meaning_input: 'Meaning-focused input',
  meaning_output: 'Meaning-focused output',
  language_focus: 'Language-focused learning',
  fluency: 'Fluency development',
};

export const STRAND_DESCRIPTION: Record<Strand, string> = {
  meaning_input: 'Listening and reading for comprehension.',
  meaning_output: 'Writing and speaking to communicate.',
  language_focus: 'Explicit study of grammar, vocabulary, spelling.',
  fluency: 'Building automaticity on material you already know.',
};

const EXERCISE_STRAND: Record<ExerciseType, Strand> = {
  // Meaning-focused input — reception skills
  multiple_choice: 'meaning_input',
  listening_choice: 'meaning_input',
  listening_type: 'meaning_input',
  translate_to_native: 'meaning_input',

  // Meaning-focused output — production for communication
  translate_to_target: 'meaning_output',
  free_production: 'meaning_output',
  speaking: 'meaning_output',
  mini_dialogue: 'meaning_output',

  // Language-focused learning — explicit form
  cloze_deletion: 'language_focus',
  fill_blank: 'language_focus',
  sentence_construction: 'language_focus',
  dictation: 'language_focus',
  error_correction: 'language_focus',
  collocation_match: 'language_focus',
  word_form: 'language_focus',
  sentence_transformation: 'language_focus',
};

export function strandForExerciseType(type: ExerciseType): Strand {
  return EXERCISE_STRAND[type] ?? 'language_focus';
}

/**
 * Aggregate minutes by strand from a daily_stats row.
 * daily_stats already tracks: listening_minutes, reading_minutes,
 * speaking_minutes, writing_minutes. This collapses those into strand
 * buckets (reading + listening → meaning_input, writing + speaking →
 * meaning_output). The language_focus / fluency buckets are populated
 * from per-exercise logs — for now they're derived from exercise type
 * on the client side.
 */
export interface StrandMinutes {
  meaning_input: number;
  meaning_output: number;
  language_focus: number;
  fluency: number;
}

export function strandMinutesFromDailyStats(stats: {
  listeningMinutes?: number;
  readingMinutes?: number;
  speakingMinutes?: number;
  writingMinutes?: number;
  /** Minutes spent on explicit drills (SRS vocab review, grammar drills). */
  languageFocusMinutes?: number;
  /** Minutes spent on fluency activities (repeated reading, shadowing). */
  fluencyMinutes?: number;
}): StrandMinutes {
  return {
    meaning_input: (stats.listeningMinutes ?? 0) + (stats.readingMinutes ?? 0),
    meaning_output: (stats.speakingMinutes ?? 0) + (stats.writingMinutes ?? 0),
    language_focus: stats.languageFocusMinutes ?? 0,
    fluency: stats.fluencyMinutes ?? 0,
  };
}

/**
 * Return the strand that's most underweight in this week's balance, or
 * null if the learner is roughly balanced. Useful for nudges like
 * "You've been heavy on drills — try a reading passage."
 */
export function mostUnderweightStrand(totals: StrandMinutes): Strand | null {
  const total =
    totals.meaning_input + totals.meaning_output + totals.language_focus + totals.fluency;
  if (total < 30) return null; // not enough data yet
  const target = total / 4;
  let worst: Strand | null = null;
  let worstGap = target * 0.15; // 15% below target before we flag
  (Object.keys(totals) as Strand[]).forEach((s) => {
    const gap = target - totals[s];
    if (gap > worstGap) {
      worstGap = gap;
      worst = s;
    }
  });
  return worst;
}
