import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  checkTutorOutput,
  TUTOR_MAX_SAFETY_CUTS,
} from './safety.ts';

const realFetch = globalThis.fetch;
function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) =>
    Promise.resolve(handler(String(input), init))) as typeof fetch;
}
function restoreFetch() {
  globalThis.fetch = realFetch;
}
function moderationResponse(flagged: boolean, categories: Record<string, boolean> = {}) {
  return new Response(JSON.stringify({ results: [{ flagged, categories }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.test('every language uses moderation when the credential is available', async () => {
  let called = false;
  stubFetch(() => {
    called = true;
    return moderationResponse(false);
  });
  try {
    const v = await checkTutorOutput('Hola, me llamo Maya.', { language: 'es', apiKey: 'sk-test' });
    assertEquals(v.source, 'both');
    assertEquals(v.safe, true);
    assert(called, 'moderation must run regardless of language');
  } finally {
    restoreFetch();
  }
});

Deno.test('the deterministic pass rejects immediately without a credential', async () => {
  const v = await checkTutorOutput('what the fuck', { language: 'en', apiKey: null });
  assertEquals(v.safe, false);
  assertEquals(v.source, 'regex');
  assert(v.flags.length > 0);
});

Deno.test('non-Latin text is checked by BOTH passes', async () => {
  stubFetch((url) => {
    assertEquals(url, 'https://api.openai.com/v1/moderations');
    return moderationResponse(false);
  });
  try {
    const v = await checkTutorOutput('こんにちは、元気ですか。', { language: 'ja', apiKey: 'sk-test' });
    assertEquals(v.source, 'both');
    assertEquals(v.safe, true);
  } finally {
    restoreFetch();
  }
});

Deno.test('moderation can flag text the regex is blind to', async () => {
  // The whole reason this pass exists: the regex returns safe, the classifier
  // does not, and the classifier must win.
  stubFetch(() => moderationResponse(true, { violence: true, 'self-harm': false }));
  try {
    const v = await checkTutorOutput('これは日本語のテキストです。', { language: 'ja', apiKey: 'sk-test' });
    assertEquals(v.safe, false);
    assertEquals(v.source, 'moderation');
    assert(v.flags.includes('moderation:violence'));
  } finally {
    restoreFetch();
  }
});

Deno.test('a moderation OUTAGE degrades, it does not mute the tutor', async () => {
  // Fail-open, deliberately. Treating an unreachable classifier as a flag would
  // cut every tutor turn mid-sentence for the duration of an OpenAI incident —
  // a broken product, not a safer one. The degradation is recorded
  // rather than hidden.
  for (const failure of [
    () => new Response('upstream exploded', { status: 500 }),
    () => { throw new Error('network down'); },
    () => new Response('{}', { status: 200 }), // 200 with no results array
  ]) {
    stubFetch(failure as () => Response);
    try {
      const v = await checkTutorOutput('こんにちは。', { language: 'ja', apiKey: 'sk-test' });
      assertEquals(v.safe, true);
      assertEquals(v.source, 'regex_only_degraded');
    } finally {
      restoreFetch();
    }
  }
});

Deno.test('a missing API key degrades rather than throwing', async () => {
  const v = await checkTutorOutput('안녕하세요.', { language: 'ko', apiKey: null });
  assertEquals(v.source, 'regex_only_degraded');
  assertEquals(v.safe, true);
});

Deno.test('a deterministic flag rejects before attempting provider moderation', async () => {
  let called = false;
  stubFetch(() => {
    called = true;
    throw new Error('down');
  });
  try {
    const v = await checkTutorOutput('fuck this', { language: 'ru', apiKey: 'sk-test' });
    assertEquals(v.safe, false);
    assertEquals(v.source, 'regex');
    assert(v.flags.length > 0);
    assertEquals(called, false);
  } finally {
    restoreFetch();
  }
});

Deno.test('a session ends after three cuts, not on the first', () => {
  // One cut is a bad sentence; three is a tutor that is not going to recover.
  assertEquals(TUTOR_MAX_SAFETY_CUTS, 3);
});
