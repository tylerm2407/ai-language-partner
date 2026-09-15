import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual as eq} from 'node:util';
import {createPatchSet} from './patch-set.mjs';
import {russianWordOrderFixes} from './russian-word-order-fixes.mjs';
import {gradeAnswer} from '../../lib/grading.ts';
const base='docs/audits/question-verification/remediation/ru-word-order-root-review';
const archive=JSON.parse(await readFile(`${base}/reviewed-source-2c8409a63484.json`,'utf8'));
const adjudication=JSON.parse(await readFile(`${base}/root-candidate-adjudication.json`,'utf8'));
const decisions=(await readFile(`${base}/field-decisions.jsonl`,'utf8')).trim().split('\n').map(JSON.parse);
const final='829a2f21400c45225326f2e8132a99414f80509dfb483c4b777af71359d06e92';
if(createHash('sha256').update(await readFile('scripts/question-audit/russian-word-order-fixes.mjs')).digest('hex')!==final)throw Error('Unreviewed source');
const set=await createPatchSet();russianWordOrderFixes(set);
const fields=[],runtime=[];
if(set.patches().length!==103)throw Error('Unexpected rows');
for(const original of archive.originals){
 const old=archive.patches.find(p=>p.id===original.exercise.id),expected=structuredClone(old),p=set.patches().find(p=>p.id===old.id);
 const more=adjudication.results.filter(r=>r.id===old.id&&r.root_decision==='request_exact_addition').map(r=>r.candidate);
 if(more.length)expected.after.accepted_answers.push(...more);
 if(!eq(expected,p))throw Error(`Unexpected delta ${original.ref}`);
 const pending=decisions.filter(d=>d.id===old.id&&d.decision==='revise');
 for(const answer of more){
  const e={...original.exercise,...p.after},hints={exerciseHints:{exerciseType:e.type,skillType:e.skill_type,language:'ru'}};
  if(gradeAnswer(answer,e.correct_answer,old.after.accepted_answers,hints).isCorrect||!gradeAnswer(answer,e.correct_answer,e.accepted_answers,hints).isCorrect)throw Error('Missing actual repair');
  runtime.push({ref:original.ref,answer,before:false,after:true});
 }
 for(const d of pending)fields.push({...d,after:p.after[d.field],decision:'approve_as_correction',rationale:more.length?'Exact independently approved tile-preserving additions; all other fields unchanged.':'Original E1660 array retained: proposed punctuation-changing sentences are not constructible from the literal bank. See root-candidate-adjudication.json.',source_sha256:final,all_103_patches_exactly_compared:true});
}
if(fields.length!==3||runtime.length!==5)throw Error('Incomplete followup');
await writeFile(`${base}/followup-field-decisions.jsonl`,fields.map(x=>JSON.stringify(x)).join('\n')+'\n');
await writeFile(`${base}/followup-runtime-results.jsonl`,runtime.map(x=>JSON.stringify(x)).join('\n')+'\n');
console.log(JSON.stringify({all_rows_compared:103,approved_arrays:3,repaired_answers:5}));
