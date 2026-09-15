/**
 * Unit tests for lib/reading-speed.ts.
 *
 * Pure functions, no mocks needed. The cases that matter are the guards: this
 * module is fed `reading_books.word_count` and `user_book_progress.
 * percent_complete` straight from the server, so it has to survive a 0-word
 * row and a percent that rounded past 100 on the last page.
 */
import {
  LEARNER_WORDS_PER_MINUTE,
  estimatedReadMinutes,
  formatReadDuration,
  remainingReadMinutes,
} from './reading-speed';

describe('LEARNER_WORDS_PER_MINUTE', () => {
  it('is the second-language pace, not the native one', () => {
    // Guards the reconciliation: Home used to say 140 and book detail 200.
    // If someone raises this back to ~200 the two screens are consistent but
    // both wrong for the person actually reading.
    expect(LEARNER_WORDS_PER_MINUTE).toBe(140);
  });
});

describe('estimatedReadMinutes', () => {
  it('converts words to minutes at the learner pace', () => {
    expect(estimatedReadMinutes(1400)).toBe(10);
    expect(estimatedReadMinutes(140)).toBe(1);
  });

  it('rounds to the nearest minute', () => {
    expect(estimatedReadMinutes(1330)).toBe(10); // 9.5 → 10
    expect(estimatedReadMinutes(1260)).toBe(9); // 9.0
  });

  it('never rounds a real text down to zero minutes', () => {
    expect(estimatedReadMinutes(1)).toBe(1);
    expect(estimatedReadMinutes(69)).toBe(1);
  });

  it('returns 0 for an absent or nonsensical count so callers can omit the label', () => {
    expect(estimatedReadMinutes(0)).toBe(0);
    expect(estimatedReadMinutes(-100)).toBe(0);
    expect(estimatedReadMinutes(Number.NaN)).toBe(0);
    expect(estimatedReadMinutes(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('remainingReadMinutes', () => {
  it('scales by how much is left, not how much is done', () => {
    expect(remainingReadMinutes(1400, 0)).toBe(10);
    expect(remainingReadMinutes(1400, 50)).toBe(5);
    expect(remainingReadMinutes(1400, 90)).toBe(1);
  });

  it('clamps a percent that overshot on the final page', () => {
    // percent_complete is numeric(5,2) written as (page+1)/totalPages*100, so
    // 100.01 is reachable. It must read as finished, not as negative time.
    expect(remainingReadMinutes(1400, 100)).toBe(0);
    expect(remainingReadMinutes(1400, 100.01)).toBe(0);
    expect(remainingReadMinutes(1400, 250)).toBe(0);
  });

  it('treats a negative or non-finite percent as unstarted', () => {
    expect(remainingReadMinutes(1400, -5)).toBe(10);
    expect(remainingReadMinutes(1400, Number.NaN)).toBe(10);
  });

  it('returns 0 when the book has no word count', () => {
    expect(remainingReadMinutes(0, 50)).toBe(0);
  });
});

describe('formatReadDuration', () => {
  it('shows plain minutes under an hour', () => {
    expect(formatReadDuration(1)).toBe('1 min');
    expect(formatReadDuration(59)).toBe('59 min');
  });

  it('breaks into hours once a book is long', () => {
    expect(formatReadDuration(60)).toBe('1 hr');
    expect(formatReadDuration(100)).toBe('1 hr 40 min');
    expect(formatReadDuration(140)).toBe('2 hr 20 min');
    expect(formatReadDuration(120)).toBe('2 hr');
  });

  it('renders nothing rather than "0 min" when there is no estimate', () => {
    expect(formatReadDuration(0)).toBe('');
    expect(formatReadDuration(-3)).toBe('');
    expect(formatReadDuration(Number.NaN)).toBe('');
  });

  it('carries no tilde, so it is safe to read aloud', () => {
    // The "~" belongs to the visual caller; screen readers should not hear it.
    expect(formatReadDuration(45)).not.toContain('~');
  });
});
