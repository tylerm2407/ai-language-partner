// Follow-up review record for the 36-row ES/JA/KO exact-topic batch after the lead
// mirrored distractors on the six listening_choice rows. Records ONLY those six fields;
// the original field-decisions.jsonl is read for the recommended values and never rewritten.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual as eq} from 'node:util';
import {createPatchSet} from './patch-set.mjs';
import {lessonRefs} from './lesson-refs.mjs';
import {exactTopicRepairs,exactTopicFixes} from './es-ja-ko-exact-topic-fixes.mjs';

const base='docs/audits/question-verification/remediation/es-ja-ko-exact-topic-root-review';
const source='scripts/question-audit/es-ja-ko-exact-topic-fixes.mjs';
const expectedSha='b512d85f6385b912ba8f7e5d9f856b936cee744c768add9f1a80aa4038ecbc69';
const priorSha='0c03d82216cc8fd846203aadf6b565ca8d9bf6362aeea93637ecaa920625981e';
const sha=x=>createHash('sha256').update(x).digest('hex');
const sourceText=await readFile(source);
const sourceSha=sha(sourceText);
if(sourceSha!==expectedSha)throw Error(`Unreviewed source: ${sourceSha}`);
const reviewer='independent reviewer (Claude Fable 5.1, session 2026-09-14), independent of author';
const reviewedOn='2026-09-14';

const priorPath=`${base}/field-decisions.jsonl`;
const prior=(await readFile(priorPath,'utf8')).trim().split('\n').map(l=>JSON.parse(l));
const recommended=prior.filter(f=>f.field==='distractors'&&f.decision==='revise'&&f.source_sha256===priorSha);
if(recommended.length!==6)throw Error(`Expected six prior distractor revisions, found ${recommended.length}`);

const set=await createPatchSet();exactTopicFixes(set);
if(set.patches().length!==36)throw Error('Expected exactly thirty-six patches');
const fields=[],rows=[];
for(const r of recommended){
 const p=exactTopicRepairs.find(x=>`${x.language}-E${String(x.n).padStart(4,'0')}`===r.ref);
 const full=lessonRefs(set.snapshot,p.language)(p.n),e=full.exercise,patch=set.patches().find(x=>x.id===e.id);
 if(e.id!==r.id||e.type!=='listening_choice')throw Error(`${r.ref}: changed follow-up dependency`);
 const after=patch.after.distractors;
 const match=eq(after,r.recommended_after);
 const mirrored=eq(after,patch.after.options.filter(o=>o!==patch.after.correct_answer))&&after.length===3;
 // Every other field on the row must be unchanged from the reviewed source's emission.
 const priorFields=prior.filter(f=>f.ref===r.ref&&f.field!=='distractors');
 const otherUnchanged=priorFields.every(f=>eq(patch.after[f.field],f.after))&&Object.keys(patch.after).length===priorFields.length+1;
 if(!otherUnchanged)throw Error(`${r.ref}: a non-distractor field drifted`);
 rows.push({ref:full.ref,id:e.id,type:e.type,options:patch.after.options,correct_answer:patch.after.correct_answer,distractors_before:e.distractors,distractors_after:after,recommended_after:r.recommended_after,matches_recommendation:match,other_fields_unchanged:otherUnchanged});
 fields.push({reviewer,reviewed_on:reviewedOn,ref:full.ref,table:'exercises',id:e.id,field:'distractors',before:e.distractors,after,
  decision:match&&mirrored?'approve_as_correction':'revise',
  rationale:match&&mirrored?'Emitted distractors now equal the three non-key options in the row’s own option order, matching the value recommended in the first review and the convention of every other listening_choice row. All other fields on the row are emitted unchanged from the reviewed source.':'Emitted value does not equal the recommended mirrored array.',
  source_sha256:sourceSha,prior_source_sha256:priorSha,prior_decision_evidence:priorPath,...(match?{}:{recommended_after:r.recommended_after})});
}
const archive=`${base}/reviewed-source-${sourceSha.slice(0,12)}.json`;
const body=JSON.stringify({source_sha256:sourceSha,prior_source_sha256:priorSha,reviewer,reviewed_on:reviewedOn,
 change_from_prior:'Only the update loop changed: listening_choice rows now emit distractors = options minus correct_answer. Verified by unified diff against the frozen copy embedded in exact-topic-proposals.json (hash 0c03d822…).',
 source:sourceText.toString('utf8'),rows},null,2)+'\n';
try{await writeFile(archive,body,{flag:'wx'});}catch(e){if(e.code!=='EEXIST'||await readFile(archive,'utf8')!==body)throw e;}
const evidenceSha=sha(body);
await writeFile(`${base}/followup-field-decisions.jsonl`,fields.map(f=>JSON.stringify({...f,evidence:archive,evidence_sha256:evidenceSha})).join('\n')+'\n');
console.log(JSON.stringify({fields:fields.length,approved:fields.filter(f=>f.decision==='approve_as_correction').length,mismatches:fields.filter(f=>f.decision!=='approve_as_correction').map(f=>f.ref),archive,evidence_sha256:evidenceSha}));
