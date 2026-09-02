/**
 * The provider calls, mirroring what the edge functions send, plus the
 * concurrency and retry policy that keeps a 4,000-item run from looking like
 * an attack.
 *
 * Every request body below is a deliberate copy of an edge function's, and
 * `providers.test.ts` pins each copied prompt and parameter against the edge
 * function's SOURCE TEXT. A prompt that drifts does not corrupt the cache — a
 * differently-worded hint is still a valid hint — but it does mean the warmed
 * content stops being what the app would have produced, which is a thing to
 * find in CI rather than in a learner's lesson.
 *
 * The API keys are read once by the caller and passed in. They are never
 * logged, never interpolated into an error message, and never written to disk.
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const FISH_URL = 'https://api.fish.audio/v1/tts';

/** Pinned to what translate / get-hint / explain-passage all pin. */
export const TEXT_MODEL = 'claude-haiku-4-5-20251001';

/** max_tokens, per edge function. Copied; asserted against source in tests. */
export const MAX_TOKENS = {
  translation: 300,
  hint: 80,
  explanation: 400,
} as const;

export interface HaikuUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface HaikuResult {
  text: string;
  usage: HaikuUsage;
}

interface AnthropicResponse {
  content?: { text?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
}

/**
 * One Anthropic Messages call, shaped exactly as the edge functions shape it —
 * raw fetch with `anthropic-version: 2023-06-01`, no SDK.
 *
 * The SDK is not used here on purpose. This script exists to write rows that
 * three Deno edge functions will read back, and those functions call the API
 * with `fetch` and a hand-built body. Reproducing that body literally is the
 * cheapest way to be sure the warmed content is what the runtime path would
 * have produced — and it keeps a dependency out of a repo that ships in an
 * app binary (CLAUDE.md §6).
 */
export async function callHaiku(opts: {
  apiKey: string;
  system: string;
  userMessage: string;
  maxTokens: number;
  signal?: AbortSignal;
}): Promise<HaikuResult> {
  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': opts.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: TEXT_MODEL,
      max_tokens: opts.maxTokens,
      system: opts.system,
      messages: [{ role: 'user', content: opts.userMessage }],
    }),
    signal: opts.signal,
  });

  if (!response.ok) {
    // The body can echo request content but never the key — the key is only
    // ever a header. Truncated so a large error page cannot flood the log.
    const detail = (await response.text()).slice(0, 300);
    throw new HttpError(`Anthropic ${response.status}: ${detail}`, response.status);
  }

  const data = (await response.json()) as AnthropicResponse;
  const text = (data.content?.[0]?.text ?? '').trim();
  if (!text) throw new Error('Anthropic returned an empty completion');

  return {
    text,
    usage: {
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
    },
  };
}

/** One fish.audio synthesis, shaped as supabase/functions/tts/index.ts shapes
 *  a lesson clip: model `s2-pro`, mp3, `latency: 'normal'`. */
export async function callFish(opts: {
  apiKey: string;
  referenceId: string;
  text: string;
  signal?: AbortSignal;
}): Promise<ArrayBuffer> {
  const response = await fetch(FISH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey}`,
      model: 's2-pro',
    },
    body: JSON.stringify({
      text: opts.text,
      reference_id: opts.referenceId,
      format: 'mp3',
      latency: 'normal',
    }),
    signal: opts.signal,
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new HttpError(`fish.audio ${response.status}: ${detail}`, response.status);
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength === 0) throw new Error('fish.audio returned empty audio');
  return buffer;
}

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** 429 and 5xx are worth another go; a 400 will be a 400 forever. */
export function isRetryable(err: unknown): boolean {
  if (err instanceof HttpError) return err.status === 429 || err.status >= 500;
  // Network-level failures (DNS, reset, timeout) carry no status.
  return err instanceof Error && !(err instanceof HttpError);
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retry with exponential backoff and jitter.
 *
 * Jitter is not decoration: with a fixed concurrency of N, a provider blip
 * fails all N in flight at once, and a deterministic backoff sends all N back
 * in the same millisecond — a self-inflicted thundering herd against a service
 * that has just told us it is unhappy.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; baseDelayMs?: number; onRetry?: (err: unknown, attempt: number) => void } = {},
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const base = opts.baseDelayMs ?? 1000;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === attempts || !isRetryable(err)) break;
      opts.onRetry?.(err, attempt);
      await sleep(base * 2 ** (attempt - 1) * (0.5 + Math.random()));
    }
  }
  throw lastError;
}

/**
 * Run `worker` over `items` with at most `limit` in flight.
 *
 * A worker never rejects the whole run: one bad row must not abandon the
 * 3,800 good ones, and every completed item is already durable in the cache,
 * so a failure is a thing to report and re-run rather than a thing to unwind.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<{ ok: R[]; failed: { item: T; error: unknown }[] }> {
  const ok: R[] = [];
  const failed: { item: T; error: unknown }[] = [];
  let cursor = 0;

  const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      try {
        ok.push(await worker(items[index], index));
      } catch (error) {
        failed.push({ item: items[index], error });
      }
    }
  });

  await Promise.all(runners);
  return { ok, failed };
}
