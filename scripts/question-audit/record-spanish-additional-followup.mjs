import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual as eq} from 'node:util';
import {createPatchSet} from './patch-set.mjs';
import {lessonRefs} from './lesson-refs.mjs';
import {gradeAnswer} from '../../lib/grading.ts';
import {spanishLessonFixes} from './spanish-lesson-fixes.mjs';
import {spanishLessonAdditionalFixes} from './spanish-lesson-additional-fixes.mjs';
import {spanishExplanationFollowupFixes} from './spanish-explanation-followup-fixes.mjs';
import {selectSpanishNarrowWithSearchAlternatives,selectSpanishGrammarWithOrderAlternative} from './spanish-approved-followup-composition.mjs';
const base='docs/audits/question-verification/remediation/es-additional-root-review';
const explanationSha=createHash('sha256').update(await readFile('scripts/question-audit/spanish-explanation-followup-fixes.mjs')).digest('hex');
if(explanationSha!=='345496f3390dd85224c9a6b06cffac191009f4d0c9cd5a4f6bd5b667ad51cffc')throw Error('Unreviewed explanation');
const before=await createPatchSet();spanishLessonFixes(before);spanishLessonAdditionalFixes(before);
const after=await createPatchSet();spanishLessonFixes(selectSpanishNarrowWithSearchAlternatives(after));spanishLessonAdditionalFixes(selectSpanishGrammarWithOrderAlternative(after));spanishExplanationFollowupFixes(after);
const get=lessonRefs(after.snapshot,'es'),fields=[],runtime=[];
for(const n of [2238,2279,2294]){
 const full=get(n),e=full.exercise,old=before.patches().find(p=>p.id===e.id),next=after.patches().find(p=>p.id===e.id);
 for(const[field,value]of Object.entries(next.after)){
  if(eq(old?.after[field],value))continue;
  if(!((n===2238&&field==='explanation')||(n===2279&&['accepted_answers','explanation'].includes(field))||(n===2294&&field==='accepted_answers')))throw Error('Unexpected followup field');
  const rationale=field==='explanation'?(n===2238?'Tenga is first/third singular; context, not a uniquely-he ending, permits omitted él. RAE conjugation verifies this.':'FundéuRAE confirms periphrastic passives are not categorically wrong; revised explanation keeps idiomatic se preference for this notice.'):(n===2279?'All four original tiles form a valid topic-fronted language-use notice, independently agreed by root and author.':'Explicit yo and una persona retain the current non-specific sales-experience meaning and subjunctive, independently agreed by root and author.');
  fields.push({reviewer:'root and audit_german independently adjudicated',reviewed_on:'2026-09-13',ref:full.ref,table:'exercises',id:e.id,field,before:e[field],after:value,decision:'approve_as_correction',rationale,sources:field==='explanation'?next.sources:[],source_sha256:field==='explanation'?explanationSha:null});
  if(field==='accepted_answers')for(const answer of value.filter(a=>!old.after.accepted_answers.includes(a))){
   const hints={exerciseHints:{exerciseType:e.type,skillType:e.skill_type,targetGrammar:e.target_grammar,language:'es'}};
   if(gradeAnswer(answer,e.correct_answer,old.after.accepted_answers,hints).isCorrect||!gradeAnswer(answer,e.correct_answer,value,hints).isCorrect)throw Error('Missing runtime improvement');
   if(n===2279&&!eq(answer.toLowerCase().split(' ').sort(),e.metadata.tiles.map(t=>t.toLowerCase()).sort()))throw Error('Invalid tile inventory');
   runtime.push({ref:full.ref,answer,before:false,after:true});
  }
 }
}
if(fields.length!==3||runtime.length!==3)throw Error('Incomplete followup');
for(const p of before.patches()){
 const actual=after.patches().find(x=>x.id===p.id);
 for(const[k,v]of Object.entries(p.after))if(!fields.some(f=>f.id===p.id&&f.field===k)&&!eq(v,actual.after[k]))throw Error('Unrelated source change');
}
await writeFile(`${base}/followup-field-decisions.jsonl`,fields.map(f=>JSON.stringify(f)).join('\n')+'\n');
await writeFile(`${base}/followup-runtime-results.jsonl`,runtime.map(f=>JSON.stringify(f)).join('\n')+'\n');
console.log(JSON.stringify({exact_followup_fields:3,added_valid_answers:3,unrelated_before_fields_preserved:true,already_corrected_E2238_explanation_preserved:true}));
