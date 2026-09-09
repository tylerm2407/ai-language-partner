/**
 * Run work after the response has been sent.
 *
 * Supabase's edge runtime exposes EdgeRuntime.waitUntil to keep the instance
 * alive past the response. It is absent under plain `deno test`, so the
 * fallback just lets the promise run detached. Use it only for writes the
 * caller does not need to observe — a non-fatal audit row, a cache warm — never
 * for anything the response depends on.
 */
export function runInBackground(task: Promise<unknown>): void {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } })
    .EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(task);
}
