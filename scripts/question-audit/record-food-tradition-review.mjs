import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createPatchSet} from './patch-set.mjs';
import {lessonRefs} from './lesson-refs.mjs';
import {a2FoodTraditionFixes} from '../../docs/audits/question-verification/remediation/de-it-zh/a2-food-tradition-fixes.mjs';
const base='docs/audits/question-verification/remediation/food-tradition-root-review';
const source='docs/audits/question-verification/remediation/de-it-zh/a2-food-tradition-fixes.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const expected='6a50f71788ce4e47765f72814e5dbd8300c5cca8f0395628565d148de6317957';
if(sha(await readFile(source))!==expected)throw Error('Unreviewed source');
const set=await createPatchSet();a2FoodTraditionFixes(set);
const rows=[],fields=[],originals=[],additions={de:{},it:{},zh:{}};
const notes={
 1077:'Cake is named in the explicit fictional birthday custom; rice/fish/bread are not. No universal national custom is asserted.',
 1078:'The recurring New Year Day soup meal preserves occasion, first-person plural, always and action. Visible lexical selectors avoid a hidden preferred-synonym requirement; add independently confirmed ordinary orders/article/punctuation variants.',
 1079:'The yearly birthday-cake statement is present/habitual, not a single past meal. Mass/count English and every/each year are valid; optional fronted-adverbial commas must not become hidden requirements.',
 1080:'A selected grammatical form occurs inside the food-custom sentence: German backt/backt-with-umlaut both standard; Italian singular prepara; Chinese forced 都/不 choice selects affirmative recurrence 都.',
 1083:'The father explicitly makes soup and the mother makes bread/rice. Other relatives are false under the provided account, not excluded as possible cooks in general.',
 1084:'Grandmother, repeated cake preparation and speaker birthday remain explicit. German backen forms agree; Italian optional article before familiar nonna; Chinese requested 奶奶 scopes paternal relation and permits natural omission of repeated possessive.',
};
for(const lang of ['de','it','zh']){
 const get=lessonRefs(set.snapshot,lang);
 originals.push({language:lang,questions:Array.from({length:12},(_,i)=>get(1077+i))});
 for(const n of [1077,1078,1079,1080,1083,1084]){
  const full=get(n),e=full.exercise,p=set.patches().find(p=>p.id===e.id),all=[p.after.correct_answer,...(p.after.accepted_answers??e.accepted_answers)];
  if(lang==='de'&&n===1078)additions.de[n]=all.map(x=>x.replace('Suppe','eine Suppe'));
  if(lang==='it'&&n===1078)additions.it[n]=['la zuppa','zuppa','una zuppa','della zuppa'].flatMap(x=>[`A Capodanno noi mangiamo sempre ${x}.`,`Mangiamo a Capodanno sempre ${x}.`]);
  if(lang==='it'&&n===1084)additions.it[n]=['Mia nonna prepara sempre per il mio compleanno una torta.','La mia nonna prepara sempre per il mio compleanno una torta.'];
  if(n===1079)additions[lang][n]=all.filter(x=>x.includes(',')).map(x=>x.replace(',',''));
  if(lang==='zh'&&n===1078)additions.zh[n]=['元旦，我们总是喝汤。','元旦，我們總是喝湯。',...all.filter(x=>x.includes('，')).map(x=>x.replace('，',''))];
  if(lang==='zh'&&n===1084)additions.zh[n]=all.filter(x=>x.includes('，')).map(x=>x.replace('，',''));
  rows.push({...full,patch:p,root_note:notes[n]});
  for(const[field,after]of Object.entries(p.after)){
   const revise=field==='accepted_answers'&&additions[lang][n];
   fields.push({reviewer:'root, independent of audit_french',reviewed_on:'2026-09-13',ref:full.ref,table:'exercises',id:e.id,field,before:e[field],after,decision:revise?'revise':'approve_as_correction',rationale:notes[n],source_sha256:expected,...(revise?{recommended_after:[...after,...additions[lang][n]]}:{})});
  }
 }
}
if(Object.values(additions).flatMap(x=>Object.values(x)).flat().length!==42)throw Error('Unexpected followup count');
await mkdir(base,{recursive:true});
const archive=`${base}/reviewed-source-6a50f71788ce.json`,body=JSON.stringify({source_sha256:expected,rows,original_lessons:originals,requested_additions:additions},null,2)+'\n';
try{await writeFile(archive,body,{flag:'wx'});}catch(e){if(e.code!=='EEXIST'||await readFile(archive,'utf8')!==body)throw e;}
await writeFile(`${base}/field-decisions.jsonl`,fields.map(f=>JSON.stringify({...f,evidence:archive,evidence_sha256:sha(body)})).join('\n')+'\n');
console.log(JSON.stringify({rows:18,full_originals:36,fields:fields.length,pending_arrays:fields.filter(x=>x.decision==='revise').length,requested_answers:42}));
