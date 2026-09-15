import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createPatchSet} from './patch-set.mjs';
import {lessonRefs} from './lesson-refs.mjs';
import {b1OngoingPastFixes} from '../../docs/audits/question-verification/remediation/de-it-zh/b1-ongoing-past-fixes.mjs';
const base='docs/audits/question-verification/remediation/ongoing-past-root-review';
const source='docs/audits/question-verification/remediation/de-it-zh/b1-ongoing-past-fixes.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const expected='b89f74a2f6617fb3260b8edf28b413624adc0de95ab4f8722e981771abee09f0';
if(sha(await readFile(source))!==expected)throw Error('Unreviewed source');
const set=await createPatchSet();b1OngoingPastFixes(set);
const rows=[],fields=[],originals=[],additions={de:{},it:{},zh:{}};
const hint='The wir past form is aßen in German and Austrian spelling; Swiss spelling uses assen.';
const notes={
 1585:'Explicit yesterday reading overlaps phone ringing; correct action is reading, not completion/cooking/no start. German gerade plus past, Italian stava leggendo and Chinese past-time plus 正在 express background without a universal English-tense mapping.',
 1586:'Visible lexical/form constraints select past background and completed arrival. German reading in a book is already accepted and allows two further frontings; Italian arrival naturally permits postverbal Marco; Chinese permits 读/讀 because prompt does not select 看.',
 1587:'Still eating at eight yesterday preserves continuation and time without inventing morning/evening. English using eating is visible; listed number/time spellings and phrase orders valid.',
 1588:'Explicit form/closed choice selects plural aßen, stavamo, or 在. Swiss assen is standard and not excluded by locale, so accept it and scope the ß hint. Chinese 了 cannot fill this specific progressive blank.',
 1591:'Source error genuinely ill-formed: leste, leggiendo, 正看在. Visible instruction limits changes, preserving other words/order. Chinese optional comma is not a word and can be omitted in both scripts.',
 1594:'Explicit dinner start eight, arrival eight-thirty before finish entails ongoing meal then; all other choices contradict scene. Does not infer completion from mere tense/aspect.',
};
for(const lang of ['de','it','zh']){
 const get=lessonRefs(set.snapshot,lang);
 originals.push({language:lang,questions:Array.from({length:14},(_,i)=>get(1585+i))});
 for(const n of [1585,1586,1587,1588,1591,1594]){
  const full=get(n),e=full.exercise,p=set.patches().find(p=>p.id===e.id),all=[p.after.correct_answer,...(p.after.accepted_answers??e.accepted_answers)];
  if(lang==='de'&&n===1586)additions.de[n]=['Gerade las ich in einem Buch, als Marco ankam.','In einem Buch las ich gerade, als Marco ankam.'];
  if(lang==='de'&&n===1588)additions.de[n]=['assen'];
  if(lang==='it'&&n===1586)additions.it[n]=all.map(x=>x.replace('Marco è arrivato','è arrivato Marco'));
  if(lang==='zh'&&n===1586)additions.zh[n]=all.map(x=>x.replace('看',x.includes('書')?'讀':'读'));
  if(lang==='zh'&&n===1591)additions.zh[n]=all.map(x=>x.replace('，',''));
  rows.push({...full,patch:p,root_note:notes[n]});
  const reviewFields=new Set(Object.keys(p.after));
  if(additions[lang][n])reviewFields.add('accepted_answers');
  for(const field of reviewFields){
   const after=p.after[field]??e[field],revise=field==='accepted_answers'&&additions[lang][n]||lang==='de'&&n===1588&&field==='hint_text';
   const recommended=field==='hint_text'?hint:[...(p.after.accepted_answers??e.accepted_answers),...(additions[lang][n]??[])];
   fields.push({reviewer:'root, independent of audit_french',reviewed_on:'2026-09-13',ref:full.ref,table:'exercises',id:e.id,field,before:e[field],after,decision:revise?'revise':'approve_as_correction',rationale:notes[n],source_sha256:expected,...(revise?{recommended_after:recommended}:{})});
  }
 }
}
if(Object.values(additions).flatMap(x=>Object.values(x)).flat().length!==29)throw Error('Unexpected followup count');
await mkdir(base,{recursive:true});
const archive=`${base}/reviewed-source-b89f74a2f661.json`,body=JSON.stringify({source_sha256:expected,rows,original_lessons:originals,requested_additions:additions,requested_german_1588_hint:hint,supplementary_sources:['https://www.duden.de/sprachwissen/rechtschreibregeln/doppel-s-und-scharfes-s','https://www.treccani.it/enciclopedia/imperfetto_%28Enciclopedia-dell%27Italiano%29/']},null,2)+'\n';
try{await writeFile(archive,body,{flag:'wx'});}catch(e){if(e.code!=='EEXIST'||await readFile(archive,'utf8')!==body)throw e;}
await writeFile(`${base}/field-decisions.jsonl`,fields.map(f=>JSON.stringify({...f,evidence:archive,evidence_sha256:sha(body)})).join('\n')+'\n');
console.log(JSON.stringify({rows:18,full_originals:42,fields:fields.length,pending_fields:fields.filter(x=>x.decision==='revise').length,requested_answers:29}));
