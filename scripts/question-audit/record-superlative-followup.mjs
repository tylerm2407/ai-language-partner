import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual as eq} from 'node:util';
import {createPatchSet} from './patch-set.mjs';
import {a2SuperlativeFixes} from '../../docs/audits/question-verification/remediation/de-it-zh/a2-superlative-fixes.mjs';
import {gradeAnswer} from '../../lib/grading.ts';
const base='docs/audits/question-verification/remediation/superlative-root-review';
const archive=JSON.parse(await readFile(`${base}/reviewed-source-b0effb08066a.json`,'utf8'));
const decisions=(await readFile(`${base}/field-decisions.jsonl`,'utf8')).trim().split('\n').map(JSON.parse);
const finalSha='a0af91acffa59a1f04d8293c2dce6736b9cf8d9dacf3fb545a3b4b7e2ce7ee6e';
if(createHash('sha256').update(await readFile('docs/audits/question-verification/remediation/de-it-zh/a2-superlative-fixes.mjs')).digest('hex')!==finalSha)throw Error('Unreviewed source');
const set=await createPatchSet();a2SuperlativeFixes(set);
const fields=[],runtime=[];
for(const row of archive.rows){
 const old=row.patch,expected=structuredClone(old),p=set.patches().find(p=>p.id===old.id);
 const decision=decisions.find(d=>d.id===p.id&&d.decision==='revise');
 if(decision)expected.after.accepted_answers=decision.recommended_after;
 if(!eq(expected,p))throw Error(`Unreviewed change ${row.ref}`);
 if(!decision)continue;
 const e={...row.exercise,...p.after},hints={exerciseHints:{exerciseType:e.type,skillType:e.skill_type,targetGrammar:e.target_grammar,language:row.course.language}};
 for(const answer of p.after.accepted_answers.filter(a=>!old.after.accepted_answers.includes(a))){
  if(gradeAnswer(answer,e.correct_answer,old.after.accepted_answers,hints).isCorrect||!gradeAnswer(answer,e.correct_answer,e.accepted_answers,hints).isCorrect)throw Error('Missing actual repair');
  runtime.push({ref:row.ref,answer,before:false,after:true});
 }
 fields.push({...decision,after:p.after.accepted_answers,decision:'approve_as_correction',source_sha256:finalSha,all_18_patches_exactly_compared:true});
}
if(fields.length!==6||runtime.length!==28)throw Error('Incomplete followup');
await writeFile(`${base}/followup-field-decisions.jsonl`,fields.map(x=>JSON.stringify(x)).join('\n')+'\n');
await writeFile(`${base}/followup-runtime-results.jsonl`,runtime.map(x=>JSON.stringify(x)).join('\n')+'\n');
console.log(JSON.stringify({all_rows_compared:18,approved_arrays:6,repaired_valid_answers:28}));
