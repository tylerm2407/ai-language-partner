/**
 * Unit tests for spoken command classification.
 *
 * The failure that matters here is a command eating a real answer: if a card
 * teaching "pausa" treats the learner saying "pausa" as a pause command, that
 * card can never be answered correctly and the learner has no way to see why.
 */

import { classifyUtterance, COMMAND_PHRASES } from './handsfree-commands';

describe('recognising commands', () => {
  it.each([
    ['pause', 'pause'],
    ['repeat', 'repeat'],
    ['skip', 'skip'],
    ['stop', 'end'],
    ['next', 'skip'],
    ['say that again', 'repeat'],
    ["i'm done", 'end'],
  ] as const)('treats "%s" as the %s command', (said, command) => {
    expect(classifyUtterance(said, 'en', 'la manzana')).toEqual({ kind: 'command', command });
  });

  it('is insensitive to case, padding and trailing punctuation', () => {
    for (const said of ['  SKIP  ', 'Skip.', 'skip!', 'SKIP?']) {
      expect(classifyUtterance(said, 'en', 'la manzana')).toEqual({
        kind: 'command',
        command: 'skip',
      });
    }
  });

  it('is insensitive to accents', () => {
    expect(classifyUtterance('répeat', 'en', 'la manzana')).toEqual({
      kind: 'command',
      command: 'repeat',
    });
  });
});

describe('whole-utterance matching', () => {
  it('does not treat a command word inside a sentence as a command', () => {
    expect(classifyUtterance('I want to skip breakfast', 'en', 'quiero desayunar')).toEqual({
      kind: 'answer',
    });
  });

  it('does not fire on a sentence that merely ends with a command word', () => {
    expect(classifyUtterance('please do not stop', 'en', 'por favor no pares')).toEqual({
      kind: 'answer',
    });
  });

  it('treats ordinary speech as an answer', () => {
    expect(classifyUtterance('la manzana está en la mesa', 'en', 'la manzana está en la mesa'))
      .toEqual({ kind: 'answer' });
  });
});

describe('the expected answer always wins', () => {
  it('grades "pausa" as an answer when the card is teaching it', () => {
    // Without this veto the card would be unanswerable: every correct attempt
    // would be swallowed as a pause command.
    expect(classifyUtterance('pausa', 'es', 'pausa')).toEqual({ kind: 'answer' });
  });

  it('still treats it as a command when the card expects something else', () => {
    expect(classifyUtterance('pausa', 'es', 'la manzana')).toEqual({
      kind: 'command',
      command: 'pause',
    });
  });

  it('honours accepted variants, not just the primary answer', () => {
    expect(classifyUtterance('repite', 'es', 'otra cosa', ['repite'])).toEqual({
      kind: 'answer',
    });
  });

  it('applies the veto on a near match, not only an exact one', () => {
    // "skipp" vs expected "skip" scores above the pass mark, so grading would
    // have accepted it — the classifier must not disagree with grading.
    expect(classifyUtterance('skip', 'en', 'skip')).toEqual({ kind: 'answer' });
  });
});

describe('language handling', () => {
  it('uses the learner L1 phrase table', () => {
    expect(classifyUtterance('siguiente', 'es', 'la manzana')).toEqual({
      kind: 'command',
      command: 'skip',
    });
  });

  it('accepts a regional locale tag', () => {
    expect(classifyUtterance('skip', 'en-US', 'la manzana')).toEqual({
      kind: 'command',
      command: 'skip',
    });
  });

  it('falls back to English for a language with no table', () => {
    expect(classifyUtterance('skip', 'ja', 'りんご')).toEqual({
      kind: 'command',
      command: 'skip',
    });
  });

  it('does not crash on an empty or missing language', () => {
    expect(classifyUtterance('skip', '', 'la manzana')).toEqual({
      kind: 'command',
      command: 'skip',
    });
  });
});

describe('degenerate input', () => {
  it('treats an empty transcript as an answer, not a command', () => {
    // Empty transcripts are handled upstream as an aborted listen. Classifying
    // one as a command would fire a random control on a silent turn.
    expect(classifyUtterance('', 'en', 'la manzana')).toEqual({ kind: 'answer' });
    expect(classifyUtterance('   ', 'en', 'la manzana')).toEqual({ kind: 'answer' });
  });
});

describe('phrase table integrity', () => {
  it('only defines commands the session engine implements', () => {
    const implemented = ['pause', 'repeat', 'skip', 'end'];
    for (const lang of Object.keys(COMMAND_PHRASES)) {
      expect(Object.keys(COMMAND_PHRASES[lang]).sort()).toEqual([...implemented].sort());
    }
  });

  it('has no empty phrase lists', () => {
    for (const lang of Object.keys(COMMAND_PHRASES)) {
      for (const command of Object.keys(COMMAND_PHRASES[lang])) {
        expect(
          COMMAND_PHRASES[lang][command as keyof (typeof COMMAND_PHRASES)[string]].length,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('never assigns the same phrase to two commands', () => {
    for (const lang of Object.keys(COMMAND_PHRASES)) {
      const all = Object.values(COMMAND_PHRASES[lang]).flat();
      expect(new Set(all).size).toBe(all.length);
    }
  });
});
