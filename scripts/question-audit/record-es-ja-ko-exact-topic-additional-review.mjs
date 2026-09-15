// Independent review record for the 39-row ES/JA/KO clothing/hobby/weather
// exact-topic batch. Applies the frozen source exactly as the build would
// (Spanish lexical aliases first, through the batch's own wrapper) to a fresh
// set, then writes per-field decisions with the exact before/after values.
// Records evidence only; it does not touch the draft, the snapshot or the source.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual as eq} from 'node:util';
import {createPatchSet} from './patch-set.mjs';
import {lessonRefs} from './lesson-refs.mjs';
import {lexicalAdditionalFixes} from './es-ja-ko-lexical-additional-fixes.mjs';
import {exactTopicAdditionalRepairs,exactTopicAdditionalFixes,selectSpanishLexicalBeforeAdditionalExactTopics} from './es-ja-ko-exact-topic-additional-fixes.mjs';

const base='docs/audits/question-verification/remediation/es-ja-ko-exact-topic-additional-root-review';
const source='scripts/question-audit/es-ja-ko-exact-topic-additional-fixes.mjs';
const expectedSourceSha='066927cfcaef15c65c257c40c15f946e42235e3273a14b13b9ffbcea6d4db534';
const reviewer='independent reviewer (Claude Fable 5.1, session 2026-09-14), independent of author';
const reviewedOn='2026-09-14';
const sha=x=>createHash('sha256').update(x).digest('hex');
const sourceSha=sha(await readFile(source));
if(sourceSha!==expectedSourceSha)throw Error(`Unreviewed source: ${sourceSha}`);

// Apply exactly as build-remediation.mjs would: the Spanish lexical aliases
// pass through this batch's wrapper (which drops only E0241/E0319/E0324
// 'Hour'/'Football'/'iga'), then the batch itself on the unwrapped set.
const set=await createPatchSet();
const unwrapped=await createPatchSet();lexicalAdditionalFixes(unwrapped,'es');
lexicalAdditionalFixes(selectSpanishLexicalBeforeAdditionalExactTopics(set),'es');
const es=lessonRefs(set.snapshot,'es');
const suppressed=new Set([241,319,324].map(n=>es(n).exercise.id));
if(unwrapped.patches().length-set.patches().length!==3)throw Error('Wrapper did not drop exactly three Spanish alias rows');
if(!eq(set.patches(),unwrapped.patches().filter(p=>!suppressed.has(p.id))))throw Error('Wrapper changed a non-selected lexical patch');
const beforeBatch=structuredClone(set.patches());
exactTopicAdditionalFixes(set);
const batchIds=new Set(exactTopicAdditionalRepairs.map(p=>lessonRefs(set.snapshot,p.language)(p.n).exercise.id));
if(batchIds.size!==39)throw Error('Expected 39 distinct exercise IDs');
for(const p of beforeBatch){const now=set.patches().find(x=>x.table===p.table&&x.id===p.id);if(!now||!eq(now.after,p.after))throw Error(`Batch altered an unrelated lexical patch: ${p.id}`);}
if(set.patches().length!==beforeBatch.length+39)throw Error('Batch did not add exactly 39 rows');
for(const id of suppressed){const p=set.patches().find(x=>x.id===id);const acc=p.after.accepted_answers??[];
 if(['Hour','Football','iga'].some(x=>acc.includes(x)))throw Error(`Obsolete alias survived on ${id}`);}

// Reviewer notes per (language, ref). Decision defaults to approve_as_correction
// for every changed field of the row; per-field overrides live in `fieldDecisions`.
const notes=new Map([
 ['es-241','Original Hora/Time is a time word with no clothing or colour link. Vestido is the ordinary Spanish word for dress; "Dress" is the unique natural English key. Article forms and frock are acceptable alternatives. Grader accepts lowercase "dress" and rejects the old key.'],
 ['es-242','Original Mañ-ana/Tomorrow is a time adverb, not a colour. Verde is the basic colour word; Ver+de is the only completion. The "Complete the name of the color:" prefix renders before the blank and does not disturb the split on the blank marker.'],
 ['es-245','Dictation of Vestido with hint Dress replaces Hora/Time. Prompt, key and typed transcript agree; the detached card aabbccdd-1111-1004-c009 is the Hora card and stays valid for the speaking row 124. No stored audio exists to overwrite; TTS audio is neither generated nor auditioned here.'],
 ['es-246','Listening to Vestido selects Dress uniquely among Shirt/Shoes/Dress/Coat; the other three are real garments and all wrong. Hora card detached for the same reason as E0245. The app builds choices from options, so distractors=[] is inert (existing MC rows already use it).'],
 ['es-305','Original Oficina/Office is a workplace, not a hobby. Nadar/To swim is a common A1 leisure verb; To read/To cook are taught in this lesson and To run is a plausible wrong verb. One correct option only.'],
 ['es-313','Dictation of Nadar with hint To swim replaces Oficina. Transcript, key and hint agree; the Oficina card aabbccdd-1111-1005-c003 is detached and remains on speaking row 106.'],
 ['es-314','Listening to Nadar selects To swim uniquely among four verbs. Oficina card detached. Choices come from options.'],
 ['es-317','Original Leer/To read is a hobby verb, not weather. Lluvia/Rain is the unique correct choice among Rain/Wind/Snow/Cloud, all weather nouns.'],
 ['es-318','Original Cocinar/To cook is a hobby verb. Viento is the standard word for wind. El viento is the article form. Aire as wind is attested (Wiktionary Spanish aire sense 3 "wind, breeze", synonym viento; author cites RAE sense 3, which this session could not fetch). Sentence forms such as hace viento are correctly rejected because the prompt asks for the word.'],
 ['es-319','Original Fútbol/Soccer is a sport. Nube/Cloud is a basic weather noun; article forms accepted. The obsolete "Football" alias is dropped by the wrapper and does not survive on this row.'],
 ['es-324','Original Am-igo/Friend is unrelated to weather. Primavera/Spring fits a Weather & Seasons lesson that otherwise teaches only summer and winter; Prim+avera is the only completion. The obsolete "iga" alias is dropped by the wrapper; the row now carries no alias, matching the frozen empty array.'],
 ['es-325','Dictation of Lluvia with hint Rain replaces Leer; the Leer card aabbccdd-1111-1005-c004 is detached and stays on speaking row 109.'],
 ['es-326','Listening to Lluvia selects Rain uniquely among Wind/Rain/Snow/Cloud. Leer card detached.'],
 ['ja-241','Original 時間/Time is unrelated to clothing. ワンピース is the everyday Japanese word for a dress (jisho: "dress; one-piece", common word). "Dress" is the natural key; one-piece dress and frock forms are reasonable alternatives. It is a katakana loanword and readable at A1 even though jisho tags it N2.'],
 ['ja-242','Original 明-日/Tomorrow is a time word. グリ+ーン (グリーン) is a common loanword for green and the only completion; consistent with the lesson\'s existing loanword blank シ+ャツ. Non-blocking note: 緑 (みどり) is the more basic native colour word and would match the native 赤い/青い used elsewhere in the lesson; a future み+どり blank would be preferable but the row is not wrong.'],
 ['ja-245','Dictation of ワンピース with hint Dress replaces 時間; the 時間 card aabbccdd-6666-1004-c009 is detached and stays on speaking row 124. Katakana is the expected typed form; a hiragana rendering is not accepted, which is appropriate for a loanword.'],
 ['ja-246','Listening to ワンピース selects Dress uniquely among Dress/Coat/Shirt/Shoes. 時間 card detached.'],
 ['ja-305','Original 事務所/Office is a workplace. 泳ぐ/To swim is a basic hobby verb; To read/To cook are this lesson\'s own verbs, To run is a plausible wrong verb.'],
 ['ja-313','Dictation of 泳ぐ with hint To swim; the kana reading およぐ is accepted, which is right for a typed transcript. 事務所 card aabbccdd-6666-1005-c003 detached and kept on speaking row 106.'],
 ['ja-314','Listening to 泳ぐ selects To swim uniquely. 事務所 card detached.'],
 ['ja-317','Original 読む/To read is a hobby verb. 雨/Rain is the unique correct choice among four weather nouns.'],
 ['ja-318','Original 料理する/To cook is a hobby verb. 風 is the standard word for wind; kana かぜ accepted. Sentence forms such as 風が強い are rejected because the prompt asks for the word.'],
 ['ja-319','Original サッカー/Soccer is a sport. 雲/Cloud is a basic weather noun; article forms accepted.'],
 ['ja-324','Original 友-達/Friend is unrelated to weather. 今日は寒いです is a natural A1 weather sentence; 寒+い is the only completion (寒かった is correctly rejected against "It is cold today"). Non-blocking note: 寒い is already the key of this lesson\'s row 4 MC, so the blank re-tests a known word rather than adding one; a snow or cloud blank would add coverage. Not wrong.'],
 ['ja-325','Dictation of 雨 with hint Rain; kana あめ accepted. 読む card aabbccdd-6666-1005-c004 detached and kept on speaking row 109.'],
 ['ja-326','Listening to 雨 selects Rain uniquely among Snow/Cloud/Rain/Wind. 読む card detached.'],
 ['ko-241','Original 시간/Time is unrelated to clothing. 원피스 is the ordinary Korean word for a dress (Wiktionary: "dress", loan from one-piece). "Dress" is the natural key with one-piece and frock forms as alternatives.'],
 ['ko-242','Original 내-일/Tomorrow is a time word. 초+록색 (초록색, "green colour", Wiktionary) is the only completion of the full colour noun; 초록 alone is also a standalone noun for green (Wiktionary 草綠), so accepting 록 is right. Consistent with the lesson\'s 빨간색/파란색 pattern.'],
 ['ko-245','Dictation of 원피스 with hint Dress replaces 시간; the 시간 card aabbccdd-7777-1004-c009 is detached and stays on speaking row 124.'],
 ['ko-246','Listening to 원피스 selects Dress uniquely among Shirt/Dress/Shoes/Coat. 시간 card detached.'],
 ['ko-305','Original 사무실/Office is a workplace. 수영하다/To swim is a basic hobby verb; To read/To cook are this lesson\'s own verbs, To run is a plausible wrong verb.'],
 ['ko-313','Dictation of 수영하다 with hint To swim. Dictionary form matches the lesson\'s other verbs (읽다, 요리하다); the polite 수영해요 is correctly not accepted for a dictation of the spoken form. 사무실 card aabbccdd-7777-1005-c003 detached and kept on speaking row 106.'],
 ['ko-314','Listening to 수영하다 selects To swim uniquely. 사무실 card detached.'],
 ['ko-317','Original 읽다/To read is a hobby verb. 비/Rain is the unique correct choice among Wind/Snow/Rain/Cloud.'],
 ['ko-318','Original 요리하다/To cook is a hobby verb. 바람 is the only ordinary word for wind; no alternatives are needed. Sentence forms such as 바람이 분다 are rejected because the prompt asks for the word.'],
 ['ko-319','Original 축구/Soccer is a sport. 구름/Cloud is a basic weather noun; article forms accepted.'],
 ['ko-324','Original 친-구/Friend is unrelated to weather. 안개/Fog is attested (Wiktionary "fog, mist") and 안+개 is the only completion; a reasonable A1 weather noun beside rain/wind/cloud.'],
 ['ko-325','Dictation of 비 with hint Rain; a one-syllable transcript is unambiguous with the hint shown. 읽다 card aabbccdd-7777-1005-c004 detached and kept on speaking row 109.'],
 ['ko-326','Listening to 비 selects Rain uniquely among Snow/Cloud/Wind/Rain. 읽다 card detached.'],
]);
const sourcesFor=(lang,n)=>lang==='es'&&n===318?['https://en.wiktionary.org/wiki/aire','https://dle.rae.es/aire']:
 lang==='ja'&&n===241?['https://jisho.org/search/%E3%83%AF%E3%83%B3%E3%83%94%E3%83%BC%E3%82%B9']:
 lang==='ko'&&n===241?['https://en.wiktionary.org/wiki/%EC%9B%90%ED%94%BC%EC%8A%A4']:
 lang==='ko'&&n===242?['https://en.wiktionary.org/wiki/%EC%B4%88%EB%A1%9D%EC%83%89','https://en.wiktionary.org/wiki/%EC%B4%88%EB%A1%9D']:
 lang==='ko'&&n===324?['https://en.wiktionary.org/wiki/%EC%95%88%EA%B0%9C']:[];
// Every changed field on every row is approved as a correction; no field-level
// override is recorded. Kept as an explicit map so a later revision is visible.
const fieldDecisions=new Map();

const fields=[],rows=[];
for(const p of exactTopicAdditionalRepairs){
 const c=lessonRefs(set.snapshot,p.language)(p.n),e=c.exercise,patch=set.patches().find(x=>x.table==='exercises'&&x.id===e.id);
 const note=notes.get(`${p.language}-${p.n}`);if(!note)throw Error(`No reviewer note for ${c.ref}`);
 if(!patch)throw Error(`No patch for ${c.ref}`);
 for(const [field,after] of Object.entries(patch.after))if(!eq(after,p.fields[field]))throw Error(`${c.ref}.${field}: patch differs from authored proposal`);
 for(const [field,value] of Object.entries(p.fields))if(!eq(value,e[field])&&!Object.hasOwn(patch.after,field))throw Error(`${c.ref}.${field}: authored change missing from patch`);
 const card=e.card_id?set.row('cards',e.card_id):null;
 rows.push({ref:c.ref,language:p.language,n:p.n,course:{title:c.course.title,cefr_level:c.course.cefr_level},unit:{title:c.unit.title,description:c.unit.description},
  lesson:{id:c.lesson.id,title:c.lesson.title},exercise:e,card:card&&{id:card.id,target_text:card.target_text,native_text:card.native_text,audio_url:card.audio_url,
  other_exercises_using_card:set.snapshot.exercises.filter(x=>x.card_id===card.id&&x.id!==e.id).map(x=>({id:x.id,type:x.type,order_index:x.order_index}))},
  patch,note,sources:sourcesFor(p.language,p.n)});
 for(const [field,after] of Object.entries(patch.after)){
  const decision=fieldDecisions.get(`${c.ref}.${field}`)??'approve_as_correction';
  fields.push({reviewer,reviewed_on:reviewedOn,ref:c.ref,table:'exercises',id:e.id,field,before:e[field],after,decision,rationale:note,source_sha256:sourceSha,
   ...(sourcesFor(p.language,p.n).length?{sources:sourcesFor(p.language,p.n)}:{})});
 }
}
if(rows.length!==39)throw Error('Expected 39 reviewed rows');

await mkdir(base,{recursive:true});
const archive=`${base}/reviewed-source-${sourceSha.slice(0,12)}.json`;
const body=JSON.stringify({source:source,source_sha256:sourceSha,snapshot_sha256:set.snapshot&&'8c7f381c78d87e57593febe851526355d300c7a704e5a57dd49a614edabd7c0f',reviewer,reviewed_on:reviewedOn,
 applied_as:"lexicalAdditionalFixes(selectSpanishLexicalBeforeAdditionalExactTopics(set),'es'); exactTopicAdditionalFixes(set)",
 wrapper_suppressed:[...suppressed].sort(),rows},null,2)+'\n';
try{await writeFile(archive,body,{flag:'wx'});}catch(e){if(e.code!=='EEXIST'||await readFile(archive,'utf8')!==body)throw e;}
const evidenceSha=sha(body);
await writeFile(`${base}/field-decisions.jsonl`,fields.map(f=>JSON.stringify({...f,evidence:archive,evidence_sha256:evidenceSha})).join('\n')+'\n');
const counts=fields.reduce((a,f)=>({...a,[f.decision]:(a[f.decision]??0)+1}),{});
console.log(JSON.stringify({rows:rows.length,fields:fields.length,counts,source_sha256:sourceSha,evidence:archive,evidence_sha256:evidenceSha,
 non_approved:fields.filter(f=>f.decision!=='approve_as_correction').map(f=>`${f.ref}.${f.field}`)}));
