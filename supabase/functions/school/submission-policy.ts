export interface AssignmentSubmissionPolicy {
  status: string;
  dueAt: string | null;
  lateSubmissionAllowed: boolean;
}
export type SubmissionPolicyDecision =
  | { allowed: true; isLate: boolean }
  | { allowed: false; reason: 'NOT_PUBLISHED' | 'PAST_DUE' };

export function evaluateSubmissionPolicy(
  assignment: AssignmentSubmissionPolicy,
  nowMs: number,
): SubmissionPolicyDecision {
  if (assignment.status !== 'published') {
    return { allowed: false, reason: 'NOT_PUBLISHED' };
  }

  const dueAtMs = assignment.dueAt ? Date.parse(assignment.dueAt) : Number.NaN;
  const isLate = Number.isFinite(dueAtMs) && nowMs > dueAtMs;

  if (isLate && !assignment.lateSubmissionAllowed) {
    return { allowed: false, reason: 'PAST_DUE' };
  }

  return { allowed: true, isLate };
}

export type GradeValidation =
  | { valid: true; score: number }
  | { valid: false; reason: 'INVALID_SCORE' | 'OUT_OF_RANGE' };

export function validateTeacherScore(
  value: unknown,
  maxPoints: number,
): GradeValidation {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { valid: false, reason: 'INVALID_SCORE' };
  }
  if (!Number.isFinite(maxPoints) || maxPoints < 0 || value < 0 || value > maxPoints) {
    return { valid: false, reason: 'OUT_OF_RANGE' };
  }
  return { valid: true, score: value };
}
