// Deno tests for ./json-string-stream.ts.
//
// Run with: `deno test supabase/functions/_shared/json-string-stream.test.ts`
//
// The property under test is the only one that matters: for ANY way of cutting
// the same JSON document into chunks, the decoded value must come out
// identical. Every production bug this module can have is a chunk boundary
// landing somewhere the decoder was not expecting — inside the key, inside an
// escape, between the two halves of a `\uXXXX`, between the two units of a
// surrogate pair. So most of these tests take one document and replay it at
// every possible split.

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { JsonStringValueStream } from './json-string-stream.ts';

/** Feed `doc` as chunks of exactly `size` characters. */
function decodeInChunks(doc: string, size: number, key = 'reply'): string {
  const stream = new JsonStringValueStream(key);
  let out = '';
  for (let i = 0; i < doc.length; i += size) {
    out += stream.push(doc.slice(i, i + size));
  }
  return out + stream.end();
}

/** Feed `doc` split into two chunks at `at`. */
function decodeSplitAt(doc: string, at: number, key = 'reply'): string {
  const stream = new JsonStringValueStream(key);
  const out = stream.push(doc.slice(0, at)) + stream.push(doc.slice(at));
  return out + stream.end();
}

/** Assert the value decodes identically no matter where the document is cut. */
function assertSplitInvariant(doc: string, expected: string, key = 'reply'): void {
  for (let at = 0; at <= doc.length; at++) {
    assertEquals(decodeSplitAt(doc, at, key), expected, `split at ${at}`);
  }
  for (const size of [1, 2, 3, 5, 7, 13]) {
    assertEquals(decodeInChunks(doc, size, key), expected, `chunks of ${size}`);
  }
}

Deno.test('extracts a plain value, however it is chunked', () => {
  assertSplitInvariant(
    '{"reply": "Buenas tardes", "correction": null}',
    'Buenas tardes',
  );
});

Deno.test('the key does not have to have arrived yet', () => {
  const stream = new JsonStringValueStream('reply');
  assertEquals(stream.push('{"re'), '');
  assertEquals(stream.push('ply"'), '');
  assertEquals(stream.push(' : '), '');
  assertEquals(stream.push('"Hola'), 'Hola');
  assertEquals(stream.done, false);
  assertEquals(stream.push('"'), '');
  assertEquals(stream.done, true);
});

Deno.test('an escaped quote does not end the value — the regex bug', () => {
  // This is the whole reason the module exists. A regex over accumulated text
  // stops at the first `"` it sees and drops the rest of the reply.
  assertSplitInvariant(
    String.raw`{"reply": "Ella dijo \"hola\" y se fue.", "gloss": "x"}`,
    'Ella dijo "hola" y se fue.',
  );
});

Deno.test('decodes the two-character escapes', () => {
  assertSplitInvariant(
    String.raw`{"reply": "line one\nline two\ttabbed\\backslash\/slash"}`,
    'line one\nline two\ttabbed\\backslash/slash',
  );
});

Deno.test('decodes \\uXXXX, including a split in the middle of the digits', () => {
  // The accents every target language uses arrive as \\uXXXX escapes, so this
  // is the escape most likely to straddle a chunk boundary in production.
  const doc = String.raw`{"reply": "\u00bfQu\u00e9 tal?"}`;
  assertSplitInvariant(doc, '¿Qué tal?');
  // Named explicitly: the cut lands between the two halves of `é`'s escape.
  const at = doc.indexOf('00e9') + 2;
  assert(at > 2);
  assertEquals(decodeSplitAt(doc, at), '¿Qué tal?');
});

Deno.test('a surrogate pair survives a split between its two escapes', () => {
  const doc = String.raw`{"reply": "nice 😀 done"}`;
  assertSplitInvariant(doc, 'nice 😀 done');
  // A high surrogate is never emitted alone: it is held until its partner
  // arrives, so no caller can JSON.stringify half an emoji.
  const stream = new JsonStringValueStream('reply');
  assertEquals(stream.push(String.raw`{"reply":"\ud83d`), '');
  assertEquals(stream.push(String.raw`\ude00`), '😀');
});

Deno.test('a raw (unescaped) multi-byte character passes through', () => {
  assertSplitInvariant('{"reply": "¿Qué tal? 😀"}', '¿Qué tal? 😀');
});

Deno.test('CJK content is not special-cased', () => {
  assertSplitInvariant('{"reply": "我们换个话题吧。你想聊什么？"}', '我们换个话题吧。你想聊什么？');
});

Deno.test('stops at the closing quote and ignores the rest of the envelope', () => {
  const stream = new JsonStringValueStream('reply');
  const out = stream.push('{"reply":"Hola","correction":{"explanation":"never mind"}}');
  assertEquals(out, 'Hola');
  assertEquals(stream.done, true);
  // Anything pushed afterwards is the rest of the object, not our value.
  assertEquals(stream.push('{"reply":"second"}'), '');
});

Deno.test('a key that appears inside an earlier string value is not mistaken for the key', () => {
  // `from = at + 1` in #enterValue: the first hit is inside a value, so it is
  // rejected (no colon follows) and the search continues.
  assertSplitInvariant(
    '{"note": "the \\"reply\\" field", "reply": "actual"}',
    'actual',
  );
});

Deno.test('a same-named key holding a non-string is skipped', () => {
  assertSplitInvariant('{"reply": null, "reply": "text"}', 'text');
});

Deno.test('an unterminated value yields everything decoded so far', () => {
  // A truncated completion (max_tokens) or a dropped connection. The caller
  // still gets the text; it simply never sees `done`.
  const stream = new JsonStringValueStream('reply');
  assertEquals(stream.push('{"reply": "half a sen'), 'half a sen');
  assertEquals(stream.done, false);
  assertEquals(stream.end(), '');
});

Deno.test('a lone high surrogate at the end is released by end()', () => {
  const stream = new JsonStringValueStream('reply');
  assertEquals(stream.push(String.raw`{"reply":"x\ud83d`), 'x');
  assertEquals(stream.end(), '\ud83d');
});

Deno.test('whitespace between key, colon and value is tolerated', () => {
  assertSplitInvariant('{\n  "reply"\n  :\n  "spaced"\n}', 'spaced');
});

Deno.test('a prose preamble before the JSON does not grow the buffer without bound', () => {
  const stream = new JsonStringValueStream('reply');
  // 200k of noise, fed in chunks — the seek buffer keeps only what could still
  // start a match, so this must not accumulate.
  for (let i = 0; i < 2000; i++) stream.push('x'.repeat(100));
  assertEquals(stream.push('{"reply":"ok"}'), 'ok');
});

Deno.test('an empty value is a value', () => {
  assertSplitInvariant('{"reply": "", "gloss": "x"}', '');
});

Deno.test('the key is configurable', () => {
  assertSplitInvariant('{"reply": "a", "gloss": "b"}', 'b', 'gloss');
});
