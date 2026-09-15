/**
 * "Phrasal Verbs" is a claim about English grammar, made over nine languages.
 *
 * The lesson sits in the B2 unit "Idiomatic Expressions", between Common Idioms,
 * Proverbs, Collocations and Figurative Language. Like every lesson in that
 * unit it draws on one shared pool of twelve English idioms — break the ice,
 * hit the nail on the head, a piece of cake, cost an arm and a leg, let the cat
 * out of the bag, better late than never, on cloud nine, pull someone's leg,
 * once in a blue moon, kill two birds with one stone, the ball is in your court,
 * bite off more than you can chew — and asks the learner for the natural
 * equivalent in the target language. Not one of those is a phrasal verb.
 *
 * Round one authored a single genuine phrasal-verb item into the Spanish,
 * Japanese and Korean copies ("put off" rendered as aplazar and its
 * equivalents). One row out of sixteen does not make an idiom lesson a
 * phrasal-verb lesson, and in the other six languages there is no such row at
 * all. Worse, the category does not exist to be taught: a phrasal verb is an
 * English verb-plus-particle construction. Spanish, French, Italian,
 * Portuguese, Russian, Chinese, Japanese and Korean do not have them (German's
 * separable-prefix verbs are the nearest analogue, and none is taught here).
 * The title promises a grammar topic the target language does not possess.
 *
 * The register offered two remedies: retitle, or move the content. Moving is
 * not available — the four sibling lessons are full of the same pool, and
 * relocating rows would change what learners have already practised. So the
 * title changes, to one that is true of all nine copies including the three
 * with the authored phrasal-verb row: the lesson teaches the target-language
 * EQUIVALENT of an English multi-word expression.
 *
 * `description` moves with it because in this unit the description is a verbatim
 * copy of the title; leaving "Phrasal Verbs" there would keep the false claim on
 * screen wherever descriptions are shown.
 *
 * What is deliberately NOT done: the sibling titles are just as decorative —
 * "Proverbs" teaches Dar en el clavo, which is an idiom, not a proverb. They are
 * loose descriptions of idiomatic material, which is a curriculum-design
 * judgement. "Phrasal Verbs" is singled out because it is the only one naming a
 * grammatical category that is absent from the language being taught.
 */

export const NEW_TITLE = 'Idiomatic Equivalents';
const REASON = 'Idiomatic Expressions / Phrasal Verbs: the lesson teaches target-language equivalents of English idioms, not phrasal verbs, which are an English verb-plus-particle construction the target languages do not have. Retitle to what the lesson does; the description is a verbatim copy of the title in this unit and moves with it. No exercise row is changed.';

export function idiomaticEquivalentsRetitle(set) {
  const { snapshot, update } = set;
  const units = new Map(snapshot.units.map(u => [u.id, u]));
  const lessons = snapshot.lessons.filter(lesson =>
    lesson.title === 'Phrasal Verbs' && units.get(lesson.unit_id)?.title === 'Idiomatic Expressions');
  if (lessons.length !== 9) throw new Error(`Expected nine Phrasal Verbs lessons, found ${lessons.length}`);
  for (const lesson of lessons) {
    if (lesson.description !== 'Phrasal Verbs') throw new Error(`${lesson.id}: description is not the title verbatim`);
    update('lessons', lesson.id, { title: NEW_TITLE, description: NEW_TITLE }, REASON);
  }
  return lessons.length;
}
