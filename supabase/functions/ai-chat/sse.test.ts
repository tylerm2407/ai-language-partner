// Deno tests for ./sse.ts.
//
// Run with: `deno test supabase/functions/ai-chat/sse.test.ts`
//
// The failure this file exists to prevent: a decoder that treats one network
// read as one event. It passes every hand-written test and then, in
// production, silently drops the deltas that happened to straddle a TCP
// boundary — which for a 500-token completion is most of them. So the main
// test replays one real Anthropic stream at every possible split point.

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { anthropicDeltaText, anthropicStreamError, SseDecoder, sseFrame } from './sse.ts';

/** A realistic Anthropic stream, including the framing we ignore. */
const ANTHROPIC_STREAM = [
  'event: message_start',
  'data: {"type":"message_start","message":{"id":"msg_1","role":"assistant"}}',
  '',
  'event: content_block_start',
  'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
  '',
  ': ping',
  '',
  'event: content_block_delta',
  'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"{\\"reply\\": \\"Buenas "}}',
  '',
  'event: content_block_delta',
  'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"tardes.\\"}"}}',
  '',
  'event: message_delta',
  'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}',
  '',
  'event: message_stop',
  'data: {"type":"message_stop"}',
  '',
].join('\n');

/** Decode the whole stream in fixed-size chunks and return the text deltas. */
function deltasInChunks(stream: string, size: number): string[] {
  const decoder = new SseDecoder();
  const out: string[] = [];
  for (let i = 0; i < stream.length; i += size) {
    for (const evt of decoder.push(stream.slice(i, i + size))) {
      const text = anthropicDeltaText(evt);
      if (text !== null) out.push(text);
    }
  }
  return out;
}

const EXPECTED_DELTAS = ['{"reply": "Buenas ', 'tardes."}'];

Deno.test('extracts text deltas whatever the chunking', () => {
  for (const size of [1, 2, 3, 7, 16, 64, 4096]) {
    assertEquals(deltasInChunks(ANTHROPIC_STREAM, size), EXPECTED_DELTAS, `chunks of ${size}`);
  }
  // Every two-way split, including one that lands between a \r and its \n.
  for (let at = 0; at <= ANTHROPIC_STREAM.length; at++) {
    const decoder = new SseDecoder();
    const out: string[] = [];
    for (const part of [ANTHROPIC_STREAM.slice(0, at), ANTHROPIC_STREAM.slice(at)]) {
      for (const evt of decoder.push(part)) {
        const text = anthropicDeltaText(evt);
        if (text !== null) out.push(text);
      }
    }
    assertEquals(out, EXPECTED_DELTAS, `split at ${at}`);
  }
});

Deno.test('CRLF line endings decode the same as LF', () => {
  assertEquals(
    deltasInChunks(ANTHROPIC_STREAM.replace(/\n/g, '\r\n'), 5),
    EXPECTED_DELTAS,
  );
});

Deno.test('a keep-alive comment produces no event', () => {
  const decoder = new SseDecoder();
  assertEquals(decoder.push(': ping\n\n'), []);
});

Deno.test('a partial line is not dispatched until it is complete', () => {
  const decoder = new SseDecoder();
  assertEquals(decoder.push('event: content_block_delta\ndata: {"type":"content_'), []);
  const events = decoder.push('block_delta","delta":{"type":"text_delta","text":"hi"}}\n\n');
  assertEquals(events.length, 1);
  assertEquals(anthropicDeltaText(events[0]), 'hi');
});

Deno.test('non-text events carry no delta', () => {
  const decoder = new SseDecoder();
  const events = decoder.push(
    'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"max_tokens"}}\n\n',
  );
  assertEquals(anthropicDeltaText(events[0]), null);
});

Deno.test('an input_json_delta is not reply text', () => {
  // Tool use would emit these. Treating them as reply text would splice tool
  // arguments into what the learner hears.
  const decoder = new SseDecoder();
  const events = decoder.push(
    'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"input_json_delta","partial_json":"{"}}\n\n',
  );
  assertEquals(anthropicDeltaText(events[0]), null);
});

Deno.test('unparseable data is skipped rather than thrown', () => {
  const decoder = new SseDecoder();
  const events = decoder.push('event: content_block_delta\ndata: not json\n\n');
  assertEquals(anthropicDeltaText(events[0]), null);
});

Deno.test('a mid-stream provider error is surfaced', () => {
  const decoder = new SseDecoder();
  const events = decoder.push(
    'event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}\n\n',
  );
  assertEquals(anthropicStreamError(events[0]), 'overloaded_error');
  assertEquals(anthropicDeltaText(events[0]), null);
});

Deno.test('a normal event is not mistaken for an error', () => {
  const decoder = new SseDecoder();
  const events = decoder.push('event: message_stop\ndata: {"type":"message_stop"}\n\n');
  assertEquals(anthropicStreamError(events[0]), null);
});

Deno.test('sseFrame emits one blank-line-terminated frame with single-line data', () => {
  const frame = sseFrame('chunk', { text: 'line one\nline two' });
  assertEquals(frame, 'event: chunk\ndata: {"text":"line one\\nline two"}\n\n');
  // The payload must never contain a raw newline — that would end the data
  // field early and split one frame into two on the client.
  assertEquals(frame.split('\n').length, 4);
});

Deno.test('a frame this function emits round-trips through its own decoder', () => {
  const decoder = new SseDecoder();
  const events = decoder.push(sseFrame('done', { reply: 'Hola', correction: null }));
  assertEquals(events.length, 1);
  assertEquals(events[0].event, 'done');
  assertEquals(JSON.parse(events[0].data), { reply: 'Hola', correction: null });
});
