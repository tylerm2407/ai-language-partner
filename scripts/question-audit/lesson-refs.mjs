/** The same frozen ordering as packet.mjs. A lookup is not a semantic review. */
export function lessonRefs(snapshot, language) {
  const courses = new Map(snapshot.courses.map(x => [x.id, x]));
  const units = new Map(snapshot.units.map(x => [x.id, x]));
  const lessons = new Map(snapshot.lessons.map(x => [x.id, x]));
  const bands = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const rows = snapshot.exercises.filter(e => e.type !== 'speaking' && e.response_mode !== 'speak')
    .map(exercise => {
      const lesson = lessons.get(exercise.lesson_id), unit = units.get(lesson.unit_id);
      return { exercise, lesson, unit, course: courses.get(unit.course_id) };
    }).filter(e => e.course.target_language === language)
    .sort((a, b) => bands.indexOf(a.course.cefr_level) - bands.indexOf(b.course.cefr_level)
      || a.unit.order_index - b.unit.order_index || a.lesson.order_index - b.lesson.order_index
      || a.exercise.order_index - b.exercise.order_index || a.exercise.id.localeCompare(b.exercise.id));
  if (rows.length !== 2312) throw new Error(`Unexpected frozen ${language} question count: ${rows.length}`);
  return number => {
    if (!Number.isInteger(number) || number < 1 || number > rows.length) throw new Error(`Invalid ${language} ref ${number}`);
    return { ...rows[number - 1], ref: `${language}-E${String(number).padStart(4, '0')}` };
  };
}
