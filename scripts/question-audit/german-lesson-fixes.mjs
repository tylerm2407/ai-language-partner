import { lessonRefs } from './lesson-refs.mjs';

// Adjudicated narrow batch. Open production, word-order redesign and broader
// lexical alternatives are separate; this is not a blanket approval of reviews.
export function germanLessonFixes(set) {
  const { row, update } = set;
  const get = lessonRefs(set.snapshot, 'de');
  const edit = (n, fields, reason, sources = []) => update('exercises', get(n).exercise.id, fields, `${get(n).ref}: ${reason}`, sources);
  const choice = (n, before, after, reason, sources) => {
    const e = get(n).exercise;
    if (e.options.filter(x => x === before).length !== 1 || e.options.includes(after) || e.correct_answer === before) throw new Error(`Unexpected de-E${n} options`);
    edit(n, { options: e.options.map(x => x === before ? after : x), ...(e.distractors.includes(before) ? { distractors: e.distractors.map(x => x === before ? after : x) } : {}) }, reason, sources);
  };
  choice(36, 'Sorry', 'Good morning', 'Entschuldigen Sie permits apology and attention-getting readings, so Sorry competes with the valid Excuse me key.', ['https://en.langenscheidt.com/german-english/entschuldigen']);
  choice(1879, 'Ethics', 'Wealth', 'Langenscheidt gives both Ethics and Morality for Moral in the same ethical sense; no supplied context distinguishes the offered pair.', ['https://en.langenscheidt.com/german-english/moral']);
  choice(1949, 'Nevertheless', 'Therefore', 'Jedoch permits both However and Nevertheless; use an unambiguously different connective as the distractor.', ['https://en.langenscheidt.com/german-english/jedoch']);

  edit(2234, { explanation: 'The Konjunktiv II of haben is hätte, formed from hatte with an umlaut. Other verbs have their own patterns; not every strong or mixed verb adds an umlaut. Ich hätte gern expresses what the speaker would like to have.' }, 'Keep the correct hätte key; remove the false universal umlaut rule.');
  edit(2235, { hint_text: 'Put hätte last in the wenn-clause. In the main clause, place würde before ich, optionally with dann before würde; fahren goes last.' }, 'Finite würde is not at the end of the main clause; preserve the correctly keyed verb frame and the existing optional-dann variant.');
  const agentSource = ['https://grammis.ids-mannheim.de/systematische-grammatik/1361'];
  edit(2246, { hint_text: 'Use the usual agent preposition that takes dative with einer jungen Autorin.', explanation: 'Von + dative introduces the writer here: von einer jungen Autorin. Durch takes accusative, so it cannot precede einer in this sentence. Durch can express an agent in other passive sentences; it is not restricted exclusively to means or intermediaries.' }, 'The dative form selects von; the old absolute ban on agentive durch was false.', agentSource);
  const passive = row('grammar_rules', '0e4a2d10-8de9-4a68-92fc-0cb5e0128cc3');
  update('grammar_rules', passive.id, { explanation: passive.explanation.replace('The agent takes von + dative;', 'The agent is commonly introduced with von + dative (durch + accusative is also possible in suitable contexts);') }, 'Dependent passive reference: qualify the same agent-preposition generalization.', agentSource);
  edit(2252, { hint_text: 'For this standard written-language exercise, use the bare year 1950 or im Jahr 1950. Passive: wurde + Partizip II.', explanation: 'The Präteritum passive is wurde gebaut; the accepted Perfekt is ist gebaut worden. This exercise practises the standard year expressions 1950 and im Jahr 1950. In + year also occurs in usage, but is not the form being taught here.' }, 'Replace never with an explicit standard-writing target; do not expand the key to disputed in + year usage.', ['https://www.duden.de/sprachwissen/sprachratgeber/2525', 'https://grammis.ids-mannheim.de/fragen/3206']);
  edit(2252, { prompt: 'Translate to standard written German using the bare year or im Jahr: The house was built in 1950.' }, 'Show the year-phrase selector in the question rather than only in an optional hint.');
  edit(2257, { explanation: 'Geben takes a dative recipient, so the masculine singular relative pronoun is dem. Dessen is genitive masculine/neuter singular; denen is dative plural; deren is genitive feminine singular or plural. None of those fits the masculine singular dative role here.' }, 'Deren is not exclusively plural; keep the correct dem answer.');
  edit(2278, { hint_text: 'Rewrite both verbs in Konjunktiv I for the formal reported-speech style practised here.', explanation: 'In this formal reported-speech exercise, change ist to sei and arbeitet to arbeite across the coordinated clauses. Indicative reported speech is possible in other registers; the task specifically practises Konjunktiv I.' }, 'Make the formal-register transformation explicit without declaring all indicative reporting erroneous.');
  edit(2278, { metadata: { ...get(2278).exercise.metadata, correction_instruction: 'Rewrite the report in formal German using Konjunktiv I for both reported verbs. Keep the rest of the meaning unchanged.' } }, 'Learner-visible contextual instruction is required: the original indicative is not inherently ungrammatical. Requires the opt-in correction_instruction renderer owned by root.');

  // Each new answer below is independently judged in the exact prompt context
  // and has a before-rejected / after-accepted actual-gradeAnswer regression.
  const additions = [
    [2265, ['Der Roman, welchen ich gerade lese, ist spannend.'], 'Welchen is a grammatical accusative masculine relative pronoun in this unrestricted relative-clause transformation.'],
    [2266, ['Der Freund, mit welchem ich gereist bin, wohnt in Berlin.', 'Der Freund, mit welchem ich gereist bin, lebt in Berlin.', 'Der Freund, mit dem ich reiste, wohnt in Berlin.', 'Der Freund, mit dem ich reiste, lebt in Berlin.'], 'The prompt specifies der Freund and wohnen/leben, but not Perfekt; formal welchem and the Präteritum reiste preserve the requested meaning.'],
    [2280, ['Die Professorin sagt, die Prüfung sei schwierig.', 'Die Professorin sagt, dass die Prüfung schwierig sei.'], 'The English professor has no specified gender; both feminine forms preserve the required Konjunktiv I and supplied vocabulary.'],
  ];
  for (const [n, answers, reason] of additions) edit(n, { accepted_answers: [...get(n).exercise.accepted_answers, ...answers] }, reason);
  edit(2265, { hint_text: 'Use an accusative masculine relative pronoun: den or the more formal welchen.', explanation: 'The role of ihn requires an accusative masculine relative pronoun: den or the more formal welchen. Place the relative clause after Der Roman, with lese at its end and a comma on each side.' }, 'Align the hint and explanation with the independently confirmed welchen alternative.');
}
