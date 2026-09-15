// Independent review record for the 36-row ES/JA/KO exact-topic batch
// (jobs / kitchen / music). Evidence bookkeeping only: it re-applies the frozen
// source exactly as the build would (wrapped lexical step, then the batch) to a
// fresh patch set, and writes per-field decisions. It edits no source or draft.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual as eq} from 'node:util';
import {createPatchSet} from './patch-set.mjs';
import {lessonRefs} from './lesson-refs.mjs';
import {lexicalAdditionalFixes} from './es-ja-ko-lexical-additional-fixes.mjs';
import {selectSpanishLexicalBeforeSuperlativeTasks} from './es-ja-ko-topic-composition.mjs';
import {exactTopicRepairs,exactTopicFixes,selectSpanishLexicalBeforeExactTopics} from './es-ja-ko-exact-topic-fixes.mjs';

const base='docs/audits/question-verification/remediation/es-ja-ko-exact-topic-root-review';
const source='scripts/question-audit/es-ja-ko-exact-topic-fixes.mjs';
const expectedSha='0c03d82216cc8fd846203aadf6b565ca8d9bf6362aeea93637ecaa920625981e';
const sha=x=>createHash('sha256').update(x).digest('hex');
const sourceSha=sha(await readFile(source));
if(sourceSha!==expectedSha)throw Error(`Unreviewed source: ${sourceSha}`);
const reviewer='independent reviewer (Claude Fable 5.1, session 2026-09-14), independent of author';
const reviewedOn='2026-09-14';
const MHLW='https://www.mhlw.go.jp/topics/2002/bukyoku/isei/kango.html';
const NIKL='https://krdict.korean.go.kr/eng/dicSearch/SearchView?ParaWordNo=15151&nation=eng&nationCode=6';

// Apply exactly as the build would: the wrapped Spanish lexical step first, then the batch on the
// unwrapped set. A control set runs the lexical step unwrapped so the supersession is measurable.
const set=await createPatchSet(),control=await createPatchSet();
lexicalAdditionalFixes(selectSpanishLexicalBeforeSuperlativeTasks(control),'es');
lexicalAdditionalFixes(selectSpanishLexicalBeforeExactTopics(selectSpanishLexicalBeforeSuperlativeTasks(set)),'es');
const lexicalBefore=set.patches().length;
const supersededIds=new Set([286,288,446].map(n=>lessonRefs(set.snapshot,'es')(n).exercise.id));
if(control.patches().length-lexicalBefore!==3)throw Error('Wrapper did not suppress exactly three alias arrays');
if(!eq(set.patches(),control.patches().filter(p=>!supersededIds.has(p.id))))throw Error('Wrapper altered a non-selected patch');
exactTopicFixes(set);
if(set.patches().length!==lexicalBefore+36)throw Error('Expected exactly thirty-six new patches');

// Per-row rationale. "Off-topic" means an isolated label with no learner-visible link to the exact
// lesson title, judged from the whole lesson before reading the proposal.
const notes={
 es:{
  286:'Original Soccer/Fútbol has no link to Jobs & Professions. Nurse→Enfermero is correct; Enfermera and the article-bearing forms are natural A1 answers. The old Balompié alias answers the removed label and is correctly suppressed by the guarded wrapper.',
  287:'Original Caliente/Hot is weather, not a job. Ingeniero→Engineer is correct; An/The engineer are ordinary English forms.',
  288:'Original Fr+ío (cold) is weather. Dent+ista=Dentista is correct with a single blank; the old ía alias answers the removed label and is suppressed.',
  291:'Listening transcript Ingeniero equals the key and the TTS text; hint Engineer agrees. The stale Caliente card is detached from this row only; the card and its speaking row are untouched.',
  292:'Spoken Ingeniero selects Engineer uniquely among four professions (Doctor/Nurse/Engineer/Teacher); stale Caliente card detached.',
  446:'Original Bathroom/Baño is another room, not the kitchen. Plate→Plato is correct; Un/El plato are natural. The four old regional bathroom aliases answer the removed label and are suppressed.',
  447:'Original Dormitorio/Bedroom is another room. Cuchara→Spoon is correct; A/The spoon are ordinary.',
  452:'Original Ca+ma (bed) is bedroom furniture. Te+nedor=Tenedor is correct with a single blank.',
  2103:'Original Escultura/Sculpture is visual art inside Music Appreciation. Melodía→Melody is correct; Rhythm/Harmony/Silence are wrong and stay in the music domain.',
  2112:'Original Novela/Novel is literature, not music. Ritmo→Rhythm is correct; Silence/Melody/Volume are wrong and plausible.',
  2113:'Listening transcript Melodía equals the key and the TTS text; hint Melody agrees. Stale Escultura card detached; card and speaking row untouched.',
  2114:'Spoken Melodía selects Melody uniquely among Melody/Rhythm/Harmony/Silence; stale Escultura card detached.',
 },
 ja:{
  286:'Original サッカー has no link to Jobs & Professions. 看護師 is the current licensed, gender-neutral title (MHLW: 看護婦/看護士 unified into 看護師 by the 2001 law change effective 2002). かんごし is the shared reading of 看護師 and 看護士 and must be accepted for kana typing; ナース is a common loanword. The pre-2002 titles 看護婦/かんごふ/看護士 are accepted only for grading leniency, never as the key: they remain real words a learner meets in older material and everyday speech (看護婦さん), and rejecting them would reproduce the rejected-valid-answer defect this audit corrects. The explanation states plainly that they are older and gender-specific, and the app renders the note only after the learner answers, so it cannot leak the key or teach the old titles as current.',
  287:'Original 暑い is weather. エンジニア→Engineer is correct; An/The engineer are ordinary.',
  288:'Original 寒+い is weather. 歯+科医=歯科医 is correct; 科医師 (歯科医師, the licensed title), 医者 (歯医者, the everyday word) and its kana いしゃ are all valid completions of the single blank.',
  291:'Listening transcript エンジニア equals the key and the TTS text; hint Engineer agrees. Stale 暑い card detached; card and speaking row untouched.',
  292:'Spoken エンジニア selects Engineer uniquely among Teacher/Engineer/Doctor/Nurse; stale 暑い card detached.',
  446:'Original Bath/お風呂 is another room. Plate→皿 is correct; お皿, さら, おさら are natural typed forms.',
  447:'Original 寝室 is another room. スプーン→Spoon is correct.',
  452:'Original ベ+ッド (bed) is bedroom furniture. フォ+ーク=フォーク is correct with a single blank.',
  2103:'Original 彫刻 is visual art inside Music Appreciation. 旋律→Melody is correct and B2-appropriate; Rhythm/Harmony/Silence are wrong.',
  2112:'Original 小説 is literature. リズム→Rhythm is correct; Silence/Melody/Volume are wrong.',
  2113:'Listening transcript 旋律 equals the key and the TTS text; kana せんりつ accepted for typing; hint Melody agrees. Stale 彫刻 card detached; card and speaking row untouched.',
  2114:'Spoken 旋律 selects Melody uniquely among Rhythm/Harmony/Silence/Melody; stale 彫刻 card detached.',
 },
 ko:{
  286:'Original 축구 has no link to Jobs & Professions. 간호사 is the current title. 간호원 is defined by NIKL as the word previously used for 간호사; it is accepted only for grading leniency, not as the key, and the explanation labels it older. The note renders only after answering.',
  287:'Original 더운 is weather. 엔지니어→Engineer is correct; An/The engineer are ordinary.',
  288:'Original 추+운 is weather. 치+과 의사 = 치과 의사 (spaced professional-term form) is correct; 과의사 accepts the closed spelling 치과의사, so neither spacing is rejected. No learner-facing dictionary headword was retrievable to certify one spacing over the other; both are in use.',
  291:'Listening transcript 엔지니어 equals the key and the TTS text; hint Engineer agrees. Stale 더운 card detached; card and speaking row untouched.',
  292:'Spoken 엔지니어 selects Engineer uniquely among Nurse/Teacher/Doctor/Engineer; stale 더운 card detached.',
  446:'Original Bathroom/화장실 is another room. Plate→접시 is correct; 그릇 (dish/bowl) is a different word, so no alternative is needed.',
  447:'Original 침실 is another room. 숟가락→Spoon is correct.',
  452:'Original 침+대 (bed) is bedroom furniture. 포+크=포크 is correct with a single blank.',
  2103:'Original 조각 is visual art inside Music Appreciation. 선율→Melody is correct and B2-appropriate; Harmony/Rhythm/Silence are wrong.',
  2112:'Original 소설 is literature. 리듬→Rhythm is correct; Rhythm/Silence/Melody/Volume unique.',
  2113:'Listening transcript 선율 equals the key and the TTS text; hint Melody agrees. Stale 조각 card detached; card and speaking row untouched.',
  2114:'Spoken 선율 selects Melody uniquely among Harmony/Silence/Melody/Rhythm; stale 조각 card detached.',
 },
};
const distractorNote='listening_choice renders exercise.options and grading ignores distractors, so an emptied array is inert at runtime. But every other listening_choice row in the frozen curriculum, and all 42 earlier reviewed listening_choice replacements in the current draft, keep distractors mirrored to the three non-key options. Emptying it breaks that convention and leaves a field that misdescribes the row. Recommend the mirrored array; non-blocking.';

const rows=[],fields=[];
for(const p of exactTopicRepairs){
 const full=lessonRefs(set.snapshot,p.language)(p.n),e=full.exercise,patch=set.patches().find(x=>x.table==='exercises'&&x.id===e.id);
 if(!patch)throw Error(`${full.ref}: no patch`);
 const lesson=set.snapshot.exercises.filter(x=>x.lesson_id===full.lesson.id).sort((a,b)=>a.order_index-b.order_index).map(x=>({id:x.id,order_index:x.order_index,type:x.type,prompt:x.prompt,correct_answer:x.correct_answer,accepted_answers:x.accepted_answers,options:x.options,card_id:x.card_id}));
 const card=e.card_id?set.row('cards',e.card_id):null;
 const note=notes[p.language][p.n];
 rows.push({...full,original_card:card,lesson_rows:lesson,patch,note,superseded_alias:supersededIds.has(e.id)?control.patches().find(x=>x.id===e.id).after.accepted_answers:null});
 for(const[field,after]of Object.entries(patch.after)){
  const revise=field==='distractors'&&e.type==='listening_choice';
  const sources=p.n===286&&p.language==='ja'?[MHLW]:p.n===286&&p.language==='ko'?[NIKL]:[];
  fields.push({reviewer,reviewed_on:reviewedOn,ref:full.ref,table:'exercises',id:e.id,field,before:e[field],after,
   decision:revise?'revise':'approve_as_correction',
   rationale:revise?distractorNote:note,source_sha256:sourceSha,
   ...(revise?{recommended_after:patch.after.options.filter(o=>o!==patch.after.correct_answer)}:{}),
   ...(sources.length?{sources}:{})});
 }
}
if(rows.length!==36)throw Error('Incomplete review');
await mkdir(base,{recursive:true});
const archive=`${base}/reviewed-source-${sourceSha.slice(0,12)}.json`;
const body=JSON.stringify({source_sha256:sourceSha,reviewer,reviewed_on:reviewedOn,applied_as:"lexicalAdditionalFixes(selectSpanishLexicalBeforeExactTopics(selectSpanishLexicalBeforeSuperlativeTasks(set)),'es'); ...; exactTopicFixes(set)",
 wrapper_check:{lexical_patches_unwrapped:control.patches().length,lexical_patches_wrapped:lexicalBefore,suppressed_ids:[...supersededIds],non_selected_patches_identical:true},
 rows},null,2)+'\n';
try{await writeFile(archive,body,{flag:'wx'});}catch(e){if(e.code!=='EEXIST'||await readFile(archive,'utf8')!==body)throw e;}
const evidenceSha=sha(body);
await writeFile(`${base}/field-decisions.jsonl`,fields.map(f=>JSON.stringify({...f,evidence:archive,evidence_sha256:evidenceSha})).join('\n')+'\n');

const counts=fields.reduce((a,f)=>({...a,[f.decision]:(a[f.decision]??0)+1}),{});
const byRef=new Map();for(const f of fields){const r=byRef.get(f.ref)??{approve:0,revise:0,other:0,fields:[]};r[f.decision==='approve_as_correction'?'approve':f.decision==='revise'?'revise':'other']++;r.fields.push(f.field);byRef.set(f.ref,r);}
const table=[...byRef.entries()].map(([ref,r])=>{const p=exactTopicRepairs.find(x=>`${x.language}-E${String(x.n).padStart(4,'0')}`===ref);return `| ${ref} | ${p.oldKey} | ${p.fields.correct_answer} | ${r.fields.length} | ${r.approve} | ${r.revise} | ${r.revise?'partial (distractors)':'approved'} |`;}).join('\n');
const nonApproved=fields.filter(f=>f.decision!=='approve_as_correction').map(f=>`- \`${f.ref}.${f.field}\` — ${f.decision}: recommended \`${JSON.stringify(f.recommended_after)}\` instead of \`${JSON.stringify(f.after)}\`.`).join('\n');
await writeFile(`${base}/README.md`,`# ES / JA / KO exact-topic review — jobs, kitchen, music (36 rows)

Reviewer: ${reviewer}. Reviewed on ${reviewedOn}. This records an independent field-level review; it does not deploy anything and does not edit the source.

## Scope

- Source: \`${source}\`, SHA-256 \`${sourceSha}\` (hard-checked by \`scripts/question-audit/record-es-ja-ko-exact-topic-review.mjs\`).
- Snapshot: frozen curriculum \`8c7f381c78d87e57593febe851526355d300c7a704e5a57dd49a614edabd7c0f\` via \`createPatchSet()\`.
- Rows: ES/JA/KO E0286, E0287, E0288, E0291, E0292 (Jobs & Professions, A1), E0446, E0447, E0452 (In the Kitchen, A1), E2103, E2112, E2113, E2114 (Music Appreciation, B2).
- Applied as the build would: \`lexicalAdditionalFixes(selectSpanishLexicalBeforeExactTopics(selectSpanishLexicalBeforeSuperlativeTasks(set)),'es')\` then \`exactTopicFixes(set)\` on the unwrapped set.
- Evidence archive: \`reviewed-source-${sourceSha.slice(0,12)}.json\` (SHA-256 \`${evidenceSha}\`), one full-context row per exercise including the whole lesson, the original card, the patch and the superseded alias where one existed.
- Decisions: \`field-decisions.jsonl\`, one line per changed field.

## Method

Every lesson was read whole from the frozen snapshot (all exercises, unit and course) and the original row judged before the proposal was read. Then each field was checked independently: key correctness, naturalness of every accepted alternative, distractor wrongness and plausibility, target-language script and politeness, lesson-topic alignment, level, and for listening rows that the TTS text, transcript and English key agree. The whole build order was replayed in memory with the wrapper inserted: 3,338 draft patches became 3,371 (33 added, 3 replaced, 0 removed, every other patch deep-equal). Without the wrapper the batch fails closed on es-E0286 and leaves the patch set unchanged.

## Wrapper verdict

\`selectSpanishLexicalBeforeExactTopics\` validates the frozen originals of ES E0286/E0288/E0446 (key, type, lesson title, empty accepted_answers), suppresses exactly the three obsolete alias writes (Balompié; ía; Cuarto de baño/Aseo/Servicio/Sanitario), throws on any other write to those ids, and passes every other update through untouched. Verified in both nesting orders with \`selectSpanishLexicalBeforeSuperlativeTasks\`. \`exactTopicFixes\` separately refuses to run if any patch already exists on a target id.

## Decision counts

${Object.entries(counts).map(([k,v])=>`- ${k}: ${v}`).join('\n')}

## Per-row verdicts

| Ref | Old key | New key | Fields | Approved | Revise | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
${table}

## Non-approved fields

${nonApproved||'None.'}

${distractorNote}

## Terminology notes

- Japanese nurse: 看護師 is the current licensed title; 看護婦 and 看護士 were unified into it (MHLW, ${MHLW}). They are accepted only as alternatives, the explanation labels them older, and the app shows the note only after the learner answers.
- Korean nurse: NIKL defines 간호원 as the word previously used for 간호사 (${NIKL}). Same handling.
- Korean dentist: the key uses the spaced form 치과 의사 and accepts 치과의사; no rejection risk either way. No learner-dictionary headword was retrievable to certify a single spacing.
- Spanish "aire" is not in this batch (it belongs to the 39-row additional batch, es-E0318); the RAE page could not be fetched by this reviewer, so nothing is claimed about it here.

## Limits

- No audio was generated or auditioned; listening rows are text-aligned only.
- Grading behaviour was taken from the existing Deno tests (all 36 keys and alternatives accepted, all 36 old keys rejected); this review did not run the app.
- The In the Kitchen lesson reads as an original rooms-of-the-house design under a kitchen title; replacing the three room labels is the audit's chosen route (no lesson renames), and door/window/table/chair remain as plausible kitchen furniture.
`);
console.log(JSON.stringify({rows:rows.length,fields:fields.length,counts,pending:fields.filter(f=>f.decision!=='approve_as_correction').map(f=>`${f.ref}.${f.field}`),archive,evidence_sha256:evidenceSha}));
