import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createPatchSet} from './patch-set.mjs';
import {lessonRefs} from './lesson-refs.mjs';
import {b1RealConditionFixes} from '../../docs/audits/question-verification/remediation/de-it-zh/b1-real-condition-fixes.mjs';
const base='docs/audits/question-verification/remediation/real-condition-root-review';
const source='docs/audits/question-verification/remediation/de-it-zh/b1-real-condition-fixes.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const expected='6b527f6aa3199fa2e7c3e35bd65955e5ba61f6febccf8ff4dcfda303d7310b3a';
if(sha(await readFile(source))!==expected)throw Error('Unreviewed source');
const set=await createPatchSet();b1RealConditionFixes(set);
const rows=[],fields=[],originals=[],additions={de:{},it:{},zh:{}};
const notes={
 1641:'Rain tomorrow is the stated condition for staying home, not a prediction that rain is certain or a biconditional sunny-day plan. All alternate choices change condition or time.',
 1642:'Full rain/stay-home relation with visible present-form selectors in DE/IT, no imported obligatory future morphology. DE verb-final wenn and main inversion; optional so and inserted wenn clause valid. IT noi/allora order variants valid. ZH 如果/就/明天 selects conditional future meaning, but does not require 在; colloquial 待家里 preserves location.',
 1643:'Late/delayed bus tomorrow conditions walking to school; English will/walk and If the bus opening visible. Optional then expresses same consequence, preserving each late/arrives-late/running-late/delayed variant and contraction.',
 1644:'Explicit present-form or closed result/contrast selector uniquely requires regnet, piove, 就. No assertion that 却 is always ungrammatical or that target languages copy English will morphology.',
 1647:'Genuine source errors: German main-clause placement, Italian noi/resta agreement, Chinese 就 inserted inside 家里. Visible correction instructions preserve words/order except selected repair. IT/ZH introductory comma optional, so missing-comma answers also valid.',
 1650:'Given the late-bus condition, walking is stated result. Taxi/home/cancel-school not supported, and no conclusion about on-time bus is imposed.',
};
for(const lang of ['de','it','zh']){
 const get=lessonRefs(set.snapshot,lang);
 originals.push({language:lang,questions:Array.from({length:14},(_,i)=>get(1641+i))});
 for(const n of [1641,1642,1643,1644,1647,1650]){
  const full=get(n),e=full.exercise,p=set.patches().find(p=>p.id===e.id),all=[p.after.correct_answer,...(p.after.accepted_answers??e.accepted_answers)];
  if(lang==='de'&&n===1642)additions.de[n]=['Wenn es morgen regnet, so bleiben wir zu Hause.','Wenn es morgen regnet, so bleiben wir zuhause.','Wir bleiben, wenn es morgen regnet, zu Hause.','Wir bleiben, wenn es morgen regnet, zuhause.'];
  if(n===1643)additions[lang][n]=all.map(x=>x.replace(/ (we will|we'll)/,' then $1'));
  if(lang==='it'&&n===1642)additions.it[n]=['Se domani piove, noi allora restiamo a casa.','Se domani piove noi allora restiamo a casa.','Se piove domani, noi allora restiamo a casa.','Se piove domani noi allora restiamo a casa.'];
  if(lang==='it'&&n===1647)additions.it[n]=all.map(x=>x.replace(',',''));
  if(lang==='zh'&&n===1642)additions.zh[n]=all.map(x=>x.replace('待在','待'));
  if(lang==='zh'&&n===1647)additions.zh[n]=all.map(x=>x.replace('，',''));
  rows.push({...full,patch:p,root_note:notes[n]});
  const reviewFields=new Set(Object.keys(p.after));
  if(additions[lang][n])reviewFields.add('accepted_answers');
  for(const field of reviewFields){
   const after=Object.hasOwn(p.after,field)?p.after[field]:e[field],revise=field==='accepted_answers'&&additions[lang][n];
   fields.push({reviewer:'root, independent of audit_french',reviewed_on:'2026-09-13',ref:full.ref,table:'exercises',id:e.id,field,before:e[field],after,decision:revise?'revise':'approve_as_correction',rationale:notes[n],source_sha256:expected,...(revise?{recommended_after:[...after,...additions[lang][n]]}:{})});
  }
 }
}
if(Object.values(additions).flatMap(x=>Object.values(x)).flat().length!==93)throw Error('Unexpected followup count');
await mkdir(base,{recursive:true});
const archive=`${base}/reviewed-source-6b527f6aa319.json`,body=JSON.stringify({source_sha256:expected,rows,original_lessons:originals,requested_additions:additions,supplementary_sources:[{url:'https://sutian.moe.edu.tw/zh-hant/su/13736/',note:'Mandarin gloss of a Taiwanese dictionary example uses 待家裡; cited for that Mandarin wording, not to substitute Taiwanese grammar for Mandarin.'},{url:'https://grammis.ids-mannheim.de/systematische-grammatik/1601',note:'IDS correlates for conditional clauses include so.'}]},null,2)+'\n';
try{await writeFile(archive,body,{flag:'wx'});}catch(e){if(e.code!=='EEXIST'||await readFile(archive,'utf8')!==body)throw e;}
await writeFile(`${base}/field-decisions.jsonl`,fields.map(f=>JSON.stringify({...f,evidence:archive,evidence_sha256:sha(body)})).join('\n')+'\n');
console.log(JSON.stringify({rows:18,full_originals:42,fields:fields.length,pending_arrays:fields.filter(x=>x.decision==='revise').length,requested_answers:93}));
