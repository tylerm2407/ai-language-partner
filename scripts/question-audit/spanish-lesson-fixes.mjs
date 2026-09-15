import { lessonRefs } from './lesson-refs.mjs';

/** Narrow confirmed-error batch, not blanket acceptance of proposed synonyms.
 * Production grading, one-tile tasks and progression remain separate work. */
export function spanishLessonFixes(set) {
  const { row, update, replaceText } = set;
  const get = lessonRefs(set.snapshot, 'es');
  const edit = (ref, fields, reason, sources = []) => {
    const { exercise, ref: label } = get(ref);
    update('exercises', exercise.id, fields, `${label}: ${reason}`, sources);
  };
  const replaceOption = (ref, before, after, reason, sources = []) => {
    const { exercise } = get(ref);
    if (exercise.options?.filter(x => x === before).length !== 1 || exercise.options.includes(after)) throw new Error(`Unexpected options at es-E${ref}`);
    const fields = { options: exercise.options.map(x => x === before ? after : x) };
    if (exercise.distractors?.includes(before)) fields.distractors = exercise.distractors.map(x => x === before ? after : x);
    edit(ref, fields, reason, sources);
  };
  for (const ref of [5, 49]) replaceOption(ref, 'Good evening', 'Thank you',
    'Buenas noches can mean both Good night and Good evening. Preserve the valid primary key and replace the second correct choice with an unambiguously different meaning.');
  replaceOption(36, 'Sorry', 'Good morning', 'Disculpe can be an apology or an attention-getter; Sorry is not a defensible wrong distractor for this context-free listening prompt.');
  replaceOption(1599, 'Meanwhile', 'Finally', 'Mientras can function as both while and meanwhile; replace the second valid option.', ['https://www.rae.es/dpd/mientras']);
  replaceOption(1627, 'Then', 'Before', 'Luego has both Next and Then as valid sequence translations; retain the original primary answer with a distinct distractor.');
  replaceOption(1949, 'Nevertheless', 'Therefore', 'Sin embargo allows However and Nevertheless; replace the second correct adversative with a consequence connector.');

  const hariaReason = 'Haría is a conditional form of hacer, retaining the lexical meaning do/make; it is not a general standalone equivalent of English would.';
  edit(1642, { prompt: 'Translate to Spanish: I would do (use the conditional of hacer)', accepted_answers: ['Yo haría'] }, hariaReason);
  for (const ref of [1655, 1666, 1706]) {
    const e = get(ref).exercise;
    if (e.correct_answer !== 'Would' || !e.options.includes('Would')) throw new Error(`Unexpected Haría key: ${ref}`);
    edit(ref, { correct_answer: 'Would do / would make', options: e.options.map(x => x === 'Would' ? 'Would do / would make' : x) }, hariaReason);
  }
  edit(1665, { hint_text: 'Would do / would make' }, hariaReason);
  edit(1719, { prompt: 'Write a sentence using the word: Haría (would do / would make)' }, `${hariaReason} This gloss repair does not resolve the separately tracked open-production grading defect.`);
  update('cards', 'aabbccdd-1111-3007-c002-b10000000000', { native_text: 'Would do / would make' }, 'Dependent shared vocabulary card: preserve the lexical do/make meaning of Haría so lesson/SRS hints do not contradict the repaired questions.');

  const insteadReason = 'En vez de is the prepositional phrase Instead of, not bare Instead; preserve its required complement relationship.';
  for (const ref of [1649, 1688, 1701, 1714]) {
    const e = get(ref).exercise;
    replaceText('exercises', e.id, 'prompt', [['Instead', 'Instead of']], `es-E${ref}: ${insteadReason}${ref === 1649 ? ' Open-production grading remains a separate unresolved issue.' : ''}`);
  }
  edit(1681, { hint_text: 'Instead of' }, insteadReason);
  const insteadChoice = get(1682).exercise;
  edit(1682, { correct_answer: 'Instead of', options: insteadChoice.options.map(x => x === 'Instead' ? 'Instead of' : x) }, insteadReason);
  update('cards', 'aabbccdd-1111-3007-c009-b10000000000', { native_text: 'Instead of' }, `Dependent shared vocabulary card: ${insteadReason}`);
  // Dictation metadata that is not displayed and valid Spanish transcripts are unchanged.
  edit(2157, { hint_text: "To pull someone's leg" }, 'Restore the missing possessive apostrophe in the visible English idiom hint; the card already has correct spelling.');
  edit(2176, { correct_answer: 'el séptimo cielo', accepted_answers: ['la gloria'] },
    'The English idiom expresses great happiness; estar en las nubes means being absent-minded/daydreaming. The new key and alternative both fit the literal Estar en ___ frame.', ['https://dle.rae.es/nube']);

  edit(2238, { explanation: 'Doubt takes the subjunctive here: dudo que tenga (not tiene). The pronoun «él» can be omitted when context identifies him. The form «tenga» itself can be first- or third-person singular, so the ending alone does not identify the subject.' }, 'Correct the explanation of subject omission without changing the valid answer.');
  const siSource = ['https://www.rae.es/dpd/si'];
  edit(2250, {
    hint_text: 'In this hypothetical condition, use the imperfect subjunctive after «si»; the main clause keeps the conditional.',
    explanation: 'For this hypothetical present/future condition, standard Spanish uses si tuviera/tuviese, followed by aprendería in the main clause. This rule concerns conditional «si» meaning if; indirect-question «si» meaning whether can be followed by a conditional.',
  }, 'Scope the si rule to the conditional construction being tested; the unqualified never-after-si claim is false.', siSource);
  edit(2306, {
    hint_text: 'In this hypothetical condition, change the si-clause verb to the imperfect subjunctive.',
    explanation: 'This hypothetical condition requires si supiera/supiese in standard Spanish. Keep te la diría in the main clause. The restriction is not a ban on the conditional after indirect-question «si» meaning whether.',
  }, 'Distinguish conditional if from interrogative whether; retain both correct subjunctive variants.', siSource);
  const siRule = row('grammar_rules', '01c5536c-6f2d-413f-90d7-29d5176dfaec');
  update('grammar_rules', siRule.id, {
    explanation: 'Common patterns: real condition, si + present indicative, with a future, present or imperative result; hypothetical present/future, si + imperfect subjunctive with a conditional result; unreal past, si + pluperfect subjunctive with a conditional perfect or pluperfect subjunctive result. These restrictions apply to conditional si (if), not indirect-question si (whether).',
    common_errors: siRule.common_errors.map(x => ({ ...x, note: 'In this hypothetical condition, standard Spanish uses the imperfect subjunctive in the si-clause.' })),
  }, 'Dependent grammar reference repeats the false universal never-after-si rule; qualify the construction and retain its valid examples.', siSource);

  edit(2263, { accepted_answers: ['Marta dijo que ella no podía ir a la reunión'] }, 'The instruction explicitly requires starting with Marta dijo que; the old alternative omitted Marta and did not fulfill the requested transformation.');
  edit(2305, { accepted_answers: ['Paula dijo que ella llegaría tarde a la cena'] }, 'The instruction explicitly requires starting with Paula dijo que; retain the named subject in the accepted variant.');
  edit(2285, {
    hint_text: 'Trabajar en una empresa uses «en». Choose the relative expression that preserves that relationship.',
    explanation: 'Among these choices, en la que expresses the place where he works. En que, en la cual and donde can also form grammatical versions of this sentence, but are not offered here. Plain que does not express the required relationship in this sentence, and quien refers to people.',
  }, 'An article is not obligatory in every valid relative; correct the categorical hint while preserving the uniquely correct offered option.');
  const search = get(2294).exercise;
  edit(2294, {
    accepted_answers: [...search.accepted_answers, 'Busco alguien que tenga experiencia en ventas', 'Estoy buscando alguien que tenga experiencia en ventas'],
    hint_text: 'For the intended non-specific person, use the subjunctive in the relative clause. With buscar, personal «a» before alguien is optional. Sales = ventas.',
    explanation: 'For someone not yet identified, use tenga: busco (a) alguien que tenga experiencia en ventas. With buscar, both alguien and a alguien are standard here. The subjunctive follows the intended non-specific reading, not the word alguien alone.',
  }, 'RAE explicitly permits buscar (a) alguien with a subjunctive relative. Remove the false mandatory-a hint and accept both standard forms.', ['https://www.rae.es/dpd/a']);
  edit(2302, {
    accepted_answers: ['vendían'],
    explanation: 'The plural subject muchas casas requires a plural verb. Se vendieron presents completed sales; se vendían describes ongoing or repeated sales during the crisis. Both past-tense readings fit the prompt, which does not require the preterite.',
  }, 'The prompt asks only for past tense; imperfect vendían is valid as well as preterite vendieron. Both independent reviews identified the missing variant.');
}
