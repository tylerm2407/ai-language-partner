/**
 * Unit tests for error classification in `gradeAnswer` / `classifyError`.
 */

import { classifyError, gradeAnswer, gradeSpeechTranscription } from './grading';

describe('classifyError', () => {
  describe('phonological', () => {
    it('classifies speaking exercises as phonological regardless of text', () => {
      const result = classifyError('buen-os dee-as', 'buenos días', {
        exerciseType: 'speaking',
      });
      expect(result).toBe('phonological');
    });

    it('phonological wins even when skillType is grammar', () => {
      // Speaking is the only STT path; always classify as phonological.
      const result = classifyError('hola', 'hello', {
        exerciseType: 'speaking',
        skillType: 'grammar',
      });
      expect(result).toBe('phonological');
    });
  });

  describe('grammar', () => {
    it('classifies explicit targetGrammar as grammar', () => {
      const result = classifyError('I goed home', 'I went home', {
        targetGrammar: 'past_simple_irregular',
      });
      expect(result).toBe('grammar');
    });

    it('classifies skillType grammar as grammar', () => {
      const result = classifyError('he have', 'he has', {
        skillType: 'grammar',
      });
      expect(result).toBe('grammar');
    });

    it('classifies word_form exercises as grammar', () => {
      const result = classifyError('running', 'ran', {
        exerciseType: 'word_form',
      });
      expect(result).toBe('grammar');
    });

    it('classifies sentence_transformation exercises as grammar', () => {
      const result = classifyError('She is not happy', "She isn't happy", {
        exerciseType: 'sentence_transformation',
      });
      expect(result).toBe('grammar');
    });

    it('classifies error_correction as grammar', () => {
      const result = classifyError('He go home', 'He goes home', {
        exerciseType: 'error_correction',
      });
      expect(result).toBe('grammar');
    });

    it('grammar signal wins over spelling-distance', () => {
      // "teh" vs "the" is 1-edit, but if the hint says it's a grammar
      // exercise, classify as grammar.
      const result = classifyError('he teh boy', 'he is the boy', {
        skillType: 'grammar',
      });
      expect(result).toBe('grammar');
    });
  });

  describe('lexical', () => {
    it('classifies explicit targetWord as lexical', () => {
      const result = classifyError('apple', 'orange', {
        targetWord: 'orange',
      });
      expect(result).toBe('lexical');
    });

    it('classifies skillType vocabulary as lexical', () => {
      const result = classifyError('perro', 'gato', {
        skillType: 'vocabulary',
      });
      expect(result).toBe('lexical');
    });

    it('classifies a whole-word swap on translate exercises as lexical', () => {
      // Same token count, one word is completely different (not a typo).
      const result = classifyError('the dog runs', 'the cat runs', {
        exerciseType: 'translate_to_target',
      });
      expect(result).toBe('lexical');
    });

    it('classifies collocation_match with whole-word swap as lexical', () => {
      const result = classifyError('make a shower', 'take a shower', {
        exerciseType: 'collocation_match',
      });
      expect(result).toBe('lexical');
    });
  });

  describe('spelling', () => {
    it('classifies a 1-char typo on a short word as spelling', () => {
      const result = classifyError('helo', 'hello', {});
      expect(result).toBe('spelling');
    });

    it('classifies a multi-word answer with a single typo-shaped word as spelling', () => {
      // "te" vs "the" is a 1-edit typo on one token.
      const result = classifyError('I like te pizza', 'I like the pizza', {});
      expect(result).toBe('spelling');
    });

    it('classifies typos without any hints', () => {
      // No hints at all, just a close string match.
      const result = classifyError('recieve', 'receive');
      expect(result).toBe('spelling');
    });

    it('does NOT classify a long entirely-different word as spelling', () => {
      // "elephant" vs "kangaroo" — too different to be a typo.
      const result = classifyError('elephant', 'kangaroo', {
        exerciseType: 'translate_to_target',
      });
      expect(result).not.toBe('spelling');
    });
  });

  describe('null / unknown', () => {
    it('returns null when nothing matches', () => {
      // No hints + dramatically different strings + same token count.
      const result = classifyError('apples oranges bananas', 'cars trucks boats');
      expect(result).toBeNull();
    });

    it('returns null for empty-ish answers with no hints', () => {
      const result = classifyError('', '', {});
      expect(result).toBeNull();
    });
  });
});

describe('gradeAnswer populates errorType', () => {
  it('populates errorType when hints provided and answer is wrong', () => {
    const result = gradeAnswer('I goed', 'I went', [], {
      exerciseHints: { targetGrammar: 'past_simple_irregular' },
    });
    expect(result.isCorrect).toBe(false);
    expect(result.errorType).toBe('grammar');
  });

  it('errorType is null for correct answers', () => {
    const result = gradeAnswer('hello', 'hello', [], {
      exerciseHints: { skillType: 'vocabulary' },
    });
    expect(result.isCorrect).toBe(true);
    expect(result.errorType).toBeNull();
  });

  it('errorType is null (or undefined) when no hints are provided', () => {
    const result = gradeAnswer('foo', 'bar', []);
    // Back-compat: callers without hints get a nullish errorType.
    expect(result.errorType ?? null).toBeNull();
  });

  it('classifies a speaking-exercise failure as phonological', () => {
    const result = gradeAnswer('buenas deeas', 'buenos días', [], {
      exerciseHints: { exerciseType: 'speaking' },
    });
    expect(result.isCorrect).toBe(false);
    expect(result.errorType).toBe('phonological');
  });

  it('classifies a typo-accepted answer as correct with null errorType', () => {
    // Within fuzzy distance -> accepted as correct -> no errorType.
    const result = gradeAnswer('recieve', 'receive', [], {
      exerciseHints: { skillType: 'vocabulary' },
    });
    expect(result.isCorrect).toBe(true);
    expect(result.errorType).toBeNull();
  });
});

describe('gradeAnswer accent tolerance', () => {
  it('accepts "cafe" for "café" (dropped Spanish accent)', () => {
    const result = gradeAnswer('cafe', 'café');
    expect(result.isCorrect).toBe(true);
  });

  it('accepts "esta" for "está"', () => {
    const result = gradeAnswer('esta', 'está');
    expect(result.isCorrect).toBe(true);
  });

  it('accepts "nino" for "niño" (ñ decomposes to n + combining tilde)', () => {
    const result = gradeAnswer('nino', 'niño');
    expect(result.isCorrect).toBe(true);
  });

  it('accepts "etre" for French "être"', () => {
    const result = gradeAnswer('etre', 'être');
    expect(result.isCorrect).toBe(true);
  });

  it('rejects accent-only miss in strict mode ("hablo" vs "habló" is a different tense)', () => {
    const result = gradeAnswer('hablo', 'habló', [], { strict: true });
    expect(result.isCorrect).toBe(false);
  });

  it('rejects accent-only miss for grammar exercises', () => {
    const result = gradeAnswer('hablo', 'habló', [], {
      exerciseHints: { targetGrammar: 'preterite' },
    });
    expect(result.isCorrect).toBe(false);
  });

  it('nudges about accents when correct only because of accent differences', () => {
    const result = gradeAnswer('cafe', 'café');
    expect(result.isCorrect).toBe(true);
    expect(result.feedback).toBe('Correct! (Watch the accents: "café")');
    expect(result.errorType ?? null).toBeNull();
  });

  it('gives plain "Correct!" when accents match exactly', () => {
    const result = gradeAnswer('café', 'café');
    expect(result.feedback).toBe('Correct!');
  });

  it('accepts a combined typo + accent miss via fuzzy match', () => {
    // "cafee" vs "café": stripped forms are 1 edit apart — a typo, not just
    // an accent slip, so it takes the fuzzy path and gets the typo feedback.
    const result = gradeAnswer('cafee', 'café');
    expect(result.isCorrect).toBe(true);
    expect(result.feedback).toBe('Correct! (Minor typo: "café")');
  });

  it('still rejects fully wrong answers', () => {
    const result = gradeAnswer('perro', 'café');
    expect(result.isCorrect).toBe(false);
  });
});

describe('gradeAnswer strict grammar grading', () => {
  it('rejects a wrong grammar form that is within fuzzy typo distance', () => {
    // "hablo" (indicative) vs "hable" (present subjunctive): 1 edit apart.
    // Without strict grammar grading this was wrongly accepted as a typo.
    const result = gradeAnswer('hablo', 'hable', [], {
      exerciseHints: { skillType: 'grammar', targetGrammar: 'present_subjunctive' },
    });
    expect(result.isCorrect).toBe(false);
    expect(result.errorType).toBe('grammar');
  });

  it('rejects a within-distance distractor tapped on a grammar multiple_choice', () => {
    // German "können" (indicative) vs "könnten" (Konjunktiv II): 1 edit. A
    // tapped distractor must never grade correct.
    const result = gradeAnswer('können', 'könnten', [], {
      exerciseHints: { skillType: 'grammar', exerciseType: 'multiple_choice' },
    });
    expect(result.isCorrect).toBe(false);
  });

  it('rejects a within-distance wrong form on a word_form exercise (grammar by type)', () => {
    // No skillType/targetGrammar, but word_form is inherently a grammar shape.
    const result = gradeAnswer('ran', 'run', [], {
      exerciseHints: { exerciseType: 'word_form' },
    });
    expect(result.isCorrect).toBe(false);
  });

  it('still accepts an exact grammar answer', () => {
    const result = gradeAnswer('hable', 'hable', [], {
      exerciseHints: { skillType: 'grammar' },
    });
    expect(result.isCorrect).toBe(true);
    expect(result.errorType).toBeNull();
  });

  it('still normalizes case and trailing punctuation under strict grammar grading', () => {
    // Strict removes fuzzy typo tolerance, but normalize() still applies.
    const result = gradeAnswer('Hable.', 'hable', [], {
      exerciseHints: { skillType: 'grammar' },
    });
    expect(result.isCorrect).toBe(true);
  });

  it('still accepts a listed accepted_answer under strict grammar grading', () => {
    const result = gradeAnswer('haya comido', 'hubiera comido', ['haya comido'], {
      exerciseHints: { skillType: 'grammar' },
    });
    expect(result.isCorrect).toBe(true);
  });

  it('does NOT make vocabulary answers strict (typo still accepted)', () => {
    const result = gradeAnswer('recieve', 'receive', [], {
      exerciseHints: { skillType: 'vocabulary' },
    });
    expect(result.isCorrect).toBe(true);
  });
});

/**
 * `gradeSpeechTranscription` had no tests despite being the scoring function
 * for every spoken answer. These characterise its behaviour on what
 * speech-to-text actually produces — dropped articles, missing accents,
 * added punctuation — because the 60-point pass mark sits on raw
 * Levenshtein similarity and it was not obvious whether that is too harsh.
 */
describe('gradeSpeechTranscription', () => {
  it('scores an exact match at 100', () => {
    const r = gradeSpeechTranscription('la manzana', 'la manzana', []);
    expect(r.score).toBe(100);
    expect(r.isCorrect).toBe(true);
  });

  it('ignores case and trailing punctuation the recogniser adds', () => {
    expect(gradeSpeechTranscription('La manzana.', 'la manzana', []).score).toBe(100);
  });

  it('accepts a variant over the primary answer', () => {
    const r = gradeSpeechTranscription('manzana', 'la manzana', ['manzana']);
    expect(r.score).toBe(100);
    expect(r.isCorrect).toBe(true);
  });

  it('tolerates a dropped article', () => {
    expect(gradeSpeechTranscription('manzana', 'la manzana', []).isCorrect).toBe(true);
  });

  it('tolerates a missing accent', () => {
    // Unlike gradeAnswer this does NOT strip diacritics; it relies on edit
    // distance absorbing them, which is a weaker guarantee on short answers.
    expect(gradeSpeechTranscription('esta bien', 'está bien', []).isCorrect).toBe(true);
  });

  it('rejects a completely different utterance', () => {
    expect(gradeSpeechTranscription('el perro corre', 'la manzana roja', []).isCorrect).toBe(false);
  });

  it('scores an empty transcript at zero rather than crashing', () => {
    const r = gradeSpeechTranscription('', 'la manzana', []);
    expect(r.score).toBe(0);
    expect(r.isCorrect).toBe(false);
  });

  it('reports whether the target word was actually said', () => {
    expect(gradeSpeechTranscription('la manzana roja', 'la manzana roja', [], 'manzana')
      .targetPresent).toBe(true);
    expect(gradeSpeechTranscription('la fruta roja', 'la manzana roja', [], 'manzana')
      .targetPresent).toBe(false);
  });

  it('is harsher on short answers than long ones for the same single error', () => {
    // Edit distance is length-normalised, so one wrong character costs far
    // more on a two-word card. That is where false negatives will appear.
    const short = gradeSpeechTranscription('si', 'no', []);
    const long = gradeSpeechTranscription(
      'la manzana roja esta en la mesa',
      'la manzana roja está en la mesa',
      [],
    );
    expect(short.score).toBeLessThan(long.score);
  });
});

describe('typo tolerance is measured against the expected answer', () => {
  it('rejects a one-edit substitution that produces a different short word', () => {
    // THE regression. The budget used to key off the LEARNER'S answer length:
    // "yo" is two characters, so one edit was allowed, and a substitution
    // turning one real word into a different real word was graded
    // "Correct! (Minor typo)", rated 4, and pushed out to a longer SM-2
    // interval — teaching the wrong meaning and then reinforcing it.
    const result = gradeAnswer('yo', 'no', []);
    expect(result.isCorrect).toBe(false);
  });

  it('still forgives a genuine typo in a longer word', () => {
    // One edit is most of a two-letter word and very little of a seven-letter
    // one, which is the whole reason the threshold is proportional.
    expect(gradeAnswer('recieve', 'receive', []).isCorrect).toBe(true);
    expect(gradeAnswer('cafee', 'café', []).isCorrect).toBe(true);
  });

  it('does not hand a long sentence a large typo budget', () => {
    const expected = 'me gustaria reservar una mesa para dos personas';
    // Four edits in a 46-character sentence is under any proportional ratio,
    // but the cap keeps it at 2.
    const fourEdits = 'me gustaria reservar una mesa para dos persxxxs';
    expect(gradeAnswer(fourEdits, expected, []).isCorrect).toBe(false);
  });
});

describe('confusable pairs are not typos', () => {
  it('rejects a listed confusable pair when the language is known', () => {
    // `isConfusablePair` existed and was never called, so every pair it
    // enumerates was accepted as a minor typo and then reinforced by SRS.
    const result = gradeAnswer('rato', 'gato', [], {
      exerciseHints: { language: 'es' },
    });
    expect(result.isCorrect).toBe(false);
  });

  it('rejects a longer confusable pair that length alone cannot catch', () => {
    // "hombre"/"hambre" is one edit in a six-letter word — well inside the
    // proportional budget, and a completely different meaning.
    const result = gradeAnswer('hambre', 'hombre', [], {
      exerciseHints: { language: 'es' },
    });
    expect(result.isCorrect).toBe(false);
  });

  it('leaves grading unchanged when no language hint is supplied', () => {
    // Callers that do not pass a language keep the previous behaviour rather
    // than silently getting a different grade.
    expect(gradeAnswer('hambre', 'hombre', []).isCorrect).toBe(true);
  });
});
