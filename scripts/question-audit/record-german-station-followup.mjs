import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual as eq } from 'node:util';
import { createPatchSet } from './patch-set.mjs';
import { deFollowonChoiceCandidates } from '../../docs/audits/question-verification/remediation/de-it-zh/de-followon-choices.mjs';
import { deA1GreetingsFoodCandidates } from '../../docs/audits/question-verification/remediation/de-it-zh/de-a1-greetings-food-candidates.mjs';
import { deA1TransportShoppingCandidates } from '../../docs/audits/question-verification/remediation/de-it-zh/de-a1-transport-shopping-candidates.mjs';
import { gradeAnswer } from '../../lib/grading.ts';
const base = 'docs/audits/question-verification/remediation/de-followon-root-review';
const sourceSha = createHash('sha256').update(await readFile('docs/audits/question-verification/remediation/de-it-zh/de-a1-transport-shopping-candidates.mjs')).digest('hex');
if (sourceSha !== 'a17c050bce3612bc806b354935e76dea5a1f3a5d5df8cb68a0da71b2634cfc13') throw new Error('Unreviewed source revision');
const archive = JSON.parse(await readFile(`${base}/reviewed-batch.json`, 'utf8'));
const originals = (await readFile(`${base}/field-decisions.jsonl`, 'utf8')).trim().split('\n').map(JSON.parse);
const set = await createPatchSet();
deFollowonChoiceCandidates(set); deA1GreetingsFoodCandidates(set); deA1TransportShoppingCandidates(set);
const fields = [];
for (const row of archive.rows) {
  const expected = structuredClone(row.patch);
  const target = ['de-E0158', 'de-E0202'].includes(row.ref);
  if (target) expected.after.accepted_answers = ['Station', 'Haltestelle'];
  const actual = set.patches().find(p => p.id === row.id);
  if (!eq(actual, expected)) throw new Error(`Unexpected whole-patch change ${row.ref}`);
  if (!target) continue;
  const hints = { exerciseHints: { exerciseType: row.exercise.type, skillType: row.exercise.skill_type, language: 'de' } };
  if (gradeAnswer('Haltestelle', row.exercise.correct_answer, ['Station'], hints).isCorrect ||
    !gradeAnswer('Haltestelle', row.exercise.correct_answer, actual.after.accepted_answers, hints).isCorrect) throw new Error('Missing runtime repair');
  fields.push({ ...originals.find(d => d.id === row.id && d.field === 'accepted_answers'), after: actual.after.accepted_answers,
    source_sha256: sourceSha, decision: 'approve_as_correction',
    rationale: 'Root and author independently verified the passenger-transport Haltestelle sense in primary bilingual dictionaries. The actual bare Station prompt has no railway-building restriction. Exact36-patch comparison proves only these two arrays changed; actual grader rejects before and accepts after.',
    sources: ['https://dictionary.cambridge.org/dictionary/english-german/station', 'https://dictionary.cambridge.org/dictionary/german-english/haltestelle'] });
}
if (fields.length !== 2) throw new Error('Incomplete follow-up');
const output = fields.map(x => JSON.stringify(x)).join('\n') + '\n';
if (process.argv.includes('--verify')) {
  if (await readFile(`${base}/station-followup-field-decisions.jsonl`, 'utf8') !== output) throw new Error('Stale follow-up');
} else await writeFile(`${base}/station-followup-field-decisions.jsonl`, output);
console.log(JSON.stringify({ exact_followup_fields: 2, actual_added_answer_passes: 2 }));
