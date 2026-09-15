/**
 * Regenerate the declared readmission allowlist from the live measurement.
 *
 * Run it only when you have deliberately changed what readmissions exist — for
 * example after adding a confusable pair or fixing a row — and read the diff
 * before committing it. The test is the guard; this is the way to move it.
 *
 *   deno run --allow-read --allow-write --sloppy-imports \
 *     scripts/question-audit/write-readmission-allowlist.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { findReadmissions } from './readmission.mjs';

const path = 'docs/audits/question-verification/remediation/readmission-allowlist.json';
const doc = JSON.parse(await readFile(path, 'utf8'));
const found = findReadmissions();
const languages = [...new Set(found.map((entry) => entry.split('|')[0]))].sort();

doc.count = found.length;
doc.by_language = Object.fromEntries(languages.map((l) => [l, found.filter((e) => e.split('|')[0] === l).length]));
doc.readmissions = found;
await writeFile(path, `${JSON.stringify(doc, null, 1)}\n`);
console.log(JSON.stringify({ count: doc.count, by_language: doc.by_language }));
