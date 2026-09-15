// Minimal remaining Russian tasks after independently approved sentence banks.
import { lessonRefs } from './lesson-refs.mjs';
const choice = (prompt, correct_answer, options) => ({ prompt, correct_answer, options, distractors: options.filter(a => a !== correct_answer), accepted_answers: [] });
export const russianTargetedSkills = [
  [13, 'Goodbye', 'A1', 'Phrases & Sentences', choice('You are meeting someone for the first time. Which phrase introduces you as Anna?', 'Меня зовут Анна.', ['Я живу в Москве.', 'Большое спасибо!', 'Меня зовут Анна.', 'До свидания!']), 'The unit explicitly promises introductions but contains no self-introduction. Add the ordinary Russian name construction in its phrases lesson; retain the other correct greetings.'],
  [1515, 'Password', 'B1', 'Tech Problems', choice('Read: «Я ввёл правильный пароль, но не могу войти в свою учётную запись. Остальные страницы открываются нормально». What problem does the speaker report?', 'They cannot sign in even though they entered the correct password.', ['They have forgotten the password.', 'The keyboard has stopped responding.', 'None of the web pages will open.', 'They cannot sign in even though they entered the correct password.']), 'The precise problems lesson has technology vocabulary but no concrete malfunction. Add a fictional login problem while retaining technical prerequisites.'],
  [1585, 'Suddenly', 'B1', 'Past Continuous', choice('Read: «Вчера в восемь вечера я готовил ужин, а моя сестра читала. Вдруг зазвонил телефон». Which two actions were already in progress when the phone rang?', 'Preparing dinner and reading', ['Reading and leaving the house', 'Preparing dinner and reading', 'Preparing dinner and making a phone call', 'Eating dinner and making a phone call']), 'The precise ongoing-past lesson has no ongoing finite past action. Add Russian imperfective background actions and a perfective onset; do not invent a distinct Russian continuous tense.'],
  [2103, 'Sculpture', 'B2', 'Music Appreciation', choice('Read this concert review: «В финале оркестр играет всё тише, а основная мелодия повторяется». What change in volume does the reviewer describe?', 'The orchestra gradually plays more softly.', ['The orchestra maintains exactly the same volume.', 'The orchestra gradually plays more softly.', 'The orchestra gradually plays more loudly.', 'The orchestra suddenly stops playing.']), 'The isolated sculpture target is unrelated to the precise music lesson. Add interpretation of a musical feature in a short concert review.'],
  [2112, 'Novel', 'B2', 'Music Appreciation', choice('Which change does «оркестр постепенно ускоряет темп» describe in a concert review?', 'The music gets faster.', ['The music starts again.', 'The music gets slower.', 'The music gets quieter.', 'The music gets faster.']), 'The isolated novel target is unrelated to the precise music lesson. Add musical tempo recognition, while retaining relevant shared literary vocabulary and the approved composer sentence.'],
  [2113, 'Скульптура', 'B2', 'Music Appreciation', { prompt: 'Музыка звучит всё быстрее.', correct_answer: 'Музыка звучит всё быстрее.', hint_text: 'The music gets faster.', card_id: null, accepted_answers: [] }, 'Replace the dependent isolated sculpture listening copy with a musical change and detach the stale sculpture card.'],
  [2114, 'Sculpture', 'B2', 'Music Appreciation', { ...choice('Музыка звучит всё быстрее.', 'The music gets faster.', ['The music gets quieter.', 'The music starts again.', 'The music gets faster.', 'The music gets slower.']), card_id: null }, 'Replace the dependent isolated sculpture listening meaning copy with the same musical change and detach the stale sculpture card.'],
];

// No current overlap. Preflight all rows before writing any newly proposed task.
export function russianTargetedSkillFixes(set) {
  const get = lessonRefs(set.snapshot, 'ru');
  for (const [n, oldKey, level, lesson, after] of russianTargetedSkills) {
    const c = get(n), e = c.exercise;
    if (e.correct_answer !== oldKey || c.course.cefr_level !== level || c.lesson.title !== lesson || e.prompt_audio_url !== null) throw new Error(`Changed Russian targeted-skill dependency ${c.ref}`);
    const prior = set.patches().find(p => p.table === 'exercises' && p.id === e.id);
    if (prior && Object.keys(after).some(field => Object.hasOwn(prior.after, field))) throw new Error(`Unreviewed overlapping Russian targeted-skill field: ${c.ref}`);
  }
  for (const [n, , , , after, reason] of russianTargetedSkills) set.update('exercises', get(n).exercise.id, after, `${get(n).ref}: ${reason} Preserve ID/type/level/lesson; broader practice depth, open production and generated audio remain separate.`);
}
