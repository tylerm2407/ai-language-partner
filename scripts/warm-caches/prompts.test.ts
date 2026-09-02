/**
 * The prompts and request parameters this script copies out of edge-function
 * modules Node cannot import are pinned here against those modules' SOURCE
 * TEXT.
 *
 * A drifted prompt is a milder failure than a drifted key — the row is still
 * readable, it just no longer says what the app would have said — but it is
 * the kind of drift nobody notices for months. Reading the source is the same
 * technique supabase/functions/tts/tts.test.ts already uses on the same file.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

import { buildHintUserMessage, buildTranslateSystemPrompt, HINT_SYSTEM_PROMPT } from './prompts';
import { buildExplainSystemPrompt } from './keys';
import { MAX_TOKENS, TEXT_MODEL } from './providers';
import { isRetryable, HttpError, mapWithConcurrency, withRetry } from './providers';

const FUNCTIONS = resolve(__dirname, '..', '..', 'supabase', 'functions');
const source = (relative: string): string => readFileSync(resolve(FUNCTIONS, relative), 'utf-8');

describe('model and token ceilings match the edge functions', () => {
  it('pins the same Haiku snapshot all three text functions pin', () => {
    expect(TEXT_MODEL).toBe('claude-haiku-4-5-20251001');
    for (const fn of ['translate/index.ts', 'get-hint/index.ts', 'explain-passage/index.ts']) {
      expect(source(fn)).toContain(`const TEXT_MODEL = '${TEXT_MODEL}';`);
    }
  });

  it('pins each function’s max_tokens', () => {
    expect(source('translate/index.ts')).toContain(`max_tokens: ${MAX_TOKENS.translation},`);
    expect(source('get-hint/index.ts')).toContain(`max_tokens: ${MAX_TOKENS.hint},`);
    expect(source('explain-passage/index.ts')).toContain(
      `const MAX_OUTPUT_TOKENS = ${MAX_TOKENS.explanation};`,
    );
  });
});

describe('translate system prompt', () => {
  it('is byte-identical to the one in translate/index.ts', () => {
    const built = buildTranslateSystemPrompt('${sourceLanguage}', '${targetLanguage}');
    expect(source('translate/index.ts')).toContain(built);
  });

  it('interpolates the direction it was given', () => {
    const prompt = buildTranslateSystemPrompt('Spanish', 'English');
    expect(prompt).toContain('from Spanish into English');
  });
});

describe('hint prompt', () => {
  it('uses the un-personalised base prompt, which is what hint_cache holds', () => {
    const index = source('get-hint/index.ts');
    expect(index).toContain(HINT_SYSTEM_PROMPT);
    // The personalisation clause exists in the function but must never be used
    // for a cached hint: hint_cache has no user dimension.
    expect(index).toContain('<LEARNER_PROFILE>');
    expect(HINT_SYSTEM_PROMPT).not.toContain('LEARNER_PROFILE');
  });

  it('builds the user message in the field order the function uses', () => {
    const message = buildHintUserMessage(
      { target_text: 'perro', native_text: 'dog', part_of_speech: 'noun', example_sentence: 'El perro corre.' },
      'listening_type',
      'es',
    );
    expect(message.split('\n')).toEqual([
      'Exercise type: listening_type',
      'Target language: es',
      'Native text: dog',
      'Target text: perro',
      'Part of speech: noun',
      'Example sentence: El perro corre.',
    ]);
  });

  it('omits the optional lines when the card has none, as the function does', () => {
    const message = buildHintUserMessage(
      { target_text: 'perro', native_text: 'dog', part_of_speech: null, example_sentence: null },
      'speaking',
      'es',
    );
    expect(message.split('\n')).toHaveLength(4);
  });

  it('keeps the labels the function writes', () => {
    const index = source('get-hint/index.ts');
    for (const label of [
      '`Exercise type: ${exerciseType}`',
      '`Target language: ${targetLanguage}`',
      '`Native text: ${nativeText}`',
      '`Target text: ${targetText}`',
    ]) {
      expect(index).toContain(label);
    }
  });
});

describe('explain prompt', () => {
  it('is the real builder, imported rather than copied', () => {
    const prompt = buildExplainSystemPrompt('es', 'en', 'B1');
    expect(prompt).toContain('You help a B1 learner of es understand one paragraph');
    expect(source('explain-passage/index.ts')).toContain(
      'buildExplainSystemPrompt(language, nativeLanguage, cefrLevel)',
    );
  });
});

describe('retry policy', () => {
  it('retries a 429 and a 500 but never a 400', () => {
    expect(isRetryable(new HttpError('rate limited', 429))).toBe(true);
    expect(isRetryable(new HttpError('server', 503))).toBe(true);
    expect(isRetryable(new HttpError('bad request', 400))).toBe(false);
    expect(isRetryable(new HttpError('not found', 404))).toBe(false);
  });

  it('treats a network failure with no status as retryable', () => {
    expect(isRetryable(new Error('ECONNRESET'))).toBe(true);
  });

  it('gives up immediately on a non-retryable error', async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw new HttpError('bad request', 400);
        },
        { attempts: 3, baseDelayMs: 1 },
      ),
    ).rejects.toThrow('bad request');
    expect(calls).toBe(1);
  });

  it('succeeds on a later attempt after a retryable failure', async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw new HttpError('rate limited', 429);
        return 'ok';
      },
      { attempts: 3, baseDelayMs: 1 },
    );
    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });
});

describe('mapWithConcurrency', () => {
  it('never exceeds the limit', async () => {
    let inFlight = 0;
    let peak = 0;
    await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7, 8], 3, async (n) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight--;
      return n;
    });
    expect(peak).toBeLessThanOrEqual(3);
  });

  it('processes every item exactly once', async () => {
    const items = [1, 2, 3, 4, 5];
    const { ok } = await mapWithConcurrency(items, 2, async (n) => n * 2);
    expect(ok.sort((a, b) => a - b)).toEqual([2, 4, 6, 8, 10]);
  });

  it('lets one failure be reported without abandoning the rest', async () => {
    const { ok, failed } = await mapWithConcurrency([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error('boom');
      return n;
    });
    expect(ok.sort()).toEqual([1, 3]);
    expect(failed).toHaveLength(1);
    expect(failed[0].item).toBe(2);
  });
});
