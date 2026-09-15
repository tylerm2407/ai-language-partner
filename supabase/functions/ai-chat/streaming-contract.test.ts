// Deno tests for the streaming contract in ./index.ts and ./stream.ts.
//
// Run with: `deno test supabase/functions/ai-chat/streaming-contract.test.ts`
//
// index.ts is source-parsed rather than imported: it calls serve() at module
// scope, so importing it from a test would stand up an HTTP listener. Same
// approach as prompt.test.ts and tts/tts.test.ts.
//
// What is locked here is the set of properties that are cheap to break by
// accident and expensive to discover in the field:
//
//   1. Streaming is opt-in. `stream` absent means the old code path, exactly.
//   2. Quota and the burst limit are spent BEFORE a stream is opened, and a
//      rejection from either is a JSON 429 — the client reads the status code
//      before it opens an event stream, so a limit reached inside an SSE frame
//      is a limit the client never sees.
//   3. Both transports finish the turn through the same function, so a side
//      effect cannot exist on one path and not the other.
//   4. The two paths send the SAME request body. A divergent system array
//      means a divergent cached prefix, which silently doubles input cost.

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

const INDEX_SRC = await Deno.readTextFile(new URL('./index.ts', import.meta.url));
const STREAM_SRC = await Deno.readTextFile(new URL('./stream.ts', import.meta.url));

/** Drop comment lines. These assertions are about what runs, not about what
 *  the comments are allowed to describe. */
function codeOnly(src: string): string {
  return src
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    })
    .join('\n');
}

Deno.test('streaming is opt-in and never inferred', () => {
  // `=== true`, not truthiness: a client that sends `stream: "false"` gets the
  // non-streaming path, which is the safe one.
  assert(
    INDEX_SRC.includes('if (wantsStream === true) {'),
    'the streaming branch must be an explicit `=== true` check',
  );
  assertEquals(
    INDEX_SRC.split('chatStreamResponse({').length - 1,
    1,
    'there should be exactly one place a stream can be opened',
  );
});

Deno.test('quota and the burst limit are consumed before a stream is opened', () => {
  const streamAt = INDEX_SRC.indexOf('chatStreamResponse({');
  assert(streamAt > 0);
  for (const guard of ['checkBurstLimit(', "consumeDailyQuota(", "'RATE_LIMITED'", "'DAILY_TEXT_LIMIT_REACHED'"]) {
    const at = INDEX_SRC.indexOf(guard);
    assert(at > 0, `${guard} should still exist`);
    assert(at < streamAt, `${guard} must be spent before the stream opens`);
  }
});

Deno.test('a limit is a JSON 429, never an SSE frame', () => {
  const streamAt = INDEX_SRC.indexOf('chatStreamResponse({');
  let from = 0;
  let found = 0;
  for (;;) {
    const at = INDEX_SRC.indexOf('status: 429', from);
    if (at === -1) break;
    assert(at < streamAt, 'every 429 must be returned before the stream opens');
    found++;
    from = at + 1;
  }
  assertEquals(found, 2, 'the burst limit and the daily limit both return 429');
});

Deno.test('both transports finish the turn through the same function', () => {
  // Two call sites, one implementation. A second copy of the correction log /
  // evidence / card-save sequence is how they drift apart.
  assertEquals(
    INDEX_SRC.split('finalizeTurn(supabase, turnContext').length - 1,
    2,
    'exactly the streaming and non-streaming call sites',
  );
  assertEquals(
    INDEX_SRC.split('async function finalizeTurn(').length - 1,
    1,
    'exactly one implementation',
  );
});

Deno.test('the two paths send the same request body', () => {
  // One object, built once. index.ts must not add `stream` itself — that key
  // belongs to the streaming writer and nowhere else.
  assert(INDEX_SRC.includes('const anthropicBody = {'));
  assert(
    INDEX_SRC.includes('body: JSON.stringify(anthropicBody),'),
    'the non-streaming path sends the shared body verbatim',
  );
  assert(
    !/stream:\s*true/.test(codeOnly(INDEX_SRC)),
    'index.ts must never set stream:true — the streaming writer owns that key',
  );
  assert(
    STREAM_SRC.includes('JSON.stringify({ ...opts.requestBody, stream: true })'),
    'the streaming writer adds exactly one key to the shared body',
  );
  assertEquals(
    codeOnly(STREAM_SRC).split('opts.requestBody').length - 1,
    1,
    'and sends the shared body from exactly one place',
  );
});

Deno.test('the non-streaming path still goes through generateValidated', () => {
  // CLAUDE.md §1.1. Streaming does its own per-sentence validation; it must
  // not have removed the pipeline from the path that can still use it.
  assert(INDEX_SRC.includes('await generateValidated({'));
  assert(INDEX_SRC.includes('safetyRetries: 2'));
});

Deno.test('the streamed reply is validated per sentence, and the rest of the envelope separately', () => {
  // The reply goes out sentence by sentence, so its gate is in stream.ts.
  assert(
    STREAM_SRC.includes('validateContentSafety(text'),
    'each sentence is safety-checked before it is emitted',
  );
  // Everything that is NOT streamed — correction, vocabulary, gloss — has its
  // own gate, or streaming would be a hole in the pipeline rather than a
  // different shape of it.
  assert(INDEX_SRC.includes('async function stripUnsafeMetadata('));
  assert(
    INDEX_SRC.includes('stripUnsafeMetadata(parseAIResponse(rawText), targetLanguage)'),
    'the metadata gate must run before the done frame is built',
  );
});

Deno.test('the SSE response carries the headers a client needs, plus CORS', () => {
  for (const header of [
    "'Content-Type': 'text/event-stream'",
    "'Cache-Control': 'no-cache'",
    "Connection: 'keep-alive'",
    '...corsHeaders',
  ]) {
    assert(STREAM_SRC.includes(header), `missing ${header}`);
  }
});

Deno.test('the provider error text is never returned to the client', () => {
  // CLAUDE.md §6: an Anthropic error body quotes the request — and therefore
  // the system prompt — back at us.
  assert(STREAM_SRC.includes('const CLIENT_ERROR = {'));
  const frames = STREAM_SRC.match(/send\('error', [^)]*\)/g) ?? [];
  assert(frames.length > 0, 'the error frame should exist');
  for (const frame of frames) {
    assertEquals(frame, "send('error', CLIENT_ERROR)", 'error frames must carry the canned message only');
  }
});

// ─── Missions ─────────────────────────────────────────────────────────────
//
// The finish turn is the one request that must never open a stream and must
// never be turned away at the daily limit: it is scored and answered in one
// JSON envelope, from turns that were each already paid for.

Deno.test('finish never streams', () => {
  assert(
    INDEX_SRC.includes('const wantsStream = finish ? false : rawStream;'),
    'the stream flag must be forced off for a finish before the streaming branch is reached',
  );
  assert(
    INDEX_SRC.indexOf('const wantsStream = finish ? false : rawStream;') <
      INDEX_SRC.indexOf('if (wantsStream === true) {'),
  );
});

Deno.test('finish is never a 429', () => {
  // A finish with nothing to finish is a 400, not a quota answer.
  const at = INDEX_SRC.indexOf("code: 'NOTHING_TO_FINISH'");
  assert(at > 0, 'the NOTHING_TO_FINISH refusal should exist');
  const status = INDEX_SRC.slice(at, INDEX_SRC.indexOf('status:', at) + 'status: 400'.length);
  assert(status.endsWith('status: 400'), 'NOTHING_TO_FINISH must be a 400');
  // The daily-limit branch turns away ordinary turns only; a finish at the
  // limit degrades to the canned send-off instead.
  assert(
    INDEX_SRC.includes('if (!allowed) {\n      if (!finish) {'),
    'the daily-limit 429 must be guarded by !finish',
  );
  assert(INDEX_SRC.includes('sendoffOnly = true;'));
  assert(INDEX_SRC.includes('const SENDOFF_REPLIES: Record<string, string> = {'));
});

Deno.test('the attempt is resolved before the daily quota is spent', () => {
  // A locked stage or a finished attempt must not cost a text message.
  const resolveAt = INDEX_SRC.indexOf('await resolveMissionAttempt(supabase, {');
  const quotaAt = INDEX_SRC.indexOf('await consumeDailyQuota(');
  const burstAt = INDEX_SRC.indexOf('await checkBurstLimit(');
  assert(resolveAt > 0 && quotaAt > 0 && burstAt > 0);
  assert(burstAt < resolveAt, 'burst first — a rate-limited request should not touch the attempt');
  assert(resolveAt < quotaAt, 'the attempt is resolved before quota is consumed');
});

Deno.test('the prompt is built from the row’s stage, never the request’s', () => {
  const call = INDEX_SRC.slice(INDEX_SRC.indexOf('const systemPrompt = buildSystemPrompt('));
  const args = call.slice(0, call.indexOf(');'));
  assert(args.includes('missionAttempt?.stage'), 'buildSystemPrompt must take the attempt row’s stage');
  assert(!/\bmissionStage\b/.test(args), 'the client-sent missionStage must not reach the prompt');
});

Deno.test('a finish logs no correction, leaves no evidence and banks no cards', () => {
  const fn = INDEX_SRC.slice(INDEX_SRC.indexOf('async function finalizeTurn('));
  assert(fn.includes("const correction = ctx.finish ? null : parsed.correction;"));
  const guarded = fn.slice(fn.indexOf('if (!ctx.finish) {'), fn.indexOf('// ── Mission progress'));
  assert(guarded.includes('recordConversationEvidence(supabase'), 'evidence is inside the !finish guard');
  assert(guarded.includes('saveChatVocabulary(supabase'), 'cards are inside the !finish guard');
});

Deno.test('objective ids are whitelisted against the mission before they are believed', () => {
  assert(INDEX_SRC.includes('parsed.objectivesMet.filter((id) => ids.has(id))'));
  assert(INDEX_SRC.includes('missionObjectiveIds(ctx.mission.def)'));
});

Deno.test('evidence is attributed to the session on both transports', () => {
  // The streaming fallback and finalizeTurn both write evidence; the new
  // column has to be on both or a mission's accuracy depends on transport.
  assertEquals(
    INDEX_SRC.split('chatSessionId: turnContext.evidenceSessionId,').length - 1 +
      INDEX_SRC.split('chatSessionId: ctx.evidenceSessionId,').length - 1,
    2,
  );
});

Deno.test('a safety failure sends the pre-authored fallback, not the model text', () => {
  assert(STREAM_SRC.includes("send('fallback', { reply: opts.fallbackReply })"));
  assert(
    INDEX_SRC.includes('fallbackReply,'),
    'the streaming writer is handed the same per-language fallback the old path used',
  );
  assert(INDEX_SRC.includes('const fallbackReply = FALLBACK_REPLIES[targetLanguage] ?? FALLBACK_REPLIES.en;'));
});
