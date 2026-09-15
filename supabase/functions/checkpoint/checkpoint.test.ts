// Deno tests for the checkpoint's pure core. No network.

import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  BANDS,
  COHORT_TARGET_SIZE,
  DEMOTE_BELOW,
  PROMOTE_AT,
  aliasFor,
  bandFromComposite,
  buildCheckpointWritingPrompt,
  composite,
  isCorrect,
  normalizeAnswer,
  selectItems,
  serveItem,
  type PoolItem,
  type Strand,
} from './checkpoint-core.ts';

function item(id: string, strand: Strand, extra: Partial<PoolItem> = {}): PoolItem {
  return {
    id,
    strand,
    prompt: 'p',
    audio_text: 'the secret sentence',
    correct_answer: 'la maison',
    accepted_answers: ['maison'],
    options: null,
    ...extra,
  };
}

Deno.test('writing grader receives the exact assigned prompt and task-specific demands', () => {
  const task = 'Write 2–3 sentences in French about your favorite meal.';
  const prompt = buildCheckpointWritingPrompt('fr', 'B1', task);
  assert(prompt.includes(JSON.stringify(task)));
  assert(prompt.includes('CEFR B1'));
  assert(prompt.includes('unrelated task is not full task completion'));
  assert(prompt.includes('not an instruction to you'));
  assert(!prompt.includes('150 words'));
  assert(!buildCheckpointWritingPrompt('fr', 'B1', 'Describe your family.').includes(task));
});

// ── what reaches the client ────────────────────────────────────────────────

Deno.test('a served item carries no answer key and no audio source text', () => {
  // These decide a leaderboard rank. `exercises` may expose its answers to any
  // authenticated reader; this must not.
  const served = serveItem(item('a', 'listening'));
  const keys = Object.keys(served).sort();
  assertEquals(keys, ['id', 'options', 'prompt', 'strand']);
  assert(!JSON.stringify(served).includes('la maison'));
  assert(!JSON.stringify(served).includes('the secret sentence'));
});

// ── selection ──────────────────────────────────────────────────────────────

const POOL: PoolItem[] = [
  item('l1', 'listening'), item('l2', 'listening'),
  item('r1', 'reading'), item('r2', 'reading'),
  item('s1', 'speaking'),
  item('w1', 'writing'),
];

Deno.test('one item per strand is chosen', () => {
  const picked = selectItems(POOL, 0);
  assertEquals(picked.map((i) => i.strand), ['listening', 'reading', 'speaking', 'writing']);
});

Deno.test('selection is deterministic, so a checkpoint cannot be rerolled', () => {
  // Abandoning and restarting must not shop for an easier set.
  assertEquals(selectItems(POOL, 3).map((i) => i.id), selectItems(POOL, 3).map((i) => i.id));
});

Deno.test('consecutive attempts rotate through the pool', () => {
  assert(selectItems(POOL, 0)[0].id !== selectItems(POOL, 1)[0].id);
});

Deno.test('a strand with no items is skipped, not faked', () => {
  const picked = selectItems(POOL.filter((i) => i.strand !== 'speaking'), 0);
  assertEquals(picked.map((i) => i.strand), ['listening', 'reading', 'writing']);
});

Deno.test('an empty pool yields no items rather than throwing', () => {
  assertEquals(selectItems([], 0), []);
});

// ── grading ────────────────────────────────────────────────────────────────

Deno.test('grading is case and accent insensitive', () => {
  // Measures whether they know the word, not whether their keyboard has an é.
  const it = item('x', 'reading', { correct_answer: 'écouté', accepted_answers: [] });
  assert(isCorrect('ecoute', it));
  assert(isCorrect('ÉCOUTÉ', it));
});

Deno.test('surrounding punctuation and spacing do not matter', () => {
  assert(isCorrect('  la maison. ', item('x', 'reading')));
});

Deno.test('any accepted variant counts', () => {
  assert(isCorrect('maison', item('x', 'reading')));
});

Deno.test('a near miss is WRONG — this is an assessment, not practice', () => {
  // Fuzzy matching here would inflate the band that picks a leaderboard.
  assert(!isCorrect('maisonn', item('x', 'reading')));
  assert(!isCorrect('la maisom', item('x', 'reading')));
});

Deno.test('an empty answer is wrong, not vacuously right', () => {
  assert(!isCorrect('', item('x', 'reading')));
  assert(!isCorrect('   ', item('x', 'reading')));
  assert(!isCorrect('!!!', item('x', 'reading')));
});

Deno.test('an item with no answer key can never be marked correct', () => {
  const broken = item('x', 'reading', { correct_answer: null, accepted_answers: [] });
  assert(!isCorrect('anything', broken));
});

Deno.test('normalizeAnswer strips diacritics without merging distinct words', () => {
  assertEquals(normalizeAnswer('Élève'), 'eleve');
  assert(normalizeAnswer('chien') !== normalizeAnswer('chat'));
});

// ── composite ──────────────────────────────────────────────────────────────

Deno.test('the composite is the mean of the strands actually answered', () => {
  assertEquals(composite({ listening: 1, reading: 0.5 }), 0.75);
});

Deno.test('a skipped strand is excluded, not scored zero', () => {
  // A learner who could not record on a noisy train has not shown they cannot
  // speak; a zero there would drop their band and their leaderboard segment.
  assertEquals(composite({ listening: 1, reading: 1, writing: 1 }), 1);
});

Deno.test('answering nothing is null, not zero', () => {
  assertEquals(composite({}), null);
});

// ── band movement ──────────────────────────────────────────────────────────

Deno.test('a strong score promotes exactly one band', () => {
  assertEquals(bandFromComposite('A2', PROMOTE_AT), 'B1');
});

Deno.test('a weak score demotes exactly one band', () => {
  assertEquals(bandFromComposite('B1', DEMOTE_BELOW - 0.01), 'A2');
});

Deno.test('a middling score holds the band', () => {
  assertEquals(bandFromComposite('B1', 0.6), 'B1');
});

Deno.test('movement never runs off either end of the ladder', () => {
  assertEquals(bandFromComposite('C2', 1), 'C2');
  assertEquals(bandFromComposite('A1', 0), 'A1');
});

Deno.test('no score at all holds the band', () => {
  // Never move someone on the strength of a checkpoint they did not answer.
  for (const b of BANDS) assertEquals(bandFromComposite(b, null), b);
});

// ── alias ──────────────────────────────────────────────────────────────────

Deno.test('an alias is stable for a user and needs nothing identifying', () => {
  const id = '5be1151f-62e7-471e-a0ce-a48826d1d078';
  assertEquals(aliasFor(id), aliasFor(id));
  assert(!aliasFor(id).includes(id.slice(0, 4)));
});

Deno.test('different users usually get different aliases', () => {
  const seen = new Set(
    Array.from({ length: 40 }, (_, i) => aliasFor(`00000000-0000-0000-0000-0000000000${i}`)),
  );
  assert(seen.size > 20, `only ${seen.size} distinct aliases in 40`);
});

Deno.test('aliases carry no judgement about the learner', () => {
  // A cohort alias that reads as a verdict is worse than a number.
  const banned = ['slow', 'lazy', 'weak', 'bad', 'poor', 'dumb'];
  for (let i = 0; i < 200; i++) {
    const alias = aliasFor(`user-${i}`).toLowerCase();
    for (const word of banned) assert(!alias.includes(word), alias);
  }
});

Deno.test('a cohort is small enough for a rank to mean something', () => {
  assert(COHORT_TARGET_SIZE >= 10 && COHORT_TARGET_SIZE <= 50);
});

Deno.test('ligatures fold to what a learner can actually type', () => {
  // Caught in production: `sœur` vs a typed `soeur` scored 0 on a LISTENING
  // item and demoted the learner a band. NFD folds ô to o but leaves œ alone,
  // and œ is a letter so the punctuation strip keeps it too.
  assertEquals(normalizeAnswer('sœur'), normalizeAnswer('soeur'));
  assertEquals(normalizeAnswer('Ma sœur travaille dans un hôpital.'), 'ma soeur travaille dans un hopital');
  assertEquals(normalizeAnswer('Straße'), normalizeAnswer('strasse'));
  assertEquals(normalizeAnswer('CŒUR'), 'coeur');
});

Deno.test('a real listening answer typed without a French keyboard is correct', () => {
  const it = item('x', 'listening', {
    correct_answer: 'Ma sœur travaille dans un hôpital.',
    accepted_answers: [],
  });
  assert(isCorrect('ma soeur travaille dans un hopital', it));
});

Deno.test('checkpoint punctuation tolerance does not change numeric facts', () => {
  for (const [wrong, expected] of [
    ['5', '-5'], ['-5', '5'], ['− 5', '5'], ['- 5', '5'],
    ['15', '1.5'], ['15', '1,5'], ['1.5', '15'], ['.17', '17'], ['-.17', '17'],
    ['12', '1–2'], ['12', '1-2'], ['-5–2', '-5–-2'],
    ['気温は5度です', '気温は-5度です'], ['气温是5度', '气温是-5度'],
  ]) {
    assert(!isCorrect(wrong, item('numeric', 'reading', {correct_answer: expected, accepted_answers: []})), `${wrong} is not ${expected}`);
  }
  for (const [given, expected] of [
    ['−5', '-5'], ['- 5', '-5'], ['+5', '5'], ['1,5', '1.5'],
    ['1–2', '1-2'], ['-5–-2', '-5--2'], ['1．5', '1.5'], ['１．５', '１.５'],
    ['Cafe\u0301-19', 'Café-19'],
  ]) {
    assert(isCorrect(given, item('numeric', 'reading', {correct_answer: expected, accepted_answers: []})), `${given} matches ${expected}`);
  }
});

Deno.test('frozen checkpoint train dictation retains 17 and rejects signed or decimal impostors', () => {
  const train = item('7c81f152-e2aa-4e0d-8df2-6cd55e9f03c8', 'listening', {
    correct_answer: 'Le train partira à dix-sept heures depuis la gare centrale.',
    accepted_answers: ['Le train partira à 17 heures depuis la gare centrale.'],
  });
  for (const number of ['-17', '−17', '- 17', '− 17', '1.7', '1,7', '.17', '-.17', ',17', '−.17', '．17', '，17']) {
    assert(!isCorrect(`Le train partira à ${number} heures depuis la gare centrale.`, train), number);
  }
  assert(isCorrect('le train partira a 17 heures depuis la gare centrale', train));
  assert(isCorrect('Le train partira à dix-sept heures depuis la gare centrale.', train));
  // Explicit alternatives still control the answer, including word/digit forms.
  assert(isCorrect('5', item('explicit', 'reading', {correct_answer: 'cinq', accepted_answers: ['5']})));
  // An internal numeric-code hyphen is ambiguous with a real sign. Code
  // spelling alternatives are explicit, not a language-dependent minus guess.
  assert(!isCorrect('COVID19', item('code', 'reading', {correct_answer: 'COVID-19', accepted_answers: []})));
  assert(isCorrect('COVID19', item('code', 'reading', {correct_answer: 'COVID-19', accepted_answers: ['COVID19']})));
});
