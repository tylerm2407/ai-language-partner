import {isDeepStrictEqual as eq} from 'node:util';
import {lessonRefs} from './lesson-refs.mjs';

// Wrap ONLY the older spanishLessonFixes invocation, together with its existing
// search-alternative wrapper. Apply the separately reviewed named-skill batch
// to the unwrapped set. Never carry greeting options into text comprehension.
export function selectSpanishNarrowBeforeReadingTask(set) {
  const {exercise,lesson,unit,course}=lessonRefs(set.snapshot,'es')(49);
  const id='aabbccdd-1111-1001-0005-e00000000001';
  const e=set.row('exercises',id);
  if(exercise.id!==id || e.lesson_id!=='aabbccdd-1111-1001-0005-000000000000' ||
     e.type!=='multiple_choice' || e.correct_answer!=='Good night' ||
     e.prompt!=='What does "Buenas noches" mean in English?' ||
     !eq(e.options,['Good morning','Good night','Good evening','Goodbye']) ||
     !eq(e.distractors,[]) || lesson.title!=='Reading Simple Texts' ||
     unit.title!=='Greetings & Basics' || course.cefr_level!=='A1') {
    throw Error('Changed Spanish reading source dependency: E0049');
  }
  const expected={options:['Good morning','Good night','Thank you','Goodbye']};
  return {...set,update(table,rowId,after,reason,sources) {
    if(table==='exercises' && rowId===id) {
      if(!eq(after,expected)) throw Error('Changed Spanish reading options dependency: E0049');
      return; // Explicit exact supersession, not a general conflict override.
    }
    return set.update(table,rowId,after,reason,sources);
  }};
}
