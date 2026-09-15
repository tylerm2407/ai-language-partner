import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual as eq} from 'node:util';
import {createPatchSet} from './patch-set.mjs';
import {russianLessonFixes} from './russian-lesson-fixes.mjs';
const base='docs/audits/question-verification/remediation/ru-root-review';
const archive=JSON.parse(await readFile(`${base}/reviewed-source-95c812eb74e4.json`,'utf8'));
const decisions=(await readFile(`${base}/field-decisions.jsonl`,'utf8')).trim().split('\n').map(JSON.parse);
const finalSha='fa47591da49a9c8063d19118c768a59221950c332022e801ccd6a0dcf5e5e1ba';
if(createHash('sha256').update(await readFile('scripts/question-audit/russian-lesson-fixes.mjs')).digest('hex')!==finalSha)throw Error('Unreviewed source');
const set=await createPatchSet();russianLessonFixes(set);
const fields=[];
if(set.patches().length!==415||archive.rows.length!==415)throw Error('Unexpected row count');
for(const row of archive.rows){
 const old=row.patch,expected=structuredClone(old),p=set.patches().find(p=>p.id===old.id);
 const decision=decisions.find(d=>d.id===old.id&&d.decision==='revise');
 if(decision){expected.after.prompt=decision.recommended_after;expected.before.prompt=decision.before;}
 if(!eq(expected,p))throw Error(`Unreviewed change ${row.ref}`);
 if(decision)fields.push({...decision,after:p.after.prompt,decision:'approve_as_correction',source_sha256:finalSha,all_415_patches_exactly_compared:true});
}
if(fields.length!==2)throw Error('Incomplete followup');
await writeFile(`${base}/followup-field-decisions.jsonl`,fields.map(x=>JSON.stringify(x)).join('\n')+'\n');
console.log(JSON.stringify({all_rows_compared:415,approved_visible_prompts:2}));
