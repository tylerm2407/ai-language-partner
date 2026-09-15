// Follow-up review record for the lead's convention fix to the 39-row
// ES/JA/KO exact-topic batch: listening_choice rows now mirror their non-key
// options into `distractors` like every frozen listening_choice row.
// Records ONLY the nine distractors fields; the original 140-field record in
// field-decisions.jsonl is left untouched.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual as eq} from 'node:util';
import {createPatchSet} from './patch-set.mjs';
import {lessonRefs} from './lesson-refs.mjs';
import {exactTopicAdditionalRepairs,exactTopicAdditionalFixes} from './es-ja-ko-exact-topic-additional-fixes.mjs';

const base='docs/audits/question-verification/remediation/es-ja-ko-exact-topic-additional-root-review';
const source='scripts/question-audit/es-ja-ko-exact-topic-additional-fixes.mjs';
const expectedSourceSha='30496c870a0cccbab18e547c7f6754a25d256565ab54ec8eaa9b1d17124a298a';
const previousSourceSha='066927cfcaef15c65c257c40c15f946e42235e3273a14b13b9ffbcea6d4db534';
const reviewer='independent reviewer (Claude Fable 5.1, session 2026-09-14), independent of author';
const reviewedOn='2026-09-14';
const sha=x=>createHash('sha256').update(x).digest('hex');
const sourceSha=sha(await readFile(source));
if(sourceSha!==expectedSourceSha)throw Error(`Unreviewed source: ${sourceSha}`);

const set=await createPatchSet();exactTopicAdditionalFixes(set);
if(set.patches().length!==39)throw Error('Expected 39 patch rows');

// The frozen convention the fix restores: listening_choice rows carry their
// non-key options as distractors (as a set; the frozen order usually differs).
// Measured, not assumed: the exceptions are recorded, and every one of them is
// drift (an apostrophe lost in the copy, or a distractor that is an older
// alternative wording), not a row with empty distractors.
const frozenChoice=set.snapshot.exercises.filter(e=>e.type==='listening_choice');
const nonKey=e=>[...e.options].filter(o=>o!==e.correct_answer);
const drift=frozenChoice.filter(e=>!eq([...nonKey(e)].sort(),[...(e.distractors??[])].sort()));
const apostropheDrift=drift.filter(e=>eq([...nonKey(e)].map(x=>x.replace(/[’']/g,'')).sort(),[...(e.distractors??[])].map(x=>x.replace(/[’']/g,'')).sort()));
const emptyDistractors=frozenChoice.filter(e=>!(e.distractors??[]).length);
if(emptyDistractors.length)throw Error(`Frozen listening_choice rows with empty distractors: ${emptyDistractors.length}`);
const convention={listening_choice_rows:frozenChoice.length,mirror_as_set:frozenChoice.length-drift.length,
 mirror_in_options_order:frozenChoice.filter(e=>eq(nonKey(e),e.distractors)).length,
 drift_rows:drift.length,drift_apostrophe_only:apostropheDrift.length,drift_other_wording:drift.length-apostropheDrift.length,empty_distractors:0,
 drift_ids:drift.map(e=>e.id).sort()};

// Context judgement per row: each distractor must be a real word of the same
// class that does NOT translate the spoken prompt.
const wrong=new Map([
 ['es-E0246',{spoken:'Vestido',key:'Dress',distractors:{Shirt:'camisa',Shoes:'zapatos',Coat:'abrigo'}}],
 ['es-E0314',{spoken:'Nadar',key:'To swim',distractors:{'To cook':'cocinar','To run':'correr','To read':'leer'}}],
 ['es-E0326',{spoken:'Lluvia',key:'Rain',distractors:{Wind:'viento',Snow:'nieve',Cloud:'nube'}}],
 ['ja-E0246',{spoken:'ワンピース',key:'Dress',distractors:{Coat:'コート',Shirt:'シャツ',Shoes:'靴'}}],
 ['ja-E0314',{spoken:'泳ぐ',key:'To swim',distractors:{'To read':'読む','To cook':'料理する','To run':'走る'}}],
 ['ja-E0326',{spoken:'雨',key:'Rain',distractors:{Snow:'雪',Cloud:'雲',Wind:'風'}}],
 ['ko-E0246',{spoken:'원피스',key:'Dress',distractors:{Shirt:'셔츠',Shoes:'신발',Coat:'코트'}}],
 ['ko-E0314',{spoken:'수영하다',key:'To swim',distractors:{'To run':'달리다','To read':'읽다','To cook':'요리하다'}}],
 ['ko-E0326',{spoken:'비',key:'Rain',distractors:{Snow:'눈',Cloud:'구름',Wind:'바람'}}],
]);

const fields=[],rows=[];
for(const p of exactTopicAdditionalRepairs){
 const c=lessonRefs(set.snapshot,p.language)(p.n),e=c.exercise;
 if(e.type!=='listening_choice')continue;
 const patch=set.patches().find(x=>x.table==='exercises'&&x.id===e.id);
 const judged=wrong.get(c.ref);if(!judged)throw Error(`No context judgement for ${c.ref}`);
 const expected=p.fields.options.filter(o=>o!==p.fields.correct_answer);
 const after=patch.after.distractors;
 const mirrors=eq(after,expected)&&after.length===3&&new Set(after).size===3&&!after.includes(p.fields.correct_answer);
 const allJudgedWrong=after.every(d=>Object.hasOwn(judged.distractors,d))&&judged.spoken===p.fields.prompt&&judged.key===p.fields.correct_answer;
 // Non-distractor fields must be byte-identical to the previously reviewed proposal.
 for(const [field,value] of Object.entries(patch.after))if(field!=='distractors'&&!eq(value,p.fields[field]))throw Error(`${c.ref}.${field}: differs from reviewed proposal`);
 const decision=mirrors&&allJudgedWrong?'approve_as_correction':'reject';
 const rationale=`Distractors now mirror options minus the key (${after.join(' / ')}), the convention on ${convention.mirror_as_set} of ${convention.listening_choice_rows} frozen listening_choice rows (the other ${convention.drift_rows} are copy drift, none empty). `+
  `Spoken ${judged.spoken} = ${judged.key}; each distractor names something else in the same class (${after.map(d=>`${d} = ${judged.distractors[d]}`).join(', ')}), so none is a correct answer. `+
  `Runtime reads choices from options, so this restores the data convention without changing what the learner sees. Other fields are unchanged from the 066927cf review.`;
 rows.push({ref:c.ref,id:e.id,before:e.distractors,after,expected_from_options:expected,options:p.fields.options,key:p.fields.correct_answer,judgement:judged,decision});
 fields.push({reviewer,reviewed_on:reviewedOn,ref:c.ref,table:'exercises',id:e.id,field:'distractors',before:e.distractors,after,decision,rationale,
  source_sha256:sourceSha,previous_source_sha256:previousSourceSha});
}
if(fields.length!==9)throw Error(`Expected nine distractors fields, got ${fields.length}`);
// The other 30 rows must carry no distractors change at all.
for(const p of set.patches())if(!rows.some(r=>r.id===p.id)&&Object.hasOwn(p.after,'distractors'))throw Error(`Unexpected distractors change on ${p.id}`);

await mkdir(base,{recursive:true});
const archive=`${base}/reviewed-source-${sourceSha.slice(0,12)}.json`;
const body=JSON.stringify({source,source_sha256:sourceSha,previous_source_sha256:previousSourceSha,reviewer,reviewed_on:reviewedOn,
 scope:'Follow-up: only the nine listening_choice distractors fields changed by the convention fix; all other fields were reviewed under the previous hash.',
 diff_against_previous:'Update loop only: listening_choice rows emit distractors = options.filter(o => o !== correct_answer); no data, guard or wrapper line changed.',
 frozen_convention:convention,rows},null,2)+'\n';
try{await writeFile(archive,body,{flag:'wx'});}catch(e){if(e.code!=='EEXIST'||await readFile(archive,'utf8')!==body)throw e;}
const evidenceSha=sha(body);
await writeFile(`${base}/followup-field-decisions.jsonl`,fields.map(f=>JSON.stringify({...f,evidence:archive,evidence_sha256:evidenceSha})).join('\n')+'\n');
const {drift_ids,...conventionSummary}=convention;
console.log(JSON.stringify({fields:fields.length,counts:fields.reduce((a,f)=>({...a,[f.decision]:(a[f.decision]??0)+1}),{}),frozen_convention:conventionSummary,
 source_sha256:sourceSha,evidence:archive,evidence_sha256:evidenceSha,non_approved:fields.filter(f=>f.decision!=='approve_as_correction').map(f=>f.ref)}));
