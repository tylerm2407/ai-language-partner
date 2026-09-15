import {isDeepStrictEqual as eq} from 'node:util';
import {lessonRefs} from './lesson-refs.mjs';

// Explicitly compose two independently adjudicated same-field additions without
// mutating historical sources or weakening the compiler's conflict rejection.
export function selectSpanishNarrowWithSearchAlternatives(set){
 const id=lessonRefs(set.snapshot,'es')(2294).exercise.id;
 const expected=['Estoy buscando a alguien que tenga experiencia en ventas','Busco alguien que tenga experiencia en ventas','Estoy buscando alguien que tenga experiencia en ventas'];
 return {...set,update(table,rowId,after,reason,sources){
  if(table!=='exercises'||rowId!==id||!Object.hasOwn(after,'accepted_answers'))return set.update(table,rowId,after,reason,sources);
  if(!eq(after.accepted_answers,expected))throw Error('Re-review changed Spanish search alternatives');
  set.update(table,rowId,{...after,accepted_answers:[...expected,'Yo busco a alguien que tenga experiencia en ventas','Busco una persona que tenga experiencia en ventas']},`${reason} Independent follow-up also accepts explicit yo and una persona with the same non-specific subjunctive meaning.`,sources);
 }};
}
export function selectSpanishGrammarWithOrderAlternative(set){
 const id=lessonRefs(set.snapshot,'es')(2279).exercise.id;
 const expected=['Se habla español aquí','Se habla aquí español'];
 return {...set,update(table,rowId,after,reason,sources){
  if(table!=='exercises'||rowId!==id||!Object.hasOwn(after,'accepted_answers'))return set.update(table,rowId,after,reason,sources);
  if(!eq(after.accepted_answers,expected))throw Error('Re-review changed Spanish order alternatives');
  set.update(table,rowId,{...after,accepted_answers:[...expected,'Español se habla aquí']},`${reason} Root and author also verified the four-tile topic-fronted Español se habla aquí, with no visible anchor restriction.`,sources);
 }};
}
