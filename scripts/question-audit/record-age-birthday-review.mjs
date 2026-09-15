import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createPatchSet} from './patch-set.mjs';
import {lessonRefs} from './lesson-refs.mjs';
import {a1AgeBirthdayFixes} from '../../docs/audits/question-verification/remediation/de-it-zh/a1-age-birthday-fixes.mjs';
const base='docs/audits/question-verification/remediation/age-birthday-root-review';
const sourceSha=createHash('sha256').update(await readFile('docs/audits/question-verification/remediation/de-it-zh/a1-age-birthday-fixes.mjs')).digest('hex');
if(sourceSha!=='ab34dcf9283833d49d44b2ce6a0de1946dc93c32fee19000474bcae027ece88e')throw Error('Unreviewed source');
const set=await createPatchSet();a1AgeBirthdayFixes(set);
const rows=[],fields=[],originalLessons=[];
const notes={
 de:['Direct child-directed age question uses du and distinguishes name, date and place.','Eight-year first-person age uses sein and written acht; both supplied orders preserve age.','Lea’s age8 correctly maps to English be and explicit number/contraction alternatives.','Ben requires ist; zehn remains ten.','Ben is June8, distinct from Lea May3; am achten Juni has correct ordinal inflection.','Birthday expression and written June8 date are correct; also accept Ich habe Geburtstag am achten Juni.'],
 it:['Direct age question uses avere; other choices ask name/date/location.','Ho otto anni correctly uses avere; explicit io is optional.','Lea ha otto anni means Lea is eight; English short forms and contractions preserve age.','Ben requires ha; dieci is ten.','Ben is June8; Italian cardinal otto and article elision are correctly taught.','Both birthday/date clause orders obey requested essere and il mio compleanno; eighth becomes cardinal otto.'],
 zh:['Young-child context justifies 几岁; other choices uniquely ask name/date/location.','Age predicate omits 是; 八岁 and current-year statements preserve age8, with traditional script variants.','他 is he; 八岁了 describes current age8, optionally English now, not obligatory past tense.','十 requires age measure 岁, not calendar 年; traditional 歲 also valid.','Xiaohong is June8, not Xiaoming May3; month-before-day correctly decoded.','Birthday with 是 and written六月八号/日, reversed clause and traditional號 forms preserve June8.'],
};
for(const lang of ['de','it','zh']){
 const get=lessonRefs(set.snapshot,lang);
 originalLessons.push({language:lang,questions:Array.from({length:12},(_,i)=>get(375+i))});
 for(let n=375;n<=380;n++){
  const full=get(n),e=full.exercise,p=set.patches().find(p=>p.id===e.id),note=notes[lang][n-375];
  rows.push({...full,patch:p,root_note:note});
  for(const[field,after]of Object.entries(p.after))fields.push({reviewer:'root, independent of author audit_french',reviewed_on:'2026-09-13',ref:full.ref,table:'exercises',id:e.id,field,before:e[field],after,decision:lang==='de'&&n===380&&field==='accepted_answers'?'revise':'approve_as_correction',rationale:note,source_sha256:sourceSha,...(lang==='de'&&n===380&&field==='accepted_answers'?{recommended_after:[...after,'Ich habe Geburtstag am achten Juni.']}:{})});
 }
}
await mkdir(base,{recursive:true});const archive=`${base}/reviewed-source-${sourceSha.slice(0,12)}.json`,body=JSON.stringify({source_sha256:sourceSha,rows,original_lessons:originalLessons},null,2)+'\n';
try{await writeFile(archive,body,{flag:'wx'});}catch(e){if(e.code!=='EEXIST'||await readFile(archive,'utf8')!==body)throw e;}
await writeFile(`${base}/field-decisions.jsonl`,fields.map(f=>JSON.stringify({...f,evidence:archive,evidence_sha256:createHash('sha256').update(body).digest('hex')})).join('\n')+'\n');
console.log(JSON.stringify({rows:18,full_original_questions_read:36,fields:fields.length,pending_fields:1}));
