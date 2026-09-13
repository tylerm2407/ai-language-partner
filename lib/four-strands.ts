/**
 * Weekly practice-time balance across the four columns Fluenci actually
 * measures: listening, reading, speaking, writing.
 *
 * This used to model Paul Nation's Four Strands (research.md §14.3) —
 * meaning-focused input/output, language-focused study, and fluency
 * development — but only two of those four buckets ever had a real data
 * source: `daily_stats` has no `languageFocusMinutes` or `fluencyMinutes`
 * column, so those two bars always read 0% and the "underweight" nudge could
 * only ever point at one of them. This module now measures the four columns
 * `daily_stats` genuinely tracks, directly, over the current week.
 *
 * The `Strand` union's member names below are kept as-is even though they no
 * longer mean "strand" — `components/stats/FourStrandsCard.tsx` (out of this
 * change's file scope) types its own per-strand color map against this exact
 * union, so renaming the keys would break that file's typecheck. What each
 * key HOLDS and is LABELED as has changed: one key per measured skill, not a
 * strand grouping.
 */

export type Strand = 'meaning_input' | 'meaning_output' | 'language_focus' | 'fluency';

export const STRAND_LABELS: Record<Strand, string> = {
  meaning_input: 'Listening',
  meaning_output: 'Reading',
  language_focus: 'Speaking',
  fluency: 'Writing',
};

export const STRAND_DESCRIPTION: Record<Strand, string> = {
  meaning_input: 'Minutes spent listening this week.',
  meaning_output: 'Minutes spent reading this week.',
  language_focus: 'Minutes spent speaking this week.',
  fluency: 'Minutes spent writing this week.',
};

export interface StrandMinutes {
  meaning_input: number;
  meaning_output: number;
  language_focus: number;
  fluency: number;
}

/**
 * Sum listening/reading/speaking/writing minutes across a set of
 * `daily_stats` rows — typically a week from `fetchStatsRange`, so the card
 * reads "this week's balance" honestly instead of just today's row.
 */
export function strandMinutesFromDailyStats(
  rows: {
    listeningMinutes?: number;
    readingMinutes?: number;
    speakingMinutes?: number;
    writingMinutes?: number;
  }[],
): StrandMinutes {
  return rows.reduce<StrandMinutes>(
    (totals, row) => ({
      meaning_input: totals.meaning_input + (row.listeningMinutes ?? 0),
      meaning_output: totals.meaning_output + (row.readingMinutes ?? 0),
      language_focus: totals.language_focus + (row.speakingMinutes ?? 0),
      fluency: totals.fluency + (row.writingMinutes ?? 0),
    }),
    { meaning_input: 0, meaning_output: 0, language_focus: 0, fluency: 0 },
  );
}

/**
 * Return the strand that's most underweight this week, or null if the
 * learner is roughly balanced or there isn't enough data yet. Since all four
 * buckets are now genuinely measured, "underweight" only fires for a skill
 * that is truly below the others — never a bucket that was never wired up.
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
