// Remaining minimal French A2/B1/B2 closed-task proposals. Not deployed.
import { lessonRefs } from './lesson-refs.mjs';

const choice = (prompt, correct_answer, options) => ({ prompt, correct_answer, options, distractors: options.filter(a => a !== correct_answer), accepted_answers: [] });

// [frozen E ref, original key, level, exact lesson, new fields, reason]
export const frenchTargetedSkills = [
  [585, 'Cousin', 'A2', 'Talking About Ages', choice('Read: « Mon cousin a dix-huit ans et sa sœur a vingt et un ans. » Who is older?', 'The cousin’s sister', ['The cousin', 'The cousin’s sister', 'They are the same age', 'Their ages are not given']), 'The named age lesson still has no age or number after the approved banks. Supply one age comparison using avoir; retain family-role vocabulary and the valid multi-tile boyfriend task.'],
  [1017, 'Better', 'A2', 'Superlatives', choice('What does « C’est le meilleur restaurant de la ville » mean?', 'It is the best restaurant in town.', ['It is a better restaurant than the one next door.', 'It is the worst restaurant in town.', 'It is the best restaurant in town.', 'It is the cheapest restaurant in town.']), 'The precise superlatives lesson contains only comparative targets. Supply a real le meilleur superlative with its comparison set; preserve comparative prerequisites.'],
  [1041, 'Cheaper', 'A2', 'Preferences', choice('Read: « Je préfère ce train parce qu’il est moins cher. » Which statement matches the speaker’s preference?', 'The speaker prefers this train because it costs less.', ['The speaker dislikes this train because it is slow.', 'The speaker prefers this train because it is faster.', 'The speaker likes both trains equally.', 'The speaker prefers this train because it costs less.']), 'The named preferences lesson contains comparisons but no preference expression. Add je préfère with a simple reason while retaining moins cher.'],
  [1515, 'Password', 'B1', 'Tech Problems', choice('Read: « J’ai saisi le bon mot de passe, mais le site refuse la connexion. Les autres pages s’ouvrent normalement. » What problem does the speaker report?', 'They cannot sign in even though they entered the correct password.', ['They have forgotten the password.', 'None of the web pages will open.', 'They cannot sign in even though they entered the correct password.', 'The keyboard has stopped responding.']), 'The precise problems lesson contains device/Internet vocabulary but no malfunction. Add one concrete problem report while preserving the useful technical vocabulary.'],
  [1585, 'Suddenly', 'B1', 'Past Continuous', choice('Read: « Hier, à huit heures, je préparais le dîner pendant que ma sœur lisait. Soudain, le téléphone a sonné. » Which two actions were already in progress when the phone rang?', 'Preparing dinner and reading', ['Preparing dinner and reading', 'Preparing dinner and making a phone call', 'Reading and leaving the house', 'Eating dinner and making a phone call']), 'The exact ongoing-past lesson still contains no ongoing-past clause. Supply two context-selected imparfait actions and a passé composé interruption; retain soudain without importing an English auxiliary formula into French.'],
  [2103, 'Sculpture', 'B2', 'Music Appreciation', choice('Read this concert review: « Dans le dernier passage, l’orchestre joue de moins en moins fort, tandis que la mélodie principale revient plusieurs fois. » What change in volume does the reviewer describe?', 'The orchestra gradually plays more softly.', ['The orchestra gradually plays more loudly.', 'The orchestra suddenly stops playing.', 'The orchestra maintains exactly the same volume.', 'The orchestra gradually plays more softly.']), 'The isolated sculpture item is unrelated to the precise music lesson. Replace it with an actual concert-review interpretation of a musical feature, not a claim that all short arts terms are unsuitable at B2.'],
  [2112, 'Novel', 'B2', 'Music Appreciation', choice('Which change does « le tempo s’accélère » describe in a music review?', 'The music gets faster.', ['The music gets quieter.', 'The music gets slower.', 'The music gets faster.', 'The music starts again.']), 'The isolated novel target is unrelated to the precise music lesson. Replace it with music-specific tempo recognition; short recognition remains legitimate at B2.'],
  [2113, 'Sculpture', 'B2', 'Music Appreciation', { prompt: 'Le tempo s’accélère.', correct_answer: 'Le tempo s’accélère.', hint_text: 'The music gets faster.', card_id: null, accepted_answers: [] }, 'Replace the dependent isolated-sculpture listening copy with the new musical feature and detach its stale sculpture card.'],
  [2114, 'Sculpture', 'B2', 'Music Appreciation', { ...choice('Le tempo s’accélère.', 'The music gets faster.', ['The music gets quieter.', 'The music gets slower.', 'The music gets faster.', 'The music starts again.']), card_id: null }, 'Replace the dependent isolated-sculpture listening meaning copy with the new musical feature and detach its stale sculpture card.'],
];

// Invoke after the earlier French producers. There are NO current overlapping
// proposed fields. Fail closed if that changes; do not silently suppress or
// overwrite an unreviewed producer, including an accepted array cleared to [].
export function frenchTargetedSkillFixes(set) {
  const get = lessonRefs(set.snapshot, 'fr');
  for (const [n, oldKey, level, lesson, after] of frenchTargetedSkills) {
    const context = get(n), e = context.exercise;
    if (e.correct_answer !== oldKey || context.course.cefr_level !== level || context.lesson.title !== lesson || e.prompt_audio_url !== null) throw new Error(`Changed French targeted-skill dependency ${context.ref}`);
    const earlier = set.patches().find(p => p.table === 'exercises' && p.id === e.id);
    if (earlier && Object.keys(after).some(field => Object.hasOwn(earlier.after, field))) throw new Error(`Unreviewed overlapping French targeted-skill field: ${context.ref}`);
  }
  for (const [n, , , , after, reason] of frenchTargetedSkills) {
    const context = get(n);
    set.update('exercises', context.exercise.id, after, `${context.ref}: ${reason} Preserve ID, type, level and exact lesson. This is minimal controlled practice, not whole-genre mastery, open-production or audio certification.`);
  }
}
