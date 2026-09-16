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
 * Items in the order they will be asked.
 *
 * Stable within a strand: the server chose the rotation (`selectItems`) and
 * reordering inside it would discard that choice. A strand the server did not
 * send simply does not appear.
 */
export function orderCheckpointItems(items: CheckpointItem[]): CheckpointItem[] {
  const rank = new Map(CHECKPOINT_STRAND_ORDER.map((s, i) => [s, i]));
  return [...items].sort((a, b) => (rank.get(a.strand) ?? 99) - (rank.get(b.strand) ?? 99));
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

export const STRAND_LABELS: Record<CheckpointStrand, string> = {
  listening: 'Listening',
  reading: 'Reading',
  writing: 'Writing',
  speaking: 'Speaking',
};

export interface CheckpointScoreLine {
  strand: CheckpointStrand;
  /** 0–100, rounded. Null when the strand was not measured. */
  percent: number | null;
}

/** Per-strand result rows in the order they were asked. */
export function checkpointScoreLines(result: CheckpointResult): CheckpointScoreLine[] {
  return CHECKPOINT_STRAND_ORDER.map((strand) => {
    const raw = result.scores[strand];
    return {
      strand,
      percent: typeof raw === 'number' && Number.isFinite(raw) ? Math.round(raw * 100) : null,
    };
  });
}

/**
 * What the result means, in one sentence.
 *
 * It never says "you are now B1". A checkpoint moves the learner's cohort
 * segment; the band on their report still comes from practice history, and a
 * result screen implying otherwise would be the gate we deliberately did not
 * build. `movedFrom` and `band` differing is real information — the instrument
 * disagreed with where they sat — and it is reported as exactly that.
 */
export function checkpointOutcomeLine(result: CheckpointResult): string {
  if (result.composite === null) {
    return 'Nothing was scored this time, so your level is unchanged.';
  }
  if (result.band === result.movedFrom) {
    return `This check-in agrees with ${result.movedFrom}.`;
  }
  const up = CHECKPOINT_BAND_ORDER.indexOf(result.band) > CHECKPOINT_BAND_ORDER.indexOf(result.movedFrom);
  return up
    ? `This check-in put you above ${result.movedFrom}, at ${result.band}.`
    : `This check-in put you below ${result.movedFrom}, at ${result.band}.`;
}

/** Mirrors `BANDS` in supabase/functions/checkpoint/checkpoint-core.ts. */
export const CHECKPOINT_BAND_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
