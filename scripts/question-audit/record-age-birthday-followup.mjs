import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual as eq} from 'node:util';
import {createPatchSet} from './patch-set.mjs';
import {gradeAnswer} from '../../lib/grading.ts';
import {a1AgeBirthdayFixes} from '../../docs/audits/question-verification/remediation/de-it-zh/a1-age-birthday-fixes.mjs';
const base='docs/audits/question-verification/remediation/age-birthday-root-review';
const sourceSha=createHash('sha256').update(await readFile('docs/audits/question-verification/remediation/de-it-zh/a1-age-birthday-fixes.mjs')).digest('hex');
if(sourceSha!=='e1bbc1faba1ceb00a00213aab5964e720bca9b39198b82f4a1c956ed6da554c7')throw Error('Unreviewed source');
const archive=JSON.parse(await readFile(`${base}/reviewed-source-ab34dcf92838.json`,'utf8'));
const initial=(await readFile(`${base}/field-decisions.jsonl`,'utf8')).trim().split('\n').map(JSON.parse);
const set=await createPatchSet();a1AgeBirthdayFixes(set);const fields=[];
for(const row of archive.rows){
 const expected=structuredClone(row.patch),target=row.ref==='de-E0380';
 if(target)expected.after.accepted_answers.push('Ich habe Geburtstag am achten Juni.');
 const actual=set.patches().find(p=>p.id===row.exercise.id);
 if(!eq(actual,expected))throw Error(`Unreviewed patch delta ${row.ref}`);
 if(!target)continue;
 const e=row.exercise,answer='Ich habe Geburtstag am achten Juni.';
 const hints={exerciseHints:{exerciseType:e.type,skillType:actual.after.skill_type,targetGrammar:actual.after.target_grammar,language:'de'}};
 if(gradeAnswer(answer,actual.after.correct_answer,row.patch.after.accepted_answers,hints).isCorrect||!gradeAnswer(answer,actual.after.correct_answer,actual.after.accepted_answers,hints).isCorrect)throw Error('Missing runtime repair');
 const old=initial.find(f=>f.ref===row.ref&&f.field==='accepted_answers');
 fields.push({...old,after:actual.after.accepted_answers,decision:'approve_as_correction',source_sha256:sourceSha,rationale:'Root and author independently approve the ordinary postposed date after Geburtstag, preserving the requested written June8 date. All18 whole patches were compared; this is the only difference.'});
}
if(fields.length!==1)throw Error('Incomplete followup');
await writeFile(`${base}/followup-field-decisions.jsonl`,JSON.stringify(fields[0])+'\n');
console.log(JSON.stringify({exact_followup_fields:1,unchanged_other_rows:17}));
