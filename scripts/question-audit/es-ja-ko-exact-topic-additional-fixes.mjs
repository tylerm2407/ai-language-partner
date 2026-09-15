import {isDeepStrictEqual as eq} from 'node:util';
import {lessonRefs} from './lesson-refs.mjs';

const lexical=(prompt,key,accepted=[],options=null,hint=null)=>({prompt,correct_answer:key,accepted_answers:accepted,
 options,hint_text:hint,explanation:null,card_id:null,target_word:null,target_grammar:null,distractors:[],skill_type:'vocabulary'});
const r=(language,n,oldKey,fields)=>({language,n,oldKey,fields});

// Separate thirty-nine-row batch: retain clothing price/payment vocabulary,
// actual hobbies and actual weather words. Do not resolve the more debatable
// seasonal-hobby boundary by inventing an undocumented review rationale.
export const exactTopicAdditionalRepairs=[
 r('es',241,'Time',lexical('Translate the item of clothing into English: Vestido','Dress',['A dress','The dress','Frock','A frock','The frock'])),
 r('es',242,'ana',lexical('Complete the name of the color: Ver_____ (Green)','de')),
 r('es',245,'Hora',lexical('Vestido','Vestido',[],null,'Dress')),
 r('es',246,'Time',lexical('Vestido','Dress',[],['Shirt','Shoes','Dress','Coat'])),
 r('es',305,'Office',lexical('What does "Nadar" mean in English?','To swim',[],['To read','To swim','To cook','To run'])),
 r('es',313,'Oficina',lexical('Nadar','Nadar',[],null,'To swim')),
 r('es',314,'Office',lexical('Nadar','To swim',[],['To cook','To run','To read','To swim'])),
 r('es',317,'To read',lexical('What does "Lluvia" mean in English?','Rain',[],['Rain','Wind','Snow','Cloud'])),
 r('es',318,'Cocinar',lexical('Translate the weather word into Spanish: Wind','Viento',['El viento','Aire','El aire'])),
 r('es',319,'Soccer',lexical('Translate to English: Nube','Cloud',['A cloud','The cloud'])),
 r('es',324,'igo',lexical('Prim_____ (Spring, the season)','avera')),
 r('es',325,'Leer',lexical('Lluvia','Lluvia',[],null,'Rain')),
 r('es',326,'To read',lexical('Lluvia','Rain',[],['Wind','Rain','Snow','Cloud'])),

 r('ja',241,'Time',lexical('Translate the item of clothing into English: ワンピース','Dress',
  ['A dress','The dress','One-piece dress','A one-piece dress','The one-piece dress','Frock','A frock','The frock'])),
 r('ja',242,'日',lexical('グリ_____ (Green)','ーン')),
 r('ja',245,'時間',lexical('ワンピース','ワンピース',[],null,'Dress')),
 r('ja',246,'Time',lexical('ワンピース','Dress',[],['Dress','Coat','Shirt','Shoes'])),
 r('ja',305,'Office',lexical('What does "泳ぐ" mean in English?','To swim',[],['To swim','To read','To cook','To run'])),
 r('ja',313,'事務所',lexical('泳ぐ','泳ぐ',['およぐ'],null,'To swim')),
 r('ja',314,'Office',lexical('泳ぐ','To swim',[],['To read','To cook','To swim','To run'])),
 r('ja',317,'To read',lexical('What does "雨" mean in English?','Rain',[],['Wind','Rain','Snow','Cloud'])),
 r('ja',318,'料理する',lexical('Translate the weather word into Japanese: Wind','風',['かぜ'])),
 r('ja',319,'Soccer',lexical('Translate to English: 雲','Cloud',['A cloud','The cloud'])),
 r('ja',324,'達',lexical('今日は寒_____です。 (It is cold today.)','い')),
 r('ja',325,'読む',lexical('雨','雨',['あめ'],null,'Rain')),
 r('ja',326,'To read',lexical('雨','Rain',[],['Snow','Cloud','Rain','Wind'])),

 r('ko',241,'Time',lexical('Translate the item of clothing into English: 원피스','Dress',
  ['A dress','The dress','One-piece dress','A one-piece dress','The one-piece dress','Frock','A frock','The frock'])),
 r('ko',242,'일',lexical('초_____ (Green)','록색',['록'])),
 r('ko',245,'시간',lexical('원피스','원피스',[],null,'Dress')),
 r('ko',246,'Time',lexical('원피스','Dress',[],['Shirt','Dress','Shoes','Coat'])),
 r('ko',305,'Office',lexical('What does "수영하다" mean in English?','To swim',[],['To cook','To run','To read','To swim'])),
 r('ko',313,'사무실',lexical('수영하다','수영하다',[],null,'To swim')),
 r('ko',314,'Office',lexical('수영하다','To swim',[],['To swim','To run','To read','To cook'])),
 r('ko',317,'To read',lexical('What does "비" mean in English?','Rain',[],['Wind','Snow','Rain','Cloud'])),
 r('ko',318,'요리하다',lexical('Translate the weather word into Korean: Wind','바람')),
 r('ko',319,'Soccer',lexical('Translate to English: 구름','Cloud',['A cloud','The cloud'])),
 r('ko',324,'구',lexical('안_____ (Fog)','개')),
 r('ko',325,'읽다',lexical('비','비',[],null,'Rain')),
 r('ko',326,'To read',lexical('비','Rain',[],['Snow','Cloud','Wind','Rain'])),
];

const targets={241:['translate_to_native','Clothes & Colors'],242:['fill_blank','Clothes & Colors'],
 245:['listening_type','Clothes & Colors'],246:['listening_choice','Clothes & Colors'],
 305:['multiple_choice','Hobbies & Interests'],313:['listening_type','Hobbies & Interests'],314:['listening_choice','Hobbies & Interests'],
 317:['multiple_choice','Weather & Seasons'],318:['translate_to_target','Weather & Seasons'],319:['translate_to_native','Weather & Seasons'],
 324:['fill_blank','Weather & Seasons'],325:['listening_type','Weather & Seasons'],326:['listening_choice','Weather & Seasons']};

export function exactTopicAdditionalFixes(set){
 const ids=new Set();
 for(const p of exactTopicAdditionalRepairs){const c=lessonRefs(set.snapshot,p.language)(p.n),e=c.exercise,[type,title]=targets[p.n];
  const family={es:'1111',ja:'6666',ko:'7777'}[p.language];
  const expectedCard=p.n===245||p.n===246?`aabbccdd-${family}-1004-c009-000000000000`:
   p.n===313||p.n===314?`aabbccdd-${family}-1005-c003-000000000000`:
   p.n===325||p.n===326?`aabbccdd-${family}-1005-c004-000000000000`:null;
  if(e.type!==type||e.correct_answer!==p.oldKey||c.lesson.title!==title||c.course.cefr_level!=='A1'||
   e.prompt_audio_url!==null||e.card_id!==expectedCard||!eq(e.metadata,{})||ids.has(e.id))throw Error(`${c.ref}: changed additional exact-topic dependency`);
  if(set.patches().some(x=>x.table==='exercises'&&x.id===e.id))throw Error(`${c.ref}: unresolved additional exact-topic overlap`);
  ids.add(e.id);
 }
 if(ids.size!==39)throw Error('Expected thirty-nine additional exact-topic replacements');
 for(const p of exactTopicAdditionalRepairs){const c=lessonRefs(set.snapshot,p.language)(p.n);
  // Every frozen listening_choice row mirrors its non-key options into distractors; keep that convention (independent review 2026-09-14).
  const fields=targets[p.n][0]==='listening_choice'?{...p.fields,distractors:p.fields.options.filter(o=>o!==p.fields.correct_answer)}:p.fields;
  set.update('exercises',c.exercise.id,fields,
  `${c.ref}: Replace an isolated label with content directly matching ${c.lesson.title}; preserve ID/type/placement, detach only stale card links and keep the valid shared card. Paired TTS transcripts/keys are authored but audio is not generated or auditioned.`,
  p.language==='es'&&p.n===318?['https://dle.rae.es/aire']:[]);}
}

export function selectSpanishLexicalBeforeAdditionalExactTopics(set){
 const get=lessonRefs(set.snapshot,'es'),expected=new Map([
  [241,{key:'Time',after:{accepted_answers:['Hour']}}],
  [319,{key:'Soccer',after:{accepted_answers:['Football']}}],
  [324,{key:'igo',after:{accepted_answers:['iga']}}],
 ]),byId=new Map();
 for(const [n,x] of expected){const c=get(n),e=c.exercise;
  if(e.correct_answer!==x.key||e.type!==targets[n][0]||c.lesson.title!==targets[n][1]||!eq(e.accepted_answers,[]))throw Error(`Changed Spanish additional exact-topic source E${n}`);
  byId.set(e.id,{n,...x});
 }
 return {...set,update(table,id,after,reason,sources){const x=table==='exercises'?byId.get(id):undefined;
  if(x){if(!eq(after,x.after))throw Error(`Changed Spanish additional exact-topic lexical dependency E${x.n}`);return;}
  return set.update(table,id,after,reason,sources);
 }};
}
