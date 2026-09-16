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

const path = reverse
  ? resolve(root, 'docs/audits/question-verification/remediation/reverse.sql')
  : resolve(root, 'supabase/migrations/134_question_audit_content_patch.sql');
const body = await readFile(path, 'utf8');

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
