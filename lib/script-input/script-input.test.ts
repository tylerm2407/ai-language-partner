/**
 * The conversions a learner will actually type on day one.
 *
 * Every case here is a word from the courses' own A1 vocabulary rather than an
 * invented string, because the thing being tested is whether someone can answer
 * the exercises — not whether a table round-trips.
 */

import { japaneseInput, romajiToKana, kanjiCandidates } from './ja';
import { koreanInput, romajaToHangul } from './ko';
import { russianInput, latinToCyrillic } from './ru';
import { chineseInput, pinyinCandidates, pinyinComposition } from './zh';
import { scriptInputFor, needsScriptInput } from './index';

describe('Japanese romaji to kana', () => {
  it.each([
    ['konnichiwa', 'こんにちわ'],
    ['onna', 'おんな'],
    ['zannen', 'ざんねん'],
    ['nn', 'ん'],
    ['sakana', 'さかな'],
    ['mizu', 'みず'],
    ['nihon', 'にほん'],
    ['gakkou', 'がっこう'],
    ['kitte', 'きって'],
    ['shitsumon', 'しつもん'],
    ['ohayou', 'おはよう'],
    ['ringo', 'りんご'],
    ['jugyou', 'じゅぎょう'],
  ])('%s -> %s', (romaji, kana) => {
    expect(japaneseInput.settle(romaji)).toBe(kana);
  });

  it('writes the topic particle the way a keyboard does', () => {
    // こんにちは ends in は, which is spelled `ha` even though it is said "wa".
    // A system IME behaves the same way; this is Japanese, not a shortfall.
    expect(japaneseInput.settle('konnichiha')).toBe('こんにちは');
  });

  it('spells shi the strict way and the wapuro way alike', () => {
    expect(japaneseInput.settle('shi')).toBe(japaneseInput.settle('si'));
    expect(japaneseInput.settle('tsu')).toBe(japaneseInput.settle('tu'));
  });

  it('holds a consonant back until its vowel arrives, then lets it go', () => {
    expect(romajiToKana('sakan')).toEqual({ text: 'さか', pending: 'n' });
    expect(romajiToKana('saka')).toEqual({ text: 'さか', pending: '' });
    // Pressing Check on さかん must not submit さか.
    expect(japaneseInput.settle('sakan')).toBe('さかん');
  });

  it('offers kanji the course teaches for a reading, and nothing else', () => {
    const fish = kanjiCandidates('さかな', []);
    expect(fish.map((c) => c.text)).toContain('魚');
    expect(kanjiCandidates('ぬぬぬ', [])).toEqual([]);
  });

  it('offers a single kanji for its own reading, which is how a fragment is typed', () => {
    // 乳 is the tail of 牛乳 and is not a word, so it is in no dictionary. A
    // per-character reading is the only route to it. Sixty rows depend on this.
    expect(kanjiCandidates('にゅう', []).map((c) => c.text)).toContain('乳');
    expect(kanjiCandidates('ご', []).map((c) => c.text)).toContain('護');
  });

  it('puts the whole word above the single characters', () => {
    // さかな is 魚 the word, not a hunt through every kanji read さかな.
    expect(kanjiCandidates('さかな', [])[0].text).toBe('魚');
  });

  it('lifts the answer the exercise wants to the front without inventing it', () => {
    const ranked = kanjiCandidates('みず', ['水']);
    expect(ranked[0].text).toBe('水');
    // Context re-ranks; it must never introduce a candidate of its own.
    expect(kanjiCandidates('ぬぬぬ', ['水'])).toEqual([]);
  });
});

describe('Korean romaja to Hangul', () => {
  it.each([
    ['annyeong', '안녕'],
    ['hanguk', '한국'],
    ['sarang', '사랑'],
    ['hapnida', '합니다'],
    ['hakgyo', '학교'],
    ['chingu', '친구'],
    ['seonsaengnim', '선생님'],
    ['mul', '물'],
    ['bap', '밥'],
  ])('%s -> %s', (romaja, hangul) => {
    expect(koreanInput.settle(romaja)).toBe(hangul);
  });

  it('writes the letters it is given, not the sound they make together', () => {
    // 합니다 is SAID "hamnida" — ㅂ assimilates to the ㄴ after it — but it is
    // WRITTEN with ㅂ. Romaja carries the sound, so a learner typing what they
    // hear gets 함니다: a real word, wrongly spelled.
    //
    // No transliteration can fix this, because the information is not in the
    // input. It is why the keypad ships alongside: ㅎ ㅏ ㅂ ㄴ ㅣ ㄷ ㅏ is
    // unambiguous, and why a learner who wants to be sure should tap.
    expect(koreanInput.settle('hamnida')).toBe('함니다');
  });

  it('reads a final consonant as a final and an initial as an initial', () => {
    // The same letter k: ㄱ closing 국, ㅋ opening 코.
    expect(romajaToHangul('hanguk').text).toBe('한국');
    expect(romajaToHangul('ko').text).toBe('코');
  });

  it('composes a bare vowel onto the silent initial', () => {
    expect(romajaToHangul('a').text).toBe('아');
  });
});

describe('Russian Latin to Cyrillic', () => {
  it.each([
    ['privet', 'привет'],
    ['spasibo', 'спасибо'],
    ['zhena', 'жена'],
    ['horosho', 'хорошо'],
    ['chay', 'чай'],
    ['shkola', 'школа'],
    ['dobroe utro', 'доброе утро'],
    ['yazyk', 'язык'],
  ])('%s -> %s', (latin, cyrillic) => {
    expect(russianInput.settle(latin)).toBe(cyrillic);
  });

  it('waits before committing a letter that could still start a digraph', () => {
    expect(latinToCyrillic('s')).toEqual({ text: '', pending: 's' });
    expect(latinToCyrillic('sh')).toEqual({ text: '', pending: 'sh' });
    // `sh` is a complete key AND the start of `shch`, so it is held while the
    // learner may still be typing — and released the moment they are done.
    expect(russianInput.settle('sh')).toBe('ш');
    expect(russianInput.settle('shch')).toBe('щ');
  });
});

describe('Chinese pinyin candidates', () => {
  it('offers the word for a full reading', () => {
    expect(pinyinCandidates('nihao', []).map((c) => c.text)).toContain('你好');
  });

  it('offers characters for a partial reading', () => {
    expect(pinyinCandidates('ni', []).map((c) => c.text)).toContain('你');
  });

  it('ranks what the exercise asked for first', () => {
    const ranked = pinyinCandidates('shi', ['是']);
    expect(ranked[0].text).toBe('是');
  });

  it('never invents a candidate from context alone', () => {
    // A string outside the lexicon stays outside it, answer or not.
    expect(pinyinCandidates('zzzz', ['我'])).toEqual([]);
  });

  it('keeps pinyin in composition and commits anything that is not pinyin', () => {
    expect(pinyinComposition('wo')).toEqual({ text: '', pending: 'wo' });
    expect(pinyinComposition('wo ')).toEqual({ text: 'wo ', pending: '' });
  });

  it('submits unconverted pinyin as pinyin rather than swallowing it', () => {
    // Wrong, and visibly wrong, which is the point: an empty field would leave
    // the learner with no idea what happened to what they typed.
    expect(chineseInput.settle('wo')).toBe('wo');
  });
});

describe('engine selection', () => {
  it('covers exactly the four non-Latin courses', () => {
    for (const lang of ['ja', 'ko', 'zh', 'ru'] as const) {
      expect(needsScriptInput(lang)).toBe(true);
    }
    for (const lang of ['en', 'es', 'fr', 'de', 'it', 'pt'] as const) {
      expect(scriptInputFor(lang)).toBeNull();
    }
    expect(scriptInputFor(null)).toBeNull();
  });
});
