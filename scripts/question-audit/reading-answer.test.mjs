import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { gradeAnswer, normalize } from '../../lib/grading.ts';
import { readingAnswerSets, orderedReadingExamples } from './reading-answer-fixes.mjs';
import { shortReadingAnswers } from './reading-short-answer-fixes.mjs';
const snapshot = JSON.parse(await Deno.readTextFile('.question-audit/snapshot-8c7f381c78d8.json'));
const { patches } = JSON.parse(await Deno.readTextFile('docs/audits/question-verification/remediation/draft-patches.json'));
const courses = new Map(snapshot.courses.map(x => [x.id, x]));
const passages = new Map(snapshot.reading_passages.map(x => [x.id, x]));
const grade = (answer, q) => gradeAnswer(answer, q.correct_answer, q.accepted_answers).isCorrect;

Deno.test('closed source-category enumeration uses distinct categories and both three-item punctuation styles', () => {
  assertEquals(orderedReadingExamples(1, ['A', 'B']), ['A', 'B']);
  assertEquals(orderedReadingExamples(2, ['A', 'B', 'C']), ['A and B', 'A and C', 'B and A', 'B and C', 'C and A', 'C and B']);
  const triples = orderedReadingExamples(3, ['A', 'B', 'C', 'D', 'E']);
  assertEquals(triples.length, 120);
  assertEquals(new Set(triples).size, 120);
  assert(triples.includes('A, B, and C'));
  assert(triples.includes('C, B and A'));
});

Deno.test('all26 response-count repairs retain identity and accept every explicitly authored example', () => {
  assertEquals(readingAnswerSets.length, 26);
  const seen = new Set();
  for (const [language, number, count, categories, additional] of readingAnswerSets) {
    const before = snapshot.reading_questions.filter(q => courses.get(passages.get(q.passage_id).course_id).target_language === language)
      .sort((a, b) => a.id.localeCompare(b.id))[number - 1];
    const patch = patches.find(p => p.table === 'reading_questions' && p.id === before.id);
    assert(patch, `${language}-R${number}`);
    const after = { ...before, ...patch.after };
    seen.add(before.id);
    assertEquals(after.passage_id, before.passage_id);
    assertEquals(after.question_type, 'short_answer');
    assertEquals(after.id, before.id);
    assertEquals(after.correct_answer, orderedReadingExamples(count, categories)[0]);
    for (const answer of [...orderedReadingExamples(count, categories), ...additional]) {
      assert(grade(answer, after), `${language}-R${number}: ${answer}`);
    }
    assert(!grade('This unrelated answer is not supported by the text.', after));
    assert(!/any .*acceptable|alternatively|or:|either answer/i.test(after.correct_answer));
    const normalized = [after.correct_answer, ...after.accepted_answers].map(normalize);
    assertEquals(new Set(normalized).size, normalized.length, `${language}-R${number}: duplicate normalized answers`);
  }
  assertEquals(seen.size, 26);
});

Deno.test('originally rejected literal one/two-example answers become accepted', () => {
  for (const [language, number, answer] of [
    ['es', 3, 'Solar'], ['es', 3, 'Wind'], ['es', 13, 'Cyberbullying'],
    ['fr', 28, 'Vietnamese and Mexican'], ['de', 23, 'Cycling and swimming'],
    ['it', 16, 'Privacy and transparency'], ['pt', 5, 'Privacy'],
    ['ja', 3, 'Misinformation'], ['ja', 15, 'Smartphone voice recognition'],
    ['ko', 26, 'A stronger heart'], ['ru', 29, 'More energy and less stress'],
  ]) {
    const before = snapshot.reading_questions.filter(q => courses.get(passages.get(q.passage_id).course_id).target_language === language)
      .sort((a, b) => a.id.localeCompare(b.id))[number - 1];
    const after = { ...before, ...patches.find(p => p.table === 'reading_questions' && p.id === before.id).after };
    assert(!grade(answer, before), `${language}-R${number} must reproduce the omission`);
    assert(grade(answer, after), `${language}-R${number}`);
  }
});

Deno.test('all21 short-answer omissions accept the reviewed literal answers, not neighboring numbers', () => {
  assertEquals(shortReadingAnswers.length, 21);
  for (const [language, number, answers] of shortReadingAnswers) {
    const before = snapshot.reading_questions.filter(q => courses.get(passages.get(q.passage_id).course_id).target_language === language)
      .sort((a, b) => a.id.localeCompare(b.id))[number - 1];
    const after = { ...before, ...patches.find(p => p.table === 'reading_questions' && p.id === before.id).after };
    assert(!grade(answers[0], before), `${language}-R${number}: original omission must reproduce`);
    for (const answer of answers) assert(grade(answer, after), `${language}-R${number}: ${answer}`);
    assertEquals(after.correct_answer, before.correct_answer);
    assertEquals(after.passage_id, before.passage_id);
    if (language === 'de' && number === 1) assert(!grade('2046', after));
    if (language === 'fr' && number === 8) assert(!grade('16%', after));
    if (language === 'pt' && number === 4) assert(!grade('151 minutes', after));
  }
});
