// Deno tests for the phrase-help reply parser.
//
// Run with: `deno test supabase/functions/phrase-help/parse.test.ts`

import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { MAX_GLOSS_CHARS, MAX_PHRASE_CHARS, parsePhraseHelp } from './parse.ts';

const OK = { phrase: '¿Me trae la cuenta, por favor?', gloss: 'Could you bring me the bill, please?' };

Deno.test('a clean JSON object parses, trimmed', () => {
  assertEquals(
    parsePhraseHelp(JSON.stringify({ phrase: `  ${OK.phrase} `, gloss: `${OK.gloss}\n` })),
    OK,
  );
});

Deno.test('code fences and surrounding prose are tolerated', () => {
  const body = JSON.stringify(OK);
  assertEquals(parsePhraseHelp('```json\n' + body + '\n```'), OK);
  assertEquals(parsePhraseHelp('```\n' + body + '```'), OK);
  assertEquals(parsePhraseHelp('Sure! ' + body + ' Hope that helps.'), OK);
  // An array around ONE object is the model being chatty, not wrong: the
  // brace scan finds the object inside it.
  assertEquals(parsePhraseHelp(JSON.stringify([OK])), OK);
});

Deno.test('both halves are required', () => {
  assertEquals(parsePhraseHelp(JSON.stringify({ phrase: OK.phrase })), null);
  assertEquals(parsePhraseHelp(JSON.stringify({ gloss: OK.gloss })), null);
  assertEquals(parsePhraseHelp(JSON.stringify({ phrase: '  ', gloss: OK.gloss })), null);
  assertEquals(parsePhraseHelp(JSON.stringify({ phrase: OK.phrase, gloss: 42 })), null);
});

Deno.test('over the cap is null, not truncated', () => {
  assertEquals(parsePhraseHelp(JSON.stringify({ phrase: 'x'.repeat(MAX_PHRASE_CHARS + 1), gloss: 'g' })), null);
  assertEquals(parsePhraseHelp(JSON.stringify({ phrase: 'p', gloss: 'y'.repeat(MAX_GLOSS_CHARS + 1) })), null);
  const atCap = { phrase: 'x'.repeat(MAX_PHRASE_CHARS), gloss: 'y'.repeat(MAX_GLOSS_CHARS) };
  assertEquals(parsePhraseHelp(JSON.stringify(atCap)), atCap);
});

Deno.test('not an object, or not JSON at all, is null', () => {
  assertEquals(parsePhraseHelp('[]'), null);
  assertEquals(parsePhraseHelp('"just a string"'), null);
  assertEquals(parsePhraseHelp('I cannot help with that.'), null);
  assertEquals(parsePhraseHelp(''), null);
  assertEquals(parsePhraseHelp(undefined as unknown as string), null);
});
