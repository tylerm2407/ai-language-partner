/**
 * `daily_stats` never had `languageFocusMinutes` or `fluencyMinutes` columns,
 * so the old strand model always rendered two permanently-empty bars and an
 * "underweight" nudge that could only ever point at one of those two fakes.
 * These tests pin the replacement: four real measured minutes, summed across
 * a week of rows, with a nudge that only fires on a genuine gap.
 */
import { strandMinutesFromDailyStats, mostUnderweightStrand, STRAND_LABELS } from './four-strands';

describe('strandMinutesFromDailyStats', () => {
  it('sums the four measured columns across a week of rows', () => {
    const totals = strandMinutesFromDailyStats([
      { listeningMinutes: 10, readingMinutes: 5, speakingMinutes: 2, writingMinutes: 1 },
      { listeningMinutes: 4, readingMinutes: 1, speakingMinutes: 3, writingMinutes: 2 },
    ]);
    expect(totals).toEqual({
      meaning_input: 14, // listening: 10 + 4
      meaning_output: 6, // reading: 5 + 1
      language_focus: 5, // speaking: 2 + 3
      fluency: 3, // writing: 1 + 2
    });
  });

  it('treats missing minute fields as zero rather than throwing', () => {
    const totals = strandMinutesFromDailyStats([{}, { listeningMinutes: 5 }]);
    expect(totals).toEqual({ meaning_input: 5, meaning_output: 0, language_focus: 0, fluency: 0 });
  });

  it('returns all-zero totals for an empty week', () => {
    expect(strandMinutesFromDailyStats([])).toEqual({
      meaning_input: 0,
      meaning_output: 0,
      language_focus: 0,
      fluency: 0,
    });
  });
});

describe('mostUnderweightStrand', () => {
  it('returns null when there is not enough data yet', () => {
    expect(mostUnderweightStrand({ meaning_input: 5, meaning_output: 5, language_focus: 5, fluency: 5 })).toBeNull();
  });

  it('returns null when the four measured skills are roughly balanced', () => {
    const totals = { meaning_input: 20, meaning_output: 18, language_focus: 21, fluency: 19 };
    expect(mostUnderweightStrand(totals)).toBeNull();
  });

  it('flags the skill that is genuinely below the others, never a stub bucket', () => {
    // Only two bars ever moved under the old model — language_focus and
    // fluency stayed pinned at 0 no matter what. Now every bucket is a real
    // measured skill, so a genuine gap in speaking (language_focus) surfaces.
    const totals = { meaning_input: 30, meaning_output: 30, language_focus: 2, fluency: 30 };
    expect(mostUnderweightStrand(totals)).toBe('language_focus');
  });

  it('does not flag a skill that is only slightly below average', () => {
    const totals = { meaning_input: 26, meaning_output: 25, language_focus: 24, fluency: 25 };
    expect(mostUnderweightStrand(totals)).toBeNull();
  });
});

describe('STRAND_LABELS', () => {
  it('names the four measured skills honestly, not the old academic strand names', () => {
    expect(Object.values(STRAND_LABELS)).toEqual(
      expect.arrayContaining(['Listening', 'Reading', 'Speaking', 'Writing']),
    );
  });
});
