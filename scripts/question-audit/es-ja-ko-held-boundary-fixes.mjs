import {isDeepStrictEqual as eq} from 'node:util';
import {lessonRefs} from './lesson-refs.mjs';

const lexical=(prompt,key,accepted=[],options=null,hint=null,explanation=null)=>({prompt,correct_answer:key,accepted_answers:accepted,
 options,hint_text:hint,explanation,card_id:null,target_word:null,target_grammar:null,distractors:[],skill_type:'vocabulary'});
// listening_choice rows in these lessons carry distractors = options minus the key.
const choice=(text,key,options)=>({...lexical(text,key,[],options),distractors:options.filter(o=>o!==key)});
const r=(language,n,oldKey,fields)=>({language,n,oldKey,fields});

// Held boundary rows adjudicated individually on 2026-09-14 (see
// remediation/es-ja-ko/held-boundary-dispositions.md). Every one of the thirty
// held rows is an isolated label with no learner-visible link to its exact
// lesson: Film & Theater carries painting/sculpture only as bare glosses, and
// Hobbies & Interests carries hot/cold/summer/winter with no seasonal-leisure
// framing anywhere in the lesson. Painting and sculpture stay taught in the
// sibling Describing Art lesson; the temperature/season words stay taught in
// Weather & Seasons. Shared cards remain; only the stale links are detached.
// Independent review (held-boundary-root-review, 2026-09-14) revised one field:
// ja-E0312 now keys スポーツ alone. 運動/うんどう are no longer accepted, because
// this curriculum keys 運動 as Exercise in the JA A2 course (Health & Wellness /
// Healthy Lifestyle, four Review & Test rows, card
// aabbccdd-6666-2002-c012-a20000000000); 運動 reads as sport only in compounds
// such as 運動会 and 運動部.
const draw=['Draw','To draw a picture','Draw a picture','To draw pictures','To paint','Paint','To paint a picture','Paint a picture'];
export const heldBoundaryRepairs=[
 r('es',309,'Hot',lexical('What does "Bailar" mean in English?','To dance',[],['To dance','To cook','To read','To sing'])),
 r('es',310,'Frío',lexical('Translate to Spanish: To sing','Cantar')),
 r('es',311,'Summer',lexical('Translate to English: Dibujar','To draw',['Draw'])),
 r('es',312,'erno',lexical('Depor_____ (Sport)','te')),
 r('es',315,'Verano',lexical('Guitarra','Guitarra',[],null,'Guitar')),
 r('es',316,'Summer',choice('Guitarra','Guitar',['To cook','Guitar','Soccer','To read'])),
 r('es',2089,'Painting',lexical('What does "Guion" mean in English?','Script',[],['Genre','Script','Poem','Review'],null,
  'Guion (older spelling guión) is the script or screenplay of a film or play.')),
 r('es',2090,'Escultura',lexical('Translate to Spanish: Stage (of a theater)','Escenario',['El escenario'])),
 r('es',2099,'Pintura',lexical('Público','Público',[],null,'Audience')),
 r('es',2100,'Painting',choice('Público','Audience',['Genre','Audience','Poem','Inspiration'])),

 r('ja',309,'Hot',lexical('What does "踊る" mean in English?','To dance',[],['To dance','To cook','To read','To sing'])),
 r('ja',310,'寒い',lexical('Translate to Japanese: To sing','歌う',['うたう'])),
 r('ja',311,'Summer',lexical('Translate to English: 絵を描く','To draw',draw)),
 r('ja',312,'冬',lexical('Fill in the missing word: _____ means Sport','スポーツ')),
 r('ja',315,'夏',lexical('ギター','ギター',[],null,'Guitar')),
 r('ja',316,'Summer',choice('ギター','Guitar',['To cook','Guitar','Soccer','To read'])),
 r('ja',2089,'Painting',lexical('What does "脚本" mean in English?','Script',[],['Script','Genre','Poem','Review'],null,
  '脚本 (きゃくほん) is the script or screenplay of a film or play.')),
 r('ja',2090,'彫刻',lexical('Translate to Japanese: Stage (of a theater)','舞台',['ぶたい','ステージ'])),
 r('ja',2099,'絵画',lexical('観客','観客',['かんきゃく'],null,'Audience')),
 r('ja',2100,'Painting',choice('観客','Audience',['Audience','Metaphor','Inspiration','Symbolism'])),

 r('ko',309,'Hot',lexical('What does "춤추다" mean in English?','To dance',[],['To sing','To cook','To dance','To read'])),
 r('ko',310,'추운',lexical('Translate to Korean: To sing','노래하다',['노래를 하다','노래 부르다','노래를 부르다'])),
 r('ko',311,'Summer',lexical('Translate to English: 그림을 그리다','To draw',draw)),
 r('ko',312,'울',lexical('스포_____ (Sport)','츠')),
 r('ko',315,'여름',lexical('기타','기타',[],null,'Guitar')),
 r('ko',316,'Summer',choice('기타','Guitar',['To cook','Soccer','Guitar','To read'])),
 r('ko',2089,'Painting',lexical('What does "각본" mean in English?','Script',[],['Poem','Script','Genre','Review'],null,
  '각본 is the script or screenplay of a film or play.')),
 r('ko',2090,'조각',lexical('Translate to Korean: Stage (of a theater)','무대')),
 r('ko',2099,'그림',lexical('관객','관객',[],null,'Audience')),
 r('ko',2100,'Painting',choice('관객','Audience',['Novel','Audience','Poem','Masterpiece'])),
];

const targets={309:['multiple_choice','Hobbies & Interests'],310:['translate_to_target','Hobbies & Interests'],
 311:['translate_to_native','Hobbies & Interests'],312:['fill_blank','Hobbies & Interests'],
 315:['listening_type','Hobbies & Interests'],316:['listening_choice','Hobbies & Interests'],
 2089:['multiple_choice','Film & Theater'],2090:['translate_to_target','Film & Theater'],
 2099:['listening_type','Film & Theater'],2100:['listening_choice','Film & Theater']};
// The frozen Japanese E0312 is a cloze row, not fill_blank; the other two are fill_blank.
const expectedType=(language,n)=>language==='ja'&&n===312?'cloze_deletion':targets[n][0];
const expectedCard=(language,n)=>{const family={es:'1111',ja:'6666',ko:'7777'}[language];
 return n===315||n===316?[`aabbccdd-${family}-1005-c009-000000000000`,'Summer']:
  n===2099||n===2100?[`aabbccdd-${family}-4004-c003-b20000000000`,'Painting']:[null,null];};

export function heldBoundaryFixes(set) {
 const ids=new Set();
 // Fail before emitting anything: every dependency (type, key, lesson, level,
 // audio, card and its meaning, metadata) must still be the frozen one, and
 // none of these rows may already carry a draft patch.
 for(const p of heldBoundaryRepairs){const c=lessonRefs(set.snapshot,p.language)(p.n),e=c.exercise,[,title]=targets[p.n];
  const [card,cardMeaning]=expectedCard(p.language,p.n);
  if(e.type!==expectedType(p.language,p.n)||e.correct_answer!==p.oldKey||c.lesson.title!==title||c.course.cefr_level!==(p.n<561?'A1':'B2')||
    e.prompt_audio_url!==null||e.card_id!==card||!eq(e.metadata,{})||ids.has(e.id))throw Error(`${c.ref}: changed held-boundary dependency`);
  if(card&&set.row('cards',card).native_text!==cardMeaning)throw Error(`${c.ref}: changed held-boundary card`);
  if(set.patches().some(x=>x.table==='exercises'&&x.id===e.id))throw Error(`${c.ref}: unresolved held-boundary overlap`);
  ids.add(e.id);
 }
 if(ids.size!==30)throw Error('Expected thirty held-boundary replacements');
 for(const p of heldBoundaryRepairs){const c=lessonRefs(set.snapshot,p.language)(p.n);set.update('exercises',c.exercise.id,p.fields,
  `${c.ref}: Held boundary row adjudicated individually on 2026-09-14: the "${p.oldKey}" label has no learner-visible link to ${c.lesson.title}. Replace with ${c.lesson.title} vocabulary at the same type and placement; detach only the stale card link and keep the shared card. Paired TTS transcripts/keys are authored; audio is not generated or auditioned.`,
  p.language==='es'&&p.n===2089?['https://dle.rae.es/guion']:[]);}
}
