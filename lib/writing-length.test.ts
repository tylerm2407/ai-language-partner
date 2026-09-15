import { readFileSync } from 'fs';
import { join } from 'path';

import { countWritingUnits, isSegmentedLanguage, normalizeLanguageCode } from './writing-length';

// Segment counts are asserted as ranges, not exact numbers: word-boundary
// segmentation for Japanese and Chinese comes from the runtime's ICU
// dictionary, and Node (full ICU 78 here), Deno and any future Hermes build
// can legitimately split a compound differently. What must hold is that a
// sentence is several units, never one whitespace chunk and never one unit
// per character.

test.each([
  ['es', 'Me llamo Ana y vivo en Madrid.', 7],
  ['fr', "  Je m'appelle   Camille.\n", 3],
  ['en', '', 0],
  ['ru', 'Я живу в Москве', 4],
  ['ko', '저는 학생입니다.', 2],
])('whitespace words for %s', (language, text, expected) => {
  expect(countWritingUnits(text, language)).toEqual({ count: expected, unit: 'word', method: 'whitespace' });
});

test('a missing language falls back to whitespace words', () => {
  expect(countWritingUnits('one two', null)).toEqual({ count: 2, unit: 'word', method: 'whitespace' });
  expect(countWritingUnits('one two', undefined).method).toBe('whitespace');
  expect(isSegmentedLanguage(undefined)).toBe(false);
});

test('我每天早上去学校 is several segments, not one chunk and not eight characters', () => {
  expect(typeof Intl.Segmenter).toBe('function');
  const result = countWritingUnits('我每天早上去学校', 'zh');
  expect(result.unit).toBe('segment');
  expect(result.method).toBe('intl_segmenter');
  // Node 22 / ICU 78 gives 5 (我 每天 早上 去 学校); tolerate dictionary drift.
  expect(result.count).toBeGreaterThanOrEqual(3);
  expect(result.count).toBeLessThanOrEqual(6);
});

test('Chinese punctuation and spaces are not segments', () => {
  const plain = countWritingUnits('今天和朋友一起学习中文', 'zh');
  const punctuated = countWritingUnits('今天，和朋友一起学习中文。 ', 'zh');
  expect(plain.count).toBeGreaterThanOrEqual(4);
  expect(punctuated.count).toBe(plain.count);
});

test('Japanese is counted in word segments', () => {
  const result = countWritingUnits('私は毎朝学校に行きます。', 'ja');
  expect(result.unit).toBe('segment');
  expect(result.method).toBe('intl_segmenter');
  // 私 は 毎朝 学校 に 行き ます under ICU 78; particles count as segments.
  expect(result.count).toBeGreaterThanOrEqual(4);
  expect(result.count).toBeLessThanOrEqual(9);
  expect(countWritingUnits('', 'ja')).toEqual({ count: 0, unit: 'segment', method: 'intl_segmenter' });
});

test('a whitespace count of the same Japanese sentence would have been one', () => {
  expect(countWritingUnits('私は毎朝学校に行きます。', 'es').count).toBe(1);
});

describe('without Intl.Segmenter', () => {
  const original = Intl.Segmenter;
  beforeEach(() => {
    Object.defineProperty(Intl, 'Segmenter', { value: undefined, configurable: true, writable: true });
  });
  afterEach(() => {
    Object.defineProperty(Intl, 'Segmenter', { value: original, configurable: true, writable: true });
  });

  test('ja/zh report unavailable with a character count, never words', () => {
    const result = countWritingUnits('我每天早上去学校。', 'zh');
    expect(result).toEqual({ count: 8, unit: 'character', method: 'unavailable' });
    const ja = countWritingUnits('私は 学生です。', 'ja');
    expect(ja).toEqual({ count: 6, unit: 'character', method: 'unavailable' });
  });

  test('other languages are unaffected', () => {
    expect(countWritingUnits('uno dos tres', 'es')).toEqual({ count: 3, unit: 'word', method: 'whitespace' });
  });
});

describe('language codes are normalised to their primary subtag', () => {
  test.each(['zh', 'zh-CN', 'zh_Hans_CN', 'ZH', ' zh-Hant '])('%s is segmented Chinese', (code) => {
    expect(isSegmentedLanguage(code)).toBe(true);
    const result = countWritingUnits('我每天早上去学校', code);
    expect(result.method).toBe('intl_segmenter');
    expect(result.count).toBe(countWritingUnits('我每天早上去学校', 'zh').count);
    // The bug this closes: an unnormalised code counted the whole sentence as 1.
    expect(result.count).toBeGreaterThan(1);
  });

  test.each(['ja', 'JA', 'ja-JP'])('%s is segmented Japanese', (code) => {
    expect(countWritingUnits('私は毎朝学校に行きます。', code).method).toBe('intl_segmenter');
  });

  test('spaced languages and junk codes are unaffected', () => {
    expect(countWritingUnits('uno dos tres', 'es-MX')).toEqual({ count: 3, unit: 'word', method: 'whitespace' });
    expect(isSegmentedLanguage('')).toBe(false);
    expect(isSegmentedLanguage('   ')).toBe(false);
    expect(isSegmentedLanguage('jap')).toBe(false);
    expect(isSegmentedLanguage('constructor')).toBe(false);
    expect(countWritingUnits('one two', 'constructor').method).toBe('whitespace');
  });

  test('normalizeLanguageCode returns the primary subtag or null', () => {
    expect(normalizeLanguageCode('zh-Hans-CN')).toBe('zh');
    expect(normalizeLanguageCode('  PT_BR ')).toBe('pt');
    expect(normalizeLanguageCode('')).toBeNull();
    expect(normalizeLanguageCode('-')).toBeNull();
    expect(normalizeLanguageCode(null)).toBeNull();
    expect(normalizeLanguageCode(undefined)).toBeNull();
  });
});

// The client and the server keep separate copies of this module because the
// edge function cannot import from lib/. A comment asking the next editor to
// keep them identical guarantees nothing, so the contract is asserted: both
// files are read and everything below the header comment must match byte for
// byte. The Deno suite beside the server copy runs the same assertion, so a
// one-sided edit fails whichever suite the editor happens to run.
describe('twin module', () => {
  const CLIENT = join(__dirname, 'writing-length.ts');
  const SERVER = join(__dirname, '..', 'supabase', 'functions', 'grade-writing', 'writing-length.ts');

  function bodyAfterHeader(file: string): string {
    const source = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const headerEnd = source.indexOf('*/');
    if (headerEnd === -1) throw new Error(`${file} has no header comment block`);
    return source.slice(headerEnd + 2).trim();
  }

  test('the client and server copies have not drifted', () => {
    expect(bodyAfterHeader(SERVER)).toBe(bodyAfterHeader(CLIENT));
  });

  test('each header still points at the other copy', () => {
    const client = readFileSync(CLIENT, 'utf8');
    const server = readFileSync(SERVER, 'utf8');
    expect(client).toContain('TWIN: supabase/functions/grade-writing/writing-length.ts');
    expect(server).toContain('TWIN: lib/writing-length.ts');
  });
});
