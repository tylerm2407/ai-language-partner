/**
 * The decisions behind the checkpoint screen.
 *
 * ── WHAT A CHECKPOINT IS FOR, RIGHT NOW ──
 *
 * A voluntary five-minute check: four strands, fresh items the learner has not
 * seen, graded on the server. It is NOT what publishes their CEFR band — that
 * is still `buildProficiencyReport`, estimated from practice history. Taking a
 * checkpoint changes which cohort board they sit on and nothing else.
 *
 * That separation is deliberate and the UI has to say so plainly. The case for
 * eventually letting a checkpoint gate promotion is real — a weighted blend of
 * work already done is compensatory and accumulative, where a test is neither —
 * but it is a decision to make against data, and there is none yet: no learner
 * has ever taken one. Wiring it as a gate first would mean betting the most
 * visible number in the app on an instrument with zero attempts behind it.
 *
 * So this ships as a measurement people can choose to take, the report keeps
 * publishing from practice, and the two numbers can be compared. If they agree,
 * gating adds ceremony. If they diverge, that is worth knowing before the blend
 * is trusted any further.
 *
 * ── WHY THE LOGIC IS HERE AND NOT IN THE SCREEN ──
 *
 * Project rule (CLAUDE.md §6): screens render, `lib/` decides. Everything below
 * is pure and has no React in it, so the order items are asked in, what counts
 * as answered, and when a submission is allowed are all testable without
 * mounting anything.
 */
import type { CheckpointItem, CheckpointResult } from './ai';

export type CheckpointStrand = CheckpointItem['strand'];

/**
 * Every strand the RESULT reports, which is the four item strands plus the
 * spoken conversation.
 *
 * Interaction is not a `CheckpointStrand` because it is not an item: it has no
 * prompt to answer, no rung to sit on, and its score comes from what the
 * learner produced rather than from matching a key. Keeping the two types
 * apart is what stops a conversation being looked for in the item list.
 */
export type CheckpointScoreStrand = CheckpointStrand | 'interaction';

/**
 * Result rows, conversation first.
 *
 * Deliberately not the order the test asks in. This mirrors
 * `nextLevelSteps` in the report, which leads with conversation because that
 * is where the work pays — interaction is 0.55 of the level and the other four
 * strands together are 0.33. A learner reading their result should meet the
 * heaviest number first.
 */
export const CHECKPOINT_SCORE_ORDER: CheckpointScoreStrand[] = [
  'interaction',
  'listening',
  'reading',
  'writing',
  'speaking',
];

/**
 * The order strands are asked in.
 *
 * Receptive before productive, which is the order every lesson already uses,
 * and speaking LAST for a specific reason: it is the only strand that can fail
 * for reasons that have nothing to do with the learner — a denied microphone
 * permission, a noisy room, a recording that will not start. Asking it last
 * means such a failure costs the strand rather than the checkpoint, and
 * `composite` excludes a skipped strand instead of scoring it zero.
 */
export const CHECKPOINT_STRAND_ORDER: CheckpointStrand[] = [
  'listening',
  'reading',
  'writing',
  'speaking',
];

/**
 * Items in the order they will be asked: strand by strand, easiest rung first.
 *
 * The band sort is what the staircase added. An attempt now carries two or
 * three items per strand, one per rung, and the server sends them grouped by
 * strand but a learner should meet the easier one first — a B2 question before
 * the A2 one reads as the test being broken, and answering downhill is a worse
 * measurement because a hard opener makes people give up on the strand.
 *
 * Ties are left alone: the server chose the rotation within a rung
 * (`selectAdaptiveItems`) and reordering inside it would discard that choice.
 * A strand the server did not send simply does not appear.
 */
export function orderCheckpointItems(items: CheckpointItem[]): CheckpointItem[] {
  const rank = new Map(CHECKPOINT_STRAND_ORDER.map((s, i) => [s, i]));
  const bandRank = (band: string) => {
    const i = CHECKPOINT_BAND_ORDER.indexOf(band);
    return i < 0 ? 99 : i;
  };
  return [...items].sort((a, b) => {
    const byStrand = (rank.get(a.strand) ?? 99) - (rank.get(b.strand) ?? 99);
    return byStrand !== 0 ? byStrand : bandRank(a.band) - bandRank(b.band);
  });
}

/**
 * Which rung this item is within its strand, as "2 of 3".
 *
 * The question caption used to read `Listening · 4` off the global index, which
 * with one item per strand happened to be the question number. With three
 * listening rungs in an attempt that number says nothing a learner can use,
 * and the per-strand position is what tells them how much of the strand is
 * left.
 */
export function checkpointRungLabel(
  item: CheckpointItem,
  items: CheckpointItem[],
): string {
  const inStrand = items.filter((i) => i.strand === item.strand);
  const position = inStrand.findIndex((i) => i.id === item.id) + 1;
  if (position === 0 || inStrand.length <= 1) return STRAND_LABELS[item.strand];
  return `${STRAND_LABELS[item.strand]} · ${position} of ${inStrand.length}`;
}

/**
 * Whether an item has an answer worth sending.
 *
 * Whitespace is not an answer. The server normalises before comparing, so a
 * spaces-only string would arrive, be normalised to empty, and score as wrong —
 * which reads to the learner as "I answered and got it wrong" rather than "I
 * left it blank".
 */
export function isCheckpointAnswered(
  item: CheckpointItem,
  answers: Record<string, string>,
): boolean {
  return (answers[item.id] ?? '').trim().length > 0;
}

export interface CheckpointProgress {
  answered: number;
  total: number;
  /** 0–1. Zero when there is nothing to answer, never NaN. */
  fraction: number;
}

export function checkpointProgress(
  items: CheckpointItem[],
  answers: Record<string, string>,
): CheckpointProgress {
  const answered = items.filter((i) => isCheckpointAnswered(i, answers)).length;
  return {
    answered,
    total: items.length,
    fraction: items.length > 0 ? answered / items.length : 0,
  };
}

/**
 * Strands with no answer at all — what the result will be missing.
 *
 * Named rather than counted because the result screen has to say which ones
 * were not measured. A composite over three strands is a different claim from
 * one over four, and a learner who skipped speaking should not read their
 * number as though it included it.
 */
export function skippedCheckpointStrands(
  items: CheckpointItem[],
  answers: Record<string, string>,
): CheckpointStrand[] {
  return CHECKPOINT_STRAND_ORDER.filter((strand) => {
    const inStrand = items.filter((i) => i.strand === strand);
    return inStrand.length > 0 && !inStrand.some((i) => isCheckpointAnswered(i, answers));
  });
}

/**
 * Whether a submission is worth making.
 *
 * One answered item is enough. Requiring all of them would turn a skipped
 * speaking strand into a lost checkpoint, and the server already handles the
 * partial case properly — `composite` averages the strands that were answered
 * and excludes the rest, precisely so a missing microphone does not read as an
 * inability to speak.
 */
export function canSubmitCheckpoint(
  items: CheckpointItem[],
  answers: Record<string, string>,
): boolean {
  return items.some((i) => isCheckpointAnswered(i, answers));
}

/** Answers stripped of the blanks, ready to send. */
export function checkpointSubmission(
  items: CheckpointItem[],
  answers: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const item of items) {
    const value = (answers[item.id] ?? '').trim();
    if (value) out[item.id] = value;
  }
  return out;
}

export const STRAND_LABELS: Record<CheckpointScoreStrand, string> = {
  listening: 'Listening',
  reading: 'Reading',
  writing: 'Writing',
  speaking: 'Speaking',
  // "Conversation", not "Interaction". The CEFR term names the strand in the
  // code; the learner-facing word is the one the rest of the app uses.
  interaction: 'Conversation',
};

export interface CheckpointScoreLine {
  strand: CheckpointScoreStrand;
  /** 0–100, rounded. Null when the strand was not measured. */
  percent: number | null;
}

/** Per-strand result rows, conversation first. See `CHECKPOINT_SCORE_ORDER`. */
export function checkpointScoreLines(result: CheckpointResult): CheckpointScoreLine[] {
  return CHECKPOINT_SCORE_ORDER.map((strand) => {
    const raw = result.scores[strand];
    return {
      strand,
      percent: typeof raw === 'number' && Number.isFinite(raw) ? Math.round(raw * 100) : null,
    };
  });
}

/**
 * Turns the conversation still owes before it counts as evidence.
 *
 * Mirrors `MIN_INTERACTION_TURNS_SCORED` on the server (3), and it is a
 * COUNT OF LEARNER REPLIES rather than of scored turns, because the client
 * cannot know which of its turns the server found long enough to score —
 * `scoreTurn` discards anything under four words and never tells the client.
 *
 * So this is a floor the UI uses to say "one more to go", not the verdict. A
 * learner who answers four times in single words will still see the strand come
 * back unmeasured, and the result screen has to be able to say so.
 */
export const MIN_INTERACTION_REPLIES = 3;

/**
 * Whether the conversation has run long enough to be worth submitting.
 *
 * Never a gate on finishing the test. The conversation is skippable in exactly
 * the way speaking is, and for a sharper version of the same reason: it is
 * spoken-only, so a denied microphone or a noisy room can end it through no
 * fault of the learner. An absent strand is excluded from the score; a strand
 * that blocked submission would turn a mic problem into a lost checkpoint.
 */
export function interactionIsEvidence(replies: number): boolean {
  return replies >= MIN_INTERACTION_REPLIES;
}

/**
 * What the result means, in one sentence.
 *
 * WHAT THE TEST NOW DOES TO THE REPORT
 *
 * It used to do nothing: the band came from practice history, full stop, and
 * this line was careful never to say "you are now B1". That was the right call
 * while the instrument was four questions at one band — see
 * `lib/cefr-proficiency.ts` and the checkpoint function header for the old
 * reasoning — but it left an unmeasured learner with no way to get a level at
 * all short of twelve days of conversation, which is the dead end this work
 * exists to close.
 *
 * So: the test publishes the level WHEN PRACTICE HAS NOT MEASURED ONE, and
 * never overrides one that practice has. `testPublishesLevel` is that rule, and
 * this line has to tell the learner which case they are in before they read the
 * band — a result that quietly did or did not become their level would be worse
 * than either behaviour on its own.
 *
 * @param publishes Whether this result becomes the level on the report. The
 *   caller knows, because it holds the report.
 */
export function checkpointOutcomeLine(result: CheckpointResult, publishes = false): string {
  if (result.composite === null) {
    return 'Nothing was scored this time, so your level is unchanged.';
  }
  const moved = result.band !== result.movedFrom;
  const up =
    CHECKPOINT_BAND_ORDER.indexOf(result.band) > CHECKPOINT_BAND_ORDER.indexOf(result.movedFrom);

  const measurement = !moved
    ? `This test agrees with ${result.movedFrom}.`
    : up
      ? `This test put you above ${result.movedFrom}, at ${result.band}.`
      : `This test put you below ${result.movedFrom}, at ${result.band}.`;

  return publishes
    ? `${measurement} Your report now shows ${result.band} — your practice history will take over once it has measured enough.`
    : `${measurement} Your report keeps the level measured from your practice.`;
}

/**
 * Does a test result become the level shown on the report?
 *
 * Only when practice has not measured one. The weighted six-strand estimate is
 * the better instrument when it can speak at all — it is built from weeks of
 * real work rather than five minutes of questions, and it weights live
 * conversation at 0.55, which the test does not measure at all. So the test
 * fills the gap and then stands down; it does not compete.
 *
 * Deliberately NOT "the higher of the two" and not "the newer of the two".
 * Either would let a learner pick their level by taking a test on a good day,
 * which is the self-assigned band this whole subsystem is built to avoid.
 */
export function testPublishesLevel(measuredLevel: string | null): boolean {
  return measuredLevel === null;
}

/** Mirrors `BANDS` in supabase/functions/checkpoint/checkpoint-core.ts. */
export const CHECKPOINT_BAND_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
