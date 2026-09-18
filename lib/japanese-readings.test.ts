/**
 * The reading table, and the one question asked of it.
 *
 * Every pair used here is a word the Japanese courses actually teach, because
 * what is being tested is whether a real learner's real answer is accepted —
 * not whether a lookup works.
 */

import {
  authoredReadingCount,
  authoredReadings,
  foldKana,
  hasKanji,
  isAuthoredReading,
  isKanaOnly,
  readingCollisions,
} from './japanese-readings';

describe('foldKana', () => {
  it('folds katakana onto hiragana', () => {
    expect(foldKana('カンゴシ')).toBe('かんごし');
    expect(foldKana('サカナ')).toBe('さかな');
  });

  it('leaves hiragana alone', () => {
    expect(foldKana('かんごし')).toBe('かんごし');
  });

  it('keeps the long-vowel mark rather than folding it to a vowel', () => {
    // コーヒー and こひ are different words; folding ー would merge them.
    expect(foldKana('コーヒー')).toBe('こーひー');
  });
});

describe('isKanaOnly', () => {
  it.each(['かんごし', 'カンゴシ', 'さかな', 'コーヒー'])('accepts %s', (text) => {
    expect(isKanaOnly(text)).toBe(true);
  });

  it.each([
    ['看護師', 'all kanji'],
    ['看ごし', 'half-converted — a composition, not a reading'],
    ['kangoshi', 'romaji the converter never ran on'],
    ['', 'nothing typed'],
    ['   ', 'whitespace'],
  ])('refuses %s (%s)', (text) => {
    expect(isKanaOnly(text)).toBe(false);
  });
});

describe('hasKanji', () => {
  it('separates written forms that have a reading to be accepted by', () => {
    expect(hasKanji('看護師')).toBe(true);
    expect(hasKanji('お願いします')).toBe(true);
    expect(hasKanji('さかな')).toBe(false);
  });
});

describe('authoredReadings', () => {
  it.each([
    ['看護師', 'かんごし'],
    ['魚', 'さかな'],
    ['水', 'みず'],
    ['牛乳', 'ぎゅうにゅう'],
    ['明日', 'あす'],
  ])('knows the authored reading of %s', (written, reading) => {
    expect(authoredReadings(written)).toContain(reading);
  });

  it('knows nothing about a fragment, and says so rather than guessing', () => {
    // 護師 is the tail of 看護師. It is not a word and has no reading of its
    // own; 90 fill-blank rows look like this.
    expect(authoredReadings('護師')).toEqual([]);
    expect(authoredReadings('人公')).toEqual([]);
  });

  it('holds the whole curriculum, not a handful', () => {
    // Guards against the generated table being emptied or truncated by a bad
    // regeneration — the failure mode that would silently switch the grader's
    // acceptance back off for every row.
    expect(authoredReadingCount()).toBeGreaterThan(250);
  });
});

describe('isAuthoredReading', () => {
  it('accepts the reading a learner would type', () => {
    expect(isAuthoredReading('かんごし', '看護師')).toBe(true);
    expect(isAuthoredReading('さかな', '魚')).toBe(true);
  });

  it('accepts it in katakana too', () => {
    expect(isAuthoredReading('カンゴシ', '看護師')).toBe(true);
  });

  it('refuses a near-miss reading', () => {
    // A learner who says かんごう does not know the word. Forgiving it teaches
    // the wrong pronunciation and then spaces it out as though it were right.
    expect(isAuthoredReading('かんごう', '看護師')).toBe(false);
    expect(isAuthoredReading('さがな', '魚')).toBe(false);
  });

  it('refuses a reading composed from the characters rather than authored', () => {
    // 明日 is あした / あす. Per-character composition would say めいにち,
    // which is not a word — this is why readings are never derived.
    expect(isAuthoredReading('めいにち', '明日')).toBe(false);
  });

  it('refuses when the written form has no kanji to be read', () => {
    // Nothing to accept a reading FOR: an all-kana key is an exact match or a
    // wrong answer, and this branch must not touch it.
    expect(isAuthoredReading('さかな', 'さかな')).toBe(false);
  });

  it('refuses a half-converted answer', () => {
    expect(isAuthoredReading('看ごし', '看護師')).toBe(false);
  });
});

describe('homophone precondition', () => {
  it('has no reading spelling two different taught words', () => {
    // The grader refuses a bare reading that spells two taught words (雨/飴,
    // 橋/箸). No such pair is authored today, which is the only reason that
    // refusal cannot fire. When this fails, a homophone pair has been added:
    // that is the moment the refusal starts doing work, and the moment to add
    // a grading test for the pair this names.
    expect(readingCollisions()).toEqual([]);
  });
});
