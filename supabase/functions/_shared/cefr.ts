/**
 * Shared CEFR helpers for edge functions.
 *
 * Keeps the proficiency-level → CEFR mapping in one place so every validator
 * and prompt builder agrees. The five-level `ProficiencyLevel` enum is the
 * onboarding + profile storage format; CEFR is the pedagogy-canonical format.
 *
 * `lib/cefr-ladder.test.ts` on the client parses the `MAP` literal below as
 * text and asserts it matches `CEFR_BAND_BY_LEVEL`. Keep the literal's shape.
 */

import type { CEFR } from './level-checker.ts';

export type ProficiencyLevel =
  | 'beginner'
  | 'elementary'
  | 'intermediate'
  | 'upper_intermediate'
  | 'advanced';

const MAP: Record<ProficiencyLevel, CEFR> = {
  beginner: 'A1',
  elementary: 'A2',
  intermediate: 'B1',
  upper_intermediate: 'B2',
  advanced: 'C1',
};

/** The full ladder, in order. Includes C2, which no declared level reaches:
 *  only a MEASURED band can put a learner there. */
export const CEFR_LADDER: readonly CEFR[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export function proficiencyToCefr(level: string | null | undefined): CEFR {
  if (level && level in MAP) return MAP[level as ProficiencyLevel];
  return 'A1';
}

/**
 * A client-supplied band, if it is one.
 *
 * Accepts the shapes an honest client might send — `'b1'`, `' B1 '` — and
 * nothing looser: `'B1-B2'` and `'B1+'` are content tags, not a learner's
 * level, and guessing at them would let a malformed value steer the prompt.
 * Never throws; the caller falls back to the declared level.
 */
export function normalizeCefrLevel(raw: unknown): CEFR | null {
  if (typeof raw !== 'string') return null;
  const band = raw.trim().toUpperCase();
  return (CEFR_LADDER as readonly string[]).includes(band) ? (band as CEFR) : null;
}

/**
 * The band a conversation surface runs at.
 *
 * Prefers `cefrLevel` — the band the client resolved from the learner's
 * MEASURED level (`lib/conversation-level.ts`: measured > placement >
 * declared) — and falls back to mapping the declared `level` when the client
 * sent nothing usable. Before this existed both chat and the live tutor used
 * the declared level alone, so the onboarding answer was a ceiling on the
 * measured level: a learner who declared "elementary" and then measured B1
 * was still talked to, and stamped, at A2.
 *
 * Client-supplied and therefore untrusted, but the only thing it can move is
 * how hard this learner's own conversation is and which band their own
 * evidence is filed under. There is no league and no economic value attached
 * to a band, so validating the shape is enough.
 */
export function resolveCefrLevel(level: string | null | undefined, cefrLevel: unknown): CEFR {
  return normalizeCefrLevel(cefrLevel) ?? proficiencyToCefr(level);
}

/**
 * The inverse ladder, for the code that is still keyed on the five-level
 * enum: correction policies, level descriptions, speech speed, turn
 * detection. C2 has no rung of its own and shares `advanced` with C1 — the
 * enum stops at C1 because onboarding never asks above it, and the C1
 * settings (natural pace, shortest silence window, self-correction expected)
 * are the right ones for a C2 speaker too.
 */
export function cefrToProficiency(band: CEFR): ProficiencyLevel {
  switch (band) {
    case 'A1':
      return 'beginner';
    case 'A2':
      return 'elementary';
    case 'B1':
      return 'intermediate';
    case 'B2':
      return 'upper_intermediate';
    case 'C1':
    case 'C2':
      return 'advanced';
  }
}
