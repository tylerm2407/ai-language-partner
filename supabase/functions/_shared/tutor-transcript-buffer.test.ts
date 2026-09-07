import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

// Redis reads its URL and token into module-level constants at IMPORT time, so
// the env has to be set before the dynamic import below. Everything after that
// runs against a fake Upstash driven by the fetch stub.
Deno.env.set('UPSTASH_REDIS_REST_URL', 'https://fake.upstash.invalid');
Deno.env.set('UPSTASH_REDIS_REST_TOKEN', 'fake-token');

const mod = await import('./tutor-transcript-buffer.ts');
const { appendTurns, readTranscript, dropTranscript, MAX_BUFFERED_TURNS, MAX_TURN_CHARS } = mod;

const realFetch = globalThis.fetch;
let store: Map<string, string>;
let failNext: boolean;

function installFakeRedis() {
  store = new Map();
  failNext = false;
  globalThis.fetch = ((_url: string | URL | Request, init?: RequestInit) => {
    if (failNext) return Promise.reject(new Error('redis down'));
    const args = JSON.parse(String(init?.body ?? '[]')) as string[];
    const [cmd, key, value] = args;
    let result: unknown = null;
    if (cmd === 'GET') result = store.has(key) ? store.get(key) : null;
    else if (cmd === 'SETEX') { store.set(key, args[3]); result = 'OK'; }
    else if (cmd === 'SET') { store.set(key, value); result = 'OK'; }
    else if (cmd === 'DEL') { result = store.delete(key) ? 1 : 0; }
    return Promise.resolve(
      new Response(JSON.stringify({ result }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }) as typeof fetch;
}
function restore() { globalThis.fetch = realFetch; }

Deno.test('turns accumulate across appends, in order', async () => {
  installFakeRedis();
  try {
    await appendTurns('s1', [{ speaker: 'tutor', text: 'Hola, como estas?' }], 600);
    await appendTurns('s1', [{ speaker: 'learner', text: 'Estoy bien' }], 600);
    const read = await readTranscript('s1');
    assert(read.available);
    assertEquals(read.turns.length, 2);
    assertEquals(read.turns[0].speaker, 'tutor');
    assertEquals(read.turns[1].text, 'Estoy bien');
  } finally { restore(); }
});

Deno.test('a lost buffer is distinguishable from a silent session', async () => {
  installFakeRedis();
  try {
    // Nothing was ever written for this session id.
    const missing = await readTranscript('never-existed');
    assertEquals(missing.available, false);
    assertEquals(missing.turns.length, 0);

    // Whereas a session that was written to reports available, even if the
    // caller later finds it short. Conflating the two would quietly turn a
    // Redis outage into "the learner had a quiet session".
    await appendTurns('s2', [{ speaker: 'learner', text: 'si' }], 600);
    const present = await readTranscript('s2');
    assertEquals(present.available, true);
  } finally { restore(); }
});

Deno.test('a Redis outage degrades instead of throwing', async () => {
  installFakeRedis();
  try {
    failNext = true;
    // An append that throws would fail the client's heartbeat and take down a
    // working conversation over bookkeeping.
    const ok = await appendTurns('s3', [{ speaker: 'learner', text: 'hola' }], 600);
    assertEquals(ok, false);
    const read = await readTranscript('s3');
    assertEquals(read.available, false);
    // Dropping must not throw either.
    await dropTranscript('s3');
  } finally { restore(); }
});

Deno.test('the buffer keeps the TAIL when it overflows', async () => {
  installFakeRedis();
  try {
    const many = Array.from({ length: MAX_BUFFERED_TURNS + 25 }, (_, i) => ({
      speaker: 'learner' as const,
      text: `turn-${i}`,
    }));
    await appendTurns('s4', many, 600);
    const read = await readTranscript('s4');
    assertEquals(read.turns.length, MAX_BUFFERED_TURNS);
    // The END of the conversation is what the debrief's "next time" is drawn
    // from, so the tail is the half worth keeping.
    assertEquals(read.turns[read.turns.length - 1].text, `turn-${MAX_BUFFERED_TURNS + 24}`);
    assert(!read.turns.some((t) => t.text === 'turn-0'));
  } finally { restore(); }
});

Deno.test('an over-long turn is truncated, not rejected', async () => {
  installFakeRedis();
  try {
    await appendTurns('s5', [{ speaker: 'tutor', text: 'x'.repeat(5000) }], 600);
    const read = await readTranscript('s5');
    assertEquals(read.turns[0].text.length, MAX_TURN_CHARS);
  } finally { restore(); }
});

Deno.test('empty and whitespace-only turns are dropped', async () => {
  installFakeRedis();
  try {
    await appendTurns('s6', [
      { speaker: 'learner', text: '   ' },
      { speaker: 'learner', text: '' },
      { speaker: 'learner', text: 'real content' },
    ], 600);
    const read = await readTranscript('s6');
    assertEquals(read.turns.length, 1);
    assertEquals(read.turns[0].text, 'real content');
  } finally { restore(); }
});

Deno.test('recogniser confidence survives only when it is a number', async () => {
  installFakeRedis();
  try {
    await appendTurns('s7', [
      { speaker: 'learner', text: 'con confianza', recognizerConfidence: 0.82 },
      // deno-lint-ignore no-explicit-any
      { speaker: 'learner', text: 'sin confianza', recognizerConfidence: 'high' as any },
    ], 600);
    const read = await readTranscript('s7');
    assertEquals(read.turns[0].recognizerConfidence, 0.82);
    assertEquals(read.turns[1].recognizerConfidence, undefined);
  } finally { restore(); }
});

Deno.test('a corrupt buffer reads as unavailable rather than crashing the end action', async () => {
  installFakeRedis();
  try {
    store.set('tutor:tx:s8', 'not json at all');
    assertEquals((await readTranscript('s8')).available, false);
    store.set('tutor:tx:s9', '{"not":"an array"}');
    assertEquals((await readTranscript('s9')).available, false);
  } finally { restore(); }
});

Deno.test('an unknown speaker is coerced to learner, never dropped', async () => {
  installFakeRedis();
  try {
    store.set('tutor:tx:s10', JSON.stringify([{ speaker: 'martian', text: 'hello' }]));
    const read = await readTranscript('s10');
    assertEquals(read.turns.length, 1);
    assertEquals(read.turns[0].speaker, 'learner');
  } finally { restore(); }
});

Deno.test('dropping removes the buffer', async () => {
  installFakeRedis();
  try {
    await appendTurns('s11', [{ speaker: 'learner', text: 'adios' }], 600);
    assertEquals((await readTranscript('s11')).available, true);
    await dropTranscript('s11');
    assertEquals((await readTranscript('s11')).available, false);
  } finally { restore(); }
});
