/** Independently authored short answers rejected in the saved runtime baseline.
 * This repairs specific omissions, not general semantic paraphrase grading.
 * Passage assertions themselves are not verified by these answer additions. */
export const shortReadingAnswers = [
  ['es', 7, ['Seven days', '7 days']],
  ['fr', 8, ['15%', '15 percent']],
  ['fr', 10, ['CNIL']],
  ['fr', 15, ['Sagrada Família', 'The Sagrada Família']],
  ['de', 1, ['2045']],
  ['de', 14, ['A customer service employee', 'Customer service employee']],
  ['it', 1, ['Brera']],
  ['it', 11, ['Third floor', 'The third floor', '3rd floor']],
  ['it', 13, ['At least 40%', '40%']],
  ['pt', 4, ['At least 150 minutes', '150 minutes']],
  ['pt', 7, ['Lisbon and Porto', 'Porto and Lisbon', 'Lisboa e Porto', 'Porto e Lisboa']],
  ['ja', 22, ['1–2 minutes', '1-2 minutes', '1 to 2 minutes']],
  ['ja', 28, ['The brain can change physically through experience.']],
  ['ko', 18, ['Sagrada Família', 'The Sagrada Família']],
  ['ko', 25, ['1–2 hours', '1-2 hours', '1 to 2 hours']],
  ['zh', 18, ['Neuroplasticity', 'Neural plasticity', '神经可塑性']],
  ['zh', 26, ['Alibaba and Tencent', 'Tencent and Alibaba', '阿里巴巴和腾讯', '腾讯和阿里巴巴']],
  ['ru', 9, ['Three times a week', 'At least three times a week', 'At least 3 times a week', '3 times a week']],
  ['ru', 13, ['Vladimir Mayakovsky', 'Владимир Маяковский']],
  ['ru', 14, ['Paella']],
  ['ru', 19, ['Park Güell']],
];
export function readingShortAnswerFixes({ snapshot, update }) {
  const courses = new Map(snapshot.courses.map(x => [x.id, x]));
  const passages = new Map(snapshot.reading_passages.map(x => [x.id, x]));
  for (const [language, n, answers] of shortReadingAnswers) {
    const q = snapshot.reading_questions.filter(q => courses.get(passages.get(q.passage_id).course_id).target_language === language)
      .sort((a, b) => a.id.localeCompare(b.id))[n - 1];
    if (q.question_type !== 'short_answer' || q.accepted_answers.length) throw new Error(`Unexpected original short answer ${language}/${n}`);
    update('reading_questions', q.id, { accepted_answers: answers },
      `${language}-R${String(n).padStart(4, '0')}: accept the directly requested name, quantity or meaning without requiring the stored key’s extra explanatory wording. Literal content was checked in both reading passes; shorter-answer rejection was reproduced in the runtime audit. This is not exhaustive paraphrase support or independent verification of unnamed studies/advice in the passage.`);
  }
}
