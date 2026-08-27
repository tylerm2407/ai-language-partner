import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Copy .env.example to .env and fill in your values.'
  );
}

// Diagnostic: prints the key FORMAT (not the full secret) so we can confirm
// the runtime actually has the new publishable key. Expect "sb_publishable_…"
// or legacy-JWT prefix "eyJhbGc…". If it shows "eyJ…", Metro is still on a
// stale bundle or an EAS dev-client is shadowing .env.
if (__DEV__) {
  const keyPrefix = supabaseAnonKey.slice(0, 20);
  const keyFormat = supabaseAnonKey.startsWith('sb_publishable_')
    ? 'NEW publishable'
    : supabaseAnonKey.startsWith('eyJ')
      ? 'LEGACY JWT'
      : 'unknown';
  console.log(`[supabase] URL: ${supabaseUrl}`);
  console.log(`[supabase] anon key format: ${keyFormat} (prefix: ${keyPrefix}…)`);
}

/**
 * How long a request may hang before it is abandoned.
 *
 * There was no timeout anywhere in the client — no `AbortController`, and no
 * `global.fetch` passed to `createClient`. On a lie-fi network (connected, no
 * throughput) a request never settles and never rejects, so the cold-start
 * loader spun forever with no cancel and no retry, and the same shape applied
 * to lesson load, chat send and writing grade.
 *
 * Two budgets: ordinary reads and writes should be quick, while an edge
 * function that calls a model legitimately takes tens of seconds.
 */
export const REQUEST_TIMEOUT_MS = 15_000;
export const AI_REQUEST_TIMEOUT_MS = 60_000;

/** `/functions/v1/...` — the AI surface, which is allowed to be slow. */
function isEdgeFunctionCall(url: string): boolean {
  return url.includes('/functions/v1/');
}

/**
 * `fetch` with a deadline.
 *
 * Aborting produces an `AbortError`, which `isNetworkError` in
 * `lib/offline-queue.ts` already treats as network-shaped — so a timed-out
 * write is queued for replay rather than lost, with no extra plumbing.
 *
 * A caller-supplied signal is respected as well as the deadline: whichever
 * fires first wins.
 */
const fetchWithTimeout: typeof fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const budget = isEdgeFunctionCall(url) ? AI_REQUEST_TIMEOUT_MS : REQUEST_TIMEOUT_MS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), budget);

  const callerSignal = init?.signal;
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timer);
  });
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // not needed for mobile
  },
  global: { fetch: fetchWithTimeout },
});
