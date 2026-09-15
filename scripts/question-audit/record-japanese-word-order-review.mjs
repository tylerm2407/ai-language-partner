import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual as eq} from 'node:util';
import {createPatchSet,SNAPSHOT_SHA} from './patch-set.mjs';
import {lessonRefs} from './lesson-refs.mjs';
import {japaneseWordOrder,japaneseWordOrderFixes} from './japanese-word-order-fixes.mjs';
import {reviews,reviewedSourceSha} from '../../docs/audits/question-verification/remediation/ja-word-order-root-review/review-data.mjs';
import {gradeAnswer} from '../../lib/grading.ts';
const base='docs/audits/question-verification/remediation/ja-word-order-root-review';
const sha=x=>createHash('sha256').update(x).digest('hex');
if(sha(await readFile('scripts/question-audit/japanese-word-order-fixes.mjs'))!==reviewedSourceSha)throw Error('Unreviewed source');
if(reviews.length!==126||!eq(reviews.map(r=>r.ref),japaneseWordOrder.map(r=>r[0])))throw Error('Incomplete individual review');
const set=await createPatchSet();japaneseWordOrderFixes(set);
const get=lessonRefs(set.snapshot,'ja'),patches=new Map(set.patches().map(p=>[p.id,p]));
await mkdir(base,{recursive:true});
const archive=`${base}/reviewed-source-${reviewedSourceSha.slice(0,12)}.json`;
const archivedText=JSON.stringify({source_sha256:reviewedSourceSha,snapshot_sha256:SNAPSHOT_SHA,rows:japaneseWordOrder,patches:set.patches(),originals:reviews.map(r=>get(r.ref))},null,2)+'\n';
try{await writeFile(archive,archivedText,{flag:'wx'});}catch(e){if(e.code!=='EEXIST'||await readFile(archive,'utf8')!==archivedText)throw e;}
const fields=[],runtime=[];
for(const review of reviews){
 const {exercise:e,ref,course,unit,lesson}=get(review.ref),patch=patches.get(e.id),after={...e,...patch.after};
 const hints={exerciseHints:{exerciseType:e.type,skillType:e.skill_type,language:'ja'}};
 for(const answer of [after.correct_answer,...after.accepted_answers]){
  if(!gradeAnswer(answer,after.correct_answer,after.accepted_answers,hints).isCorrect)throw Error(`Rejected reviewed answer ${ref}`);
  runtime.push({ref,answer,accepted:true});
 }
 for(const field of Object.keys(patch.after)){
  const decision=review.ref===1534&&field==='prompt'?'revise':'approve_as_correction';
  fields.push({reviewer:'root, independent of author audit_german',reviewed_on:'2026-09-13',ref,table:'exercises',id:e.id,level:course.cefr_level,unit:unit.title,lesson:lesson.title,field,before:e[field],after:patch.after[field],decision,rationale:review.note,evidence:archive,evidence_sha256:sha(archivedText),source_sha256:reviewedSourceSha,snapshot_sha256:SNAPSHOT_SHA,...(decision==='revise'?{recommended_after:patch.after[field].replace('develops further','develops')}:{})});
 }
}
for(const[name,rows]of [['field-decisions',fields],['runtime-results',runtime]])await writeFile(`${base}/${name}.jsonl`,rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
console.log(JSON.stringify({rows:reviews.length,fields:fields.length,approved:fields.filter(f=>f.decision==='approve_as_correction').length,pending:fields.filter(f=>f.decision==='revise').map(f=>`${f.ref}.${f.field}`),accepted_runtime_answers:runtime.length,integrated:false}));
