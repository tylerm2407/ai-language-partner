/**
 * Standing corpus check, generalised from Italian to all nine languages.
 *
 * Round one built this for Italian alone, in
 * `remediation/same-gloss-same-key.test.mjs`, and levelled nineteen groups with
 * it. The mechanism was right and the scope was the accident: the same grouping
 * run over the other eight languages finds 101 disagreeing groups carrying 129
 * omissions, none of which any producer had ever looked at.
 *
 * Three differences from the Italian original, each deliberate:
 *
 *  - Nine languages instead of one, driven off the `Translate to <Language>:`
 *    frame per language rather than a hard-coded "Italian".
 *  - Node's test runner, not Deno, so it runs beside the rest of round two.
 *  - The allowlist is NOT empty. Italian could assert "nothing disagrees"
 *    because its nineteen were all omissions. Across nine languages two
 *    populations must stay divergent, and both are declared with their reason:
 *    ten that would admit a wrong answer, fourteen where this patch's own
 *    ruling has not yet been decided for the twin, and five where a cloze frame
 *    cannot take an overt-subject form. A group that disagrees and is in
 *    neither list fails, which is the whole point of the file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRound2PatchSet } from './patch-set-round2.mjs';
import { lessonRefs } from '../lesson-refs.mjs';
import { LEVELLED, HELD_WOULD_WIDEN, PROPAGATION_PENDING, DECLARED_EXCEPTIONS, DECLARED_REASON, PROPAGATION_REASON } from './same-gloss-levelling.mjs';

const DRAFT = 'docs/audits/question-verification/round2/draft-patches.json';
const LANGUAGES = { es: 'Spanish', fr: 'French', de: 'German', it: 'Italian', pt: 'Portuguese', ru: 'Russian', ja: 'Japanese', ko: 'Korean', zh: 'Chinese' };
const PER_LANGUAGE_ROWS = 2312;

/** The English gloss and the answer language, read off the row itself. A row
 * whose prompt is not one of these three frames is not a bare gloss and is
 * deliberately out of scope. */
function classify(exercise, languageName) {
  const prompt = exercise.prompt ?? '';
  let match;
  if ((match = /^Translate to English: (.+)$/.exec(prompt))) return { direction: 'to_native', gloss: exercise.correct_answer, source: match[1] };
  if ((match = new RegExp(`^Translate to ${languageName}: (.+)$`).exec(prompt))) return { direction: 'to_target', gloss: match[1], source: exercise.correct_answer };
  if ((match = /^Fill in the missing word: _____ means (.+)$/.exec(prompt))) return { direction: 'to_target', gloss: match[1], source: exercise.correct_answer };
  return null;
}

const asSet = list => JSON.stringify([...new Set(list.map(a => a.toLowerCase()))].sort());

/** The corpus as it stands after applying the round-2 draft. */
async function corpus() {
  const set = await createRound2PatchSet();
  const { patches } = JSON.parse(await readFile(DRAFT, 'utf8'));
  const overlay = new Map(patches.filter(p => p.table === 'exercises').map(p => [p.id, p.after]));
  const groups = new Map();
  let rowCount = 0;
  for (const [language, name] of Object.entries(LANGUAGES)) {
    const get = lessonRefs(set.snapshot, language);
    for (let n = 1; n <= PER_LANGUAGE_ROWS; n++) {
      const frozen = get(n).exercise;
      const exercise = { ...frozen, ...(overlay.get(frozen.id) ?? {}) };
      rowCount++;
      if (exercise.options?.length) continue;
      const kind = classify(exercise, name);
      if (!kind) continue;
      const id = `${language}|${kind.direction}|${kind.gloss}|${kind.source}`;
      groups.set(id, [...(groups.get(id) ?? []), {
        ref: `${language}-E${String(n).padStart(4, '0')}`, id: exercise.id, type: exercise.type,
        accepted: exercise.accepted_answers ?? [], hint: exercise.hint_text ?? null, explanation: exercise.explanation ?? null,
      }]);
    }
  }
  return { groups, rowCount };
}

const disagreeing = groups => [...groups.entries()]
  .filter(([, rows]) => rows.length > 1 && new Set(rows.map(r => asSet(r.accepted))).size > 1)
  .map(([id]) => id).sort();

const declaredGroupIds = () => [...new Set([
  ...HELD_WOULD_WIDEN.map(entry => `${entry.lang}|${entry.group}`),
  ...PROPAGATION_PENDING.map(entry => `${entry.lang}|${entry.group}`),
  ...DECLARED_EXCEPTIONS.map(entry => `${entry.lang}|${entry.group}`),
])].sort();

test('the corpus is grouped the way this check expects, in all nine languages', async () => {
  const { groups, rowCount } = await corpus();
  assert.equal(rowCount, 9 * PER_LANGUAGE_ROWS, 'a language changed size; re-derive before trusting anything below');
  const multi = [...groups.values()].filter(rows => rows.length > 1);
  // Pinned so a producer that rewrites a row out of its group, or merges two,
  // moves a number and gets read rather than quietly shrinking the coverage.
  assert.equal(groups.size, 4605);
  assert.equal(multi.length, 967);
  assert.equal(multi.reduce((total, rows) => total + rows.length, 0), 1974);
});

test('no two rows with the same gloss and key accept different answers, unless declared', async () => {
  const { groups } = await corpus();
  assert.deepEqual(disagreeing(groups), declaredGroupIds(),
    'a same-gloss-same-key group disagrees and is not declared; level it, or declare it with its reason');
  for (const id of declaredGroupIds()) assert.ok(groups.has(id), `declared group ${id} is no longer a group`);
});

test('every declared exception carries a reason, and every held one carries what it would admit', () => {
  assert.ok(DECLARED_REASON.trim().length > 80);
  assert.equal(DECLARED_EXCEPTIONS.length, 5);
  for (const entry of DECLARED_EXCEPTIONS) {
    assert.match(entry.missing, /^(私は|저는)/, `${entry.ref}: declared for a reason the reason does not describe`);
    assert.ok(entry.group.includes('|'), entry.ref);
  }
  assert.equal(HELD_WOULD_WIDEN.length, 10);
  assert.equal(PROPAGATION_PENDING.length, 14);
  assert.ok(PROPAGATION_REASON.trim().length > 80);
  for (const entry of HELD_WOULD_WIDEN) {
    assert.ok(Array.isArray(entry.admits) && entry.admits.length, `${entry.ref}: held with nothing recorded that it would admit`);
    assert.ok(!entry.admits.includes(entry.missing), entry.ref);
  }
  // Nothing is both levelled and held.
  const levelled = new Set(LEVELLED.map(([, ref, , , missing]) => `${ref}|${missing}`));
  for (const entry of [...HELD_WOULD_WIDEN, ...DECLARED_EXCEPTIONS, ...PROPAGATION_PENDING]) {
    assert.ok(!levelled.has(`${entry.ref}|${entry.missing}`), `${entry.ref}: ${entry.missing} is both levelled and withheld`);
  }
});

test('every levelled string really is the twin\'s, on a row that really is the same question', async () => {
  const { groups } = await corpus();
  const set = await createRound2PatchSet();
  const byId = new Map(set.snapshot.exercises.map(e => [e.id, e]));
  for (const [id, ref, language, group, missing] of LEVELLED) {
    const members = groups.get(`${language}|${group}`);
    assert.ok(members?.length > 1, `${ref}: ${group} is no longer a multi-row group`);
    // On a to_native row the ANSWER is the English gloss and the prompt carries
    // the target-language word; on a to_target row it is the other way round.
    // The group id records them in prompt-then-answer order either way.
    const [direction, gloss, source] = group.split('|');
    const frozen = byId.get(id);
    const key = direction === 'to_native' ? gloss : source;
    const inPrompt = direction === 'to_native' ? source : gloss;
    assert.equal(frozen.correct_answer, key, `${ref}: key moved out of its group`);
    assert.ok((frozen.prompt ?? '').includes(inPrompt), `${ref}: prompt no longer carries the gloss`);
    assert.equal(frozen.options ?? null, null, `${ref}: became a choice row`);
    // The string must be something a sibling in the group already accepted
    // BEFORE this patch — levelling never invents an answer.
    const siblings = members.filter(m => m.id !== id);
    const priorlyAccepted = siblings.some(m => (byId.get(m.id).accepted_answers ?? []).some(a => a.toLowerCase() === missing.toLowerCase()));
    assert.ok(priorlyAccepted, `${ref}: "${missing}" is accepted by no sibling in ${group}; this is authoring, not levelling`);
  }
  assert.equal(LEVELLED.length, 97);
});
