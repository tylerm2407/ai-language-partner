import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual as eq} from 'node:util';
import {createPatchSet} from './patch-set.mjs';
import {lessonRefs} from './lesson-refs.mjs';
import {koreanWordOrder,koreanWordOrderFixes} from './korean-word-order-fixes.mjs';
import {gradeAnswer} from '../../lib/grading.ts';
const base='docs/audits/question-verification/remediation/ko-word-order-root-review';
const archive=JSON.parse(await readFile(`${base}/reviewed-source-09cc155c618f.json`,'utf8'));
const finalSha='38efee31665454c77084cbd375a0ecf217fc725ea53950eea310d1cc206621b0';
const source=await readFile('scripts/question-audit/korean-word-order-fixes.mjs','utf8');
const sha=x=>createHash('sha256').update(x).digest('hex');
if(sha(source)!==finalSha)throw Error('Changed follow-up source');
const newOrders=new Map([[590,[0,1,3,4,2,5]],[1915,[0,1,2,3,4,7,5,6,8,9]]]);
const expected=structuredClone(archive.rows);
for(const row of expected)if(newOrders.has(row[0]))row[4].push(newOrders.get(row[0]));
if(!eq(expected,koreanWordOrder))throw Error('Unreviewed changes outside two requested orders');
const set=await createPatchSet();koreanWordOrderFixes(set);
const get=lessonRefs(set.snapshot,'ko'),fields=[],runtime=[];
for(const[n,order]of newOrders){
 const{exercise:e,ref}=get(n),p=set.patches().find(p=>p.id===e.id),old=archive.patches.find(p=>p.id===e.id),answer=order.map(i=>p.after.metadata.tiles[i]).join(' ');
 const hints={exerciseHints:{exerciseType:e.type,skillType:e.skill_type,language:'ko'}};
 if(gradeAnswer(answer,old.after.correct_answer,old.after.accepted_answers??e.accepted_answers,hints).isCorrect||!gradeAnswer(answer,p.after.correct_answer,p.after.accepted_answers,hints).isCorrect)throw Error('No actual rejection repair');
 fields.push({reviewer:'root, independent of audit_german',reviewed_on:'2026-09-13',ref,table:'exercises',id:e.id,field:'accepted_answers',before:e.accepted_answers,after:p.after.accepted_answers,decision:'approve_as_correction',rationale:n===590?'The age complement may precede next-year timing while retaining subject and ending.':'The manner adverb may precede the embedded what-is-wrong question, while retaining both anchors.',source_sha256:finalSha,evidence:`${base}/reviewed-source-09cc155c618f.json`,all_110_tuples_compared:true});
 runtime.push({ref,answer,before:false,after:true});
}
await writeFile(`${base}/followup-field-decisions.jsonl`,fields.map(x=>JSON.stringify(x)).join('\n')+'\n');
await writeFile(`${base}/followup-runtime-results.jsonl`,runtime.map(x=>JSON.stringify(x)).join('\n')+'\n');
console.log(JSON.stringify({all_rows_compared:110,approved_fields:2,actual_valid_answers_fixed:2,source_sha256:finalSha}));
