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
 *   1. the band the proficiency report has MEASURED (`useAppStore.measuredBand`),
 *   2. the placement band the learner's lessons run at,
 *   3. the declared level, mapped through the shared ladder.
 *
 * Pure so the fallback order is asserted in one place. Callers send the
 * result as `cefrLevel` alongside the legacy `level`; the server prefers the
 * band when it is a valid one and falls back to mapping `level` otherwise, so
 * an old client keeps working.
 */
import { cefrBandForProficiencyLevel, normalizeBand, type CefrBand } from './cefr-proficiency';
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
  if (inputs.measuredBand) return inputs.measuredBand;
  const placed = normalizeBand(inputs.placementBand);
  if (placed) return placed;
  return cefrBandForProficiencyLevel(inputs.level ?? 'beginner');
}
