import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual as eq} from 'node:util';
import {createPatchSet} from './patch-set.mjs';
import {a2AgeFixes} from '../../docs/audits/question-verification/remediation/de-it-zh/a2-age-fixes.mjs';
import {gradeAnswer} from '../../lib/grading.ts';
const base='docs/audits/question-verification/remediation/a2-age-root-review';
const archive=JSON.parse(await readFile(`${base}/reviewed-source-f59820a6059e.json`,'utf8'));
const decisions=(await readFile(`${base}/field-decisions.jsonl`,'utf8')).trim().split('\n').map(JSON.parse);
const finalSha='ba61449eea0ca6d7be2627ea2bdd1b73291479e8be0cf37b1e539f5635cfcda0';
if(createHash('sha256').update(await readFile('docs/audits/question-verification/remediation/de-it-zh/a2-age-fixes.mjs')).digest('hex')!==finalSha)throw Error('Unreviewed source');
const set=await createPatchSet();a2AgeFixes(set);
const fields=[],runtime=[];
if(set.patches().length!==archive.rows.length)throw Error('Unexpected row count');
for(const row of archive.rows){
 const old=row.patch,expected=structuredClone(old),p=set.patches().find(p=>p.id===old.id);
 const decision=decisions.find(d=>d.id===old.id&&d.decision==='revise');
 if(decision)expected.after.accepted_answers=decision.recommended_after;
 if(!eq(expected,p))throw Error(`Unreviewed change ${row.ref}`);
 if(!decision)continue;
 const e={...row.exercise,...p.after},hints={exerciseHints:{exerciseType:e.type,skillType:e.skill_type,targetGrammar:e.target_grammar,language:row.course.language}};
 for(const answer of p.after.accepted_answers.filter(a=>!old.after.accepted_answers.includes(a))){
  if(gradeAnswer(answer,e.correct_answer,old.after.accepted_answers,hints).isCorrect||!gradeAnswer(answer,e.correct_answer,e.accepted_answers,hints).isCorrect)throw Error(`Missing actual repair: ${answer}`);
  runtime.push({ref:row.ref,answer,before:false,after:true});
 }
 fields.push({...decision,after:p.after.accepted_answers,decision:'approve_as_correction',source_sha256:finalSha,all_18_patches_exactly_compared:true});
}
if(fields.length!==5||runtime.length!==30)throw Error('Incomplete followup');
await writeFile(`${base}/followup-field-decisions.jsonl`,fields.map(x=>JSON.stringify(x)).join('\n')+'\n');
await writeFile(`${base}/followup-runtime-results.jsonl`,runtime.map(x=>JSON.stringify(x)).join('\n')+'\n');
console.log(JSON.stringify({all_rows_compared:18,approved_arrays:5,repaired_valid_answers:30}));
