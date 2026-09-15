import {isDeepStrictEqual as eq} from 'node:util';
import {lessonRefs} from './lesson-refs.mjs';

const mc=(prompt,key,options,explanation)=>({prompt,correct_answer:key,options,explanation,
 accepted_answers:[],skill_type:'vocabulary',target_grammar:null,target_word:null,hint_text:null,distractors:[]});
const task=(language,n,oldKey,fields)=>({language,n,oldKey,fields});

// Minimal Phrasal Verbs candidate (one row per language). The lesson's idiom
// and proverb rows, both E2209 banks and every audio row stay as they are;
// only E2201 changes, from a "Better late than never" gloss that E2211/E2212
// still test, to the one missing verb+particle sense decision. No claim is
// made that Spanish, Japanese or Korean has English phrasal-verb morphology:
// each rendering carries the whole phrasal sense in a single verb.
// Independent review (phrasal-verb-root-review, 2026-09-14) revised five fields.
//  - skill_type stays 'vocabulary' in all three languages. 'mixed' passes
//    exercises_skill_type_check but appears on none of the 23,976 frozen
//    exercises, and classifyError in lib/grading.ts reads skillType ===
//    'vocabulary' as its lexical signal, so 'mixed' would drop the error
//    category on a wrong tap. A verb-sense decision is lexical.
//  - JA/KO options no longer share one time-phrase frame. The reviewer showed
//    that the shared 来週に / 다음 주로 left three of four options ill-formed
//    (中止する takes no such date complement, 我慢する no 会議を with 来週に,
//    片付ける no meeting object; likewise 취소하다 no -로 destination, 참다 no
//    회의를 with 다음 주로, 치우다 no meeting object), so the row could be
//    solved on collocation alone. Each distractor now carries its own
//    well-formed complement.
//    These two option sets are NOT the reviewer's exact recommended strings and
//    have not themselves been independently reviewed. The reviewer's version
//    left 来週 / 다음 주 in the key only, which lets a learner match the English
//    "until next week" without reading any verb. Every option here carries the
//    time phrase and the meeting, as the approved ES set already does, so the
//    decision turns on the verb. See HELD-BOUNDARY-HANDOFF.md.
const sentence='“We’ll have to put off the meeting until next week.”';
export const phrasalVerbRepairs=[
 task('es',2201,'Better late than never',mc(
  `Read the English sentence: ${sentence} Which Spanish sentence renders “put off” naturally here?`,
  'Tendremos que aplazar la reunión hasta la semana que viene.',
  ['Tendremos que cancelar la reunión hasta la semana que viene.','Tendremos que aplazar la reunión hasta la semana que viene.',
   'Tendremos que aguantar la reunión hasta la semana que viene.','Tendremos que guardar la reunión hasta la semana que viene.'],
  'Put off here means postpone, so Spanish uses aplazar (posponer is equally natural). Cancelar renders call off, aguantar renders put up with, and guardar renders put away. Spanish has no verb-plus-particle category; one verb carries the whole phrasal sense.')),
 task('ja',2201,'Better late than never',mc(
  `Read the English sentence: ${sentence} Which Japanese sentence renders “put off” naturally here?`,
  '会議を来週に延期しなければなりません。',
  ['会議を来週に延期しなければなりません。','来週の会議を中止しなければなりません。',
   '来週の会議まで我慢しなければなりません。','来週までに会議室を片付けなければなりません。'],
  'Put off here means postpone: 延期する (先延ばしにする is also natural). 中止する is call off, 我慢する is put up with, and 片付ける is put away. Japanese has no English-style verb-plus-particle category; one verb carries the whole phrasal sense.')),
 task('ko',2201,'Better late than never',mc(
  `Read the English sentence: ${sentence} Which Korean sentence renders “put off” naturally here?`,
  '회의를 다음 주로 미뤄야 해요.',
  ['다음 주 회의를 취소해야 해요.','다음 주 회의까지 참아야 해요.',
   '회의를 다음 주로 미뤄야 해요.','다음 주까지 회의실을 치워야 해요.'],
  'Put off here means postpone: 미루다 (연기하다 is also natural). 취소하다 is call off, 참다 is put up with, and 치우다 is put away. Korean has no English-style verb-plus-particle category; one verb carries the whole phrasal sense.')),
];

export function phrasalVerbFixes(set) {
 const ids=new Set();
 for(const p of phrasalVerbRepairs){const c=lessonRefs(set.snapshot,p.language)(p.n),e=c.exercise;
  if(e.type!=='multiple_choice'||e.correct_answer!==p.oldKey||c.lesson.title!=='Phrasal Verbs'||c.course.cefr_level!=='B2'||
    e.prompt_audio_url!==null||e.card_id!==null||!eq(e.metadata,{})||ids.has(e.id))throw Error(`${c.ref}: changed phrasal-verb dependency`);
  if(set.patches().some(x=>x.table==='exercises'&&x.id===e.id))throw Error(`${c.ref}: unresolved phrasal-verb overlap`);
  ids.add(e.id);
 }
 if(ids.size!==3)throw Error('Expected three phrasal-verb tasks');
 for(const p of phrasalVerbRepairs){const c=lessonRefs(set.snapshot,p.language)(p.n);set.update('exercises',c.exercise.id,p.fields,
  `${c.ref}: Add the one missing phrasal-verb sense decision as a contextual choice task (an English verb+particle in explicit sentence context, rendered naturally in the target language). Keep every idiom/proverb row, both E2209 banks and all audio; E2211/E2212 still test the superseded gloss. No claim that the target language has English phrasal-verb morphology.`);}
}
