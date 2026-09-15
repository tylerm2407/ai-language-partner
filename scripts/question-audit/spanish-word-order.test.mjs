import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { createPatchSet } from './patch-set.mjs';
import { spanishWordOrder, spanishWordOrderFixes } from './spanish-word-order-fixes.mjs';
import { lessonRefs } from './lesson-refs.mjs';
import { gradeAnswer } from '../../lib/grading.ts';
const set = await createPatchSet();
spanishWordOrderFixes(set);
const get = lessonRefs(set.snapshot, 'es');
const patches = new Map(set.patches().map(p => [p.id, p]));

Deno.test('all and only the101 audited sole-answer Spanish tile banks receive authored replacements', () => {
  const eligible = [];
  for (let n = 1; n <= 2312; n++) {
    const e = get(n).exercise;
    if (e.type === 'sentence_construction' && (e.metadata?.tiles ?? e.correct_answer.split(' ')).length === 1 && !(e.metadata?.distractors ?? []).length) eligible.push(n);
  }
  assertEquals(spanishWordOrder.map(x => x[0]), eligible);
  assertEquals(patches.size, 101);
});

Deno.test('every new key is constructible, meets its anchors, and leaves real ordering work', () => {
  for (const [ref, , english, answer] of spanishWordOrder) {
    const before = get(ref).exercise;
    const after = { ...before, ...patches.get(before.id).after };
    const tiles = after.metadata.tiles;
    assertEquals(tiles.join(' '), answer);
    assert(after.prompt.includes(english));
    const anchorLength = tiles.length >= 8 ? 2 : 1;
    assert(tiles.length - anchorLength * 2 >= 3, `es-E${ref} reveals almost the entire order`);
    assert(after.prompt.includes(`Start with “${tiles.slice(0, anchorLength).join(' ')}”`));
    assert(after.prompt.includes(`end with “${tiles.slice(-anchorLength).join(' ')}”`));
    const hints = { exerciseType: 'sentence_construction', skillType: before.skill_type, language: 'es' };
    assert(gradeAnswer(answer, after.correct_answer, after.accepted_answers, { exerciseHints: hints }).isCorrect);
    assert(!gradeAnswer(before.correct_answer, after.correct_answer, after.accepted_answers, { exerciseHints: hints }).isCorrect);
    for (const alternative of after.accepted_answers) {
      const alternativeTiles = alternative.split(/\s+/);
      assertEquals([...alternativeTiles].sort(), [...tiles].sort());
      assertEquals(alternativeTiles.slice(0, anchorLength), tiles.slice(0, anchorLength));
      assertEquals(alternativeTiles.slice(-anchorLength), tiles.slice(-anchorLength));
      assert(gradeAnswer(alternative, after.correct_answer, after.accepted_answers, { exerciseHints: hints }).isCorrect);
    }
  }
});

Deno.test('all49 independently recommended alternatives are preserved, with no unresolved marked candidates promoted', async () => {
  const { wordOrderReviews } = await import('../../docs/audits/question-verification/remediation/es-root-review/review-data.mjs');
  assertEquals(wordOrderReviews.length, 101);
  let total = 0;
  for (const review of wordOrderReviews) {
    const authored = spanishWordOrder.find(x => x[0] === review.ref);
    assertEquals(authored[4] ?? [], review.alternatives);
    total += review.alternatives.length;
    for (const candidate of review.markedCandidates) assert(!(authored[4] ?? []).includes(candidate));
  }
  assertEquals(total, 49);
});

Deno.test('replacement banks preserve IDs, lesson/course/level links and exercise format', () => {
  for (const [ref] of spanishWordOrder) {
    const { exercise, course } = get(ref);
    assert(['A2', 'B1', 'B2'].includes(course.cefr_level));
    const patch = patches.get(exercise.id);
    assertEquals(Object.keys(patch.after).sort(), ['accepted_answers', 'correct_answer', 'metadata', 'prompt'].filter(key => Object.hasOwn(patch.after, key)).sort());
    assert(!Object.hasOwn(patch.after, 'type'));
    assert(!Object.hasOwn(patch.after, 'lesson_id'));
    assert(!Object.hasOwn(patch.after, 'prompt_audio_url'));
  }
});
