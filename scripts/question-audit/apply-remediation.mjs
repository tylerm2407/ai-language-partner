/**
 * Apply (or roll back) the audit's content patch against production.
 *
 * The SQL is streamed from disk to the Supabase Management API and never passes
 * through a tool call, because the patch is 2.5 MB and the MCP `apply_migration`
 * tool takes its query as an inline string. Same project, same credential and
 * same endpoint family the read-only snapshot already uses; this is the path the
 * dashboard SQL editor takes, which CLAUDE.md §4 names as the sanctioned
 * alternative to the MCP tool.
 *
 * Nothing here decides whether the write is safe. The SQL decides: every row is
 * re-read FOR UPDATE and compared against its recorded prior value, and one
 * mismatch rolls the whole block back. This script's only jobs are to refuse to
 * run by accident, to give the block enough time to finish, and to report
 * honestly when the answer is unclear.
 *
 *   node scripts/question-audit/apply-remediation.mjs --confirm
 *   node scripts/question-audit/apply-remediation.mjs --confirm --reverse
 *   node scripts/question-audit/apply-remediation.mjs --confirm --file supabase/migrations/136_question_audit_round_two.sql
 *
 * `--file` names any later round's SQL. It is the whole reason this script is
 * not hard-wired to round one any more: round two is a second self-guarding
 * block of the same shape, and streaming it needs the same treatment.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = 'ngqpsuixmumdnqbqxjxv';
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDirectory, '../..');

const reverse = process.argv.includes('--reverse');
if (!process.argv.includes('--confirm')) {
  console.error('Refusing to write to production without --confirm.');
  process.exit(2);
}
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is required; do not paste it into a report.');

const fileArg = process.argv.indexOf('--file');
if (fileArg !== -1 && reverse) {
  console.error('--file and --reverse name different files; pass only one.');
  process.exit(2);
}
const path = fileArg !== -1 && process.argv[fileArg + 1]
  ? resolve(process.cwd(), process.argv[fileArg + 1])
  : reverse
    ? resolve(root, 'docs/audits/question-verification/remediation/reverse.sql')
    : resolve(root, 'supabase/migrations/134_question_audit_content_patch.sql');
const body = await readFile(path, 'utf8');

/**
 * A patch that declares a precondition does not get applied by someone who has
 * not read it.
 *
 * Round two carried `apply_precondition` in its own `draft-patches.json`, in its
 * migration header and in the remaining-work register: it must ship in the same
 * release as the grading work, because seven of its rows have no other defence
 * than the Japanese edit-distance gate. It was applied anyway, on 2026-09-16,
 * by a session that had the file in front of it. Sixteen wrong answers became
 * acceptable on every build without that gate, and nothing stopped it, because
 * a precondition written in a document is a hope rather than a control.
 *
 * So it lives here now. If a draft beside this SQL declares one, applying needs
 * `--precondition-met "<evidence>"`, and the evidence is echoed into the run log
 * so the claim has an author and a date. This cannot verify the claim — no
 * script can know whether a build shipped — but it can make the claim a
 * deliberate, recorded act instead of an omission.
 *
 * Deliberately keyed on the DRAFT beside the SQL rather than on a flag in the
 * SQL, so a future round inherits the guard by declaring the field, with no
 * change here.
 */
if (!reverse) {
  const draftCandidates = [
    path.replace(/supabase\/migrations\/\d+_question_audit_round_two\.sql$/, 'docs/audits/question-verification/round2/draft-patches.json'),
    path.replace(/\/draft\.sql$/, '/draft-patches.json'),
  ];
  let declared = null;
  for (const candidate of draftCandidates) {
    if (candidate === path) continue;
    try {
      const draft = JSON.parse(await readFile(candidate, 'utf8'));
      declared = draft.apply_precondition ?? draft.APPLY_PRECONDITION ?? null;
      if (declared) break;
    } catch { /* no draft beside this SQL; nothing declared */ }
  }
  if (declared) {
    const metArg = process.argv.indexOf('--precondition-met');
    const evidence = metArg !== -1 ? process.argv[metArg + 1] : null;
    if (!evidence?.trim()) {
      console.error('\nThis patch declares a precondition:\n');
      console.error(`  ${String(declared).trim()}\n`);
      console.error('Applying it needs --precondition-met "<evidence>" — what makes it true, in your words.');
      console.error('Merging a branch is not shipping a build. A learner is protected by the code on their phone.\n');
      process.exit(2);
    }
    console.log(JSON.stringify({ precondition: String(declared).trim(), declared_met_because: evidence.trim(), by: 'apply-remediation.mjs', at: new Date().toISOString() }, null, 2));
  }
}

// The block walks 5,556 rows with a lock and an update each, which is well past
// the API's default statement timeout. SET is transaction-local, so this does
// not linger on the connection.
const query = `SET statement_timeout = '900s';\n${body}`;

console.log(JSON.stringify({
  action: reverse ? 'ROLLBACK' : 'APPLY',
  project, path,
  bytes: body.length,
  sha256: createHash('sha256').update(body).digest('hex'),
}, null, 2));

const started = Date.now();
let response;
try {
  response = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(900000),
  });
} catch (error) {
  // A dropped or timed-out connection says nothing about whether the server
  // committed. Verification, not a blind retry, is the next move — and a retry
  // would in any case be a no-op, since the block skips rows already patched.
  console.error(`\nNo answer after ${Math.round((Date.now() - started) / 1000)}s: ${error.message}`);
  console.error('The transaction may or may not have committed. Run drift-check.mjs --after before doing anything else.');
  process.exit(3);
}

const text = await response.text();
if (!response.ok) {
  // Guard failures arrive here, and they are the designed outcome of a conflict,
  // not a bug. Nothing was written: the whole block is one transaction.
  console.error(`\nRejected (${response.status}) after ${Math.round((Date.now() - started) / 1000)}s. Nothing was written.`);
  console.error(text.slice(0, 2000));
  process.exit(1);
}

console.log(`\nCommitted in ${Math.round((Date.now() - started) / 1000)}s. Server said: ${text.slice(0, 400)}`);
