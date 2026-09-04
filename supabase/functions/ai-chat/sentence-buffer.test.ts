// Deno tests for ./sentence-buffer.ts.
//
// Run with: `deno test supabase/functions/ai-chat/sentence-buffer.test.ts`
//
// Two invariants carry the whole module.
//
// First, nothing is lost at a seam: sentences.join('') + rest must reproduce
// the input character for character, whatever the input is. A streaming path
// that quietly drops a space between clips is a bug nobody reports and
// everybody hears.
//
// Second, a wrong split is worse than a late one. Most of these tests are
// therefore about NOT splitting — decimals, abbreviations, initials, list
// markers, and the case where the deciding character has not arrived yet.

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { splitCompleteSentences } from './sentence-buffer.ts';

/** Split, asserting the no-loss invariant on the way through. */
function split(buffer: string) {
  const out = splitCompleteSentences(buffer);
  assertEquals(out.sentences.join('') + out.rest, buffer, 'characters lost at a seam');
  return out;
}

/** Feed `text` one character at a time, the worst case a provider can produce,
 *  and return the sentences flushed plus whatever never completed. */
function drip(text: string): { sentences: string[]; rest: string } {
  let buffer = '';
  const sentences: string[] = [];
  for (const ch of text) {
    buffer += ch;
    const out = split(buffer);
    sentences.push(...out.sentences);
    buffer = out.rest;
  }
  return { sentences, rest: buffer };
}

Deno.test('splits on a period followed by a space', () => {
  const out = split('Buenas tardes. ¿Qué tal?');
  assertEquals(out.sentences, ['Buenas tardes. ']);
  assertEquals(out.rest, '¿Qué tal?');
});

Deno.test('the last sentence is not flushed until its terminator is confirmed', () => {
  // "¿Qué tal?" is complete but nothing follows it yet — the next character
  // could be a digit, making it something else entirely. It stays in `rest`
  // and the caller flushes it when the stream ends.
  const out = split('Hola. ¿Qué tal?');
  assertEquals(out.sentences, ['Hola. ']);
  assertEquals(out.rest, '¿Qué tal?');
});

Deno.test('does not split a decimal number', () => {
  assertEquals(split('Cuesta 3.14 euros. ').sentences, ['Cuesta 3.14 euros. ']);
  // A figure that really does end the sentence still ends it — the list-marker
  // rule is scoped to a number that OPENS a sentence, not any number at all.
  assertEquals(drip('El total es 12.50. Gracias. ').sentences, [
    'El total es 12.50. ',
    'Gracias. ',
  ]);
  assertEquals(split('El total es 12.50. Gracias. ').sentences, [
    'El total es 12.50. ',
    'Gracias. ',
  ]);
});

Deno.test('does not split an abbreviation', () => {
  for (const text of [
    'El Sr. García llegó. ',
    'Le Dr. Martin arrive. ',
    'Herr Dr. Schmidt kommt. ',
    'Il sig. Rossi arriva. ',
    'Pizza, pasta, etc. son italianos. ',
  ]) {
    assertEquals(drip(text).sentences, [text], text);
  }
});

Deno.test('does not split on an initial', () => {
  // "z. B." and "p. ej." are two single letters in a row; splitting either
  // half hands the synthesiser a sentence consisting of one letter.
  assertEquals(drip('Zum Beispiel, z. B. Kaffee. ').sentences, ['Zum Beispiel, z. B. Kaffee. ']);
  assertEquals(drip('Leí a J. K. Rowling ayer. ').sentences, ['Leí a J. K. Rowling ayer. ']);
});

Deno.test('does not split a numbered list marker', () => {
  const expected = ['1. Primero. ', '2. Segundo. '];
  assertEquals(drip('1. Primero. 2. Segundo. ').sentences, expected);
  assertEquals(split('1. Primero. 2. Segundo. ').sentences, expected);
  // "Pasos:" has no terminator, so it rides along with the item that follows;
  // what matters is that "1." and "2." never become sentences of their own.
  assertEquals(drip('Pasos:\n1. Mira.\n2. Escucha.\n').sentences, [
    'Pasos:\n1. Mira.\n',
    '2. Escucha.\n',
  ]);
});

Deno.test('a run of terminators is one sentence, not several', () => {
  assertEquals(split('¡Qué bien!? Sigue. ').sentences, ['¡Qué bien!? ', 'Sigue. ']);
  assertEquals(split('Bueno... Sigue. ').sentences, ['Bueno... ', 'Sigue. ']);
});

Deno.test('closing punctuation stays with the sentence it closes', () => {
  assertEquals(split('Ella dijo "hola." Luego se fue. ').sentences, [
    'Ella dijo "hola." ',
    'Luego se fue. ',
  ]);
  assertEquals(split('(Es cierto.) Vamos. ').sentences, ['(Es cierto.) ', 'Vamos. ']);
});

Deno.test('CJK terminators split without waiting for a space', () => {
  // The Latin rule would never fire here: 。 is followed immediately by the
  // next sentence, so waiting for whitespace means never flushing — a zh/ja/ko
  // learner would get the entire reply in one chunk at the end, which is the
  // latency this whole path exists to remove.
  const out = split('我们换个话题吧。你还想聊点什么？');
  assertEquals(out.sentences, ['我们换个话题吧。', '你还想聊点什么？']);
  assertEquals(out.rest, '');
  assertEquals(drip('こんにちは。元気ですか？はい！').sentences, [
    'こんにちは。',
    '元気ですか？',
    'はい！',
  ]);
});

Deno.test('a newline counts as the confirming whitespace', () => {
  assertEquals(split('Primero.\nSegundo. ').sentences, ['Primero.\n', 'Segundo. ']);
  // Without a following character the terminator is still unconfirmed.
  assertEquals(split('Primero.\nSegundo.').sentences, ['Primero.\n']);
});

Deno.test('character-by-character arrival gives the same answer as one shot', () => {
  const text = 'Buenas tardes. ¿Qué te gustaría comer hoy? Tenemos paella. ';
  assertEquals(drip(text).sentences, split(text).sentences);
});

Deno.test('no terminator at all means nothing flushes', () => {
  const out = split('sin puntuación alguna');
  assertEquals(out.sentences, []);
  assertEquals(out.rest, 'sin puntuación alguna');
});

Deno.test('an empty buffer is handled', () => {
  assertEquals(split(''), { sentences: [], rest: '' });
});
