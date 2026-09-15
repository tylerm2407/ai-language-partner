/** Reconcile persisted per-item review ledgers with the frozen inventory.
 * Never infer reading/review from a shared template or an absent finding. */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { lessonRefs } from './lesson-refs.mjs';
import { createPatchSet, SNAPSHOT_SHA } from './patch-set.mjs';
const { snapshot } = await createPatchSet();
const root = 'docs/audits/question-verification';
const languages = ['es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh', 'ru'];
const courses = new Map(snapshot.courses.map(x => [x.id, x]));
const passages = new Map(snapshot.reading_passages.map(x => [x.id, x]));
const expected = new Map();
for (const language of languages) {
  const get = lessonRefs(snapshot, language);
  for (let n = 1; n <= 2312; n++) {
    const { ref, exercise } = get(n);
    expected.set(ref, { id: exercise.id, language, kind: 'lesson' });
  }
  for (const [table, kind, letter, belongs] of [
    ['writing_prompts', 'writing', 'W', row => courses.get(row.course_id).target_language === language],
    ['reading_questions', 'reading', 'R', row => courses.get(passages.get(row.passage_id).course_id).target_language === language],
    ['checkpoint_items', 'checkpoint', 'C', row => row.language === language && row.strand !== 'speaking'],
  ]) snapshot[table].filter(belongs).sort((a, b) => a.id.localeCompare(b.id)).forEach((row, index) => {
    expected.set(`${language}-${letter}${String(index + 1).padStart(4, '0')}`, { id: row.id, language, kind });
  });
}
const trial = JSON.parse(await readFile('.question-audit/trial-baseline.json', 'utf8'));
for (const row of trial) expected.set(row.ref, { id: row.exercise.id, language: row.language, kind: 'trial' });
if (expected.size !== 21763) throw new Error(`Unexpected inventory: ${expected.size}`);

async function exists(path) { try { await readdir(path); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; } }
async function readLines(path) {
  try { return (await readFile(path, 'utf8')).trim().split('\n').filter(Boolean).map(line => ({ ...JSON.parse(line), evidence: path })); }
  catch (e) { if (e.code === 'ENOENT') return []; throw e; }
}
async function languageLedger(pass, language) {
  const base = `${root}/pass${pass}/${language}`;
  const flat = await readLines(`${base}/ledger.jsonl`);
  const nested = [];
  if (await exists(`${base}/ledger`)) for (const file of (await readdir(`${base}/ledger`)).filter(x => x.endsWith('.jsonl')).sort()) nested.push(...await readLines(`${base}/ledger/${file}`));
  if (flat.length && nested.length) throw new Error(`Ambiguous double ledger: ${base}`);
  return flat.length ? flat : nested;
}
const ledgers = { 1: [], 2: [] };
for (const pass of [1, 2]) for (const language of languages) ledgers[pass].push(...await languageLedger(pass, language));
for (const kind of ['writing', 'reading', 'checkpoint', 'trial']) ledgers[1].push(...await readLines(`${root}/pass1/${kind}/ledger.jsonl`));
ledgers[2].push(...await readLines(`${root}/pass2/nonlesson/ledger.jsonl`));
const views = {};
for (const pass of [1, 2]) {
  const seen = new Set();
  for (const entry of ledgers[pass]) {
    const actual = expected.get(entry.ref);
    if (!actual || actual.id !== entry.id) throw new Error(`Bad review ref/ID: pass${pass}/${entry.ref}/${entry.id}`);
    if (seen.has(entry.ref)) throw new Error(`Duplicate review: pass${pass}/${entry.ref}`);
    if (!entry.status || /pending|unreviewed/.test(entry.status)) throw new Error(`Not a completed item decision: pass${pass}/${entry.ref}`);
    seen.add(entry.ref);
  }
  const missing = [...expected.keys()].filter(ref => !seen.has(ref));
  views[pass] = { reviewed: seen.size, missing: missing.length, missing_refs: missing,
    by_kind: [...new Set([...expected.values()].map(x => x.kind))].map(kind => ({ kind,
      expected: [...expected.values()].filter(x => x.kind === kind).length,
      reviewed: [...seen].filter(ref => expected.get(ref).kind === kind).length,
    })),
    lesson_languages: languages.map(language => ({ language, expected: 2312,
      reviewed: [...seen].filter(ref => expected.get(ref).language === language && expected.get(ref).kind === 'lesson').length,
    })),
  };
}
const report = { snapshot_sha256: SNAPSHOT_SHA, total_non_speaking_questions: expected.size,
  included_bundled_trial: 24, excluded_live_speaking: 3191, passes: views,
  limitations: [
    'Coverage is based on persisted exact-ID item decisions; a reviewer may be ahead of the last saved ledger.',
    'Two passes do not prove zero errors; unresolved findings and remediation approval are separate.',
    'Root trial pass was keys-visible; second trial pass was blind then keyed.',
    'Japanese pass2 E0796–E0848 had early key exposure; a separate root blind supplement preserves 53 independently saved solutions before key access.',
    'Korean pass2 E1383–E1388 had early key exposure; a separate root blind supplement preserves six independently saved solutions before key access.',
    'Later French/Portuguese/Russian pass2 disclosed limited incidental prior exposure from authorized runtime diagnostics.',
    'Listening audio not auditioned; dynamic future generated content cannot be exhaustively certified.',
  ],
};
await writeFile(`${root}/coverage.json`, JSON.stringify(report, null, 2) + '\n');
const rows = languages.map(language => `| ${language} | 2,312 | ${views[1].lesson_languages.find(x => x.language === language).reviewed.toLocaleString('en-US')} | ${views[2].lesson_languages.find(x => x.language === language).reviewed.toLocaleString('en-US')} |`).join('\n');
await writeFile(`${root}/coverage.md`, `# Question review coverage — in progress

Frozen inventory: **21,763 non-speaking questions**, including 24 bundled trial
items. Speaking excluded: 3,191 live items. Counts below are exact-ID ledger
coverage, not error-free certifications or completed fixes.

| Lesson language | In scope | First pass | Second pass |
| --- | ---: | ---: | ---: |
${rows}

Writing (550), reading questions (309, with all 126 passages), checkpoints (72),
and bundled trials (24) have both item-review passes saved.

Overall persisted coverage: first pass ${views[1].reviewed.toLocaleString('en-US')}/21,763;
second pass ${views[2].reviewed.toLocaleString('en-US')}/21,763.
The second-pass remaining count is ${views[2].missing.toLocaleString('en-US')}.

The root trial review was not blind. Japanese second-pass early key exposure
on 53 items, and Korean exposure on six items, were followed by separately
saved root blind supplements. Later
French/Portuguese/Russian second passes disclose limited incidental exposure
from earlier runtime diagnostics. See coverage.json and the language reports.

Content correction approval and unresolved issues are tracked separately in
remediation/current-review-status.json and the reviewer notes. No production
content, settings or learner history has been changed. Tests do not certify
language quality, generated future questions or actual audio.
`);
console.log(JSON.stringify({ first_pass: views[1].reviewed, second_pass: views[2].reviewed, second_pass_remaining: views[2].missing, lessons: views[2].lesson_languages }));
