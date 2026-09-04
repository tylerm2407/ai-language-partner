/**
 * Unit tests for the sentence splitter.
 *
 * Two properties carry the feature: it must never cut inside a number or an
 * abbreviation (the pause lands mid-word and it is audible), and it must never
 * decide on a terminator sitting at the end of the buffer (the next chunk may
 * continue the token). Everything else is bookkeeping.
 */

import { splitSentences, createSentenceStream } from './sentence-stream';

describe('splitSentences', () => {
  it('splits on sentence-final punctuation followed by whitespace', () => {
    const { sentences, rest } = splitSentences('¡Buenas tardes! ¿Cómo estás? Bien');
    expect(sentences).toEqual(['¡Buenas tardes!', '¿Cómo estás?']);
    expect(rest).toBe('Bien');
  });

  it('holds a terminator at the end of the buffer', () => {
    // "Sr." might be an abbreviation and "3." might be a decimal. Neither can
    // be judged until the next character arrives.
    expect(splitSentences('Vivo en Madrid.')).toEqual({
      sentences: [],
      rest: 'Vivo en Madrid.',
    });
  });

  it('closes that sentence once whitespace arrives', () => {
    const { sentences, rest } = splitSentences('Vivo en Madrid. Y');
    expect(sentences).toEqual(['Vivo en Madrid.']);
    expect(rest).toBe('Y');
  });

  it('does not split inside a decimal number', () => {
    const { sentences, rest } = splitSentences('Son las 3.30 de la tarde. Ven');
    expect(sentences).toEqual(['Son las 3.30 de la tarde.']);
    expect(rest).toBe('Ven');
  });

  it('does not split after an abbreviation', () => {
    const { sentences } = splitSentences('El Sr. García llegó tarde. Vale');
    expect(sentences).toEqual(['El Sr. García llegó tarde.']);
  });

  it('does not split after an initial', () => {
    const { sentences } = splitSentences('J. R. R. Tolkien lo escribió. Sí');
    expect(sentences).toEqual(['J. R. R. Tolkien lo escribió.']);
  });

  it('still splits on a sentence ending in the word "no"', () => {
    // "No." abbreviates *número*, but treating it as an abbreviation would glue
    // this pair into one utterance — the common case has to win.
    const { sentences } = splitSentences('Creo que no. ¿Y tú? ');
    expect(sentences).toEqual(['Creo que no.', '¿Y tú?']);
  });

  it('keeps closing punctuation with its sentence', () => {
    const { sentences } = splitSentences('Dijo «vale». Luego se fue. ');
    expect(sentences).toEqual(['Dijo «vale».', 'Luego se fue.']);
  });

  it('handles ellipsis and CJK terminators', () => {
    expect(splitSentences('Bueno… vale. ').sentences).toEqual(['Bueno…', 'vale.']);
    expect(splitSentences('こんにちは。元気ですか？ ').sentences).toEqual([
      'こんにちは。',
      '元気ですか？',
    ]);
  });

  it('returns nothing for text with no terminator', () => {
    expect(splitSentences('me llamo')).toEqual({ sentences: [], rest: 'me llamo' });
  });
});

describe('createSentenceStream', () => {
  it('emits each sentence exactly once as chunks arrive', () => {
    const stream = createSentenceStream();
    const emitted: string[] = [];
    for (const chunk of ['¡Buenas ', 'tardes! ¿Có', 'mo estás hoy? Cuén', 'tame.']) {
      emitted.push(...stream.push(chunk));
    }
    expect(emitted).toEqual(['¡Buenas tardes!', '¿Cómo estás hoy?']);

    // The last sentence has no trailing whitespace, so only the flush releases
    // it. Without this the learner never hears the end of the turn.
    expect(stream.flush()).toEqual(['Cuéntame.']);
    expect(stream.flush()).toEqual([]);
  });

  it('splits a chunk that carries several sentences at once', () => {
    const stream = createSentenceStream();
    expect(stream.push('Hola. ¿Qué tal? Bien, gracias. ')).toEqual([
      'Hola.',
      '¿Qué tal?',
      'Bien, gracias.',
    ]);
  });

  it('passes a chunk that is already one sentence straight through', () => {
    // The server emits one sentence per chunk today. That is a server detail,
    // not a contract, but it is the common path and must not be reshaped.
    const stream = createSentenceStream();
    expect(stream.push('¡Buenas tardes! ')).toEqual(['¡Buenas tardes!']);
  });

  it('reports the full text for rendering, including the incomplete tail', () => {
    const stream = createSentenceStream();
    stream.push('Hola. ');
    stream.push('¿Qué');
    expect(stream.text()).toBe('Hola. ¿Qué');
  });

  it('emits nothing at all for an empty turn', () => {
    const stream = createSentenceStream();
    expect(stream.push('')).toEqual([]);
    expect(stream.flush()).toEqual([]);
  });
});
