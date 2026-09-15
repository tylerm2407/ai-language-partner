/**
 * Where a live tutor session's transcript accumulates while it is happening.
 *
 * WHY REDIS, BY THIS REPO'S OWN TEST
 *
 * CLAUDE.md's rule for what belongs in Redis is "only state you would be
 * willing to lose". A transcript-in-progress qualifies exactly: losing it costs
 * one session's SRS cards and one debrief, never a learning record. Everything
 * with durable meaning — the corrections, the evidence rows, the cards, the
 * memory notes — is written to Postgres at the END of the session, out of this
 * buffer. Every key gets a TTL, as the rule requires.
 *
 * WHY THE SERVER HOLDS IT AT ALL, RATHER THAN THE CLIENT POSTING IT AT THE END
 *
 * Because the client would then be the author of its own learning record. SRS
 * cards cost a metered `chat_cards` slot and appear in tomorrow's review queue;
 * a client that could post an arbitrary end-of-session transcript could mint
 * vocabulary it never encountered. Accumulating server-side, one guarded turn at
 * a time, means the transcript we analyse is the one we actually observed.
 *
 * THE FAILURE MODE THIS CREATES, AND THE FALLBACK
 *
 * Redis fails open everywhere else in this codebase, and correctly. Here an
 * outage is more serious than usual: the `end` action reads this same buffer, so
 * losing Redis costs the write-back on EVERY session, not merely on abandoned
 * ones. `readTranscript` therefore reports whether it actually had a buffer, and
 * callers are expected to fall back to a client-supplied transcript marked as
 * untrusted — writing evidence and the debrief from it, but NOT cards, because
 * cards are the only part with quota value worth farming.
 */
import { isRedisConfigured, redisGet, redisSetEx, redisDel } from './redis.ts';

export interface BufferedTurn {
  speaker: 'learner' | 'tutor';
  text: string;
  recognizerConfidence?: number;
}

/**
 * Hard ceilings on what one session may accumulate.
 *
 * A twenty-minute conversation is perhaps 120 turns. 400 is generous headroom;
 * past it something is wrong and the buffer stops growing rather than becoming
 * an unbounded write amplifier against a paid Redis plan.
 */
export const MAX_BUFFERED_TURNS = 400;
export const MAX_TURN_CHARS = 400;

/** Two hours past the session's own grant. Long enough that the reaper can
 *  still recover an abandoned session, short enough that nothing lingers. */
export const BUFFER_GRACE_SECONDS = 7200;

function key(sessionId: string): string {
  return `tutor:tx:${sessionId}`;
}

export interface TranscriptRead {
  turns: BufferedTurn[];
  /**
   * False when Redis is unconfigured, unreachable, or the key has expired.
   *
   * Deliberately distinct from `turns.length === 0`: a session where the
   * learner genuinely said nothing and a session whose buffer we lost need
   * different handling, and conflating them would silently turn an outage into
   * "the learner had a quiet session".
   */
  available: boolean;
}

/**
 * Append one exchange. Never throws — a failed append costs one turn of the
 * eventual analysis, and throwing here would fail the client's heartbeat and
 * take down a working conversation over a bookkeeping problem.
 */
export async function appendTurns(
  sessionId: string,
  turns: BufferedTurn[],
  ttlSeconds: number,
): Promise<boolean> {
  if (!isRedisConfigured() || turns.length === 0) return false;
  try {
    const existing = await readTranscript(sessionId);
    const merged = existing.turns.concat(
      turns
        .filter((t) => typeof t?.text === 'string' && t.text.trim().length > 0)
        .map((t) => ({
          speaker: t.speaker === 'tutor' ? ('tutor' as const) : ('learner' as const),
          text: t.text.trim().slice(0, MAX_TURN_CHARS),
          ...(typeof t.recognizerConfidence === 'number'
            ? { recognizerConfidence: t.recognizerConfidence }
            : {}),
        })),
    );
    // Drop from the FRONT when over the cap. The end of a conversation is what
    // the debrief's "what to try next time" is drawn from, so the tail is the
    // half worth keeping.
    const capped = merged.slice(-MAX_BUFFERED_TURNS);
    await redisSetEx(key(sessionId), JSON.stringify(capped), Math.max(60, Math.ceil(ttlSeconds)));
    return true;
  } catch (err) {
    console.warn('[tutor-transcript-buffer] append failed:', err instanceof Error ? err.message : err);
    return false;
  }
}

/** Read the accumulated transcript. Never throws. */
export async function readTranscript(sessionId: string): Promise<TranscriptRead> {
  if (!isRedisConfigured()) return { turns: [], available: false };
  try {
    const raw = await redisGet(key(sessionId));
    if (raw === null) return { turns: [], available: false };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { turns: [], available: false };
    const turns: BufferedTurn[] = [];
    for (const item of parsed) {
      if (!item || typeof item.text !== 'string') continue;
      turns.push({
        speaker: item.speaker === 'tutor' ? 'tutor' : 'learner',
        text: item.text,
        ...(typeof item.recognizerConfidence === 'number'
          ? { recognizerConfidence: item.recognizerConfidence }
          : {}),
      });
    }
    return { turns, available: true };
  } catch (err) {
    console.warn('[tutor-transcript-buffer] read failed:', err instanceof Error ? err.message : err);
    return { turns: [], available: false };
  }
}

/** Drop the buffer once it has been analysed. Never throws — the TTL is the
 *  real guarantee here, this is just tidiness. */
export async function dropTranscript(sessionId: string): Promise<void> {
  if (!isRedisConfigured()) return;
  try {
    await redisDel(key(sessionId));
  } catch {
    // The TTL will collect it. Nothing here is worth failing a session over.
  }
}
