/**
 * Which CEFR band a conversation surface (chat, live tutor) should be pitched
 * at, and stamped on the evidence it produces.
 *
 * Before this existed both surfaces sent the learner's self-declared
 * onboarding level, and the server mapped it to a band capped at C1
 * (`_shared/cefr.ts`). Two consequences, both wrong:
 *
 *  - The conversation never got harder. A learner who declared "elementary"
 *    and then measured B1 through months of work was still talked to at A2.
 *  - The evidence was stamped A2 too, so `assessSpeaking` and `assessWriting`
 *    could never see a turn above the declared band, and the declared band
 *    became a ceiling on the measured level — the reverse of what a measured
 *    level is for.
 *
 * Order of preference, most honest first:
 *   1. one band ABOVE the band the proficiency report has MEASURED
 *      (`useAppStore.measuredBand`) — see "the stretch rule" below,
 *   2. the placement band the learner's lessons run at,
 *   3. the declared level, mapped through the shared ladder.
 *
 * ── The stretch rule ──
 *
 * A MEASURED band is one the learner has already proved. Holding the
 * conversation there measures nothing new, and — because this function also
 * decides the `cefr_level` stamped on every `conversation_evidence` row — it
 * made promotion arithmetically impossible: the interaction strand judges a
 * band from evidence tagged with THAT band, and a learner whose every turn is
 * tagged at the band they already hold accumulates exactly zero evidence for
 * the band above it, forever. The strand would sit at 0 no matter how much
 * they talked.
 *
 * So a measured band is stretched one rung (capped at C2): the conversation is
 * pitched at the band the learner is working toward, and the evidence it
 * produces is evidence about that band. This is also the right pedagogy — the
 * comprehensible-input-plus-one shape — but the load-bearing reason is the
 * arithmetic one.
 *
 * Placement and declared levels are NOT stretched. Neither has been proved, so
 * holding the conversation at face value is already informative, and stretching
 * an unproven band would pitch a brand-new learner's first conversation a full
 * rung above anything they have shown they can do.
 *
 * Pure so the fallback order is asserted in one place. Callers send the
 * result as `cefrLevel` alongside the legacy `level`; the server prefers the
 * band when it is a valid one and falls back to mapping `level` otherwise, so
 * an old client keeps working.
 */
import {
  CEFR_LADDER,
  cefrBandForProficiencyLevel,
  normalizeBand,
  type CefrBand,
} from './cefr-proficiency';
import type { ProficiencyLevel } from '../types';

export interface ConversationLevelInputs {
  /** `useAppStore.measuredBand` — null until the report has measured one. */
  measuredBand: CefrBand | null | undefined;
  /** `profile.placementBand` — the band of the course the learner started in. */
  placementBand: string | null | undefined;
  /** `profile.level` — the self-declared onboarding level. */
  level: ProficiencyLevel | null | undefined;
}

export function conversationCefrBand(inputs: ConversationLevelInputs): CefrBand {
  if (inputs.measuredBand) return stretchBand(inputs.measuredBand);
  const placed = normalizeBand(inputs.placementBand);
  if (placed) return placed;
  return cefrBandForProficiencyLevel(inputs.level ?? 'beginner');
}

/**
 * One rung up the ladder, or the same band at the top of it. Exported because
 * the evidence pipeline and the report both need to agree about what "the band
 * this learner is working toward" means.
 */
export function stretchBand(band: CefrBand): CefrBand {
  const i = CEFR_LADDER.indexOf(band);
  if (i < 0 || i === CEFR_LADDER.length - 1) return band;
  return CEFR_LADDER[i + 1];
}
