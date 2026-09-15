import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual as eq} from 'node:util';
import {createPatchSet} from './patch-set.mjs';
import {gradeAnswer} from '../../lib/grading.ts';
import {b1RealConditionFixes} from '../../docs/audits/question-verification/remediation/de-it-zh/b1-real-condition-fixes.mjs';
import {ageBirthdayFixes} from './es-ja-ko-a1-age-birthday-fixes.mjs';
import {superlativeFixes} from './es-ja-ko-a2-superlative-fixes.mjs';
import {b1HypotheticalConditionFixes} from '../../docs/audits/question-verification/remediation/de-it-zh/b1-hypothetical-condition-fixes.mjs';
import {pastProgressiveFixes} from './es-ja-ko-b1-past-progressive-fixes.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
if(sha(await readFile('scripts/question-audit/topic-repair-helpers.mjs'))!=='122867600b13d45539fcaecf2a7ceaa514ad9a4f132787d44433535a058b8f2c')throw Error('Changed helper');
const configs=[
 {base:'es-ja-ko-progressive-root-review',initial:'7a5f0f19d74e',source:'scripts/question-audit/es-ja-ko-b1-past-progressive-fixes.mjs',final:'6803f2a30e25de67ec01a2b9542e6fffafc03f78364a33ed3f91c0cb48a58878',apply:pastProgressiveFixes,rows:12,fields:1,answers:8},
 {base:'hypothetical-condition-root-review',initial:'4b4fa4447b02',source:'docs/audits/question-verification/remediation/de-it-zh/b1-hypothetical-condition-fixes.mjs',final:'e8999e3659abba8ff990eb8f6feb121a011a58e4cd8fa224ba01641ac12ee2ab',apply:b1HypotheticalConditionFixes,rows:18,fields:2,answers:50},
 {base:'real-condition-root-review',initial:'6b527f6aa319',source:'docs/audits/question-verification/remediation/de-it-zh/b1-real-condition-fixes.mjs',final:'18662294f766bcfcb8a84572e78d13d165dc909742d64344115abad3caabc16e',apply:b1RealConditionFixes,rows:18,fields:8,answers:93},
 {base:'es-ja-ko-age-root-review',initial:'ac4416f9ed1e',source:'scripts/question-audit/es-ja-ko-a1-age-birthday-fixes.mjs',final:'cfd8b0334f11a78844320d82f97f3455f980379d0b5f9831a147b6bc68efd4fd',apply:ageBirthdayFixes,rows:12,fields:4,answers:18},
 {base:'es-ja-ko-superlative-root-review',initial:'7e8d6a50740f',source:'scripts/question-audit/es-ja-ko-a2-superlative-fixes.mjs',final:'b46db711b756403d20e2e476cbd83c3575d17f37feb8dc69afb8ff3d7ee164ac',apply:superlativeFixes,rows:12,fields:5,answers:64},
];
for(const config of configs){
 const base=`docs/audits/question-verification/remediation/${config.base}`;
 const archive=JSON.parse(await readFile(`${base}/reviewed-source-${config.initial}.json`,'utf8'));
 const decisions=(await readFile(`${base}/field-decisions.jsonl`,'utf8')).trim().split('\n').map(JSON.parse);
 if(sha(await readFile(config.source))!==config.final)throw Error('Unreviewed source');
 const set=await createPatchSet();config.apply(set);
 if(set.patches().length!==config.rows||archive.rows.length!==config.rows)throw Error('Unexpected rows');
 const fields=[],runtime=[];
 for(const row of archive.rows){
  const old=row.patch,expected=structuredClone(old),p=set.patches().find(p=>p.id===old.id);
  const revisions=decisions.filter(d=>d.id===old.id&&d.decision==='revise');
  for(const d of revisions){expected.after[d.field]=d.recommended_after;expected.before[d.field]=d.before;}
  if(!eq(expected,p))throw Error(`Unreviewed change ${row.ref}`);
  const e={...row.exercise,...p.after},hints={exerciseHints:{exerciseType:e.type,skillType:e.skill_type,targetGrammar:e.target_grammar,language:row.course.language}};
  for(const d of revisions){
   const previous=old.after.accepted_answers??row.exercise.accepted_answers;
   for(const answer of p.after.accepted_answers.filter(a=>!previous.includes(a))){
    const before=gradeAnswer(answer,e.correct_answer,previous,hints).isCorrect;
    const after=gradeAnswer(answer,e.correct_answer,e.accepted_answers,hints).isCorrect;
    if(!after)throw Error(`Rejected approved answer ${row.ref}: ${answer}`);
    runtime.push({ref:row.ref,answer,before,after});
   }
   fields.push({...d,after:p.after[d.field],decision:'approve_as_correction',source_sha256:config.final,all_batch_patches_exactly_compared:true});
  }
 }
 if(fields.length!==config.fields||runtime.length!==config.answers)throw Error('Incomplete followup');
 await writeFile(`${base}/followup-field-decisions.jsonl`,fields.map(x=>JSON.stringify(x)).join('\n')+'\n');
 await writeFile(`${base}/followup-runtime-results.jsonl`,runtime.map(x=>JSON.stringify(x)).join('\n')+'\n');
 console.log(JSON.stringify({batch:config.base,all_rows_compared:config.rows,approved_fields:fields.length,valid_answers:runtime.length,repaired:runtime.filter(x=>!x.before).length}));
}
