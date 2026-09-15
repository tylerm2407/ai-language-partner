// Read-only evidence compiler. Redirect nothing: caller saves emitted JSON
// through apply_patch. It does not integrate or approve any authored wording.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {createPatchSet,SNAPSHOT_SHA} from './patch-set.mjs';
import {lessonRefs} from './lesson-refs.mjs';

const [file, proposalsExport, applyExport, testFile] = process.argv.slice(2);
if (!/^es-ja-ko-[a-z0-9-]+-fixes\.mjs$/.test(file ?? '') || !testFile?.startsWith('docs/audits/question-verification/remediation/es-ja-ko/')) throw Error('Explicit local topic module and test required');
const mod=await import(`./${file}`), proposals=mod[proposalsExport];
const set=await createPatchSet(); mod[applyExport](set);
const hash=x=>createHash('sha256').update(x).digest('hex');
const draftFile='docs/audits/question-verification/remediation/draft-patches.json';
const draftRaw=await readFile(draftFile), draft=JSON.parse(draftRaw);
const sources=await Promise.all([`scripts/question-audit/${file}`,'scripts/question-audit/topic-repair-helpers.mjs',testFile].map(async path=>{const source=await readFile(path,'utf8');return {path,sha256:hash(source),source};}));
const rows=proposals.map(proposal=>{
  const {language,n,fields}=proposal, context=lessonRefs(set.snapshot,language)(n);
  const {exercise:original,lesson,unit,course,ref}=context;
  const currentPatch=draft.patches.find(p=>p.table==='exercises'&&p.id===original.id);
  const current={...original,...currentPatch?.after};
  const conflicts=Object.entries(fields).filter(([field,value])=>Object.hasOwn(currentPatch?.after??{},field)&&!isDeepStrictEqual(value,current[field])).map(([field,value])=>({field,previously_proposed_value:current[field],new_value:value,disposition:'Root must explicitly supersede this field after independent review; do not union old word-only keys/options into the new sentence task.'}));
  return {ref,language,level:course.cefr_level,lesson,unit,course,original_row:original,authored_proposal:proposal,
    full_replacement_fields:fields,proposed_row:{...original,...fields},emitted_patch:set.patches().find(p=>p.id===original.id),
    existing_draft_patch:currentPatch??null,explicit_supersessions_needed:conflicts,status:'awaiting independent review'};
});
console.log(JSON.stringify({author:'/root/audit_german',snapshot_sha256:SNAPSHOT_SHA,status:'New individual topic proposals; not independently approved, not integrated or deployed',
  scope:'Twelve exact selected rows only. No banks, audio, cards, shared rules, IDs, lesson placement or runtime changes.',
  caveats:['These four repaired slots per language do not certify every remaining task or close other curriculum groups.','Finite accepted alternatives are not a certificate of every possible paraphrase. Visible form constraints bound the target translations.','Use all full_replacement_fields when reconciling existing patches: unchanged-from-snapshot empty arrays may still need an explicit supersession.'],
  draft_as_seen:{path:draftFile,sha256:hash(draftRaw)},count:rows.length,sources,rows},null,2));
