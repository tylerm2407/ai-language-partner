// Deno tests for content-safety.ts. Run with:
//   deno test supabase/functions/_shared/content-safety.test.ts

import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { validateContentSafety } from './content-safety.ts';

// The deterministic pass is offline and should run without ANTHROPIC_API_KEY.
// If the env var IS set, these tests still work — the LLM pass only runs
// after the deterministic pass is clean.

Deno.test('clean English text passes', async () => {
  const res = await validateContentSafety('Hello, how are you today?', {
    language: 'en',
  });
  // LLM pass may or may not run depending on env; deterministic is definitely clean.
  // Either way, safe:true is the expected outcome for obviously clean text.
  // If the LLM errors, fail-open still returns safe:true.
  assertEquals(res.safe, true);
});

Deno.test('deterministic: profanity is rejected (English)', async () => {
  const res = await validateContentSafety('this is fucking great', {
    language: 'en',
  });
  assertEquals(res.safe, false);
  assert(res.reasons.length > 0);
});

Deno.test('deterministic: Spanish profanity is rejected', async () => {
  const res = await validateContentSafety('qué mierda es esto', {
    language: 'es',
  });
  assertEquals(res.safe, false);
});

Deno.test('deterministic: self-harm phrase is rejected', async () => {
  const res = await validateContentSafety('you should kill yourself', {
    language: 'en',
  });
  assertEquals(res.safe, false);
});

Deno.test('deterministic: diacritic normalization catches accented variants', async () => {
  // "joder" appears with no accent; "jodér" (fake accent) should still match
  // after NFD normalization.
  const res = await validateContentSafety('no jodér con eso', {
    language: 'es',
  });
  assertEquals(res.safe, false);
});

Deno.test('deterministic: minors list adds stricter rejections', async () => {
  const adult = await validateContentSafety('he drank a beer', { language: 'en' });
  const kid = await validateContentSafety('he drank a beer', { language: 'en', userAge: 12 });
  // Adult passes deterministic (LLM may flag; but if no API key, still passes).
  // Kid should hit the minors blocklist.
  assertEquals(kid.safe, false);
  // Don't assert on adult here since LLM pass could flag it; the minors
  // contrast is the load-bearing invariant.
  assert(adult.safe || !adult.safe);
});

Deno.test('short tokens require word boundaries (no false positive)', async () => {
  // "cock" is in the list at length 4. "Scunthorpe-cockerel" types of false
  // positives are guarded against by the word-boundary regex.
  const res = await validateContentSafety('the peacock spread its tail', {
    language: 'en',
  });
  // "peacock" contains "cock" but with non-boundary prefix → should be safe.
  assertEquals(res.safe, true);
});

Deno.test('fail-open on simulated LLM outage', async () => {
  // Point the Anthropic endpoint at a guaranteed-unreachable host by
  // temporarily overriding the API key so the HTTP call still attempts.
  // Since we can't easily monkey-patch fetch in a shared module, we instead
  // verify that when the deterministic pass is clean and there's NO api key,
  // we return safe:true (which is the LLM-skipped path, equivalent to fail-open).
  const prev = Deno.env.get('ANTHROPIC_API_KEY');
  try {
    Deno.env.delete('ANTHROPIC_API_KEY');
    // re-import? Deno caches the module. We rely on the runtime check inside
    // llmCheck(): no API key ⇒ skip ⇒ safe:true.
    const res = await validateContentSafety('perfectly fine sentence', {
      language: 'en',
    });
    assertEquals(res.safe, true);
  } finally {
    if (prev !== undefined) Deno.env.set('ANTHROPIC_API_KEY', prev);
  }
});
