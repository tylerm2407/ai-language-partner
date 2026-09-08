/**
 * lib/insights.ts — the ranking and copy behind "Your patterns".
 *
 * The thresholds here mirror `_shared/learner-context.ts` on the server. If a
 * test below has to change because a threshold moved, move the server's too,
 * or Home will show the learner a different list from the one the tutor reads.
 */
import {
  MIN_RECURRING_COUNT,
  STRUGGLING_EASE_FACTOR,
  heroSubtitle,
  idealSelfFragment,
  languageVariants,
  normaliseLanguage,
  patternsHeadline,
  rankRecurringMistakes,
  rankStrugglingWords,
  reminderCopy,
  strugglingReason,
  type CorrectionLogRow,
} from './insights';
import type { Card, ReviewItem } from '../types';

function row(over: Partial<CorrectionLogRow> & { shortLabel: string | null }): CorrectionLogRow {
  return {
    errorType: 'grammar',
    original: null,
    corrected: null,
    explanation: null,
    createdAt: '2026-09-01T10:00:00.000Z',
    ...over,
  };
}

function item(over: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id: 'ri',
    userId: 'u',
    cardId: 'c',
    easeFactor: 2.5,
    interval: 6,
    repetitions: 2,
    nextDue: '2026-09-10T00:00:00.000Z',
    lastReviewedAt: '2026-09-04T00:00:00.000Z',
    status: 'review',
    ...over,
  };
}

function card(targetText: string, over: Partial<Card> = {}): Card {
  return {
    id: `card-${targetText}`,
    courseId: 'course',
    unitId: null,
    nativeText: 'x',
    targetText,
    audioUrl: null,
    imageUrl: null,
    exampleSentence: null,
    exampleSentenceTranslation: null,
    partOfSpeech: null,
    tags: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

describe('rankRecurringMistakes', () => {
  it('drops labels seen only once — a slip is not a pattern', () => {
    const out = rankRecurringMistakes([row({ shortLabel: 'ser vs estar' }), row({ shortLabel: 'por vs para' })]);
    expect(out).toEqual([]);
    expect(MIN_RECURRING_COUNT).toBe(2);
  });

  it('tallies case- and whitespace-insensitively and keeps the most recent wording', () => {
    const out = rankRecurringMistakes([
      row({ shortLabel: 'Ser vs  Estar', createdAt: '2026-09-01T00:00:00.000Z' }),
      row({ shortLabel: 'ser vs estar', createdAt: '2026-09-03T00:00:00.000Z', original: 'soy cansado', corrected: 'estoy cansado' }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].count).toBe(2);
    expect(out[0].label).toBe('ser vs estar');
    expect(out[0].latest).toBe('2026-09-03T00:00:00.000Z');
    expect(out[0].example).toEqual({ original: 'soy cansado', corrected: 'estoy cansado', explanation: null });
  });

  it('ranks by count, then recency, and honours the limit', () => {
    const out = rankRecurringMistakes(
      [
        row({ shortLabel: 'a', createdAt: '2026-09-01T00:00:00.000Z' }),
        row({ shortLabel: 'a', createdAt: '2026-09-02T00:00:00.000Z' }),
        row({ shortLabel: 'b', createdAt: '2026-09-05T00:00:00.000Z' }),
        row({ shortLabel: 'b', createdAt: '2026-09-06T00:00:00.000Z' }),
        row({ shortLabel: 'c', createdAt: '2026-09-01T00:00:00.000Z' }),
        row({ shortLabel: 'c', createdAt: '2026-09-02T00:00:00.000Z' }),
        row({ shortLabel: 'c', createdAt: '2026-09-03T00:00:00.000Z' }),
      ],
      { limit: 2 },
    );
    expect(out.map((m) => m.label)).toEqual(['c', 'b']);
  });

  it('coerces an unknown error type to "other" rather than trusting the column', () => {
    const out = rankRecurringMistakes([
      row({ shortLabel: 'x', errorType: 'phonological' }),
      row({ shortLabel: 'x', errorType: 'phonological' }),
    ]);
    expect(out[0].errorType).toBe('other');
  });

  it('ignores rows with no label', () => {
    expect(rankRecurringMistakes([row({ shortLabel: null }), row({ shortLabel: '   ' })])).toEqual([]);
  });
});

describe('strugglingReason', () => {
  it('flags a leech first', () => {
    expect(strugglingReason(item({ status: 'leech', easeFactor: 2.5 }))).toBe('leech');
  });

  it('flags a card that failed its last review, but not a card never reviewed', () => {
    expect(strugglingReason(item({ status: 'learning', repetitions: 0, lastReviewedAt: '2026-09-01T00:00:00.000Z' }))).toBe('keeps_slipping');
    expect(strugglingReason(item({ status: 'learning', repetitions: 0, lastReviewedAt: null }))).toBeNull();
    expect(strugglingReason(item({ status: 'new', repetitions: 0, lastReviewedAt: null, easeFactor: 2.5 }))).toBeNull();
  });

  it('flags a worn-down ease factor at the server threshold', () => {
    expect(STRUGGLING_EASE_FACTOR).toBe(2.2);
    expect(strugglingReason(item({ easeFactor: 2.19 }))).toBe('hard_to_recall');
    expect(strugglingReason(item({ easeFactor: 2.2 }))).toBeNull();
  });
});

describe('rankStrugglingWords', () => {
  it('orders leech, then slipped, then hard; dedupes by text; filters by language', () => {
    const out = rankStrugglingWords(
      [
        { item: item({ id: '1', easeFactor: 2.0 }), card: card('hola') },
        { item: item({ id: '2', status: 'leech' }), card: card('adiós') },
        { item: item({ id: '3', status: 'learning', repetitions: 0 }), card: card('gracias') },
        { item: item({ id: '4', easeFactor: 1.8 }), card: card('HOLA') },
        { item: item({ id: '5', easeFactor: 1.5 }), card: card('bonjour', { language: 'fr' }) },
        { item: item({ id: '6', easeFactor: 2.5 }), card: card('fine') },
      ],
      { language: 'es' },
    );
    expect(out.map((w) => w.card.targetText)).toEqual(['adiós', 'gracias', 'hola']);
    expect(out.map((w) => w.reason)).toEqual(['leech', 'keeps_slipping', 'hard_to_recall']);
  });

  it('keeps cards whose language column is empty', () => {
    const out = rankStrugglingWords([{ item: item({ easeFactor: 1.9 }), card: card('sí') }], { language: 'es' });
    expect(out).toHaveLength(1);
  });
});

describe('language spellings', () => {
  it('queries every spelling the columns have been written with', () => {
    expect(languageVariants('es')).toEqual(expect.arrayContaining(['es', 'Spanish', 'spanish']));
    expect(normaliseLanguage('Spanish')).toBe('es');
    expect(normaliseLanguage(' ES ')).toBe('es');
    expect(normaliseLanguage('klingon')).toBe('klingon');
  });
});

describe('copy', () => {
  it('trims the ideal self on a word boundary and drops the full stop', () => {
    expect(idealSelfFragment('order coffee in Lisbon.')).toBe('order coffee in Lisbon');
    const long = 'have a long relaxed conversation with my partner’s grandmother about her childhood in the village';
    const frag = idealSelfFragment(long, 40);
    expect(frag.length).toBeLessThanOrEqual(41);
    expect(frag.endsWith('…')).toBe(true);
    expect(frag).not.toMatch(/\s…$/);
  });

  it('hero subtitle prefers the goal and falls back to the can-do statement', () => {
    expect(heroSubtitle('order coffee in Lisbon', 'Can handle short exchanges')).toBe('Toward: order coffee in Lisbon');
    expect(heroSubtitle('   ', 'Can handle short exchanges')).toBe('Can handle short exchanges');
    expect(heroSubtitle(null, 'Can handle short exchanges')).toBe('Can handle short exchanges');
  });

  it('patterns headline reads correctly at every count', () => {
    expect(patternsHeadline(0, 0)).toBe('');
    expect(patternsHeadline(1, 0)).toBe('One mistake keeps coming back');
    expect(patternsHeadline(3, 0)).toBe('3 mistakes keep coming back');
    expect(patternsHeadline(0, 1)).toBe('One word is fighting you');
    expect(patternsHeadline(0, 4)).toBe('4 words are fighting you');
    expect(patternsHeadline(2, 2)).toBe('Where your next five minutes go');
  });

  describe('reminderCopy', () => {
    it('falls back to the generic line when nothing personal is known', () => {
      expect(reminderCopy({}).body).toBe('5 minutes is enough to keep moving.');
      expect(reminderCopy({ idealL2Self: '  ', dueCount: 0, topMistakeLabel: null }).body).toBe('5 minutes is enough to keep moving.');
    });

    it('rotates through the available hooks by calendar day', () => {
      const input = { idealL2Self: 'order coffee in Lisbon', topMistakeLabel: 'ser vs estar', dueCount: 7 };
      const bodies = new Set(
        [1, 2, 3].map((d) => reminderCopy({ ...input, date: new Date(2026, 0, d) }).body),
      );
      expect(bodies.size).toBe(3);
      expect([...bodies].some((b) => b.includes('order coffee in Lisbon'))).toBe(true);
      expect([...bodies].some((b) => b.includes('ser vs estar'))).toBe(true);
      expect([...bodies].some((b) => b.includes('7 words are ready'))).toBe(true);
    });

    it('never frames a missed day as a loss', () => {
      const input = { idealL2Self: 'x', topMistakeLabel: 'y', dueCount: 3 };
      for (let d = 1; d <= 3; d++) {
        const { body } = reminderCopy({ ...input, date: new Date(2026, 0, d) });
        expect(body.toLowerCase()).not.toMatch(/streak|lose|losing|miss/);
      }
    });

    it('singularises one due word', () => {
      expect(reminderCopy({ dueCount: 1 }).body).toBe('1 word is ready for review before it fades.');
    });
  });
});
