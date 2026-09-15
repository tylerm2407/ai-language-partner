import {isDeepStrictEqual as eq} from 'node:util';
import {lessonRefs} from './lesson-refs.mjs';
// The new full birthday task supersedes ONLY the old Opa synonym in DE380.
// Preserve the immutable 25-row lexical source and its other 24 patches.
export function selectGermanLexicalBeforeAgeTask(set){
 const id=lessonRefs(set.snapshot,'de')(380).exercise.id;
 return {...set,update(table,rowId,after,reason,sources){
  if(table==='exercises'&&rowId===id){
   if(!eq(after,{accepted_answers:['Opa']}))throw Error('Changed German age-task dependency');
   return;
  }
  return set.update(table,rowId,after,reason,sources);
 }};
}

// The new birthday-event translation replaces only IT587's old Nipote cue.
// Those valid kinship alternatives do not answer the new age-event question.
export function selectItalianLexicalBeforeA2AgeTask(set){
 const id=lessonRefs(set.snapshot,'it')(587).exercise.id;
 return {...set,update(table,rowId,after,reason,sources){
  if(table==='exercises'&&rowId===id){
   if(!eq(after,{accepted_answers:['Nephew','Grandchild','Grandson','Granddaughter']}))throw Error('Changed Italian A2 age-task dependency');
   return;
  }
  return set.update(table,rowId,after,reason,sources);
 }};
}
