import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createPatchSet} from './patch-set.mjs';
import {lessonRefs} from './lesson-refs.mjs';
import {a2SuperlativeFixes} from '../../docs/audits/question-verification/remediation/de-it-zh/a2-superlative-fixes.mjs';
const base='docs/audits/question-verification/remediation/superlative-root-review';
const source='docs/audits/question-verification/remediation/de-it-zh/a2-superlative-fixes.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const expected='b0effb08066af68f6f3f350b4fe3232c1826012cbc69c3e9522b40af59a7d012';
if(sha(await readFile(source))!==expected)throw Error('Unreviewed source');
const set=await createPatchSet();a2SuperlativeFixes(set);
const notes={
 de:['Hotel A60 is minimum of60/80/100; am billigsten identifies lowest, other choices false.','Billig superlative and explicit three-hotel set; add three ordinary elliptical predicate orders.','Attributive teuerste means most expensive, not merely more expensive; short/priciest/costliest translations preserve it.','Supplied am and billig select billigsten.','Same-route50/40/30minutes makes train A slowest; am langsamsten is correct.','Schnell superlative and three-train comparison; dative plural Zügen/genitive Züge; add two unter-order predicates.'],
 it:['Definite il meno caro in three-hotel set is relative superlative of inferiority.','Caro with least-price superlative and explicit three hotels; accept optional omission of comma after fronted comparison set.','Il piu caro identifies most expensive in stated set, with valid English synonyms.','Supplied il ___ caro and least-expensive meaning select meno, not piu or carissimo.','Same-route maximum duration makes train A il piu lento.','Il piu veloce names fastest within three trains; accept optional omission of comma after fronted comparison set.'],
 zh:['Minimum60yuan identifies A as 最便宜; other supplied hotel/value choices false.','Visible 中/酒店/最/便宜 and 三 constraints preserved; omit optional fronted-set comma and accept reversed identification.','最贵 means most expensive in the stated hotel set.','One-character superlative marker constraint selects 最, not comparative 更.','Same-route最大duration50minutes makes A车最慢; not C.','Visible C车 label and 中/火车/最/三 select fastest train; comma omission and reversed identification valid in both scripts.'],
};
const additions={de:{1018:['Von den drei Hotels ist Hotel A das billigste.','Unter den drei Hotels ist Hotel A das billigste.','Hotel A ist unter den drei Hotels das billigste.'],1024:['Unter den drei Zügen ist Zug C der schnellste.','Zug C ist unter den drei Zügen der schnellste.']},it:{},zh:{}};
const rows=[],fields=[],originals=[];
for(const lang of ['de','it','zh']){
 const get=lessonRefs(set.snapshot,lang);
 originals.push({language:lang,questions:Array.from({length:12},(_,i)=>get(1017+i))});
 for(const[n,index]of [1017,1018,1019,1020,1023,1024].map((n,i)=>[n,i])){
  const full=get(n),e=full.exercise,p=set.patches().find(p=>p.id===e.id),note=notes[lang][index];
  if(n===1018||n===1024){
   const all=[p.after.correct_answer,...p.after.accepted_answers];
   if(lang==='it')additions.it[n]=all.filter(a=>a.includes(',')).map(a=>a.replace(',',''));
   if(lang==='zh')additions.zh[n]=[...all.filter(a=>a.includes('，')).map(a=>a.replace('，','')),...(n===1018?['三家酒店中最便宜的是A酒店。']:['三列火车中最快的是C车。','三列火車中最快的是C車。'])];
  }
  rows.push({...full,patch:p,root_note:note});
  for(const[field,after]of Object.entries(p.after)){
   const revise=field==='accepted_answers'&&(n===1018||n===1024);
   fields.push({reviewer:'root, independent of audit_french',reviewed_on:'2026-09-13',ref:full.ref,table:'exercises',id:e.id,field,before:e[field],after,decision:revise?'revise':'approve_as_correction',rationale:note,source_sha256:expected,...(revise?{recommended_after:[...after,...additions[lang][n]]}:{})});
  }
 }
}
if(Object.values(additions).flatMap(x=>Object.values(x)).flat().length!==28)throw Error('Unexpected additions');
await mkdir(base,{recursive:true});
const archive=`${base}/reviewed-source-b0effb08066a.json`,body=JSON.stringify({source_sha256:expected,rows,original_lessons:originals,requested_additions:additions},null,2)+'\n';
try{await writeFile(archive,body,{flag:'wx'});}catch(e){if(e.code!=='EEXIST'||await readFile(archive,'utf8')!==body)throw e;}
await writeFile(`${base}/field-decisions.jsonl`,fields.map(f=>JSON.stringify({...f,evidence:archive,evidence_sha256:sha(body)})).join('\n')+'\n');
console.log(JSON.stringify({rows:rows.length,full_originals:36,fields:fields.length,pending_arrays:6,requested_valid_answers:28}));
