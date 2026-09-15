import {isDeepStrictEqual as eq} from 'node:util';
import {lessonRefs} from './lesson-refs.mjs';

// Only the old IT1585 apostrophe cleanup is superseded by its reviewed full scene.
// Do not weaken the general compiler's same-field conflict checks.
export function selectItalianNarrowBeforeOngoingPast(set){
 const id=lessonRefs(set.snapshot,'it')(1585).exercise.id;
 return {...set,replaceText(table,rowId,field,edits,reason,sources){
  if(table==='exercises'&&rowId===id){
   if(field!=='prompt'||!eq(edits,[["''","'"]])||set.row(table,rowId).prompt!=='What does "All\'\'improvviso" mean in English?')throw Error('Changed Italian ongoing-past text dependency');
   return;
  }
  return set.replaceText(table,rowId,field,edits,reason,sources);
 },update(table,rowId,after,reason,sources){
  if(table==='exercises'&&rowId===id){
   if(!eq(after,{prompt:'What does "All\'improvviso" mean in English?'}))throw Error('Changed Italian ongoing-past dependency');
   return;
  }
  return set.update(table,rowId,after,reason,sources);
 }};
}
