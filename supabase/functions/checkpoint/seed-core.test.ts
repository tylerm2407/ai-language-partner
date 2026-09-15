import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { buildSeedPrompt, parseSeeded } from './seed-core.ts';

const reading = { strand: 'reading', prompt: 'Complete with “book”: Je lis un ___.', correctAnswer: 'livre', acceptedAnswers: [] };
const listening = { strand: 'listening', prompt: 'Type what you hear', audioText: 'Je vais à Paris.', correctAnswer: 'Je vais à Paris.' };

Deno.test('seed parser rejects invalid containers and incomplete keyed items', () => {
  for (const value of [null, 'text', [], {}, { items: 'not an array' }]) assertEquals(parseSeeded(value), []);
  assertEquals(parseSeeded({ items: [null, {}, { ...reading, strand: 'other' }, { ...reading, correctAnswer: null }] }), []);
});

Deno.test('reading seed requires exactly one literal three-underscore gap', () => {
  for (const prompt of ['Je lis un livre.', 'Je lis un _.', 'Je lis un ____.', 'Je ___ un ___.']) {
    assertEquals(parseSeeded({ items: [{ ...reading, prompt }] }), []);
  }
  const [item] = parseSeeded({ items: [reading] });
  assertEquals(item.correctAnswer, 'livre');
  assertEquals(item.acceptedAnswers, ['livre']);
});

Deno.test('seed parser rejects oversized non-speaking source fields instead of truncating', () => {
  for (const entry of [
    { ...reading, prompt: `___${'x'.repeat(498)}` },
    { ...reading, correctAnswer: 'x'.repeat(301) },
    { ...listening, audioText: 'x'.repeat(301), correctAnswer: 'x'.repeat(301) },
    { strand: 'writing', prompt: 'x'.repeat(501) },
  ]) assertEquals(parseSeeded({ items: [entry] }), []);
});

Deno.test('oversized optional answers are discarded, not changed into different answers', () => {
  const [item] = parseSeeded({ items: [{ ...reading, acceptedAnswers: ['livre', 'roman', 'x'.repeat(301), null] }] });
  assertEquals(item.acceptedAnswers, ['livre', 'roman']);
});

Deno.test('listening key must be the complete source transcription', () => {
  assertEquals(parseSeeded({ items: [{ ...listening, correctAnswer: 'Je vais à Lyon.' }] }), []);
  assertEquals(parseSeeded({ items: [{ ...listening, audioText: null }] }), []);
  assertEquals(parseSeeded({ items: [{ ...listening, correctAnswer: 'Je vais a Paris.' }] }), []);
  const [item] = parseSeeded({ items: [{ ...listening, correctAnswer: '  Je  vais a\u0300 Paris. ' }] });
  assertEquals(item.correctAnswer?.normalize('NFC'), listening.audioText);
});

Deno.test('open writing never acquires a single fixed answer or audio source', () => {
  const [item] = parseSeeded({ items: [{ strand: 'writing', prompt: 'Describe your family in French.', correctAnswer: 'My family', acceptedAnswers: ['My family'], audioText: 'My family' }] });
  assertEquals(item, { strand: 'writing', prompt: 'Describe your family in French.', correctAnswer: null, acceptedAnswers: [], audioText: null });
});

Deno.test('speaking parser behavior is preserved outside this audit scope', () => {
  const [item] = parseSeeded({ items: [{ strand: 'speaking', prompt: 'x'.repeat(510), correctAnswer: 'y'.repeat(310), acceptedAnswers: ['z'.repeat(310)] }] });
  assertEquals(item.prompt, 'x'.repeat(500));
  assertEquals(item.correctAnswer, 'y'.repeat(300));
  assertEquals(item.acceptedAnswers, ['y'.repeat(300), 'z'.repeat(300)]);
});

Deno.test('seed instructions require context-bound answers and task-appropriate progression', () => {
  const prompt = buildSeedPrompt('fr', 'B1');
  for (const text of ['CEFR B1', 'exactly one ___ gap', 'mentally insert each accepted answer', 'not paraphrase', 'complete keys/audio text', 'short English instruction asking for 2-3 sentences']) assert(prompt.includes(text));
});
