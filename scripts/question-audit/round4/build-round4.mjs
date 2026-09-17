/**
 * Round four: one ruling, five rows and a card. Same shape as rounds one and
 * two — exact-ID edits guarded on their prior values, one atomic block, a
 * generated reverse, and nothing applied by this script.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRound4PatchSet, renderPatchSql, renderReverseSql, SNAPSHOT_SHA } from './patch-set-round4.mjs';
import { yuyueIsAnAppointment, YUYUE_RULING } from './yuyue-is-an-appointment.mjs';

const set = await createRound4PatchSet();
const counts = { yuyue: yuyueIsAnAppointment(set) };
const patches = set.patches();
const directory = 'docs/audits/question-verification/round4';
await mkdir(directory, { recursive: true });

const draft = `${JSON.stringify({
  round: 3,
  snapshot_sha256: SNAPSHOT_SHA,
  status: 'Draft: not applied by this script.',
  // No apply_precondition: this round depends on no unshipped code. It changes
  // English glosses and one Chinese key, and the grader treats all of them as
  // ordinary strings.
  ruling: YUYUE_RULING,
  counts,
  patches,
}, null, 1)}\n`;
const sql = renderPatchSql(patches);
const reverse = renderReverseSql(patches);
await writeFile(`${directory}/draft-patches.json`, draft);
await writeFile(`${directory}/draft.sql`, sql);
await writeFile(`${directory}/reverse.sql`, reverse);

console.log(JSON.stringify({
  rows: patches.length,
  fields: patches.reduce((n, p) => n + Object.keys(p.after).length, 0),
  per_table: patches.reduce((acc, p) => ({ ...acc, [p.table]: (acc[p.table] ?? 0) + 1 }), {}),
  counts,
  sql_sha256: createHash('sha256').update(sql).digest('hex'),
  deployed: false,
}, null, 2));
