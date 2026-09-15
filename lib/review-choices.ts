/**
 * The review session as a multiple-choice drill.
 *
 * The review screen used to be a flip card: read the word, tap "Show Answer",
 * rate yourself Again/Hard/Good/Easy. Self-rating is honest in theory and
 * generous in practice — a learner who half-recognised a word taps Good, and
 * SM-2 schedules it as known. A choice among real alternatives is graded by
 * the pick, not by the learner's opinion of the pick.
 *
 * Three things live here, all pure so they are testable without a screen:
 *   - building the option list for a card from the learner's own deck;
 *   - turning a pick into an SM-2 rating;
 *   - the in-session queue, where a missed card comes back before the session
 *     ends but only its FIRST attempt is what the scheduler hears.
 */
import type { Card, ReviewRating } from '../types';

/** Correct + this many wrong answers, when the pool can supply them. */
export const CHOICE_DISTRACTOR_COUNT = 3;

/**
 * A correct pick under this is an Easy (5); at or over it, a Good (4).
 *
 * Lower than lib/grading.ts's 5s typing threshold on purpose: there is no
 * typing here. Four seconds is long enough to read four options and choose;
 * anything past that was recognition, not recall.
 */
export const CHOICE_FAST_MS = 4000;

/**
 * How many times one card is re-asked in a session before it is let go. The
 * card is already reset to tomorrow by its first miss; re-asking is drill,
 * and drilling a card the learner cannot get five times in a row is a wall,
 * not practice.
 */
export const CHOICE_MAX_REASKS = 3;

export type Rng = () => number;

function normalise(text: string): string {
  return text.trim().toLowerCase();
}

/** Fisher–Yates over a copy. `rng` is injectable so tests can pin the order. */
export function shuffle<T>(input: readonly T[], rng: Rng = Math.random): T[] {
  const out = [...input];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The options a card is shown with: its own translation plus up to three
 * translations of OTHER cards, shuffled.
 *
 * Distractors come from `pool` — the learner's own deck first, because those
 * are the words that actually compete in their head, and the caller tops the
 * pool up from the course when the deck is small. Cards in the same language
 * are preferred so a Spanish word is never offered a French card's meaning as
 * a wrong answer. Two pool cards that share a translation ("the bank" for two
 * senses of banco) count once, and any that share the correct card's
 * translation are dropped: a distractor that is also right is a trick, not a
 * question.
 *
 * With an empty pool the list is just the correct answer. The screen still
 * works — one option, trivially right — and that only happens to a learner
 * whose entire deck is one card and whose course fetch also failed.
 */
export function buildChoiceOptions(card: Card, pool: readonly Card[], rng: Rng = Math.random): string[] {
  const correct = card.nativeText;
  const taken = new Set<string>([normalise(correct)]);
  const sameLanguage: string[] = [];
  const other: string[] = [];

  for (const candidate of pool) {
    if (candidate.id === card.id) continue;
    const key = normalise(candidate.nativeText);
    if (!key || taken.has(key)) continue;
    taken.add(key);
    const sameLang = !card.language || !candidate.language || candidate.language === card.language;
    (sameLang ? sameLanguage : other).push(candidate.nativeText);
  }

  const distractors = [
    ...shuffle(sameLanguage, rng),
    ...shuffle(other, rng),
  ].slice(0, CHOICE_DISTRACTOR_COUNT);

  return shuffle([correct, ...distractors], rng);
}

/**
 * The SM-2 rating a pick earns. A miss is Again (1) — with the answer on the
 * screen among four options there is no "close"; SM-2 resets the card to
 * tomorrow either way (see calculateNextReview). A fast hit is Easy, a slow
 * hit is Good. Hard (3) is deliberately unreachable: a learner who narrows
 * four options to the right one after a long think has still recognised it,
 * and the slow-Good ease penalty (none) versus Hard's (−0.14) is the honest
 * cost of "I knew it, eventually".
 */
export function choiceRating(correct: boolean, responseTimeMs: number): ReviewRating {
  if (!correct) return 1;
  return responseTimeMs < CHOICE_FAST_MS ? 5 : 4;
}

/**
 * In-session state. `queue` is the ids still to be shown, front first; a
 * missed card goes to the back so it comes round again before the session
 * ends. `attempts` counts every showing, and only the first of them is a real
 * review — the caller checks `isFirstAttempt` before writing to SM-2. The
 * miss has already reset the card to tomorrow; getting it right on the second
 * pass is practice on the answer they just saw, and SM-2 must not hear it as
 * a recall.
 */
export interface ChoiceSession {
  queue: string[];
  attempts: Record<string, number>;
  /** Unique cards whose fate this session is settled: hit once, or given up on. */
  resolved: number;
  total: number;
}

export function createChoiceSession(ids: readonly string[]): ChoiceSession {
  return { queue: [...ids], attempts: {}, resolved: 0, total: ids.length };
}

/**
 * The item ids a session is dealt from: every loaded item whose card is also
 * loaded, in queue order. An item without a card (the card was deleted, or
 * the card fetch came back short) has nothing to show and is left out rather
 * than dealt as a blank; it stays due and comes round next time.
 */
export function sessionIds(
  items: readonly { id: string; cardId: string }[],
  cards: Readonly<Record<string, unknown>>,
): string[] {
  return items.filter((i) => cards[i.cardId] !== undefined).map((i) => i.id);
}

export function currentId(session: ChoiceSession): string | null {
  return session.queue[0] ?? null;
}

export function isFirstAttempt(session: ChoiceSession, id: string): boolean {
  return (session.attempts[id] ?? 0) === 0;
}

export function isComplete(session: ChoiceSession): boolean {
  return session.total > 0 && session.queue.length === 0;
}

/**
 * Record the outcome of the card at the front of the queue and advance.
 *
 * A hit retires the card. A miss re-queues it at the back unless it has
 * already been re-asked CHOICE_MAX_REASKS times, in which case it retires
 * too — resolved, not learned. With one card left a miss puts it straight
 * back at the front, which is the correct behaviour: there is nothing else
 * to interleave.
 */
export function applyChoiceResult(session: ChoiceSession, id: string, correct: boolean): ChoiceSession {
  if (session.queue[0] !== id) return session;
  const attempts = { ...session.attempts, [id]: (session.attempts[id] ?? 0) + 1 };
  const rest = session.queue.slice(1);
  const reasks = attempts[id] - 1;
  const retire = correct || reasks >= CHOICE_MAX_REASKS;
  return {
    queue: retire ? rest : [...rest, id],
    attempts,
    resolved: retire ? session.resolved + 1 : session.resolved,
    total: session.total,
  };
}
