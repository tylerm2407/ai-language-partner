// Deno tests for content-safety.ts. Run with:
//   deno test supabase/functions/_shared/content-safety.test.ts

import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { validateContentSafety } from './content-safety.ts';

const offline = { moderation: 'skip' as const };

Deno.test('clean English text passes', async () => {
  const res = await validateContentSafety('Hello, how are you today?', {
    language: 'en',
    ...offline,
  });
  assertEquals(res.safe, true);
});

Deno.test('deterministic: profanity is rejected (English)', async () => {
  const res = await validateContentSafety('this is fucking great', {
    language: 'en',
    ...offline,
  });
  assertEquals(res.safe, false);
  assert(res.reasons.length > 0);
});

Deno.test('deterministic: Spanish profanity is rejected', async () => {
  const res = await validateContentSafety('qué mierda es esto', {
    language: 'es',
    ...offline,
  });
  assertEquals(res.safe, false);
});

Deno.test('deterministic: self-harm phrase is rejected', async () => {
  const res = await validateContentSafety('you should kill yourself', {
    language: 'en',
    ...offline,
  });
  assertEquals(res.safe, false);
});

Deno.test('deterministic: diacritic normalization catches accented variants', async () => {
  // "joder" appears with no accent; "jodér" (fake accent) should still match
  // after NFD normalization.
  const res = await validateContentSafety('no jodér con eso', {
    language: 'es',
    ...offline,
  });
  assertEquals(res.safe, false);
});

Deno.test('unknown age defaults to the minor-safe policy without blocking educational mentions', async () => {
  const educational = await validateContentSafety('We learned the word beer today.', {
    language: 'en',
    ...offline,
  });
  const unknownAge = await validateContentSafety("Let's gamble at a casino", {
    language: 'en',
    ...offline,
  });
  const adult = await validateContentSafety("Let's gamble at a casino", {
    language: 'en',
    userAge: 21,
    ...offline,
  });
  assertEquals(educational.safe, true);
  assertEquals(unknownAge.safe, false);
  assertEquals(adult.safe, true);
});

Deno.test('short tokens require word boundaries (no false positive)', async () => {
  // "cock" is in the list at length 4. "Scunthorpe-cockerel" types of false
  // positives are guarded against by the word-boundary regex.
  const res = await validateContentSafety('the peacock spread its tail', {
    language: 'en',
    ...offline,
  });
  // "peacock" contains "cock" but with non-boundary prefix → should be safe.
  assertEquals(res.safe, true);
});

Deno.test('multilingual threats are rejected locally in every supported non-English language', async () => {
  for (const [language, text] of [
    ['es', 'Te voy a matar.'],
    ['fr', 'Je vais te tuer.'],
    ['de', 'Ich werde dich töten.'],
    ['it', 'Ti ucciderò.'],
    ['pt', 'Vou te matar.'],
    ['ru', 'Я тебя убью.'],
    ['ja', 'あなたを殺す。'],
    ['ko', '너를 죽이겠어.'],
    ['zh', '我要杀你。'],
  ]) {
    const res = await validateContentSafety(text, { language, ...offline });
    assertEquals(res.safe, false, `${language} threat should be rejected`);
  }
});

Deno.test('educational discussion is not a deterministic violence false positive', async () => {
  const res = await validateContentSafety('We are studying suicide prevention.', {
    language: 'en',
    ...offline,
  });
  assertEquals(res.safe, true);
});

Deno.test('required moderation fails OPEN when its credential is unavailable', async () => {
  // Product decision 2026-09-11: an OpenAI outage must not turn every AI
  // feature into canned text. The deterministic pass still vouches for the
  // text and the verdict is marked degraded so the outage is countable.
  const res = await validateContentSafety('A clean generated sentence.', {
    language: 'en',
    moderation: 'required',
    moderationApiKey: null,
  });
  assertEquals(res, { safe: true, reasons: [], degraded: true });
});

Deno.test('required moderation fails OPEN when the provider errors', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (() => Promise.resolve(new Response('down', { status: 503 }))) as typeof fetch;
  try {
    const res = await validateContentSafety('A clean generated sentence.', {
      language: 'en',
      moderation: 'required',
      moderationApiKey: 'sk-test',
    });
    assertEquals(res, { safe: true, reasons: [], degraded: true });
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test('the deterministic pass still rejects even when moderation is down', async () => {
  const res = await validateContentSafety('kill yourself', {
    language: 'en',
    moderation: 'required',
    moderationApiKey: null,
  });
  assertEquals(res.safe, false);
});

Deno.test('minor policy: ordinary drinking is not alcohol', async () => {
  for (const text of ["Let's drink coffee.", 'You can drink water here.', 'Let us drink some tea.']) {
    const res = await validateContentSafety(text, { language: 'en', ...offline });
    assertEquals(res.safe, true, text);
  }
  const res = await validateContentSafety("Let's drink beer tonight.", { language: 'en', ...offline });
  assertEquals(res.safe, false);
});

Deno.test('Korean idiom stems are not death threats', async () => {
  const idiom = await validateContentSafety('배고파 죽어요.', { language: 'ko', ...offline });
  assertEquals(idiom.safe, true);
  const threat = await validateContentSafety('죽어라!', { language: 'ko', ...offline });
  assertEquals(threat.safe, false);
});

Deno.test('best-effort moderation reports degradation without rejecting user text', async () => {
  const res = await validateContentSafety('A clean user-authored sentence.', {
    language: 'en',
    moderation: 'best-effort',
    moderationApiKey: null,
  });
  assertEquals(res, { safe: true, reasons: [], degraded: true });
});

Deno.test('provider moderation categories are preserved and the supported model is requested', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    assertEquals(String(input), 'https://api.openai.com/v1/moderations');
    const request = JSON.parse(String(init?.body));
    assertEquals(request.model, 'omni-moderation-latest');
    assertEquals(request.input, 'nuanced generated output');
    return Promise.resolve(new Response(JSON.stringify({
      results: [{ flagged: true, categories: { violence: true, sexual: false } }],
    }), { status: 200 }));
  }) as typeof fetch;
  try {
    const res = await validateContentSafety('nuanced generated output', {
      moderation: 'required',
      moderationApiKey: 'sk-test',
    });
    assertEquals(res, { safe: false, reasons: ['moderation:violence'] });
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test('long generated content is moderated in full rather than silently truncated', async () => {
  const realFetch = globalThis.fetch;
  const longText = 'a'.repeat(20_001);
  globalThis.fetch = ((_input: string | URL | Request, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body));
    assert(Array.isArray(request.input));
    assertEquals(request.input.map((part: string) => part.length), [20_000, 1]);
    return Promise.resolve(new Response(JSON.stringify({
      results: [
        { flagged: false, categories: {} },
        { flagged: true, categories: { 'self-harm': true } },
      ],
    }), { status: 200 }));
  }) as typeof fetch;
  try {
    const res = await validateContentSafety(longText, {
      moderation: 'required',
      moderationApiKey: 'sk-test',
    });
    assertEquals(res, { safe: false, reasons: ['moderation:self-harm'] });
  } finally {
    globalThis.fetch = realFetch;
  }
});
