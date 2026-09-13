/**
 * The deferred `pronunciation_scores` write.
 *
 * This row is the ONLY thing that makes a spoken attempt count: the CEFR
 * report's speaking strand (`assessSpeaking` in lib/cefr-proficiency.ts) is
 * built from this table and nothing else, and the checkpoint reads its
 * speaking score back from here. A write that fails is not a missed
 * analytics event — it is a scored attempt the learner waited for and will
 * never get credit for.
 *
 * It runs AFTER the response has gone out (`runInBackground` in index.ts), so
 * nothing here can slow the learner down and nothing here may throw. That
 * leaves one lever: try again. A single retry after a short pause is enough
 * for the failure modes actually seen — a connection reset, a transient
 * pooler refusal — and cheap enough to be unconditional. Anything still
 * failing after that is logged at ERROR with the reason, so a run of them is
 * visible in the function logs as what it is: evidence being lost.
 *
 * The log line carries no PII. Not the user id, not the transcription, not
 * the expected text — the reason and the provenance are enough to act on.
 *
 * Split out of index.ts so it can be exercised without standing up serve().
 */

export const PERSIST_RETRY_DELAY_MS = 400;

// deno-lint-ignore no-explicit-any
type Client = any;

export interface PersistDeps {
  /** Injected so the test does not have to wait. */
  delay?: (ms: number) => Promise<void>;
}

const realDelay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** One insert. Resolves to the failure reason, or null on success. Never throws. */
async function tryInsert(supabase: Client, row: Record<string, unknown>): Promise<string | null> {
  try {
    const { error } = await supabase.from('pronunciation_scores').insert(row);
    return error ? String(error.message ?? 'insert error') : null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

/**
 * Write the attempt, retrying once. Resolves `true` when a row landed.
 */
export async function persistAttempt(
  supabase: Client,
  row: Record<string, unknown>,
  deps: PersistDeps = {},
): Promise<boolean> {
  const first = await tryInsert(supabase, row);
  if (first === null) return true;

  await (deps.delay ?? realDelay)(PERSIST_RETRY_DELAY_MS);

  const second = await tryInsert(supabase, row);
  if (second === null) {
    console.warn(
      `[score-pronunciation] pronunciation_scores write landed on retry (first attempt: ${first})`,
    );
    return true;
  }

  console.error(JSON.stringify({
    evt: 'pronunciation_persist_failed',
    fn: 'score-pronunciation',
    source: row.source ?? null,
    attempts: 2,
    reason: second.slice(0, 300),
    ts: new Date().toISOString(),
  }));
  return false;
}
