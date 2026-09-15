/**
 * Spanish `accepted_answers` additions: 137 vocabulary rows where the stored key is
 * right, a learner types an alternative that is also right, and the real grader marks
 * them wrong. Additions only — no key, no existing alternative, no option and no prompt
 * is touched, and no stored entry is ever dropped.
 *
 * Input was the 137 Spanish `accepted_answers_addition` entries in
 * `lexical-defect-proposals-2026-09-14.json`, carrying 272 alternatives. A proposal is a
 * candidate, not a correction: each alternative was read against its own prompt, key,
 * existing accepted answers, lesson, unit and CEFR level in the frozen snapshot and kept
 * only if it is correct IN THAT PROMPT'S EXACT CONTEXT. What survives, what does not and
 * why is in `spanish-accepted-alternatives-evidence.json`.
 *
 * Three changes against the proposals, all in `spanish-accepted-alternatives-evidence.json`:
 *
 *   - `es-E0505` is dropped whole. Its `accepted_answers` is already patched by another
 *     producer in the current draft, so answering the same claim twice is a reconciliation
 *     for the integration owner, not something to patch over. That row's claim goes
 *     unanswered here.
 *   - `es-E1601` loses "Then". `es-E1627` is a `multiple_choice` on the identical stimulus
 *     ("Luego"), keyed "Next", and offers "Then" as a distractor; `es-E1571` and `es-E1622`
 *     teach "Entonces" as the key for "Then". Accepting it would credit a distractor the
 *     course deliberately sets against this very word. "Later" and "Afterwards" stand.
 *   - Two rows gain alternatives the proposals did not name, because an identical row got
 *     them and grading two identical rows differently is the defect, not the fix.
 *     `es-E1698` gains "Quizá" (`es-E1659` has the same gloss and key and was granted it),
 *     and `es-E1712` is added to the set entirely for the same reason against `es-E1673`.
 *     Both rows currently let those answers through only as "minor typos", which is not
 *     authored acceptance and tells a learner their correct answer was a misspelling.
 *
 * Authored, not reviewed. No independent reviewer has approved any value here.
 */
import { lessonRefs } from './lesson-refs.mjs';

/** Why a row's additions are licensed. A row may carry more than one. */
const GROUNDS = {
  lexical: 'an ordinary dictionary equivalent of the stored key, with nothing in the bare prompt narrowing the sense',
  regional: 'the standard term for the same referent in another Spanish-speaking region, and the prompt carries no regional cue',
  register: 'the same referent in a neighbouring register, in a lesson that teaches that register explicitly',
  gender: 'the English names no gendered referent, so the counterpart Spanish form is equally grammatical',
  number: 'the English gloss and the Spanish counterpart agree in number, and the prompt fixes neither',
  person: 'the prompt names no addressee, so the other persons of the same imperative are equally licensed',
  pronoun: 'Spanish allows an explicit subject pronoun and nothing in the prompt forbids one',
  conditional_person: 'the form shown is first and third person singular conditional, so the person-marked English readings are readings of the exact form on screen',
  completion: 'the visible stem admits this completion as well as the keyed one, and the prompt selects neither',
  variant: 'the RAE-sanctioned spelling variant of the very same word',
  bare_infinitive: 'an English infinitive citation may omit the marker "to", which this curriculum has already settled on es-E0229, es-E0273, es-E0295, es-E0307, es-E0767 and es-E1127',
  idiom: 'a standard equivalent of the same figurative expression; the learner is asked to translate the idiom, not to reproduce one fixed form',
  plain_gloss: 'the row reads a Spanish idiom into English, and stating what the idiom means is exactly the comprehension it tests',
};

/** [frozen ref number, type, lesson title, stored key, current accepted_answers, additions, grounds, sources?] */
export const spanishAlternativeRows = [
  [1138, "translate_to_target", "Expressing Opinions", "Estoy de acuerdo", [], ["Yo estoy de acuerdo","Concuerdo","Coincido"], ["lexical","pronoun"]],
  [1139, "translate_to_native", "Expressing Opinions", "I disagree", [], ["I do not agree","I don’t agree"], ["lexical"]],
  [1152, "translate_to_target", "Agreeing & Disagreeing", "No estoy de acuerdo", [], ["Yo no estoy de acuerdo","Estoy en desacuerdo","Discrepo","No coincido"], ["lexical","pronoun"]],
  [1153, "translate_to_native", "Agreeing & Disagreeing", "I think that", [], ["I believe that"], ["lexical"]],
  [1166, "translate_to_target", "Current Events", "Creo que", [], ["Yo creo que","Pienso que"], ["lexical","pronoun"]],
  [1222, "translate_to_target", "Job Interviews", "Currículum", [], ["Currículum vitae","Hoja de vida","CV"], ["lexical","regional"], ["https://www.wordreference.com/es/en/translation.asp?spen=hoja%20de%20vida"]],
  [1225, "cloze_deletion", "Job Interviews", "Salario", [], ["Sueldo"], ["lexical"]],
  [1236, "translate_to_target", "Office Communication", "Reunión", [], ["Junta"], ["regional"]],
  [1251, "translate_to_native", "Meetings", "Salary", [], ["Wage","Wages"], ["lexical"]],
  [1264, "translate_to_target", "Career Goals", "Salario", [], ["Sueldo"], ["lexical"]],
  [1265, "translate_to_native", "Career Goals", "To hire", [], ["Hire"], ["bare_infinitive"]],
  [1267, "cloze_deletion", "Career Goals", "Colega", [], ["Compañero de trabajo","Compañera de trabajo"], ["lexical","gender"]],
  [1279, "translate_to_native", "Work Problems", "To fire", [], ["To dismiss","Dismiss","To sack"], ["lexical","bare_infinitive"]],
  [1281, "cloze_deletion", "Work Problems", "Gerente", [], ["Gerenta"], ["gender","regional"], ["https://www.wordreference.com/es/en/translation.asp?spen=gerenta"]],
  [1293, "translate_to_native", "Review & Test", "Colleague", [], ["Coworker","Co-worker"], ["lexical"]],
  [1295, "cloze_deletion", "Review & Test", "Fecha límite", [], ["Fecha tope","Plazo"], ["lexical"]],
  [1308, "fill_blank", "Booking Travel", "erva", [], ["ervación"], ["completion","regional"]],
  [1321, "translate_to_native", "At the Airport", "Reservation", [], ["Booking"], ["lexical"]],
  [1334, "translate_to_target", "Hotel Check-in", "Reserva", [], ["Reservación"], ["regional"]],
  [1337, "cloze_deletion", "Hotel Check-in", "Tarjeta de embarque", [], ["Pase de abordar","Pase de embarque","Pase de abordaje"], ["regional"]],
  [1350, "fill_blank", "Travel Experiences", "e embarque", [], ["e abordaje"], ["completion","regional"]],
  [1351, "cloze_deletion", "Travel Experiences", "Retraso", [], ["Demora","Atraso","Retardo"], ["lexical","regional"]],
  [1363, "translate_to_native", "Travel Problems", "Boarding pass", [], ["Boarding card"], ["regional"]],
  [1364, "fill_blank", "Travel Problems", "raso", [], ["ardo"], ["completion","lexical"]],
  [1365, "cloze_deletion", "Travel Problems", "Cancelar", [], ["Anular"], ["lexical"]],
  [1376, "translate_to_target", "Review & Test", "Tarjeta de embarque", [], ["Pase de abordar","Pase de embarque","Pase de abordaje"], ["regional"]],
  [1390, "translate_to_target", "Climate & Weather", "Contaminación", [], ["Polución"], ["lexical"], ["https://www.wordreference.com/es/en/translation.asp?spen=poluci%C3%B3n"]],
  [1391, "translate_to_native", "Climate & Weather", "To recycle", [], ["Recycle"], ["bare_infinitive"]],
  [1405, "translate_to_native", "Wildlife", "Forest", [], ["Woods","Woodland"], ["lexical"]],
  [1407, "cloze_deletion", "Wildlife", "En peligro", [], ["En peligro de extinción"], ["lexical"]],
  [1420, "fill_blank", "Conservation", "ligro", [], ["ligro de extinción"], ["completion","lexical"]],
  [1433, "translate_to_native", "Pollution", "Endangered", [], ["In danger"], ["lexical"]],
  [1446, "translate_to_target", "Sustainable Living", "En peligro", [], ["En peligro de extinción"], ["lexical"]],
  [1474, "translate_to_target", "Internet & Social Media", "Sitio web", [], ["Página web"], ["lexical"]],
  [1475, "translate_to_native", "Internet & Social Media", "App", [], ["Application"], ["lexical"]],
  [1477, "cloze_deletion", "Internet & Social Media", "Descargar", [], ["Bajar"], ["lexical"]],
  [1491, "cloze_deletion", "Smartphones & Apps", "Subir", [], ["Cargar"], ["lexical"]],
  [1502, "translate_to_target", "Digital Communication", "Contraseña", [], ["Clave","Clave de acceso"], ["lexical"]],
  [1503, "translate_to_native", "Digital Communication", "To download", [], ["Download"], ["bare_infinitive"]],
  [1516, "translate_to_target", "Tech Problems", "Descargar", [], ["Bajar"], ["lexical"]],
  [1517, "translate_to_native", "Tech Problems", "To upload", [], ["Upload"], ["bare_infinitive"]],
  [1530, "translate_to_target", "Future Technology", "Subir", [], ["Cargar"], ["lexical"]],
  [1531, "translate_to_native", "Future Technology", "Screen", [], ["Display"], ["lexical"]],
  [1547, "cloze_deletion", "Review & Test", "Inteligencia artificial", [], ["IA"], ["lexical"]],
  [1559, "translate_to_native", "Telling a Story", "Suddenly", [], ["All of a sudden"], ["lexical"]],
  [1561, "cloze_deletion", "Telling a Story", "Primero", [], ["En primer lugar"], ["lexical"]],
  [1572, "translate_to_target", "Sequencing Events", "De repente", [], ["Repentinamente","Súbitamente","De pronto"], ["lexical"]],
  [1575, "cloze_deletion", "Sequencing Events", "Luego", [], ["Después","A continuación"], ["lexical"]],
  [1589, "cloze_deletion", "Past Continuous", "Finalmente", [], ["Por último"], ["lexical"]],
  [1600, "translate_to_target", "Interruptions", "Primero", [], ["En primer lugar"], ["lexical"]],
  [1601, "translate_to_native", "Interruptions", "Next", [], ["Later","Afterwards"], ["lexical"]],
  [1603, "cloze_deletion", "Interruptions", "Mientras tanto", [], ["Entretanto","Entre tanto"], ["lexical","variant"]],
  [1614, "translate_to_target", "Describing Scenes", "Luego", [], ["A continuación","Después"], ["lexical"]],
  [1615, "translate_to_native", "Describing Scenes", "Finally", [], ["Lastly"], ["lexical"]],
  [1628, "translate_to_target", "Review & Test", "Finalmente", [], ["Por último"], ["lexical"]],
  [1629, "translate_to_native", "Review & Test", "Meanwhile", [], ["In the meantime"], ["lexical"]],
  [1631, "cloze_deletion", "Review & Test", "Trama", [], ["Argumento"], ["lexical"]],
  [1643, "translate_to_native", "First Conditional", "Could", [], ["I could","He could","She could","You could"], ["conditional_person"]],
  [1645, "cloze_deletion", "First Conditional", "Desearía", [], ["Ojalá","Yo desearía","Quisiera"], ["lexical","pronoun"]],
  [1657, "translate_to_native", "Second Conditional", "Should", [], ["I should","He should","She should","You should","Ought to"], ["conditional_person","lexical"]],
  [1659, "cloze_deletion", "Second Conditional", "Quizás", [], ["Quizá","Tal vez","A lo mejor"], ["variant","lexical"], ["https://www.wordreference.com/es/en/translation.asp?spen=quiz%C3%A1"]],
  [1671, "translate_to_native", "Giving Advice", "I wish", [], ["I would like","He would like","She would like","You would like"], ["conditional_person"]],
  [1672, "fill_blank", "Giving Advice", "zás", [], ["zá"], ["completion","variant"], ["https://www.wordreference.com/es/en/translation.asp?spen=quiz%C3%A1"]],
  [1673, "cloze_deletion", "Giving Advice", "Imagina", [], ["Imagínate","Imaginen","Imaginad"], ["person"]],
  [1684, "translate_to_target", "Expressing Wishes", "Desearía", [], ["Ojalá","Yo desearía","Quisiera"], ["lexical","pronoun"]],
  [1685, "translate_to_native", "Expressing Wishes", "Perhaps", [], ["Maybe","Possibly"], ["lexical"]],
  [1687, "cloze_deletion", "Expressing Wishes", "Supongamos", [], ["Supón","Suponga","Supongan"], ["person"]],
  [1698, "translate_to_target", "Regrets", "Quizás", [], ["Tal vez","A lo mejor","Quizá"], ["variant","lexical"], ["https://www.wordreference.com/es/en/translation.asp?spen=quiz%C3%A1"]],
  [1712, "translate_to_target", "Review & Test", "Imagina", [], ["Imagínate","Imaginen","Imaginad"], ["person"]],
  [1713, "translate_to_native", "Review & Test", "Suppose", [], ["Let’s suppose","Let us suppose"], ["lexical"]],
  [1715, "cloze_deletion", "Review & Test", "De lo contrario", [], ["Si no","De otro modo"], ["lexical"]],
  [1726, "translate_to_target", "Formal Requests", "Estimado señor", [], ["Distinguido señor","Muy señor mío","Apreciado señor"], ["lexical","register"]],
  [1727, "translate_to_native", "Formal Requests", "Sincerely", [], ["Yours sincerely","Sincerely yours"], ["lexical","register"]],
  [1729, "cloze_deletion", "Formal Requests", "Algo así", [], ["Más o menos","En cierto modo"], ["lexical"]],
  [1740, "translate_to_target", "Informal Speech", "Atentamente", [], ["Sinceramente","Cordialmente","Muy atentamente"], ["lexical","register"]],
  [1741, "translate_to_native", "Informal Speech", "Regards", [], ["Greetings"], ["lexical"]],
  [1743, "cloze_deletion", "Informal Speech", "Genial", [], ["Guay","Chulo","Chévere","Bacán","Bacano","Copado"], ["register","regional"], ["https://www.wordreference.com/es/en/translation.asp?spen=chulo","https://www.wordreference.com/es/en/translation.asp?spen=ch%C3%A9vere","https://www.wordreference.com/es/en/translation.asp?spen=bac%C3%A1n","https://www.wordreference.com/es/en/translation.asp?spen=copado"]],
  [1754, "translate_to_target", "Writing Emails", "Saludos", [], ["Saludos cordiales","Cordiales saludos","Un saludo"], ["lexical","register"]],
  [1755, "translate_to_native", "Writing Emails", "Kind of", [], ["Something like that","Sort of"], ["lexical"]],
  [1757, "cloze_deletion", "Writing Emails", "Increíble", [], ["Fantástico","Alucinante","Asombroso","Impresionante"], ["lexical"]],
  [1768, "translate_to_target", "Phone Etiquette", "Algo así", [], ["Más o menos","En cierto modo"], ["lexical"]],
  [1769, "translate_to_native", "Phone Etiquette", "Cool", [], ["Great","Brilliant"], ["lexical"]],
  [1771, "cloze_deletion", "Phone Etiquette", "Lo que sea", [], ["Cualquier cosa","Da igual"], ["lexical","register"]],
  [1782, "translate_to_target", "Adapting Register", "Genial", [], ["Guay","Chulo","Chévere","Bacán","Bacano","Copado"], ["register","regional"], ["https://www.wordreference.com/es/en/translation.asp?spen=chulo","https://www.wordreference.com/es/en/translation.asp?spen=ch%C3%A9vere","https://www.wordreference.com/es/en/translation.asp?spen=bac%C3%A1n","https://www.wordreference.com/es/en/translation.asp?spen=copado"]],
  [1783, "translate_to_native", "Adapting Register", "Awesome", [], ["Incredible","Unbelievable","Amazing"], ["lexical"]],
  [1785, "cloze_deletion", "Adapting Register", "No te preocupes", [], ["No se preocupe","No se preocupen","No os preocupéis","No hay problema","No pasa nada","Tranquilo","Tranquila"], ["person","lexical"]],
  [1796, "translate_to_target", "Review & Test", "Increíble", [], ["Fantástico","Alucinante","Asombroso","Impresionante"], ["lexical"]],
  [1797, "translate_to_native", "Review & Test", "Whatever", [], ["Anything"], ["lexical"]],
  [1799, "cloze_deletion", "Review & Test", "Tío", [], ["Chabón","Pana","Compa","Güey"], ["register","regional"], ["https://www.wordreference.com/es/en/translation.asp?spen=g%C3%BCey"]],
  [1811, "translate_to_native", "Philosophy of Life", "Purpose", [], ["Aim","Intention","Objective"], ["lexical"]],
  [1824, "translate_to_target", "Beliefs & Values", "Propósito", [], ["Finalidad","Objetivo","Fin","Intención"], ["lexical"]],
  [1825, "translate_to_native", "Beliefs & Values", "Consciousness", [], ["Conscience","Awareness"], ["lexical"]],
  [1840, "fill_blank", "Abstract Concepts", "lidad", [], ["l"], ["completion","lexical"]],
  [1853, "translate_to_native", "Critical Thinking", "Morality", [], ["Morals"], ["lexical"]],
  [1866, "translate_to_target", "Expressing Complex Ideas", "Moralidad", [], ["Moral"], ["lexical"]],
  [1900, "cloze_deletion", "Building Arguments", "Refutar", [], ["Rebatir"], ["lexical"]],
  [1908, "translate_to_target", "Counterarguments", "Evidencia", [], ["Prueba","Pruebas"], ["lexical","number"]],
  [1914, "cloze_deletion", "Counterarguments", "Afirmación", [], ["Aseveración"], ["lexical"]],
  [1923, "translate_to_native", "Persuasive Language", "However", [], ["Nonetheless","Yet"], ["lexical"]],
  [1936, "translate_to_target", "Logical Fallacies", "Sin embargo", [], ["Con todo","Aun así"], ["lexical"]],
  [1937, "translate_to_native", "Logical Fallacies", "Nevertheless", [], ["Nonetheless","Notwithstanding"], ["lexical"]],
  [1950, "translate_to_target", "Formal Debate", "No obstante", [], ["Aun así","Con todo"], ["lexical"]],
  [1951, "translate_to_native", "Formal Debate", "Furthermore", [], ["Moreover","In addition","Besides"], ["lexical"]],
  [1956, "cloze_deletion", "Formal Debate", "Sesgo", [], ["Parcialidad"], ["lexical"]],
  [1964, "translate_to_target", "Review & Test", "Además", [], ["Asimismo","Más aún","Por añadidura","Es más"], ["lexical"]],
  [1965, "translate_to_native", "Review & Test", "To refute", [], ["Refute","Rebut","Disprove"], ["bare_infinitive","lexical"]],
  [1978, "translate_to_target", "Business Emails", "Propuesta", [], ["Proposición"], ["lexical"]],
  [1984, "cloze_deletion", "Business Emails", "Agenda", [], ["Orden del día","Temario"], ["lexical"]],
  [1993, "translate_to_native", "Presentations", "To implement", [], ["Implement"], ["bare_infinitive"]],
  [1998, "cloze_deletion", "Presentations", "Acta", [], ["Actas"], ["number"]],
  [2006, "translate_to_target", "Negotiations", "Implementar", [], ["Poner en práctica","Llevar a cabo","Ejecutar"], ["lexical"]],
  [2035, "translate_to_native", "Networking", "Stakeholder", [], ["Interested party"], ["lexical"]],
  [2040, "cloze_deletion", "Networking", "Plazo", [], ["Fecha límite","Fecha tope"], ["lexical"]],
  [2048, "translate_to_target", "Review & Test", "Parte interesada", [], ["Interesado","Interesada"], ["lexical","gender"]],
  [2049, "translate_to_native", "Review & Test", "Agenda", [], ["Diary","Planner","Schedule"], ["lexical"]],
  [2050, "fill_blank", "Review & Test", "ta", [], ["tas"], ["completion","number"]],
  [2068, "cloze_deletion", "Describing Art", "Protagonista", [], ["Personaje principal"], ["lexical"]],
  [2076, "translate_to_target", "Book Reviews", "Pintura", [], ["Cuadro"], ["lexical"]],
  [2082, "cloze_deletion", "Book Reviews", "Giro argumental", [], ["Giro de la trama","Giro narrativo"], ["lexical"]],
  [2096, "cloze_deletion", "Film & Theater", "Reseña", [], ["Crítica"], ["lexical"]],
  [2133, "translate_to_native", "Review & Test", "Protagonist", [], ["Main character","Lead","Leading character"], ["lexical"]],
  [2146, "translate_to_target", "Common Idioms", "Dar en el clavo", [], ["Dar justo en el clavo","Darle al clavo"], ["idiom"]],
  [2147, "translate_to_native", "Common Idioms", "A piece of cake", [], ["Child’s play","A breeze","Easy"], ["idiom","plain_gloss"]],
  [2152, "cloze_deletion", "Common Idioms", "De higos a brevas", [], ["De uvas a peras"], ["idiom"]],
  [2160, "translate_to_target", "Proverbs", "Pan comido", [], ["Coser y cantar"], ["idiom"]],
  [2161, "translate_to_native", "Proverbs", "To cost an arm and a leg", [], ["Cost an arm and a leg","To cost a fortune","Cost a fortune"], ["bare_infinitive","plain_gloss"]],
  [2166, "cloze_deletion", "Proverbs", "Descubrir el pastel", [], ["Destapar el pastel","Irse de la lengua"], ["idiom"]],
  [2174, "translate_to_target", "Collocations", "Costar un ojo de la cara", [], ["Costar un riñón","Costar un pastón"], ["idiom"]],
  [2180, "cloze_deletion", "Collocations", "Matar dos pájaros de un tiro", [], ["Matar dos pájaros de un solo tiro"], ["idiom"]],
  [2188, "translate_to_target", "Figurative Language", "Más vale tarde que nunca", [], ["Mejor tarde que nunca"], ["idiom"]],
  [2189, "translate_to_native", "Figurative Language", "To be on cloud nine", [], ["To be in seventh heaven","Be in seventh heaven","Be on cloud nine"], ["idiom","bare_infinitive"]],
  [2190, "fill_blank", "Figurative Language", "el pelo", [], ["el pelo a alguien"], ["completion","idiom"]],
  [2194, "cloze_deletion", "Figurative Language", "La pelota está en tu tejado", [], ["La pelota está en su tejado","La pelota está en vuestro tejado"], ["idiom","person"]],
  [2202, "translate_to_target", "Phrasal Verbs", "Estar en el séptimo cielo", [], ["Estar en la gloria"], ["idiom"]],
  [2203, "translate_to_native", "Phrasal Verbs", "To pull someone's leg", [], ["Pull someone’s leg","To tease someone","To joke with someone"], ["bare_infinitive","plain_gloss"]],
  [2216, "translate_to_target", "Review & Test", "Tomar el pelo", [], ["Tomarle el pelo a alguien"], ["idiom"]],
  [2217, "translate_to_native", "Review & Test", "Once in a blue moon", [], ["Very rarely","Hardly ever"], ["plain_gloss"]],];

/** Adds to `accepted_answers` and nothing else. Existing entries are carried through
 * first and unchanged, so no stored alternative can be dropped here. Every declared fact
 * about the frozen row is re-asserted, and an addition already reachable — the key, an
 * existing alternative, or a duplicate inside the row — throws rather than being quietly
 * discarded, because it means the claim was answered somewhere else and this table is
 * stale. Must run after every other producer, so that `set.patches()` can see a row
 * another author already owns. */
export function spanishAcceptedAlternatives(set) {
  const get = lessonRefs(set.snapshot, 'es');
  const alreadyPatched = new Map(set.patches().map(p => [p.id, Object.keys(p.after ?? {})]));
  const contested = [];
  for (const [n, type, lesson, key, current, additions, grounds, sources = []] of spanishAlternativeRows) {
    const { exercise: e, lesson: l, ref } = get(n);
    if (e.type !== type) throw new Error(`Unexpected exercise type: ${ref}`);
    if (l.title !== lesson) throw new Error(`Unexpected lesson: ${ref}`);
    if (e.correct_answer !== key) throw new Error(`Unexpected stored key: ${ref}`);
    if (JSON.stringify(e.accepted_answers ?? []) !== JSON.stringify(current)) throw new Error(`Unexpected current alternatives: ${ref}`);
    if (e.options?.length || e.distractors?.length) throw new Error(`Choice row is out of scope for this producer: ${ref}`);
    if (!additions.length) throw new Error(`No actual addition: ${ref}`);
    const reachable = new Set([key, ...current].map(a => a.normalize('NFC').toLowerCase()));
    const seen = new Set();
    for (const addition of additions) {
      if (typeof addition !== 'string' || !addition.trim()) throw new Error(`Empty addition: ${ref}`);
      const folded = addition.normalize('NFC').toLowerCase();
      if (reachable.has(folded)) throw new Error(`Addition already accepted: ${ref}: ${addition}`);
      if (seen.has(folded)) throw new Error(`Duplicate addition: ${ref}: ${addition}`);
      seen.add(folded);
    }
    if (!grounds?.length || grounds.some(g => !GROUNDS[g])) throw new Error(`Unknown grounds: ${ref}`);
    // Another producer reaching the same field means two authors answered one claim.
    // Collect them all and name them, rather than failing on the first or skipping it.
    if ((alreadyPatched.get(e.id) ?? []).includes('accepted_answers')) { contested.push(ref); continue; }
    const reason = `${ref}: ${additions.join(', ')} added because ${grounds.map(g => GROUNDS[g]).join('; and ')}.`;
    set.update('exercises', e.id, { accepted_answers: [...current, ...additions] }, reason, sources);
  }
  if (contested.length) throw new Error(`accepted_answers already patched by another producer: ${contested.join(', ')}`);
}
