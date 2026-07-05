// Deno tests for analyze-turn's pure helpers (analysis.ts).
// Run with: deno test --allow-read --allow-env supabase/functions/analyze-turn
//
// No network: the Anthropic call is stubbed via the injected callApi function.

import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { analyzeTurnWithRetry, parseTurnAnalysis } from './analysis.ts';

const noopLog = () => {};

// ─── parseTurnAnalysis ───────────────────────────────────────────────

Deno.test('parseTurnAnalysis: valid analysis with correction', () => {
  const parsed = parseTurnAnalysis(
    '{"correction": "Use \\"estoy\\" not \\"soy\\" here.", "vocabularyHighlights": ["cansado"]}',
  );
  assert(parsed !== null);
  assertEquals(parsed.correction, 'Use "estoy" not "soy" here.');
  assertEquals(parsed.vocabularyHighlights, ['cansado']);
});

Deno.test('parseTurnAnalysis: null correction is a valid "nothing to flag" result', () => {
  const parsed = parseTurnAnalysis('{"correction": null, "vocabularyHighlights": []}');
  assert(parsed !== null);
  assertEquals(parsed.correction, null);
  assertEquals(parsed.vocabularyHighlights, []);
});

Deno.test('parseTurnAnalysis: strips code fences and filters non-string vocab', () => {
  const parsed = parseTurnAnalysis(
    '```json\n{"correction": null, "vocabularyHighlights": ["uno", 2, null, "dos"]}\n```',
  );
  assert(parsed !== null);
  assertEquals(parsed.vocabularyHighlights, ['uno', 'dos']);
});

Deno.test('parseTurnAnalysis: unparseable or wrong-shaped output returns null', () => {
  assertEquals(parseTurnAnalysis('Sorry, I cannot analyze that.'), null);
  assertEquals(parseTurnAnalysis('["array"]'), null);
  assertEquals(parseTurnAnalysis('null'), null);
});

// ─── analyzeTurnWithRetry ────────────────────────────────────────────

Deno.test('analyzeTurnWithRetry: success on first attempt, no retry', async () => {
  let calls = 0;
  const result = await analyzeTurnWithRetry(() => {
    calls++;
    return Promise.resolve('{"correction": null, "vocabularyHighlights": ["hola"]}');
  }, noopLog);
  assertEquals(calls, 1);
  assert(result !== null);
  assertEquals(result.vocabularyHighlights, ['hola']);
});

Deno.test('analyzeTurnWithRetry: API failure retries once, then succeeds', async () => {
  let calls = 0;
  const result = await analyzeTurnWithRetry(() => {
    calls++;
    if (calls === 1) return Promise.reject(new Error('Anthropic API error: 529 - overloaded'));
    return Promise.resolve('{"correction": "Fix word order.", "vocabularyHighlights": []}');
  }, noopLog);
  assertEquals(calls, 2);
  assert(result !== null);
  assertEquals(result.correction, 'Fix word order.');
});

Deno.test('analyzeTurnWithRetry: persistent API failure returns null (degraded)', async () => {
  let calls = 0;
  const result = await analyzeTurnWithRetry(() => {
    calls++;
    return Promise.reject(new Error('Anthropic API error: 500 - boom'));
  }, noopLog);
  assertEquals(calls, 2);
  assertEquals(result, null);
});

Deno.test('analyzeTurnWithRetry: unparseable output twice returns null (degraded)', async () => {
  let calls = 0;
  const result = await analyzeTurnWithRetry(() => {
    calls++;
    return Promise.resolve('not json at all');
  }, noopLog);
  assertEquals(calls, 2);
  assertEquals(result, null);
});

// ─── unsafe correction text (user-visible AI output → content safety) ─

Deno.test('analyzeTurnWithRetry: unsafe correction twice returns null (degraded)', async () => {
  let calls = 0;
  const result = await analyzeTurnWithRetry(() => {
    calls++;
    return Promise.resolve(
      '{"correction": "Stop writing this fucking word wrong.", "vocabularyHighlights": []}',
    );
  }, noopLog);
  assertEquals(calls, 2);
  assertEquals(result, null);
});

Deno.test('analyzeTurnWithRetry: unsafe correction retries once, clean retry succeeds', async () => {
  let calls = 0;
  const result = await analyzeTurnWithRetry(() => {
    calls++;
    if (calls === 1) {
      return Promise.resolve(
        '{"correction": "this shit is wrong, use estar", "vocabularyHighlights": []}',
      );
    }
    return Promise.resolve(
      '{"correction": "Use \\"estar\\" for temporary states.", "vocabularyHighlights": []}',
    );
  }, noopLog);
  assertEquals(calls, 2);
  assert(result !== null);
  assertEquals(result.correction, 'Use "estar" for temporary states.');
});

Deno.test('analyzeTurnWithRetry: null correction skips the safety check and passes', async () => {
  let calls = 0;
  const result = await analyzeTurnWithRetry(() => {
    calls++;
    return Promise.resolve('{"correction": null, "vocabularyHighlights": ["gato"]}');
  }, noopLog);
  assertEquals(calls, 1);
  assert(result !== null);
  assertEquals(result.correction, null);
  assertEquals(result.vocabularyHighlights, ['gato']);
});
