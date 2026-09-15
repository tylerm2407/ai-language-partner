import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual as eq} from 'node:util';
import {createPatchSet} from './patch-set.mjs';
import {gradeAnswer} from '../../lib/grading.ts';
import {frenchTopicFixes} from '../../docs/audits/question-verification/remediation/fr-pt-ru/french-topic-proposals.mjs';
const base='docs/audits/question-verification/remediation/fr-topic-root-review';
const sourceSha=createHash('sha256').update(await readFile('docs/audits/question-verification/remediation/fr-pt-ru/french-topic-proposals.mjs')).digest('hex');
if(sourceSha!=='f41b1fe18faaf79a47db55cd1125fb1440849292b569e0b321b362189a5236bb')throw Error('Unreviewed source');
const archive=JSON.parse(await readFile(`${base}/reviewed-source-af27c1793d88.json`,'utf8'));
const initial=(await readFile(`${base}/field-decisions.jsonl`,'utf8')).trim().split('\n').map(JSON.parse);
const set=await createPatchSet();frenchTopicFixes(set);const fields=[];
for(const row of archive.rows){
 const expected=structuredClone(row.patch),added=row.ref==='fr-E0318'?'Il fait du vent.':row.ref==='fr-E0319'?"It's nice.":null;
 if(added)expected.after.accepted_answers.push(added);
 const actual=set.patches().find(p=>p.id===row.exercise.id);
 if(!eq(actual,expected))throw Error(`Unexpected whole-patch difference ${row.ref}`);
 if(!added)continue;
 const hints={exerciseHints:{exerciseType:row.exercise.type,skillType:row.exercise.skill_type,targetGrammar:row.exercise.target_grammar,language:'fr'}};
 if(gradeAnswer(added,actual.after.correct_answer,row.patch.after.accepted_answers,hints).isCorrect||!gradeAnswer(added,actual.after.correct_answer,actual.after.accepted_answers,hints).isCorrect)throw Error('Missing rejected-valid repair');
 fields.push({...initial.find(f=>f.id===row.exercise.id&&f.field==='accepted_answers'),after:actual.after.accepted_answers,decision:'approve_as_correction',source_sha256:sourceSha,rationale:row.ref==='fr-E0318'?'Root and author verified Il fait du vent in Larousse and Académie; exact addition now passes.':'Root and author approve contracted It’s nice for fine weather; this was rejected while the three other requested ordinary variants already passed. Exact full-patch comparison permits only this array addition.'});
}
if(fields.length!==2)throw Error('Incomplete followup');
await writeFile(`${base}/followup-field-decisions.jsonl`,fields.map(f=>JSON.stringify(f)).join('\n')+'\n');
console.log(JSON.stringify({exact_followup_fields:2,unchanged_other_rows:8,integrated:false}));
