/** Exact, passage-grounded examples for independently confirmed response-count
 * defects. This does NOT replace semantic assessment of open paraphrases.
 * Root reread every complete source passage before authoring these categories.
 * New values require independent remediation review. */
export const readingAnswerSets = [
  ['es', 3, 1, ['Solar energy', 'Wind energy'], ['Solar', 'Wind', 'Energía solar', 'Energía eólica']],
  ['es', 13, 1, ['Misinformation', 'Cyberbullying', 'Addiction'], ['Social media addiction']],
  ['fr', 6, 2, ['A stronger heart', 'Better blood circulation', 'Weight control'], ['It strengthens the heart and helps control weight.', 'It strengthens the heart and improves blood circulation.']],
  ['fr', 28, 2, ['Asian cuisine', 'Vietnamese cuisine', 'African cuisine', 'Mexican cuisine'], ['Vietnamese and Mexican', 'Asian and African', 'African and Mexican', 'Asian and Mexican', 'Vietnamese and African', 'Asian and Vietnamese']],
  ['de', 2, 1, ['Poor internet connections in some schools', 'Some students have no computer at home', 'Teachers need better training with new technologies'], ['Some pupils have no computer at home.', 'Poor internet', 'Lack of computers at home', 'Inadequate teacher training']],
  ['de', 23, 2, ['Jogging', 'Cycling', 'Football', 'Swimming'], []],
  ['de', 30, 1, ['Excessive screen time', 'Negative effects on mental health'], ['Too much screen time', 'Mental health effects']],
  ['it', 16, 2, ['Privacy', 'Discrimination', 'Transparency'], []],
  ['it', 31, 2, ['Rising temperatures', 'Milder winters', 'Hotter and drier summers', 'Melting glaciers', 'Rising sea levels'], []],
  ['it', 33, 2, ['Greater mental flexibility', 'Better concentration', 'Stronger long-term memory', 'Better problem-solving'], []],
  ['pt', 5, 1, ['Excessive time spent online', 'Privacy concerns'], ['Privacy', 'Too much time online']],
  ['pt', 27, 3, ['Stronger muscles', 'Better blood circulation', 'A healthy weight', 'Less stress', 'A greater sense of well-being'], ['Stronger muscles, better circulation, and less stress']],
  ['pt', 32, 2, ['Data bias and discrimination', 'Privacy protection', 'Responsibility for AI-caused accidents'], ['Bias and privacy', 'Privacy and accountability', 'Discrimination and responsibility']],
  ['ja', 3, 1, ['SNS addiction', 'Privacy violations', 'Misinformation'], ['Social media addiction', 'The spread of false information']],
  ['ja', 15, 1, ['Smartphone voice recognition', 'Autonomous vehicles'], ['Voice recognition on smartphones', 'Self-driving cars']],
  ['ja', 21, 1, ['Restrictions on artistic expression', 'Artworks failing to be understood or have their intended impact'], ['Restrictions on freedom of expression can put artists in danger.', 'Artworks may not be understood.']],
  ['ja', 29, 2, ['Solar power', 'Wind power', 'Wider adoption of electric vehicles'], ['Solar and wind', 'Wind and solar']],
  ['ko', 13, 2, ['Using public transport', 'Recycling', 'Saving energy'], []],
  ['ko', 22, 2, ['EBS video lessons', 'Tablets', 'Smartphones'], ['EBS and tablets', 'EBS and smartphones']],
  ['ko', 26, 1, ['A stronger heart', 'Less stress', 'A happier mood', 'Better sleep'], ['It strengthens the heart.', 'It reduces stress.', 'It improves sleep.']],
  ['ko', 32, 2, ['Recycling programs', 'Increased use of electric vehicles', 'Companies reducing plastic use'], []],
  ['zh', 21, 2, ['A stronger body', 'A better mood', 'Better sleep', 'Improved work and study efficiency'], []],
  ['zh', 23, 2, ['Rising sea levels', 'Loss of habitats for animals and plants', 'Unpredictable weather affecting farming', 'Floods and droughts'], []],
  ['zh', 32, 1, ['Learning anytime and anywhere', 'Learning at your own pace'], ['Students can learn at their own pace.', 'Students can learn anytime and anywhere.']],
  ['ru', 22, 2, ['Air pollution in major cities', 'Pollution of Lake Baikal', 'Deforestation in Siberia'], []],
  ['ru', 29, 2, ['Stronger muscles', 'A healthier heart', 'More energy', 'Less stress', 'Greater confidence and happiness'], []],
];

/** Mechanical enumeration of an authored, closed list of source categories.
 * No substring grading, inferred facts or model-generated synonym expansion. */
export function orderedReadingExamples(count, categories) {
  if (!Number.isInteger(count) || count < 1 || count > categories.length || count > 3
    || new Set(categories).size !== categories.length) throw new Error('Invalid authored categories');
  const examples = [];
  const visit = (chosen, remaining) => {
    if (chosen.length === count) {
      if (count === 1) examples.push(chosen[0]);
      else if (count === 2) examples.push(chosen.join(' and '));
      else {
        examples.push(`${chosen.slice(0, -1).join(', ')}, and ${chosen.at(-1)}`);
        examples.push(`${chosen.slice(0, -1).join(', ')} and ${chosen.at(-1)}`);
      }
      return;
    }
    remaining.forEach((value, index) => visit([...chosen, value], remaining.filter((_, i) => i !== index)));
  };
  visit([], categories);
  return examples;
}

export function readingAnswerFixes({ snapshot, update }) {
  const courses = new Map(snapshot.courses.map(x => [x.id, x]));
  const passages = new Map(snapshot.reading_passages.map(x => [x.id, x]));
  for (const [language, number, count, categories, additional] of readingAnswerSets) {
    const question = snapshot.reading_questions.filter(q => courses.get(passages.get(q.passage_id).course_id).target_language === language)
      .sort((a, b) => a.id.localeCompare(b.id))[number - 1];
    if (!question || question.question_type !== 'short_answer') throw new Error(`Wrong reading ref: ${language}/${number}`);
    const answers = [...new Set([...orderedReadingExamples(count, categories), ...additional])];
    const ref = `${language}-R${String(number).padStart(4, '0')}`;
    update('reading_questions', question.id, {
      correct_answer: answers[0], accepted_answers: answers.slice(1),
      ...(language === 'it' && number === 33 ? { question_text: 'According to the passage, what are two cognitive advantages of being bilingual?' } : {}),
    }, `${ref}: the prompt requests ${count} example${count === 1 ? '' : 's'}, but the old key combines alternatives, explanation or grading instructions. Supply a valid ${count}-example model answer and explicit ordered combinations of the independently reviewed passage categories. These examples do not exhaust valid paraphrases; semantic grading remains unresolved. ${language === 'it' && number === 33 ? 'Keep the question explicitly passage-based; disease-risk reduction is not itself one of the requested cognitive abilities. The passage’s broader scientific claims remain separately unresolved.' : ''}`.trim());
  }
}
