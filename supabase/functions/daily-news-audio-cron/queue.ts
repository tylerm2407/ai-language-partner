// Render-queue selection and outcome accounting for daily-news-audio-cron.
//
// Pure, no I/O, `deno test`-able — split out from index.ts following the
// score-pronunciation/scoring.ts precedent, so the one property that makes
// this cron trustworthy can actually be asserted.
//
// ── The property ──
//
// EVERY row the queue query returns must reach exactly ONE terminal outcome,
// and the counters must add up to the number of rows that went in.
//
// This is not bookkeeping fussiness. A news article that silently falls out
// of the queue is not a visible failure — it is an article that is simply
// never narrated, with nothing anywhere reporting it. The cron returns 200,
// the counters look plausible, and one language quietly has no podcast that
// day. `reconcile()` below exists so that state is impossible to ship: if
// the numbers do not balance, the run says so loudly in its own response.

/** The queue-relevant fields of a `daily_news` row. Deliberately narrower
 *  than the row the renderer needs — selection must not depend on article
 *  text, so it can be tested without fabricating one. */
export interface QueueCandidate {
  id: string;
  language: string;
  audio_status: string | null;
  audio_generated_at: string | null;
}

/** Why a candidate was not attempted. Reported per row so a skip is always
 *  explainable — "skipped: 3" with no reasons is how a silent drop hides. */
export type SkipReason =
  | 'language-inactive'
  | 'claim-held-by-another-runner';

export interface SkippedCandidate {
  id: string;
  language: string;
  reason: SkipReason;
}

export interface QueuePlan {
  /** Rows to attempt a claim on. */
  attempt: QueueCandidate[];
  /** Rows deliberately not attempted, each with a reason. */
  skipped: SkippedCandidate[];
}

/**
 * Decide which queued rows this run will try to render.
 *
 * Two reasons to pass a row over, and both are recorded rather than silently
 * dropped:
 *
 * 1. No active learner of that language. Rendering 18 articles a day when
 *    two will ever be heard is most of the cost of this feature for none of
 *    the value.
 * 2. A FRESH `generating` claim belongs to somebody else — the 09:20 fire,
 *    or a listener who got there first through the lazy path. A stale one is
 *    a render that died, and is fair game.
 *
 * The staleness check here is only a pre-filter, to avoid attempting claims
 * we can already see we would lose. `claim_news_audio` re-checks it under the
 * row lock and remains the authority.
 *
 * Total is conserved: `attempt.length + skipped.length === candidates.length`,
 * always. That is asserted in queue.test.ts.
 */
export function planQueue(
  candidates: QueueCandidate[],
  activeLanguages: ReadonlySet<string>,
  staleBefore: string,
): QueuePlan {
  const attempt: QueueCandidate[] = [];
  const skipped: SkippedCandidate[] = [];

  for (const row of candidates) {
    if (!activeLanguages.has(row.language)) {
      skipped.push({ id: row.id, language: row.language, reason: 'language-inactive' });
      continue;
    }
    if (row.audio_status === 'generating') {
      const isStale = !row.audio_generated_at || row.audio_generated_at < staleBefore;
      if (!isStale) {
        skipped.push({
          id: row.id,
          language: row.language,
          reason: 'claim-held-by-another-runner',
        });
        continue;
      }
    }
    attempt.push(row);
  }

  return { attempt, skipped };
}

export interface RunCounters {
  /** Rows the queue query returned — the number every outcome must sum to. */
  queued: number;
  rendered: number;
  skipped: number;
  failed: number;
}

export interface Reconciliation {
  balanced: boolean;
  /** queued − (rendered + skipped + failed). Non-zero means rows vanished
   *  (positive) or were counted twice (negative). */
  unaccounted: number;
}

/**
 * Check that every queued row reached exactly one terminal outcome.
 *
 * Returned in the cron's own response rather than merely logged, because the
 * failure this guards against is invisible by construction: the run succeeds,
 * the counters look reasonable in isolation, and the only evidence is a
 * subtraction nobody performed. Putting `queued` and `unaccounted` in the
 * response body means the next person to fire this by hand sees it without
 * having to know to look.
 */
export function reconcile(counters: RunCounters): Reconciliation {
  const accounted = counters.rendered + counters.skipped + counters.failed;
  const unaccounted = counters.queued - accounted;
  return { balanced: unaccounted === 0, unaccounted };
}
