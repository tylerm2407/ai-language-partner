// Deno tests for the goal-track pure core (goal-core.ts). No network.

import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  GENERATED_EXERCISE_TYPES,
  LESSONS_PER_TRACK,
  MIN_USABLE_EXERCISES,
  buildExercisePrompt,
  buildMapperPrompt,
  buildPlannerPrompt,
  extractJson,
  parseExercises,
  parseUnitPlan,
} from './goal-core.ts';
import { GOAL_DOMAINS, GOAL_SCENARIOS } from '../_shared/goal-taxonomy.ts';

// ── prompts ────────────────────────────────────────────────────────────────

Deno.test('the mapper prompt spells out the whole vocabulary', () => {
  // Described-but-not-listed values are how a model starts inventing, and an
  // invented value is refused downstream — costing the learner their track.
  const prompt = buildMapperPrompt('French');
  for (const d of GOAL_DOMAINS) assert(prompt.includes(d), `missing domain ${d}`);
  for (const s of GOAL_SCENARIOS) assert(prompt.includes(s), `missing scenario ${s}`);
});

Deno.test('the learner text never appears in a system prompt', () => {
  // It is untrusted free text and goes as a user-role message. These builders
  // have no parameter that could carry it, which is the point.
  assertEquals(buildMapperPrompt.length, 1);
  assert(!buildMapperPrompt('French').includes('undefined'));
});

Deno.test('the planner prompt names the scenarios in the learner ranked order', () => {
  const prompt = buildPlannerPrompt('French', 'B1', {
    domain: 'hospitality',
    scenarios: ['restaurant', 'cafe_bar'],
    register: 'informal',
  });
  assert(prompt.indexOf('restaurant') < prompt.indexOf('cafe_bar'));
  assert(prompt.includes(String(LESSONS_PER_TRACK)));
  assert(prompt.includes('B1'));
});

Deno.test('the exercise prompt distinguishes the two languages', () => {
  // Getting these backwards yields a lesson that asks for translations into
  // the language the learner already speaks.
  const prompt = buildExercisePrompt('French', 'English', 'A2', 'Ordering', 'Order a coffee');
  assert(prompt.includes('prompt in English, answer in French'));
  assert(prompt.includes('prompt in French, answer in English'));
});

// ── extractJson ────────────────────────────────────────────────────────────

Deno.test('bare JSON, fenced JSON and prefixed JSON all parse', () => {
  const want = { a: 1 };
  assertEquals(extractJson('{"a":1}'), want);
  assertEquals(extractJson('```json\n{"a":1}\n```'), want);
  assertEquals(extractJson('Here is the plan: {"a":1}'), want);
});

Deno.test('unparseable output is null rather than a throw', () => {
  assertEquals(extractJson('sorry, I cannot help with that'), null);
  assertEquals(extractJson(''), null);
});

// ── parseUnitPlan ──────────────────────────────────────────────────────────

function plan(lessonCount: number) {
  return {
    title: 'Dinner in French',
    description: 'Order and chat your way through a meal.',
    lessons: Array.from({ length: lessonCount }, (_, i) => ({
      title: `Lesson ${i}`,
      description: `Do thing ${i}`,
    })),
  };
}

Deno.test('a complete plan is accepted', () => {
  const parsed = parseUnitPlan(plan(LESSONS_PER_TRACK));
  assert(parsed);
  assertEquals(parsed.lessons.length, LESSONS_PER_TRACK);
});

Deno.test('a short plan is refused rather than padded', () => {
  // A track that silently has four lessons instead of six is one the learner
  // finishes early and concludes was thin — indistinguishable from design.
  assertEquals(parseUnitPlan(plan(LESSONS_PER_TRACK - 2)), null);
  assertEquals(parseUnitPlan(plan(LESSONS_PER_TRACK + 1)), null);
});

Deno.test('a plan missing its own title or lessons is refused', () => {
  assertEquals(parseUnitPlan({ description: 'x', lessons: [] }), null);
  assertEquals(parseUnitPlan({ title: 'x', description: 'y' }), null);
  assertEquals(parseUnitPlan(null), null);
});

Deno.test('plan text is whitespace-collapsed and length-capped', () => {
  const parsed = parseUnitPlan({
    ...plan(LESSONS_PER_TRACK),
    title: `  Dinner\n\n   in   French  `,
    description: 'x'.repeat(900),
  });
  assert(parsed);
  assertEquals(parsed.title, 'Dinner in French');
  assert(parsed.description.length <= 400);
});

// ── parseExercises ─────────────────────────────────────────────────────────

const GOOD_MC = {
  type: 'multiple_choice',
  prompt: 'How do you say "the bill"?',
  correctAnswer: "l'addition",
  acceptedAnswers: ["l'addition"],
  options: ["l'addition", 'le pain', 'la carte', 'le verre'],
  explanation: 'That is the word for the bill.',
};

Deno.test('a well-formed exercise survives', () => {
  const out = parseExercises({ exercises: [GOOD_MC] });
  assertEquals(out.length, 1);
  assertEquals(out[0].type, 'multiple_choice');
  assertEquals(out[0].options?.length, 4);
});

Deno.test('multiple choice without the answer among the options is dropped', () => {
  // The learner would tap every option and every one would be wrong. That is
  // worse than a missing exercise.
  const out = parseExercises({
    exercises: [{ ...GOOD_MC, options: ['le pain', 'la carte', 'le verre'] }],
  });
  assertEquals(out.length, 0);
});

Deno.test('a fill_blank with no blank is dropped', () => {
  const out = parseExercises({
    exercises: [
      { type: 'fill_blank', prompt: 'Je voudrais un cafe', correctAnswer: 'un', acceptedAnswers: [] },
    ],
  });
  assertEquals(out.length, 0);
});

Deno.test('the correct answer is always in acceptedAnswers, even if the model forgot', () => {
  // The grader compares against that list; leaving it out makes the right
  // answer wrong.
  const out = parseExercises({
    exercises: [{ ...GOOD_MC, acceptedAnswers: ['laddition'] }],
  });
  assert(out[0].acceptedAnswers.includes("l'addition"));
});

Deno.test('an unknown exercise type is dropped, not passed through', () => {
  // Only the text-only subset is generated; a `listening_choice` would render
  // as a play button with no audio behind it.
  const out = parseExercises({
    exercises: [{ ...GOOD_MC, type: 'listening_choice' }, { ...GOOD_MC, type: 'speaking' }],
  });
  assertEquals(out.length, 0);
});

Deno.test('generated types are all text-only', () => {
  for (const t of GENERATED_EXERCISE_TYPES) {
    assert(!['listening_choice', 'listening_type', 'dictation', 'speaking'].includes(t), t);
  }
});

Deno.test('duplicate options collapse', () => {
  const out = parseExercises({
    exercises: [{ ...GOOD_MC, options: ["l'addition", "l'addition", 'le pain'] }],
  });
  assertEquals(out[0].options, ["l'addition", 'le pain']);
});

Deno.test('junk yields an empty list rather than throwing', () => {
  for (const junk of [null, undefined, {}, { exercises: 'nope' }, { exercises: [null, 3] }]) {
    assertEquals(parseExercises(junk), []);
  }
});

Deno.test('the usable floor is below a full lesson, so a partial batch can still ship', () => {
  assert(MIN_USABLE_EXERCISES > 0);
  assert(MIN_USABLE_EXERCISES < 10);
});
