import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { evaluateSubmissionPolicy, validateTeacherScore } from './submission-policy.ts';

const NOW = Date.parse('2026-09-08T12:00:00.000Z');

Deno.test('submission policy accepts a published assignment before its deadline', () => {
  assertEquals(evaluateSubmissionPolicy({
    status: 'published',
    dueAt: '2026-09-09T12:00:00.000Z',
    lateSubmissionAllowed: false,
  }, NOW), { allowed: true, isLate: false });
});
Deno.test('submission policy rejects draft and closed assignments', () => {
  for (const status of ['draft', 'closed']) {
    assertEquals(evaluateSubmissionPolicy({
      status,
      dueAt: null,
      lateSubmissionAllowed: true,
    }, NOW), { allowed: false, reason: 'NOT_PUBLISHED' });
  }
});

Deno.test('submission policy rejects overdue work when late submission is disabled', () => {
  assertEquals(evaluateSubmissionPolicy({
    status: 'published',
    dueAt: '2026-09-07T12:00:00.000Z',
    lateSubmissionAllowed: false,
  }, NOW), { allowed: false, reason: 'PAST_DUE' });
});

Deno.test('submission policy marks accepted overdue work as late', () => {
  assertEquals(evaluateSubmissionPolicy({
    status: 'published',
    dueAt: '2026-09-07T12:00:00.000Z',
    lateSubmissionAllowed: true,
  }, NOW), { allowed: true, isLate: true });
});

Deno.test('teacher score must be finite and inside assignment bounds', () => {
  assertEquals(validateTeacherScore(75, 100), { valid: true, score: 75 });
  assertEquals(validateTeacherScore(-1, 100), { valid: false, reason: 'OUT_OF_RANGE' });
  assertEquals(validateTeacherScore(101, 100), { valid: false, reason: 'OUT_OF_RANGE' });
  assertEquals(validateTeacherScore(Number.NaN, 100), { valid: false, reason: 'INVALID_SCORE' });
  assertEquals(validateTeacherScore('75', 100), { valid: false, reason: 'INVALID_SCORE' });
});
