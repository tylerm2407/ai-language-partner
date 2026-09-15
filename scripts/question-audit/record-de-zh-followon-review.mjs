import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createPatchSet} from './patch-set.mjs';
import {lessonRefs} from './lesson-refs.mjs';
import {gradeAnswer} from '../../lib/grading.ts';
import {deA1WorkFamilyHealthCandidates} from '../../docs/audits/question-verification/remediation/de-it-zh/de-a1-work-family-health-candidates.mjs';
import {zhB2GrammarAlternativeCandidates} from '../../docs/audits/question-verification/remediation/de-it-zh/zh-b2-grammar-alternatives.mjs';
const base='docs/audits/question-verification/remediation/de-zh-followon-root-review';
const definitions=[
 ['de','de-a1-work-family-health-candidates.mjs','51eda62870035afe11286bad856cee9d171b7b4c97c769587b9b62850b31e2e2',deA1WorkFamilyHealthCandidates,[
  [282,'Unspecified doctor gender admits Ärztin.'],[295,'Read is a valid bare English verb for Lesen.'],[307,'Cook is a valid bare English verb for Kochen.'],
  [319,'Football is the British/international equivalent of Fußball; weather placement remains separate.'],
  [324,'Fre plus undin makes the feminine friend; weather placement remains separate.'],[336,'Leh plus rerin makes Lehrerin without a male-only clue.'],
  [346,'Freundin correctly names a female friend when gender is unspecified.'],[352,'Papa is valid familiar father without a formal-register restriction.'],
  [357,'Grandma preserves the grandmother relation.'],[368,'Oma is a valid familiar grandmother.'],[369,'Grandpa preserves the grandfather relation.'],
  [380,'Opa is valid familiar grandfather; not proof of age-production coverage.'],[401,'Grandma remains valid in family activities.'],
  [412,'Oma remains valid in unrestricted family review.'],[413,'Grandpa remains valid in unrestricted family review.'],
  [417,'Mom and Mum are ordinary American/British mother equivalents.'],[422,'Raum has the enclosed-room sense required by home context.'],
  [446,'Bad is a standard shortened bathroom term; no demand for a compound.'],[498,'Sch plus merzen forms plural Schmerzen, a normal equivalent of mass-noun pain.'],
  [508,'Medikament/Arzneimittel fit remedy sense; Arznei is valid but dated per Duden, not promoted as usual modern usage.'],
  [516,'Cambridge explicitly gives both organ Magen and belly Bauch senses of unqualified stomach.'],[517,'Ill directly translates Krank in doctor context.'],
  [530,'Med plus ikament makes medication; fixed underscores do not prescribe Medizin’s length.'],
  [542,'Schmerzen again correctly expresses bodily pain; no singular-only clue.'],[552,'Health-review medicine permits the same remedy terms; dated Arznei is only an accepted alternative.'],
 ]],
 ['zh','zh-b2-grammar-alternatives.mjs','b467969c05eebf2e53813fc60ffd7011e87af1644bacd27a2f8ccd64cadc176d',zhB2GrammarAlternativeCandidates,[
  [2238,'Reduplicated 开开 is an elaborated opening verb after 把; 您 is an unrestricted polite addressee.'],
  [2252,'Already with completed/clean washing preserves the unmarked passive and obeys explicit WITHOUT 被. Separate explanation repair is not replaced.'],
  [2266,'All four retain 得 and clear hearing: short 清, 能 with potential, speech topic, or object plus repeated verb. The visible cue includes optional you.'],
  [2288,'愈来愈 completes the increasing-heat sentence; the cue does not explicitly require 越来越 characters.'],
  [2294,'Both Chinese-language nouns with 有趣 and no final 了 preserve developing interest and required 越来越.'],
 ]],
];
await mkdir(base,{recursive:true});
const sha=x=>createHash('sha256').update(x).digest('hex'),fields=[],rows=[],runtime=[];
for(const[lang,file,expected,build,notes]of definitions){
 const path=`docs/audits/question-verification/remediation/de-it-zh/${file}`;
 if(sha(await readFile(path))!==expected)throw Error('Unreviewed source');
 const set=await createPatchSet();build(set);const get=lessonRefs(set.snapshot,lang);
 if(set.patches().length!==notes.length)throw Error('Incomplete review');
 for(const[n,note]of notes){
  const full=get(n),e=full.exercise,p=set.patches().find(p=>p.id===e.id);
  rows.push({...full,patch:p,root_note:note});
  const hints={exerciseHints:{exerciseType:e.type,skillType:e.skill_type,targetGrammar:e.target_grammar,language:lang}};
  for(const answer of p.after.accepted_answers.filter(a=>!e.accepted_answers.includes(a))){
   if(gradeAnswer(answer,e.correct_answer,e.accepted_answers,hints).isCorrect||!gradeAnswer(answer,e.correct_answer,p.after.accepted_answers,hints).isCorrect)throw Error(`Missing actual rejection repair ${full.ref}`);
   runtime.push({ref:full.ref,answer,before:false,after:true});
  }
  fields.push({reviewer:'root, independent of author audit_french',reviewed_on:'2026-09-13',ref:full.ref,table:'exercises',id:e.id,field:'accepted_answers',before:e.accepted_answers,after:p.after.accepted_answers,decision:'approve_as_correction',rationale:note,sources:p.sources,source_sha256:expected});
 }
}
const archive=`${base}/reviewed-batch.json`,body=JSON.stringify({rows},null,2)+'\n';
try{await writeFile(archive,body,{flag:'wx'});}catch(e){if(e.code!=='EEXIST'||await readFile(archive,'utf8')!==body)throw e;}
await writeFile(`${base}/field-decisions.jsonl`,fields.map(f=>JSON.stringify({...f,evidence:archive,evidence_sha256:sha(body)})).join('\n')+'\n');
await writeFile(`${base}/runtime-results.jsonl`,runtime.map(r=>JSON.stringify(r)).join('\n')+'\n');
console.log(JSON.stringify({exact_rows:rows.length,exact_fields:fields.length,actual_valid_answer_repairs:runtime.length}));
