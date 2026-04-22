/**
 * Unit tests for error classification in `gradeAnswer` / `classifyError`.
 *
 * Syntax is Jest-compatible / Vitest-compatible. The repo currently has
 * `pnpm test` -> `jest` in package.json but no Jest config yet; these tests
 * are written so they'll pick up automatically once the framework is wired.
 */

// Jest/Vitest globals: describe/expect/it are provided by the test runner at
// runtime. The repo's Jest config isn't wired yet and neither @types/jest
// nor @jest/globals is installed, so we declare minimal local shims to keep
// `tsc --noEmit` clean. These disappear into no-ops at runtime under Jest
// (Jest injects the real globals) and under Vitest (ditto).
//
// Remove this block when a real test runner (+ types) is installed.
/* eslint-disable @typescript-eslint/no-explicit-any, no-var */
declare var describe: (name: string, fn: () => void) => void;
declare var it: (name: string, fn: () => void | Promise<void>) => void;
declare var expect: (value: any) => {
  toBe(expected: any): void;
  toBeNull(): void;
  toBeUndefined(): void;
  not: { toBe(expected: any): void };
};
/* eslint-enable @typescript-eslint/no-explicit-any, no-var */

import { classifyError, gradeAnswer } from './grading';

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
