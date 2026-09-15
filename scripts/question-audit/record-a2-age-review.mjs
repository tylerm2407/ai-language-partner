import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createPatchSet} from './patch-set.mjs';
import {lessonRefs} from './lesson-refs.mjs';
import {a2AgeFixes} from '../../docs/audits/question-verification/remediation/de-it-zh/a2-age-fixes.mjs';
const base='docs/audits/question-verification/remediation/a2-age-root-review';
const source='docs/audits/question-verification/remediation/de-it-zh/a2-age-fixes.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const expected='f59820a6059edae923760511c6cde8c209eb749a326a49cd2441053a9f97f76b';
if(sha(await readFile(source))!==expected)throw Error('Unreviewed source');
const set=await createPatchSet();a2AgeFixes(set);
const rows=[],fields=[],originals=[],additions={de:{},it:{},zh:{}};
const notes={
 585:'Explicit 25 versus 22 selects older by three, not younger/equal/two. German comparative als, Italian avere age comparison and Chinese 比 plus postadjectival age difference preserve direction.',
 586:'Brother and three-year difference preserved. Visible lexical choices select German Bruder/älter and Italian avere/anni/più; Chinese prompt selects 哥哥/比 but not 大, so 年长 must also be accepted. Family possessive omission valid in supplied context.',
 587:'Visible turned requires an age-reaching event yesterday, not merely being 22. Both number spellings and temporal orders valid; adding years old also preserves the event and all explicit instructions.',
 588:'Explicit ages and requested comparative/closed pair make each missing form unique: älter, più, 大. Original noun-fragment answer cannot answer the new task.',
 591:'Question asks adult sister age, not name/job/birthday date. Chinese older sister explicit; German ist and Italian ha agree with third-person subject.',
 592:'Visible selected Perfekt/passato prossimo and become/reach lexemes resolve tense synonyms without hidden hint constraints. German geworden not passive worden; Italian ho compiuto; Chinese 昨天 plus 满 allows ordinary aspect and script variants. Fronted 昨天 comma is optional.',
};
for(const lang of ['de','it','zh']){
 const get=lessonRefs(set.snapshot,lang);
 originals.push({language:lang,questions:Array.from({length:12},(_,i)=>get(585+i))});
 for(const n of [585,586,587,588,591,592]){
  const full=get(n),e=full.exercise,p=set.patches().find(p=>p.id===e.id),all=[p.after.correct_answer,...(p.after.accepted_answers??e.accepted_answers)];
  if(n===587)additions[lang][n]=all.map(x=>x.replace(/twenty-two|22/,x=>`${x} years old`));
  if(lang==='zh'&&n===586)additions.zh[n]=['哥哥比我年长三岁。','我哥哥比我年长三岁。','我的哥哥比我年长三岁。','哥哥比我年長三歲。','我哥哥比我年長三歲。','我的哥哥比我年長三歲。'];
  if(lang==='zh'&&n===592)additions.zh[n]=all.filter(x=>x.startsWith('昨天我')).map(x=>x.replace('昨天','昨天，'));
  rows.push({...full,patch:p,root_note:notes[n]});
  for(const[field,after]of Object.entries(p.after)){
   const revise=field==='accepted_answers'&&additions[lang][n];
   fields.push({reviewer:'root, independent of audit_french',reviewed_on:'2026-09-13',ref:full.ref,table:'exercises',id:e.id,field,before:e[field],after,decision:revise?'revise':'approve_as_correction',rationale:notes[n],source_sha256:expected,...(revise?{recommended_after:[...after,...additions[lang][n]]}:{})});
  }
 }
}
if(Object.values(additions).flatMap(x=>Object.values(x)).flat().length!==30)throw Error('Unexpected followup count');
await mkdir(base,{recursive:true});
const archive=`${base}/reviewed-source-f59820a6059e.json`,body=JSON.stringify({source_sha256:expected,rows,original_lessons:originals,requested_additions:additions},null,2)+'\n';
try{await writeFile(archive,body,{flag:'wx'});}catch(e){if(e.code!=='EEXIST'||await readFile(archive,'utf8')!==body)throw e;}
await writeFile(`${base}/field-decisions.jsonl`,fields.map(f=>JSON.stringify({...f,evidence:archive,evidence_sha256:sha(body)})).join('\n')+'\n');
console.log(JSON.stringify({rows:18,full_originals:36,fields:fields.length,pending_arrays:fields.filter(x=>x.decision==='revise').length,requested_answers:30}));
