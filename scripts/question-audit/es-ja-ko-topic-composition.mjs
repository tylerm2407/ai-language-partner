import {isDeepStrictEqual as eq} from 'node:util';
import {lessonRefs} from './lesson-refs.mjs';

// Use ONLY around lexicalAdditionalFixes(set, 'es'), before applying the
// independently approved topic batch to the unwrapped set. These two older
// word-level aliases do not answer the new superlative sentence/blank tasks.
// Preserve historical sources and the compiler's general conflict rejection.
export function selectSpanishLexicalBeforeSuperlativeTasks(set) {
  const get=lessonRefs(set.snapshot,'es');
  const targets=new Map([
    [get(1019).exercise.id,{n:1019,type:'translate_to_native',key:'Cheaper',after:{accepted_answers:['Less expensive']}}],
    [get(1020).exercise.id,{n:1020,type:'fill_blank',key:'caro',after:{accepted_answers:['costoso','costosa']}}],
  ]);
  for(const [id,target] of targets) {
    const e=set.row('exercises',id),context=get(target.n);
    if(e.correct_answer!==target.key || e.type!==target.type || context.lesson.title!=='Superlatives' ||
       context.course.cefr_level!=='A2' || !eq(e.accepted_answers,[])) throw Error(`Changed Spanish superlative source dependency: E${target.n}`);
  }
  return {...set,update(table,id,after,reason,sources) {
    const target=table==='exercises'?targets.get(id):undefined;
    if(target) {
      if(!eq(after,target.after)) throw Error(`Changed Spanish superlative lexical dependency: E${target.n}`);
      return; // Explicitly superseded by the full reviewed topic fields.
    }
    return set.update(table,id,after,reason,sources);
  }};
}
