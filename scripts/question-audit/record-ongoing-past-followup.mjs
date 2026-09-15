import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual as eq} from 'node:util';
import {createPatchSet} from './patch-set.mjs';
import {b1OngoingPastFixes} from '../../docs/audits/question-verification/remediation/de-it-zh/b1-ongoing-past-fixes.mjs';
import {gradeAnswer} from '../../lib/grading.ts';
const base='docs/audits/question-verification/remediation/ongoing-past-root-review';
const archive=JSON.parse(await readFile(`${base}/reviewed-source-b89f74a2f661.json`,'utf8'));
const decisions=(await readFile(`${base}/field-decisions.jsonl`,'utf8')).trim().split('\n').map(JSON.parse);
const finalSha='eef8ba7e87c0e1b149c894a6fe52cf4da07c0091b9120b3b9c4fcc843ab932b5';
if(createHash('sha256').update(await readFile('docs/audits/question-verification/remediation/de-it-zh/b1-ongoing-past-fixes.mjs')).digest('hex')!==finalSha)throw Error('Unreviewed source');
const set=await createPatchSet();b1OngoingPastFixes(set);
const fields=[],runtime=[];
if(set.patches().length!==archive.rows.length)throw Error('Unexpected row count');
for(const row of archive.rows){
 const old=row.patch,expected=structuredClone(old),p=set.patches().find(p=>p.id===old.id);
 const revisions=decisions.filter(d=>d.id===old.id&&d.decision==='revise');
 for(const d of revisions){expected.after[d.field]=d.recommended_after;expected.before[d.field]=d.before;}
 if(!eq(expected,p))throw Error(`Unreviewed change ${row.ref}`);
 const e={...row.exercise,...p.after},hints={exerciseHints:{exerciseType:e.type,skillType:e.skill_type,targetGrammar:e.target_grammar,language:row.course.language}};
 for(const decision of revisions){
  if(decision.field==='accepted_answers')for(const answer of p.after.accepted_answers.filter(a=>!(old.after.accepted_answers??row.exercise.accepted_answers).includes(a))){
   if(gradeAnswer(answer,e.correct_answer,old.after.accepted_answers??row.exercise.accepted_answers,hints).isCorrect||!gradeAnswer(answer,e.correct_answer,e.accepted_answers,hints).isCorrect)throw Error(`Missing actual repair: ${answer}`);
   runtime.push({ref:row.ref,answer,before:false,after:true});
  }
  fields.push({...decision,after:p.after[decision.field],decision:'approve_as_correction',source_sha256:finalSha,all_18_patches_exactly_compared:true});
 }
}
if(fields.length!==6||runtime.length!==29)throw Error('Incomplete followup');
await writeFile(`${base}/followup-field-decisions.jsonl`,fields.map(x=>JSON.stringify(x)).join('\n')+'\n');
await writeFile(`${base}/followup-runtime-results.jsonl`,runtime.map(x=>JSON.stringify(x)).join('\n')+'\n');
console.log(JSON.stringify({all_rows_compared:18,approved_fields:6,repaired_valid_answers:29}));
