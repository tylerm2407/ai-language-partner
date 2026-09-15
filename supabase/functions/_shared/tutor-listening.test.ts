// Tests for the post-session listening check.
//
// The bias throughout: an item that is not obviously well-formed is thrown
// away. These are scored against a learner's measured CEFR level, so a
// malformed question that survives normalisation costs them a mark for a
// question nobody wrote.

import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  MAX_ITEM_CHARS,
  MAX_LISTENING_ITEMS,
  OPTIONS_PER_ITEM,
  gradeListeningCheck,
  normalizeListeningCheck,
  toPrompts,
  type TutorListeningItem,
} from './tutor-listening.ts';

function item(overrides: Partial<TutorListeningItem> = {}): Record<string, unknown> {
  return {
    question: 'What day did the tutor suggest?',
    options: ['Thursday', 'Friday', 'Saturday', 'Sunday'],
    answerIndex: 0,
    ...overrides,
  };
}

Deno.test('keeps a well-formed item', () => {
  const out = normalizeListeningCheck([item()]);
  assertEquals(out.length, 1);
  assertEquals(out[0].answerIndex, 0);
  assertEquals(out[0].options.length, OPTIONS_PER_ITEM);
});

Deno.test('drops an item with the wrong number of options', () => {
  assertEquals(normalizeListeningCheck([item({ options: ['a', 'b', 'c'] })]).length, 0);
  assertEquals(normalizeListeningCheck([item({ options: ['a', 'b', 'c', 'd', 'e'] })]).length, 0);
});

Deno.test('drops an item with duplicate options', () => {
  // Two identical options mean either two right answers or a wasted one, and
  // the learner cannot tell which.
  assertEquals(
    normalizeListeningCheck([item({ options: ['Thursday', 'thursday', 'Friday', 'Saturday'] })]).length,
    0,
  );
});

Deno.test('drops an item whose answerIndex does not index the options', () => {
  // A model that returns 4 for a four-option item has told us it does not know
  // its own answer.
  assertEquals(normalizeListeningCheck([item({ answerIndex: OPTIONS_PER_ITEM })]).length, 0);
  assertEquals(normalizeListeningCheck([item({ answerIndex: -1 })]).length, 0);
  assertEquals(normalizeListeningCheck([item({ answerIndex: 'first' as unknown as number })]).length, 0);
});

Deno.test('drops an item with an empty question or option', () => {
  assertEquals(normalizeListeningCheck([item({ question: '   ' })]).length, 0);
  assertEquals(normalizeListeningCheck([item({ options: ['a', '', 'c', 'd'] })]).length, 0);
});

Deno.test('truncates rather than dropping an over-long question', () => {
  const long = 'x'.repeat(MAX_ITEM_CHARS + 50);
  const out = normalizeListeningCheck([item({ question: long })]);
  assertEquals(out[0].question.length, MAX_ITEM_CHARS);
});

Deno.test('caps the number of items', () => {
  const many = Array.from({ length: MAX_LISTENING_ITEMS + 4 }, () => item());
  assertEquals(normalizeListeningCheck(many).length, MAX_LISTENING_ITEMS);
});

Deno.test('returns nothing for junk input', () => {
  assertEquals(normalizeListeningCheck(null).length, 0);
  assertEquals(normalizeListeningCheck('three questions').length, 0);
  assertEquals(normalizeListeningCheck([null, 3, 'x']).length, 0);
});

Deno.test('toPrompts removes the answer key', () => {
  const prompts = toPrompts(normalizeListeningCheck([item()]));
  assertEquals(Object.keys(prompts[0]).sort(), ['options', 'question']);
  // The whole security property in one line: nothing a client receives names
  // the right answer.
  assertEquals(JSON.stringify(prompts).includes('answerIndex'), false);
});

Deno.test('grades right and wrong answers', () => {
  const items = normalizeListeningCheck([item(), item({ answerIndex: 2 })]);
  const grade = gradeListeningCheck(items, [0, 2]);
  assertEquals(grade.correct, [true, true]);
  assertEquals(grade.correctCount, 2);
  assertEquals(grade.total, 2);
});

Deno.test('a missing answer is wrong, not skipped', () => {
  // The grade is over the ITEMS, never over how many answers arrived, so a
  // client cannot raise its own score by submitting only the ones it liked.
  const items = normalizeListeningCheck([item(), item(), item()]);
  const grade = gradeListeningCheck(items, [0]);
  assertEquals(grade.correct, [true, false, false]);
  assertEquals(grade.correctCount, 1);
  assertEquals(grade.total, 3);
});

Deno.test('non-numeric and out-of-range answers are wrong', () => {
  const items = normalizeListeningCheck([item(), item(), item()]);
  const grade = gradeListeningCheck(items, ['0', null, 99]);
  assertEquals(grade.correctCount, 0);
  assertEquals(grade.total, 3);
});

Deno.test('extra answers cannot add to the score', () => {
  const items = normalizeListeningCheck([item()]);
  const grade = gradeListeningCheck(items, [0, 0, 0, 0, 0, 0]);
  assertEquals(grade.correctCount, 1);
  assertEquals(grade.total, 1);
});

Deno.test('answers that are not an array grade as all wrong', () => {
  const items = normalizeListeningCheck([item(), item()]);
  const grade = gradeListeningCheck(items, 'zero');
  assertEquals(grade.correctCount, 0);
  assertEquals(grade.total, 2);
});
