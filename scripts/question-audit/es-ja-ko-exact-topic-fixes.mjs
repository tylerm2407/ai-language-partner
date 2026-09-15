import {isDeepStrictEqual as eq} from 'node:util';
import {lessonRefs} from './lesson-refs.mjs';

const lexical=(prompt,key,accepted=[],options=null,hint=null,explanation=null)=>({prompt,correct_answer:key,accepted_answers:accepted,
 options,hint_text:hint,explanation,card_id:null,target_word:null,target_grammar:null,distractors:[],skill_type:'vocabulary'});
const r=(language,n,oldKey,fields)=>({language,n,oldKey,fields});

// A distinct batch from the contextual MC repairs. These exact labels had no
// connection to their narrow lesson topic. Shared original cards remain valid
// elsewhere; detach them from the changed exercises rather than rewrite them.
export const exactTopicRepairs=[
 r('es',286,'Fútbol',lexical('Translate the profession into Spanish: Nurse','Enfermero',
  ['Enfermera','Un enfermero','Una enfermera','El enfermero','La enfermera'])),
 r('es',287,'Hot',lexical('Translate the profession into English: Ingeniero','Engineer',['An engineer','The engineer'])),
 r('es',288,'ío',lexical('Dent_____ (Dentist)','ista')),
 r('es',291,'Caliente',lexical('Ingeniero','Ingeniero',[],null,'Engineer')),
 r('es',292,'Hot',lexical('Ingeniero','Engineer',[],['Doctor','Nurse','Engineer','Teacher'])),
 r('es',446,'Baño',lexical('Translate to Spanish: Plate','Plato',['Un plato','El plato'])),
 r('es',447,'Bedroom',lexical('Translate to English: Cuchara','Spoon',['A spoon','The spoon'])),
 r('es',452,'ma',lexical('Te_____ (Fork)','nedor')),
 r('es',2103,'Sculpture',lexical('What does "Melodía" mean in English?','Melody',[],['Rhythm','Harmony','Melody','Silence'])),
 r('es',2112,'Novel',lexical('What does "Ritmo" mean in English?','Rhythm',[],['Silence','Melody','Volume','Rhythm'])),
 r('es',2113,'Escultura',lexical('Melodía','Melodía',[],null,'Melody')),
 r('es',2114,'Sculpture',lexical('Melodía','Melody',[],['Melody','Rhythm','Harmony','Silence'])),

 r('ja',286,'サッカー',lexical('Translate the profession into Japanese: Nurse','看護師',
  ['かんごし','ナース','看護婦','かんごふ','看護士'],null,null,'看護師 is the current gender-neutral professional title. ナース is a common loanword. The older gender-specific titles 看護婦 and 看護士 also mean nurse and are accepted as translations here.')),
 r('ja',287,'Hot',lexical('Translate the profession into English: エンジニア','Engineer',['An engineer','The engineer'])),
 r('ja',288,'い',lexical('歯_____ (Dentist)','科医',['科医師','医者','いしゃ'])),
 r('ja',291,'暑い',lexical('エンジニア','エンジニア',[],null,'Engineer')),
 r('ja',292,'Hot',lexical('エンジニア','Engineer',[],['Teacher','Engineer','Doctor','Nurse'])),
 r('ja',446,'お風呂',lexical('Translate to Japanese: Plate','皿',['お皿','さら','おさら'])),
 r('ja',447,'Bedroom',lexical('Translate to English: スプーン','Spoon',['A spoon','The spoon'])),
 r('ja',452,'ッド',lexical('フォ_____ (Fork)','ーク')),
 r('ja',2103,'Sculpture',lexical('What does "旋律" mean in English?','Melody',[],['Melody','Rhythm','Harmony','Silence'])),
 r('ja',2112,'Novel',lexical('What does "リズム" mean in English?','Rhythm',[],['Silence','Rhythm','Melody','Volume'])),
 r('ja',2113,'彫刻',lexical('旋律','旋律',['せんりつ'],null,'Melody')),
 r('ja',2114,'Sculpture',lexical('旋律','Melody',[],['Rhythm','Harmony','Silence','Melody'])),

 r('ko',286,'축구',lexical('Translate the profession into Korean: Nurse','간호사',['간호원'],null,null,
  '간호사 is the usual current professional title. The older term 간호원 also denotes a nurse and is accepted as a translation.')),
 r('ko',287,'Hot',lexical('Translate the profession into English: 엔지니어','Engineer',['An engineer','The engineer'])),
 r('ko',288,'운',lexical('치_____ (Dentist)','과 의사',['과의사'])),
 r('ko',291,'더운',lexical('엔지니어','엔지니어',[],null,'Engineer')),
 r('ko',292,'Hot',lexical('엔지니어','Engineer',[],['Nurse','Teacher','Doctor','Engineer'])),
 r('ko',446,'화장실',lexical('Translate to Korean: Plate','접시')),
 r('ko',447,'Bedroom',lexical('Translate to English: 숟가락','Spoon',['A spoon','The spoon'])),
 r('ko',452,'대',lexical('포_____ (Fork)','크')),
 r('ko',2103,'Sculpture',lexical('What does "선율" mean in English?','Melody',[],['Harmony','Melody','Rhythm','Silence'])),
 r('ko',2112,'Novel',lexical('What does "리듬" mean in English?','Rhythm',[],['Rhythm','Silence','Melody','Volume'])),
 r('ko',2113,'조각',lexical('선율','선율',[],null,'Melody')),
 r('ko',2114,'Sculpture',lexical('선율','Melody',[],['Harmony','Silence','Melody','Rhythm'])),
];

const targets={286:['translate_to_target','Jobs & Professions'],287:['translate_to_native','Jobs & Professions'],288:['fill_blank','Jobs & Professions'],
 291:['listening_type','Jobs & Professions'],292:['listening_choice','Jobs & Professions'],446:['translate_to_target','In the Kitchen'],
 447:['translate_to_native','In the Kitchen'],452:['fill_blank','In the Kitchen'],2103:['multiple_choice','Music Appreciation'],
 2112:['multiple_choice','Music Appreciation'],2113:['listening_type','Music Appreciation'],2114:['listening_choice','Music Appreciation']};

export function exactTopicFixes(set) {
 const ids=new Set();
 for(const p of exactTopicRepairs){const c=lessonRefs(set.snapshot,p.language)(p.n),e=c.exercise,[type,title]=targets[p.n];
  const family={es:'1111',ja:'6666',ko:'7777'}[p.language];
  const expectedCard=p.n===291||p.n===292?`aabbccdd-${family}-1005-c007-000000000000`:
   p.n===2113||p.n===2114?`aabbccdd-${family}-4004-c004-b20000000000`:null;
  if(e.type!==type||e.correct_answer!==p.oldKey||c.lesson.title!==title||c.course.cefr_level!==(p.n<561?'A1':'B2')||
    e.prompt_audio_url!==null||e.card_id!==expectedCard||!eq(e.metadata,{})||ids.has(e.id))throw Error(`${c.ref}: changed exact-topic dependency`);
  if(set.patches().some(x=>x.table==='exercises'&&x.id===e.id))throw Error(`${c.ref}: unresolved exact-topic overlap`);
  ids.add(e.id);
 }
 if(ids.size!==36)throw Error('Expected thirty-six exact-topic replacements');
 for(const p of exactTopicRepairs){const c=lessonRefs(set.snapshot,p.language)(p.n);
  // Every frozen listening_choice row mirrors its non-key options into distractors; keep that convention (independent review 2026-09-14).
  const fields=targets[p.n][0]==='listening_choice'?{...p.fields,distractors:p.fields.options.filter(o=>o!==p.fields.correct_answer)}:p.fields;
  set.update('exercises',c.exercise.id,fields,
  `${c.ref}: Replace an isolated off-topic label with vocabulary for ${c.lesson.title}, preserving type/placement and all shared cards. Matching listening transcripts/keys are paired; new audio has not been generated or auditioned.`,
  p.n===286&&p.language==='ja'?['https://www.mhlw.go.jp/topics/2002/bukyoku/isei/kango.html']:
   p.n===286&&p.language==='ko'?['https://krdict.korean.go.kr/eng/dicSearch/SearchView?ParaWordNo=15151&nation=eng&nationCode=6']:[]);}
}

// Wrap ONLY lexicalAdditionalFixes. These three historical aliases answer
// superseded labels, not the newly authored profession/kitchen questions.
export function selectSpanishLexicalBeforeExactTopics(set){
 const get=lessonRefs(set.snapshot,'es');
 const expected=new Map([[286,{key:'Fútbol',after:{accepted_answers:['Balompié']}}],
  [288,{key:'ío',after:{accepted_answers:['ía']}}],
  [446,{key:'Baño',after:{accepted_answers:['Cuarto de baño','Aseo','Servicio','Sanitario']}}]]);
 const byId=new Map();
 for(const [n,x] of expected){const c=get(n),e=c.exercise;
  if(e.correct_answer!==x.key||e.type!==targets[n][0]||c.lesson.title!==targets[n][1]||!eq(e.accepted_answers,[]))throw Error(`Changed Spanish exact-topic source E${n}`);
  byId.set(e.id,{n,...x});
 }
 return {...set,update(table,id,after,reason,sources){
  const x=table==='exercises'?byId.get(id):undefined;
  if(x){if(!eq(after,x.after))throw Error(`Changed Spanish exact-topic lexical dependency E${x.n}`);return;}
  return set.update(table,id,after,reason,sources);
 }};
}
