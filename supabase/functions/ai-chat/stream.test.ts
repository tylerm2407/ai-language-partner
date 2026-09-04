// Deno tests for ./stream.ts.
//
// Run with: `deno test supabase/functions/ai-chat/stream.test.ts`
//
// This is the file that guards CLAUDE.md §1.1 on the streaming path. The
// invariant it exists to prove: no text reaches `onSentence` that has not been
// through `validate` first, and once one sentence is refused NOTHING after it
// is emitted — not the rest of the reply, not a later sentence that would have
// passed on its own.

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { readReplyStream } from './stream.ts';

/** Build a ReadableStream of the given strings, as bytes. */
function streamOf(parts: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(encoder.encode(part));
      controller.close();
    },
  });
}

/** Wrap raw model output as Anthropic SSE deltas, one frame per part. */
function anthropicSse(parts: string[]): string[] {
  const frames = parts.map(
    (text) =>
      `event: content_block_delta\ndata: ${JSON.stringify({
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text },
      })}\n\n`,
  );
  return [
    'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_1"}}\n\n',
    ...frames,
    'event: message_stop\ndata: {"type":"message_stop"}\n\n',
  ];
}

const allSafe = () => Promise.resolve({ safe: true, reasons: [] });

/** Refuse any sentence containing `word`. */
function refusing(word: string) {
  return (text: string) =>
    Promise.resolve(
      text.includes(word) ? { safe: false, reasons: ['violence'] } : { safe: true, reasons: [] },
    );
}

Deno.test('emits sentences as they complete, and the whole envelope at the end', async () => {
  const sentences: string[] = [];
  const outcome = await readReplyStream({
    body: streamOf(
      anthropicSse([
        '{"reply": "Buenas tar',
        'des. ¿Qué te gustaría comer',
        ' hoy?", "correction": null, "vocabularyHighlights": [], "gloss": "Good afternoon."}',
      ]),
    ),
    onSentence: (t) => {
      sentences.push(t);
    },
    validate: allSafe,
  });

  assertEquals(sentences, ['Buenas tardes. ', '¿Qué te gustaría comer hoy?']);
  assertEquals(outcome.kind, 'complete');
  assert(outcome.kind === 'complete');
  // The raw text is the COMPLETE envelope, not just the reply — parseAIResponse
  // still has to find the correction and the vocabulary in it.
  assertEquals(
    JSON.parse(outcome.rawText).gloss,
    'Good afternoon.',
  );
});

Deno.test('the first byte leaves before the envelope is closed', async () => {
  // The whole point of the feature: sentence one is out while the correction
  // object is still being written.
  const sentences: string[] = [];
  let sentencesAtFirstEmit = -1;
  await readReplyStream({
    body: streamOf(
      anthropicSse([
        '{"reply": "Hola. ',
        'Me alegro."',
        ', "correction": {"shortLabel": "ser vs estar", "explanation": "..."}}',
      ]),
    ),
    onSentence: (t) => {
      sentences.push(t);
      if (sentencesAtFirstEmit === -1) sentencesAtFirstEmit = sentences.length;
    },
    validate: allSafe,
  });
  assertEquals(sentences, ['Hola. ', 'Me alegro.']);
  assertEquals(sentencesAtFirstEmit, 1);
});

Deno.test('nothing is emitted that has not been validated first', async () => {
  const validated: string[] = [];
  const emitted: string[] = [];
  await readReplyStream({
    body: streamOf(anthropicSse(['{"reply": "Uno. Dos. Tres."}'])),
    onSentence: (t) => {
      emitted.push(t);
    },
    validate: (t) => {
      validated.push(t);
      return allSafe();
    },
  });
  assertEquals(emitted, ['Uno. ', 'Dos. ', 'Tres.']);
  assertEquals(validated, emitted);
});

Deno.test('an unsafe sentence stops the stream and emits nothing after it', async () => {
  const emitted: string[] = [];
  const outcome = await readReplyStream({
    body: streamOf(
      anthropicSse(['{"reply": "Primero está bien. ', 'Voy a kill the time. ', 'Tercero está bien."}']),
    ),
    onSentence: (t) => {
      emitted.push(t);
    },
    validate: refusing('kill'),
  });
  // The clean sentence before it was already delivered — that is the point of
  // streaming and it is not a leak. Everything from the refusal on is dropped,
  // including the third sentence, which would have passed on its own.
  assertEquals(emitted, ['Primero está bien. ']);
  assert(outcome.kind === 'unsafe');
  assertEquals(outcome.reasons, ['violence']);
});

Deno.test('the final unterminated sentence is validated too', async () => {
  // The model hit max_tokens mid-sentence. That tail is flushed by the
  // end-of-stream drain, and it goes through the same gate.
  const emitted: string[] = [];
  const outcome = await readReplyStream({
    body: streamOf(anthropicSse(['{"reply": "Empieza bien. Y luego kill'])),
    onSentence: (t) => {
      emitted.push(t);
    },
    validate: refusing('kill'),
  });
  assertEquals(emitted, ['Empieza bien. ']);
  assert(outcome.kind === 'unsafe');
});

Deno.test('a truncated completion still delivers what arrived', async () => {
  const emitted: string[] = [];
  const outcome = await readReplyStream({
    body: streamOf(anthropicSse(['{"reply": "Una frase completa. Y otra a med'])),
    onSentence: (t) => {
      emitted.push(t);
    },
    validate: allSafe,
  });
  assertEquals(emitted, ['Una frase completa. ', 'Y otra a med']);
  assertEquals(outcome.kind, 'complete');
});

Deno.test('a mid-stream provider error ends the read', async () => {
  const emitted: string[] = [];
  const outcome = await readReplyStream({
    body: streamOf([
      ...anthropicSse(['{"reply": "Buenas tardes. ']).slice(0, -1),
      'event: error\ndata: {"type":"error","error":{"type":"overloaded_error"}}\n\n',
    ]),
    onSentence: (t) => {
      emitted.push(t);
    },
    validate: allSafe,
  });
  assertEquals(emitted, ['Buenas tardes. ']);
  assert(outcome.kind === 'provider_error');
  assertEquals(outcome.message, 'overloaded_error');
});

Deno.test('escaped quotes inside the reply do not truncate it', async () => {
  // The regex bug, end to end: a naive extractor stops at the first `"` and
  // the learner hears half the sentence.
  const emitted: string[] = [];
  const outcome = await readReplyStream({
    body: streamOf(
      anthropicSse([
        '{"reply": "Ella dijo \\"hola\\" y se fue. ',
        'Luego volvió.", "correction": null}',
      ]),
    ),
    onSentence: (t) => {
      emitted.push(t);
    },
    validate: allSafe,
  });
  assertEquals(emitted, ['Ella dijo "hola" y se fue. ', 'Luego volvió.']);
  assert(outcome.kind === 'complete');
});

Deno.test('a one-byte-at-a-time stream produces the same sentences', async () => {
  // The worst chunking a network can hand us, and the one every naive
  // implementation of this gets wrong.
  const envelope = '{"reply": "Buenas tardes. ¿Qué tal? Me alegro.", "correction": null}';
  const emitted: string[] = [];
  await readReplyStream({
    body: streamOf(anthropicSse([...envelope]).flatMap((f) => [...f])),
    onSentence: (t) => {
      emitted.push(t);
    },
    validate: allSafe,
  });
  assertEquals(emitted, ['Buenas tardes. ', '¿Qué tal? ', 'Me alegro.']);
});

Deno.test('CJK replies stream sentence by sentence', async () => {
  const emitted: string[] = [];
  await readReplyStream({
    body: streamOf(anthropicSse(['{"reply": "我们换个话题吧。', '你还想聊点什么？"}'])),
    onSentence: (t) => {
      emitted.push(t);
    },
    validate: allSafe,
  });
  assertEquals(emitted, ['我们换个话题吧。', '你还想聊点什么？']);
});

Deno.test('text after the reply value is collected but never emitted', async () => {
  // The correction explanation is not spoken to the learner and must not be
  // mistaken for reply text once the value has closed.
  const emitted: string[] = [];
  const outcome = await readReplyStream({
    body: streamOf(
      anthropicSse([
        '{"reply": "Hola.", "correction": {"explanation": "Es un error. Otro."}}',
      ]),
    ),
    onSentence: (t) => {
      emitted.push(t);
    },
    validate: allSafe,
  });
  assertEquals(emitted, ['Hola.']);
  assert(outcome.kind === 'complete');
  assertEquals(JSON.parse(outcome.rawText).correction.explanation, 'Es un error. Otro.');
});
