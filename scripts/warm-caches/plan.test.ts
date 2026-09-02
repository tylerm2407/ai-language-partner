/**
 * Planning and resume.
 *
 * `dedupeAndSkip` is the whole safety property of a re-runnable spending
 * script: get it wrong in the permissive direction and a second run pays the
 * entire bill again, in the strict direction and new curriculum is never
 * warmed. Both failures are invisible in the output — the run just looks
 * expensive, or looks suspiciously cheap.
 */

import { webcrypto } from 'crypto';
import {
  dedupeAndSkip,
  planExplanations,
  planHints,
  planTranslations,
  planTts,
  type CardRow,
  type WorkItem,
} from './plan';
import { translationCacheKey } from './keys';

beforeAll(() => {
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  }
});

const item = (key: string): WorkItem => ({ cache: 'translation', key, label: key });

const card = (over: Partial<CardRow> = {}): CardRow => ({
  id: '11111111-1111-1111-1111-111111111111',
  language: 'es',
  target_text: 'perro',
  native_text: 'dog',
  part_of_speech: 'noun',
  example_sentence: null,
  cefr_level: 'A1',
  ...over,
});

describe('dedupeAndSkip — resume', () => {
  it('keeps everything when the cache is cold', () => {
    const result = dedupeAndSkip([item('a'), item('b')], new Set());
    expect(result.items.map((i) => i.key)).toEqual(['a', 'b']);
    expect(result.alreadyCached).toBe(0);
    expect(result.duplicates).toBe(0);
  });

  it('drops what the cache already holds — a second run costs nothing', () => {
    const result = dedupeAndSkip([item('a'), item('b')], new Set(['a', 'b']));
    expect(result.items).toEqual([]);
    expect(result.alreadyCached).toBe(2);
  });

  it('warms only the new rows when curriculum is added', () => {
    const result = dedupeAndSkip([item('old'), item('new')], new Set(['old']));
    expect(result.items.map((i) => i.key)).toEqual(['new']);
    expect(result.alreadyCached).toBe(1);
  });

  it('collapses duplicates within one run so a shared key is paid for once', () => {
    const result = dedupeAndSkip([item('a'), item('a'), item('a')], new Set());
    expect(result.items).toHaveLength(1);
    expect(result.duplicates).toBe(2);
  });

  it('counts a cached duplicate as cached, not as a duplicate', () => {
    // Skipping before deduping is what keeps the two counters from describing
    // the same row twice.
    const result = dedupeAndSkip([item('a'), item('a')], new Set(['a']));
    expect(result.alreadyCached).toBe(2);
    expect(result.duplicates).toBe(0);
  });

  it('preserves input order', () => {
    const result = dedupeAndSkip([item('c'), item('a'), item('b')], new Set());
    expect(result.items.map((i) => i.key)).toEqual(['c', 'a', 'b']);
  });
});

describe('planTranslations', () => {
  it('keys on the card language and the learner native language', async () => {
    const [literal] = await planTranslations([card()], 'en');
    expect(literal.key).toBe(await translationCacheKey('perro', 'es', 'en'));
    expect(literal.form).toBe('literal');
  });

  it('also warms the reader form, because the reader normalises before asking', async () => {
    const items = await planTranslations([card({ target_text: 'Perro' })], 'en');
    expect(items.map((i) => [i.form, i.text])).toEqual([
      ['literal', 'Perro'],
      ['normalized', 'perro'],
    ]);
  });

  it('does not invent a reader form for multi-word cards — a tap is one token', async () => {
    const items = await planTranslations([card({ target_text: 'Buenos días' })], 'en');
    expect(items).toHaveLength(1);
    expect(items[0].form).toBe('literal');
  });

  it('emits one item when the two forms coincide', async () => {
    const items = await planTranslations([card({ target_text: 'perro' })], 'en');
    expect(items).toHaveLength(1);
  });

  it('skips cards already in the native language — translate short-circuits those', async () => {
    expect(await planTranslations([card({ language: 'en' })], 'en')).toEqual([]);
  });

  it('skips cards with no language and empty text', async () => {
    expect(await planTranslations([card({ language: null })], 'en')).toEqual([]);
    expect(await planTranslations([card({ target_text: '   ' })], 'en')).toEqual([]);
  });
});

describe('planHints', () => {
  it('produces one item per (card, exercise type)', () => {
    const c = card();
    const items = planHints([
      { card_id: c.id, type: 'listening_type', language: 'es', card: c },
      { card_id: c.id, type: 'speaking', language: 'es', card: c },
    ]);
    expect(items).toHaveLength(2);
    expect(new Set(items.map((i) => i.key)).size).toBe(2);
    expect(items[0].key).toBe(`${c.id}::listening_type`);
  });
});

describe('planTts', () => {
  const map = { es: { female: ['f1'] }, ja: { female: ['jf'] } };

  it('bills the citation form, in bytes', async () => {
    const { items } = await planTts([{ prompt: 'perro', language: 'es', type: 'listening_type' }], map);
    expect(items[0].sentText).toBe('perro.');
    expect(items[0].bytes).toBe(6);
  });

  it('counts CJK prompts in bytes, not characters', async () => {
    const { items } = await planTts([{ prompt: '犬', language: 'ja', type: 'listening_type' }], map);
    expect(items[0].sentText).toBe('犬.');
    expect(items[0].bytes).toBe(4); // 3 for 犬 + 1 for the added period
  });

  it('reports a language fish cannot serve instead of silently dropping it', async () => {
    const plan = await planTts([{ prompt: 'hund', language: 'sv', type: 'listening_type' }], map);
    expect(plan.items).toEqual([]);
    expect(plan.unwarmableLanguages).toEqual(['sv']);
  });

  it('gives the slow rate a distinct key so it never overwrites the canonical clip', async () => {
    const normal = await planTts([{ prompt: 'perro', language: 'es', type: 'listening_type' }], map);
    const slow = await planTts([{ prompt: 'perro', language: 'es', type: 'listening_type' }], map, 0.75);
    expect(slow.items[0].key).not.toBe(normal.items[0].key);
  });

  it('ignores an empty prompt', async () => {
    const { items } = await planTts([{ prompt: '  ', language: 'es', type: 'dictation' }], map);
    expect(items).toEqual([]);
  });
});

describe('planExplanations', () => {
  const long = 'La comida es una parte importante de la cultura de cada pais del mundo.';

  it('keys on language, native language, level and the normalised span', async () => {
    const items = await planExplanations(
      [{ span: long, language: 'es', cefrLevel: 'B1', passageTitle: 'T' }],
      'en',
    );
    expect(items).toHaveLength(1);
    expect(items[0].span).toBe(long);
  });

  it('collapses whitespace, so a re-wrapped paragraph hits the same row', async () => {
    const wrapped = long.replace(/ /g, '\n  ');
    const [a] = await planExplanations([{ span: long, language: 'es', cefrLevel: 'B1', passageTitle: 'T' }], 'en');
    const [b] = await planExplanations([{ span: wrapped, language: 'es', cefrLevel: 'B1', passageTitle: 'T' }], 'en');
    expect(b.key).toBe(a.key);
  });

  it('drops spans the edge function would refuse, rather than buying unreachable rows', async () => {
    const tooShort = await planExplanations(
      [{ span: 'Hola.', language: 'es', cefrLevel: 'B1', passageTitle: 'T' }],
      'en',
    );
    const tooLong = await planExplanations(
      [{ span: 'a '.repeat(900), language: 'es', cefrLevel: 'B1', passageTitle: 'T' }],
      'en',
    );
    expect(tooShort).toEqual([]);
    expect(tooLong).toEqual([]);
  });

  it('keys the same paragraph separately per level, as the function does', async () => {
    const [b1] = await planExplanations([{ span: long, language: 'es', cefrLevel: 'B1', passageTitle: 'T' }], 'en');
    const [b2] = await planExplanations([{ span: long, language: 'es', cefrLevel: 'B2', passageTitle: 'T' }], 'en');
    expect(b1.key).not.toBe(b2.key);
  });
});
