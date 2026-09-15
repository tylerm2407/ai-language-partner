/**
 * Confusable pairs, and what the grader actually does with them.
 *
 * Two layers on purpose:
 *  1. `isConfusablePair` itself — the list is data, so assert the data.
 *  2. `gradeAnswer` end to end — the list only matters if the grader consults
 *     it, and it consults one list per side: the course target language for
 *     `translate_to_target`, English for the answer side of
 *     `translate_to_native`. Both directions are covered below.
 */

import { isConfusablePair } from './confusable-pairs';
import { gradeAnswer } from './grading';
import { exerciseHints } from './exercise-restore';
import type { Exercise, LanguageCode } from '../types';

/** A translate exercise shaped like the patched Russian A1 rows. */
function translateExercise(type: 'translate_to_native' | 'translate_to_target'): Exercise {
  return { type, skillType: 'vocabulary' } as unknown as Exercise;
}

/** Grade exactly the way the lesson runner does: hints carry the TARGET language. */
function gradeAsRunner(
  typed: string,
  key: string,
  type: 'translate_to_native' | 'translate_to_target',
  targetLanguage: LanguageCode = 'ru',
  accepted: string[] = [],
) {
  return gradeAnswer(typed, key, accepted, {
    exerciseHints: exerciseHints(translateExercise(type), targetLanguage),
  });
}

describe('isConfusablePair', () => {
  describe('Russian pairs added for the patched A1 keys', () => {
    const added: [string, string][] = [
      ['ветер', 'вечер'],
      ['ложка', 'ножка'],
      ['стол', 'стул'],
    ];

    it.each(added)('treats %s / %s as confusable in both orders', (a, b) => {
      expect(isConfusablePair(a, b, 'ru')).toBe(true);
      expect(isConfusablePair(b, a, 'ru')).toBe(true);
    });

    it.each(added)('is case- and whitespace-insensitive for %s / %s', (a, b) => {
      expect(isConfusablePair(`  ${a.toUpperCase()} `, b, 'ru')).toBe(true);
    });

    it('does not leak Russian pairs into another language', () => {
      expect(isConfusablePair('ветер', 'вечер', 'es')).toBe(false);
      expect(isConfusablePair('стол', 'стул', 'de')).toBe(false);
    });
  });

  describe('existing pairs are untouched', () => {
    const existing: [string, string, LanguageCode][] = [
      ['gato', 'rato', 'es'],
      ['hombre', 'hambre', 'es'],
      ['poison', 'poisson', 'fr'],
      ['Rat', 'Rad', 'de'],
      ['anno', 'hanno', 'it'],
      ['pais', 'país', 'pt'],
      ['кот', 'код', 'ru'],
      ['гриб', 'грипп', 'ru'],
    ];

    it.each(existing)('still rejects %s / %s (%s)', (a, b, language) => {
      expect(isConfusablePair(a, b, language)).toBe(true);
    });
  });

  it('returns false for a language with no list and for unrelated words', () => {
    expect(isConfusablePair('spoon', 'spoons', 'ja')).toBe(false);
    expect(isConfusablePair('ложка', 'вилка', 'ru')).toBe(false);
  });

  describe('English pairs', () => {
    // The list exists and answers correctly when asked. Whether anything asks
    // it is a separate question — see the gradeAnswer block below.
    const english: [string, string][] = [
      ['skirt', 'shirt'],
      ['driver', 'diver'],
      ['plate', 'place'],
    ];

    it.each(english)('treats %s / %s as confusable in both orders', (a, b) => {
      expect(isConfusablePair(a, b, 'en')).toBe(true);
      expect(isConfusablePair(b, a, 'en')).toBe(true);
    });

    it('lives in its own list, not in the Russian one', () => {
      expect(isConfusablePair('shirt', 'skirt', 'ru')).toBe(false);
    });
  });
});

describe('gradeAnswer against the patched Russian A1 keys', () => {
  describe('target-language answers now reject their neighbour', () => {
    it('ru-E0318: "Вечер" is no longer a minor typo for Ветер', () => {
      const result = gradeAsRunner('Вечер', 'Ветер', 'translate_to_target');
      expect(result.isCorrect).toBe(false);
    });

    it('ru-E0446: "Ножка" is no longer a minor typo for Ложка', () => {
      const result = gradeAsRunner('Ножка', 'Ложка', 'translate_to_target');
      expect(result.isCorrect).toBe(false);
    });

    it('"Стул" is no longer a minor typo for Стол', () => {
      const result = gradeAsRunner('Стул', 'Стол', 'translate_to_target');
      expect(result.isCorrect).toBe(false);
    });

    it('still accepts a genuine typo that is not a real word', () => {
      expect(gradeAsRunner('Ветео', 'Ветер', 'translate_to_target').isCorrect).toBe(true);
      expect(gradeAsRunner('Ложко', 'Ложка', 'translate_to_target').isCorrect).toBe(true);
    });

    it('still accepts the exact key and a listed alternative', () => {
      expect(gradeAsRunner('ветер', 'Ветер', 'translate_to_target').isCorrect).toBe(true);
      expect(gradeAsRunner('Dish', 'Plate', 'translate_to_native', 'ru', ['Dish']).isCorrect).toBe(true);
    });
  });

  describe('native-language answers are checked against the English list', () => {
    // The learner types English while the hint still says `ru`. `gradeAnswer`
    // consults the English list for exactly this case; without it a different
    // English word one edit from the key was graded "Correct! (Minor typo)".
    const cases: [string, string, string][] = [
      ['ru-E0241', 'shirt', 'Skirt'],
      ['ru-E0287', 'diver', 'Driver'],
      ['ru-E0447', 'Place', 'Plate'],
    ];

    it.each(cases)('%s: "%s" is rejected for key "%s"', (_ref, typed, key) => {
      const result = gradeAsRunner(typed, key, 'translate_to_native');
      expect(result.isCorrect).toBe(false);
    });

    it('still accepts a genuine English typo that is not a real word', () => {
      // One edit from the key and in no pair list. Note these are insertions,
      // not transpositions: plain Levenshtein charges 2 for a transposition,
      // so "plaet" is rejected on distance alone, independently of this list.
      expect(gradeAsRunner('pllate', 'Plate', 'translate_to_native').isCorrect).toBe(true);
      expect(gradeAsRunner('driverr', 'Driver', 'translate_to_native').isCorrect).toBe(true);
      expect(gradeAsRunner('skirtt', 'Skirt', 'translate_to_native').isCorrect).toBe(true);
    });

    it('still accepts a listed accepted alternative', () => {
      expect(
        gradeAsRunner('Dish', 'Plate', 'translate_to_native', 'ru', ['Dish']).isCorrect,
      ).toBe(true);
    });

    it('does not reject an English pair member when it is the key being asked', () => {
      // Asked for Shirt, typed Shirt: an exact match never reaches the
      // confusable check.
      expect(gradeAsRunner('shirt', 'Shirt', 'translate_to_native').isCorrect).toBe(true);
    });
  });
});

/**
 * The accent-tolerant branch of `gradeAnswer` returns before the fuzzy branch,
 * so until 2026-09-14 a listed pair whose members differ only by diacritics was
 * unreachable: `stripDiacritics` folded them together and the learner was told
 * "Correct! (Watch the accents)" for a different word. An audit found 22 of the
 * 63 shipped entries dead for this reason, including Spanish él/el, tú/tu and
 * papá/papa, and Portuguese avô/avó.
 *
 * Both branches now consult the list. A genuine accent slip on the same word
 * must still be forgiven, which is what the second test pins.
 */
describe('a listed pair is refused even when the accents are all that differ', () => {
  const hints = (language: LanguageCode) => ({ exerciseHints: { exerciseType: 'translate_to_target' as const, skillType: 'vocabulary' as const, language } });

  test.each([
    ['es', 'el', 'él'],
    ['es', 'él', 'el'],
    ['es', 'tu', 'tú'],
    ['es', 'papa', 'papá'],
    ['es', 'si', 'sí'],
    ['pt', 'avó', 'avô'],
  ] as [LanguageCode, string, string][])('%s: typing %s for the key %s is wrong, not an accent slip', (language, typed, key) => {
    const result = gradeAnswer(typed, key, [], hints(language));
    expect(result.isCorrect).toBe(false);
    expect(result.feedback).not.toContain('Watch the accents');
  });

  test.each([
    ['es', 'manana', 'mañana'],
    ['es', 'cafe', 'café'],
    ['fr', 'eleve', 'élève'],
  ] as [LanguageCode, string, string][])('%s: typing %s for the key %s is still forgiven as an accent slip', (language, typed, key) => {
    const result = gradeAnswer(typed, key, [], hints(language));
    expect(result.isCorrect).toBe(true);
    expect(result.feedback).toContain('Watch the accents');
  });
});

/**
 * The list stores words with their diacritics and the fuzzy branch measures
 * distance on diacritic-stripped strings, so until 2026-09-14 a pair did not
 * catch the bare unaccented spelling: `irmao` is one edit from `irmã`, inside
 * the budget, and was accepted as a typo even though irmã/irmão is listed.
 * The lookup now folds the stored pairs with the caller's own fold.
 */
describe('a listed pair also catches the unaccented spelling of either member', () => {
  const hints = (language: LanguageCode) => ({ exerciseHints: { exerciseType: 'translate_to_target' as const, skillType: 'vocabulary' as const, language } });

  test.each([
    ['pt', 'irmao', 'Irmã'],
    ['es', 'manana', 'Manzana'],
    ['es', 'deberia', 'Desearía'],
  ] as [LanguageCode, string, string][])('%s: %s is refused for the key %s', (language, typed, key) => {
    expect(gradeAnswer(typed, key, [], hints(language)).isCorrect).toBe(false);
  });

  /**
   * Folding must not let a pair match itself: avô/avó fold to the same string,
   * and if that counted as a pair the grader would refuse the exact answer.
   *
   * The bare stem `avo` used to be forgiven, which this test recorded as an
   * open question. It is now refused — a string that could be either of two
   * taught words is neither, and `accentOnlyPartner` is how the grader asks
   * the list which words those are. See the accent branch in lib/grading.ts.
   */
  test('a pair whose members fold together does not refuse itself', () => {
    expect(gradeAnswer('avô', 'Avô', [], hints('pt')).isCorrect).toBe(true);
  });

  test('the bare stem of a pair that folds together is refused, with the reason', () => {
    const result = gradeAnswer('avo', 'Avô', [], hints('pt'));
    expect(result.isCorrect).toBe(false);
    expect(result.feedback).toContain('accent');
  });

  test('an ordinary typo with no listed partner is still forgiven', () => {
    expect(gradeAnswer('hijp', 'Hijo', [], hints('es')).isCorrect).toBe(true);
    expect(gradeAnswer('cafe', 'café', [], hints('es')).isCorrect).toBe(true);
  });
});

/**
 * Korean typo tolerance was about nine times stricter than the stated ratio:
 * distance is measured on the NFD form, where Hangul decomposes into conjoining
 * jamo that survive mark-stripping, while the budget was taken from the
 * composed length. 242 of the 354 Korean keys in the curriculum had a budget of
 * zero and ordinary adjacent-key slips were rejected outright.
 */
describe('Korean tolerance is measured in the same units as the budget', () => {
  const ko = { exerciseHints: { exerciseType: 'translate_to_target' as const, skillType: 'vocabulary' as const, language: 'ko' as LanguageCode } };

  test.each([
    ['경재', '경제'],
    ['간후사', '간호사'],
    ['건강헌', '건강한'],
    ['갑자거', '갑자기'],
  ])('a single-jamo slip %s is forgiven for the key %s', (typed, key) => {
    expect(gradeAnswer(typed, key, [], ko).isCorrect).toBe(true);
  });

  test('a listed Korean pair is still refused, so the loosening stays honest', () => {
    expect(gradeAnswer('남자친구', '여자친구', [], ko).isCorrect).toBe(false);
    expect(gradeAnswer('여자친구', '남자친구', [], ko).isCorrect).toBe(false);
  });
});

/**
 * The second Korean batch, 2026-09-14. These pairs were brought inside
 * tolerance by the budget fix above: with the budget now measured on the same
 * decomposed string the distance is measured on, Korean keys that used to have
 * a budget of zero have one or two, and a one-jamo neighbour that is a
 * different word started scoring "Correct! (Minor typo)".
 *
 * Row-level evidence — which curriculum row accepted each pair before the
 * addition, and that it rejects after — is in
 * `docs/audits/question-verification/remediation/es-ja-ko/korean-goodbye.test.mjs`
 * and `korean-goodbye-evidence.json`. What is asserted here is the grader
 * contract the content patches depend on.
 */
describe('the second Korean confusable batch', () => {
  const ko = { exerciseHints: { exerciseType: 'translate_to_target' as const, skillType: 'vocabulary' as const, language: 'ko' as LanguageCode } };
  const listening = { exerciseHints: { exerciseType: 'listening_type' as const, skillType: 'vocabulary' as const, language: 'ko' as LanguageCode } };

  test.each([
    ['갔어요', '샀어요', 'went / bought'],
    ['봤어요', '했어요', 'saw / did'],
    ['썼어요', '갔어요', 'wrote / went'],
    ['우유', '이유', 'milk / reason'],
    ['의사', '의자', 'doctor / chair'],
    ['의사', '의상', 'doctor / costume'],
    ['의식', '의심', 'consciousness / doubt'],
    ['예약', '계약', 'reservation / contract'],
    ['경제', '형제', 'economy / sibling'],
    ['사촌', '삼촌', 'cousin / uncle'],
    ['자요', '자유', 'sleeps / freedom'],
    ['하다', '싸다', 'to do / to be cheap'],
    ['바다', '하다', 'sea / to do'],
    ['바다', '싸다', 'sea / to be cheap'],
    ['청소하다', '취소하다', 'to clean / to cancel'],
    ['대명사', '동명사', 'pronoun / gerund'],
  ])('%s is no longer a minor typo for %s (%s)', (typed, key) => {
    expect(gradeAnswer(typed, key, [], ko).isCorrect).toBe(false);
    expect(gradeAnswer(key, typed, [], ko).isCorrect).toBe(false);
  });

  test('朝ご飯 and ご飯 are separated on the Japanese list', () => {
    const ja = { exerciseHints: { exerciseType: 'listening_type' as const, skillType: 'vocabulary' as const, language: 'ja' as LanguageCode } };
    expect(gradeAnswer('ご飯', '朝ご飯', [], ja).isCorrect).toBe(false);
  });

  /**
   * The precondition that lets the goodbye pair ship at all.
   *
   * 안녕히 가세요 is said to the person leaving, 안녕히 계세요 to the person
   * staying. A `listening_type` row whose audio says one of them must reject
   * the other; a `translate_to_target` row prompting the bare gloss "Goodbye"
   * must accept both. One global list cannot tell those apart — and does not
   * need to, because an authored `accepted_answers` entry returns at the
   * exact-match branch before the pair list is consulted.
   */
  describe('an authored alternative outranks the pair list', () => {
    test('with no alternative authored, the pair rejects the other goodbye', () => {
      expect(gradeAnswer('안녕히 계세요', '안녕히 가세요', [], listening).isCorrect).toBe(false);
      expect(gradeAnswer('안녕히 가세요', '안녕히 계세요', [], listening).isCorrect).toBe(false);
    });

    test('with it authored, the same answer is plainly correct', () => {
      const result = gradeAnswer('안녕히 계세요', '안녕히 가세요', ['안녕히 계세요'], ko);
      expect(result.isCorrect).toBe(true);
      expect(result.feedback).toBe('Correct!');
    });

    test('the short shape is needed too, because the lookup matches the whole answer', () => {
      // A `fill_blank` keyed on the bare verb never sees the 안녕히 stem.
      expect(isConfusablePair('가세요', '계세요', 'ko')).toBe(true);
      expect(gradeAnswer('계세요', '가세요', [], ko).isCorrect).toBe(false);
      expect(gradeAnswer('계세요', '가세요', ['계세요'], ko).isCorrect).toBe(true);
    });

    test('a genuine slip on the authored alternative is still forgiven', () => {
      expect(gradeAnswer('안녕히 계세오', '안녕히 가세요', ['안녕히 계세요'], ko).isCorrect).toBe(true);
      expect(gradeAnswer('안녕히 가세오', '안녕히 가세요', [], listening).isCorrect).toBe(true);
    });
  });

  /**
   * Three candidates were refused. Each would have encoded something the list
   * does not mean, so each is asserted absent rather than left to drift in.
   */
  describe('refused candidates stay out of the list', () => {
    test('주무세요 / 주세요 — never accepted by the grader on any row', () => {
      expect(isConfusablePair('주무세요', '주세요', 'ko')).toBe(false);
    });

    test('하다 / 한다 — one verb in two forms, not two words', () => {
      // Still not a pair: the list names two different words, and these are one
      // verb. What changed on 2026-09-15 is the grader, not the list — a
      // difference of inflectional ending is now never a typo (see the Korean
      // ending rule in lib/grading.ts), so the row no longer credits a form it
      // did not ask for. This also settles the standing ko-E0218 question
      // without reclassifying that row as a grammar exercise.
      expect(isConfusablePair('하다', '한다', 'ko')).toBe(false);
      expect(gradeAnswer('한다', '하다', [], ko).isCorrect).toBe(false);
    });

    test('씻다 / 씨다 — 씨다 is not a word, so typing it is a real typo', () => {
      expect(isConfusablePair('씻다', '씨다', 'ko')).toBe(false);
      expect(isConfusablePair('싸다', '씨다', 'ko')).toBe(false);
      expect(gradeAnswer('씨다', '씻다', [], ko).isCorrect).toBe(true);
    });
  });

  test.each([
    ['경재', '경제'],
    ['오유', '우유'],
    ['사춘', '사촌'],
    ['의삭', '의사'],
    ['청소하댜', '청소하다'],
  ])('the slip %s is still forgiven for the key %s', (typed, key) => {
    expect(gradeAnswer(typed, key, [], ko).isCorrect).toBe(true);
  });
});

/**
 * A negation is never a typo. Two strings differing only in whether they are
 * negated are opposites, and the edit distance between them is often small
 * enough to sit inside the budget — "to fire" against "not fire" is two
 * substitutions. The audit measured 134 such acceptances across the draft,
 * about 40 inverting meaning in the target language, and a minor-typo pass
 * rates as 3, which SM-2 treats as success. A pair list cannot cover it: 48
 * held on the bare key with no authored alternative, so closing them by data
 * would need one entry per taught verb per language.
 */
describe('a candidate differing only by a leading negator is refused', () => {
  const hints = (language: LanguageCode) => ({ exerciseHints: { exerciseType: 'translate_to_target' as const, skillType: 'vocabulary' as const, language } });

  test.each([
    ['es', 'Not fire', 'To fire', []],
    ['es', 'Not cost a fortune', 'To cost a fortune', []],
    ['es', 'No estudié', 'Estudié', ['Yo estudié']],
    ['es', 'No estoy de acuerdo', 'Estoy de acuerdo', ['Yo estoy de acuerdo']],
    ['it', 'Non ho mangiato', 'Ho mangiato', []],
    ['de', 'Nicht ausruhen', 'Ausruhen', []],
    ['pt', 'Não comi', 'Comi', []],
    ['ru', 'Не читал', 'Читал', []],
  ] as [LanguageCode, string, string, string[]][])('%s: %s is refused for the key %s', (language, typed, key, accepted) => {
    expect(gradeAnswer(typed, key, accepted, hints(language)).isCorrect).toBe(false);
  });

  /** The rule must not touch an answer that is legitimately negated. */
  test.each([
    ['es', 'No estoy de acuerdo', 'No estoy de acuerdo'],
    ['es', 'Nunca', 'Nunca'],
    ['en', 'Never', 'Never'],
  ] as [LanguageCode, string, string][])('%s: the negated key itself still passes: %s', (language, typed, key) => {
    expect(gradeAnswer(typed, key, [], hints(language)).isCorrect).toBe(true);
  });

  /** And a genuine typo inside a negated answer is still forgiven. */
  test('a typo inside a negated answer is still a typo', () => {
    const result = gradeAnswer('No estoy de acuedro', 'No estoy de acuerdo', [], hints('es'));
    expect(result.isCorrect).toBe(true);
    expect(result.feedback).toContain('Minor typo');
  });

  test('an ordinary typo on an affirmative key is untouched', () => {
    expect(gradeAnswer('To fir', 'To fire', [], hints('es')).isCorrect).toBe(true);
  });
});

/**
 * The お〜さん honorific frame, added 2026-09-15 after round-2 triage.
 *
 * Two findings, one family. Adding the kanji spellings of おばあさん and
 * おじいさん — which the transcription patch must do — brings five other taught
 * kinship terms inside the typo budget on the four rows that exist to tell them
 * apart. And before any addition, the kana keys already accept each other.
 */
describe('the お〜さん kinship frame', () => {
  const ja = { exerciseHints: { exerciseType: 'listening_type' as const, language: 'ja' as const } };

  it('refuses the neighbouring kana kinship term, which fires today', () => {
    // Measured across all taught Japanese strings: 23 acceptances on 12 rows,
    // with no addition involved.
    expect(gradeAnswer('おばさん', 'おばあさん', [], ja).isCorrect).toBe(false);
    expect(gradeAnswer('おばあさん', 'おばさん', [], ja).isCorrect).toBe(false);
    expect(gradeAnswer('おじさん', 'おじいさん', [], ja).isCorrect).toBe(false);
    expect(gradeAnswer('おじいさん', 'おじさん', [], ja).isCorrect).toBe(false);
  });

  it('refuses the kanji collisions without needing a pair for each', () => {
    // Adding the kanji spelling of おばあさん brings five other taught kinship
    // terms inside the budget — お婆さん is four characters, so the budget is
    // one, and each of them is one substitution away. The kanji gate refuses
    // all five before the budget is consulted, so the list deliberately does
    // NOT carry entries for them: they could never fire. The guard against a
    // relaxed gate is scripts/grading/widening-check.mjs, which reproduces the
    // readmission in that case.
    for (const candidate of ['お母さん', 'お父さん', 'お姉さん', 'お嬢さん', 'お隣さん']) {
      expect(gradeAnswer(candidate, 'おばあさん', ['お婆さん'], ja).isCorrect).toBe(false);
      expect(isConfusablePair(candidate, 'お婆さん', 'ja')).toBe(false);
    }
  });

  it('refuses a presentation for a present', () => {
    // Also found by the whole-language check, and live in both directions.
    expect(gradeAnswer('プレゼント', 'プレゼン', [], ja).isCorrect).toBe(false);
    expect(gradeAnswer('プレゼン', 'プレゼント', [], ja).isCorrect).toBe(false);
  });
});
