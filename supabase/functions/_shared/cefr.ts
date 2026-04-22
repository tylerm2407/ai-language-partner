/**
 * Shared CEFR helpers for edge functions.
 *
 * Keeps the proficiency-level → CEFR mapping in one place so every validator
 * and prompt builder agrees. The five-level `ProficiencyLevel` enum is the
 * onboarding + profile storage format; CEFR is the pedagogy-canonical format.
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

export function proficiencyToCefr(level: string | null | undefined): CEFR {
  if (level && level in MAP) return MAP[level as ProficiencyLevel];
  return 'A1';
}
