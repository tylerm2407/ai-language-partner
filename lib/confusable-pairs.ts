/**
 * Confusable word pairs per language.
 * Used to prevent fuzzy matching from accepting words with completely different meanings.
 * When a user's answer fuzzy-matches the correct answer, we check if the user's input
 * is actually a confusable pair — if so, reject the fuzzy match.
 */

import type { LanguageCode } from '../types';

// Each entry is [word1, word2] where the two words are easily confused via typo
// but have completely different meanings.
const CONFUSABLE_PAIRS: Partial<Record<LanguageCode, [string, string][]>> = {
  es: [
    // Added 2026-09-14 after a sweep found that the audit's own accepted-answer
    // additions were readmitting wrong answers: every accepted answer carries a
    // typo neighbourhood, so adding one can admit whatever already sits inside
    // it. These are the cases that flip meaning outright.
    ['menor', 'mejor'],                  // Smaller/younger vs better; one substitution between two taught comparatives.
    ['más pequeño', 'mejor'],            // Same contrast against the stored key.
    ['no estoy de acuerdo', 'yo estoy de acuerdo'], // Agreement vs its negation. Keyed on the ADDED alternative, because the grader consults the list with the best-matching accepted answer rather than the key — a pair written against the key is inert here.
    ['no no estoy de acuerdo', 'yo no estoy de acuerdo'], // The same shape on the negated row.
    ['no creo que', 'yo creo que'],      // Belief vs its negation.
    ['no desearía', 'yo desearía'],      // Wish vs its negation.
    ['proposición', 'preposición'],      // Proposition vs preposition; both separately taught.
    ['preposition', 'proposición'],      // The English gloss against the Spanish near-homograph.
    // Added 2026-09-14 by the curriculum audit: each pair is two words the
    // same lesson teaches, within the typo budget, and accepted by the real
    // grader before this. Evidence: remediation/runtime-independent-review/.
    ['abuela', 'abuelo'],            // Gender minimal pair. The final-vowel contrast IS the A1 lesson con
    ['cama', 'casa'],                // Bed vs house, both A1 core nouns taught in neighbouring lessons (B
    ['cansado', 'casado'],           // Tired vs married, the textbook Spanish minimal pair, both taught a
    ['comeré', 'compré'],            // Different verbs as well as different tenses (comprar, to buy / com
    ['debería', 'desearía'],         // Different verbs (deber, to have to / desear, to wish), glossed Sho
    ['derecha', 'derecho'],          // Straight ahead vs right, both taught across A1 Transportation and 
    ['descansar', 'descargar'],      // To rest vs to download, unrelated, both taught.
    ['esposa', 'esposo'],            // Gender minimal pair. The final-vowel contrast IS the A1 lesson con
    ['falacia', 'farmacia'],         // Fallacy vs pharmacy, unrelated, taught four bands apart.
    ['formal', 'informal'],          // Polarity pair and the entire subject of B1 Adapting Register, wher
    ['hermana', 'hermano'],          // Gender minimal pair. The final-vowel contrast IS the A1 lesson con
    ['hermano', 'verano'],           // Brother vs summer, unrelated, both A1.
    ['hija', 'hijo'],                // Gender minimal pair. The final-vowel contrast IS the A1 lesson con
    ['hola', 'hora'],                // Hour vs hello, both A1 core vocabulary. r and l are not adjacent.
    ['madre', 'padre'],              // Father vs mother, both taught in A1 Family Members with the neighb
    ['mano', 'sano'],                // Hand vs healthy, both taught in A1 Body Parts with explicit Englis
    ['manzana', 'mañana'],           // Apple vs tomorrow/morning, both A1. Note the diacritic fold alread
    ['mesa', 'meta'],                // Table vs goal, taught A1 Furniture and A2 Life Goals. s and t are 
    ['novia', 'novio'],              // Gender minimal pair. The final-vowel contrast IS the A1 lesson con
    ['ojo', 'rojo'],                 // Red vs eye, both A1, unrelated meanings.
    ['primero', 'primo'],            // First vs cousin, unrelated.
    ['reserva', 'reseña'],           // Reservation vs review, unrelated.
    ['sobrina', 'sobrino'],          // Gender minimal pair. The final-vowel contrast IS the A1 lesson con
    ['triste', 'turista'],           // Tourist vs sad, unrelated.
    ['gato', 'rato'],       // cat vs. while/mouse
    ['pero', 'perro'],      // but vs. dog
    ['el', 'él'],           // the vs. he
    ['caro', 'carro'],      // expensive vs. car
    ['casa', 'caza'],       // house vs. hunt
    ['año', 'ano'],         // year vs. anus
    ['papa', 'papá'],       // potato vs. dad
    ['si', 'sí'],           // if vs. yes
    ['como', 'cómo'],       // as/like vs. how
    ['donde', 'dónde'],     // where (relative) vs. where (question)
    ['solo', 'sólo'],       // alone vs. only
    ['que', 'qué'],         // that vs. what
    ['tu', 'tú'],           // your vs. you
    ['mas', 'más'],         // but (literary) vs. more
    ['se', 'sé'],           // reflexive pronoun vs. I know
    ['pena', 'pene'],       // shame vs. penis
    ['pollo', 'polo'],      // chicken vs. pole
    ['hombre', 'hambre'],   // man vs. hunger
    /**
     * Added 2026-09-15. The feminine `Gerenta` is a correct answer on the six
     * `Gerente` rows, and adding it puts `Renta` — rent — two edits inside the
     * budget on four of them: translate, dictation, listening and open
     * production. Both members are keyed, because the grader consults this
     * list with whichever accepted answer best matched, and that is `Gerenta`
     * on some rows and `Gerente` on others.
     *
     * `Renta` is a real Spanish word the curriculum teaches (as an alternative
     * on the two `Alquiler` rows), which is why the sibling-key rule does not
     * reach it: that rule is keys only, and `Renta` is nobody's key. This is
     * the case a pair is actually for.
     */
    ['gerenta', 'renta'],   // Manager (f.) vs rent — the addition's own neighbourhood.
    ['gerente', 'renta'],   // The same contrast against the stored key.
    /**
     * es-E1042: the feminine `Más cara` is correct on the five `Más caro`
     * rows, and adding it admits two other comparatives the same unit teaches
     * — `Más corta` (shorter) and `Más baja` (lower, shorter in height) — on
     * the listening, speaking and translate rows. Both are alternatives
     * elsewhere and neither is anyone's key, which is why the sibling-key rule
     * cannot see them and a pair is the right tool.
     */
    ['más cara', 'más corta'],   // More expensive (f.) vs shorter.
    ['más cara', 'más baja'],    // More expensive (f.) vs lower.
    ['más caro', 'más corta'],   // The same two contrasts against the stored key.
    ['más caro', 'más baja'],
  ],
  fr: [
    // Added 2026-09-14 by the curriculum audit: each pair is two words the
    // same lesson teaches, within the typo budget, and accepted by the real
    // grader before this. Evidence: remediation/runtime-independent-review/.
    ['argent', 'argument'],          // Argument vs money; two deletions land exactly on an A1 word the B2
    ['argument', 'argumenter'],      // Noun vs infinitive. A translate-to-target row asking for one and a
    ['bonjour', 'bonsoir'],          // Daytime greeting vs evening greeting; both are the key of a differ
    ['chaise', 'chemise'],           // Shirt vs chair; mirrors the English skirt/shirt entry already in t
    ['clavier', 'laver'],            // Keyboard vs to wash; different part of speech and unrelated meanin
    ['cuisine', 'cuisiner'],         // Kitchen (noun) vs to cook (infinitive). Semantically adjacent but 
    ['devrait', 'ferait'],           // "Should" vs "would do". Two substitutions landing exactly on anoth
    ['débat', 'début'],              // Beginning vs debate; one substitution between two B1 words taught 
    ['famille', 'fille'],            // Family vs daughter/girl, two deletions apart, both taught across A
    ['fier', 'hier'],                // Yesterday vs proud; h and f are not adjacent on AZERTY and the two
    ['formel', 'informel'],          // Polarity reversal carried by the in- prefix. The B1 Adapting Regis
    ['fête', 'tête'],                // Party vs head; one substitution after folding, A2 vs A1.
    ['fête', 'été'],                 // Party vs summer; deletion of the first letter, which is a plausibl
    ['grand-mère', 'grand-père'],    // Grandfather vs grandmother, a single p/m substitution. On AZERTY p
    ['heure', 'heureux'],            // Happy vs hour; two deletions, adjective vs noun.
    ['hier', 'hiver'],               // Yesterday vs winter; one substitution, both high-frequency A1/A2 w
    ['lait', 'lit'],                 // Milk vs bed; one deletion between two A1 nouns taught in the same 
    ['lire', 'pire'],                // To read vs worse; one substitution, verb vs adjective.
    ['main', 'pain'],                // Hand vs bread. On AZERTY p sits directly above m, making this the 
    ['maison', 'raison'],            // Reason vs house; one r/m substitution between two of the most comm
    ['mari', 'marié'],               // Husband (noun) vs married/groom (participle). Not an accent-only p
    ['mariage', 'marié'],            // Marriage (event) vs married/groom, both taught in A2 Family Tradit
    ['mère', 'père'],                // Mother vs father, one m/p substitution, both keys in the same A1 F
    ['pire', 'père'],                // Father vs worse; one substitution, noun vs comparative adjective.
    ['pomme', 'poème'],              // Poem vs apple; one substitution after diacritic folding, and unrel
    ['preuve', 'préjugé'],           // Prejudice vs proof. Both are B2 argumentation vocabulary taught in
    ['proposition', 'préposition'],  // Preposition vs proposal/clause. Both are B2 grammar metalanguage t
    ['salaire', 'solaire'],          // Salary vs solar; one substitution between a B1 work word and a B1 
    ['touriste', 'triste'],          // Tourist vs sad; two deletions, noun vs adjective.
    ['tête', 'été'],                 // Head vs summer; same first-letter deletion shape as fête/été.
    ['le', 'les'],          // the (singular) vs. the (plural)
    ['ou', 'où'],           // or vs. where
    ['sur', 'sûr'],         // on vs. sure
    ['du', 'dû'],           // of the vs. owed
    ['des', 'dès'],         // some vs. from
    ['a', 'à'],             // has vs. to
    ['poison', 'poisson'],  // poison vs. fish
    ['dessus', 'dessous'],  // above vs. below
    ['bon', 'bonne'],       // good (m) vs. good (f)
    ['mer', 'mère'],        // sea vs. mother
  ],
  de: [
    // Added 2026-09-14 after a sweep found that the audit's own accepted-answer
    // additions were readmitting wrong answers: every accepted answer carries a
    // typo neighbourhood, so adding one can admit whatever already sits inside
    // it. These are the cases that flip meaning outright.
    ['gütig', 'mutig'],                  // Kind vs brave; one substitution between two taught adjectives.
    ['nett', 'mutig'],                   // Same contrast against the stored key.
    // Added 2026-09-14 by the curriculum audit: each pair is two words the
    // same lesson teaches, within the typo budget, and accepted by the real
    // grader before this. Evidence: remediation/runtime-independent-review/.
    ['bein', 'nein'],                // No vs leg. Same B/N adjacency caveat as bett/nett, and "nein" is c
    ['bett', 'nett'],                // Bed vs nice. B and N are adjacent on QWERTZ, so this is a real fat
    ['billig', 'billiger'],          // Comparative vs positive, same contract note as teurer/teuer.
    ['brot', 'rot'],                 // Bread vs red. Dropping an initial letter is a plausible phone slip
    ['egal', 'regal'],               // Shelf vs "doesn’t matter"; one inserted initial letter, unrelated 
    ['fisch', 'tisch'],              // Fish vs table; one substitution between two A1 nouns, the German a
    ['formell', 'informell'],        // Polarity reversal via the in- prefix, same shape as the French and
    ['freund', 'freundin'],          // Friend/boyfriend vs female friend/girlfriend. The -in feminine suf
    ['hand', 'hund'],                // Dog vs hand; u and a are far apart on QWERTZ and the meanings are 
    ['konjunktion', 'konjunktiv'],   // Conjunction vs subjunctive; two unrelated B2 grammar concepts taug
    ['teuer', 'teurer'],             // Comparative vs positive. Morphological relatives rather than "comp
    ['der', 'die'],         // the (m) vs. the (f)
    ['sein', 'seine'],      // his vs. his (f)
    ['noch', 'nach'],       // still vs. after
    ['weg', 'Weg'],         // away vs. path
    ['Rat', 'Rad'],         // advice vs. wheel
    ['Bein', 'Biene'],      // leg vs. bee
    ['Wand', 'Wunde'],      // wall vs. wound
  ],
  it: [
    // Added 2026-09-14 after a sweep found that the audit's own accepted-answer
    // additions were readmitting wrong answers: every accepted answer carries a
    // typo neighbourhood, so adding one can admit whatever already sits inside
    // it. These are the cases that flip meaning outright.
    ["io sono d'accordo", "non sono d'accordo"], // Agreement vs its negation; the added subject pronoun puts the negated form one edit closer.
    ["sono d'accordo", "non sono d'accordo"], // Agreement vs its negation.
    ['più corto', 'più caro'],           // Shorter vs more expensive; unrelated comparatives one edit apart.
    ['più basso', 'più caro'],           // Same contrast against the stored key.
    // Added 2026-09-14 by the curriculum audit: each pair is two words the
    // same lesson teaches, within the typo budget, and accepted by the real
    // grader before this. Evidence: remediation/runtime-independent-review/.
    ['appartamento', 'appuntamento'], // Appointment vs apartment, a classic Italian confusion, both taught
    ['cane', 'pane'],                // Dog vs bread, both A1 core nouns. c and p are not adjacent.
    ['caricare', 'scaricare'],       // Antonyms, glossed To download and To upload in the same B1 lesson.
    ['dolore', 'dottore'],           // Doctor vs pain, both taught in the A1 health lessons.
    ['dovrebbe', 'potrebbe'],        // Different modal verbs (potere vs dovere), glossed Could and Should
    ['fallacia', 'farmacia'],        // Fallacy vs pharmacy, unrelated.
    ['famiglia', 'figlia'],          // Family vs daughter, both taught at A1. The deletion of "am" from a
    ['festa', 'foresta'],            // Forest vs party, unrelated.
    ['festa', 'testa'],              // Party vs head, unrelated. f and t are not adjacent.
    ['figlia', 'figlio'],            // Gender minimal pair. The final-vowel contrast IS the A1 lesson con
    ['finestra', 'sinistra'],        // Window vs left, both A1, unrelated.
    ['formale', 'informale'],        // Polarity pair and the subject of B1 Adapting Register, where Forma
    ['madre', 'padre'],              // Father vs mother, both taught in A1 Family Members. p and m are no
    ['mano', 'sano'],                // Hand vs healthy, both taught in A1 Body Parts on adjacent rows wit
    ['nonna', 'nonno'],              // Gender minimal pair. The final-vowel contrast IS the A1 lesson con
    ['preposizione', 'proposizione'], // Preposition vs clause: two B2 metalinguistic terms one edit apart,
    ['ragazza', 'ragazzo'],          // Gender minimal pair. The final-vowel contrast IS the A1 lesson con
    ['triste', 'turista'],           // Tourist vs sad, unrelated.
    ['anno', 'hanno'],      // year vs. they have
    ['pesca', 'pesce'],     // peach/fishing vs. fish
    ['sono', 'suono'],      // I am/they are vs. sound
    ['nonno', 'nono'],      // grandfather vs. ninth
    ['caldo', 'freddo'],    // hot vs. cold (not typo-confusable but common error)
  ],
  pt: [
    /**
     * Added 2026-09-15. Two feminine forms that are correct on their rows and
     * reach a different word once accepted. Each admitted string is an
     * alternative somewhere and nobody's key, so no sibling scope reaches it.
     */
    ['cansada', 'zangada'],      // pt-E0652: tired (f.) vs angry (f.).
    ['cansado', 'zangada'],      // The same contrast against the stored key.
    ['mais cara', 'mais curta'], // pt-E1042: more expensive (f.) vs shorter (f.).
    ['mais caro', 'mais curta'],
    // Added 2026-09-14 after a sweep found that the audit's own accepted-answer
    // additions were readmitting wrong answers: every accepted answer carries a
    // typo neighbourhood, so adding one can admit whatever already sits inside
    // it. These are the cases that flip meaning outright.
    ['esposo', 'esposa'],                // Husband vs wife; the whole point of the row is which one.
    ['marido', 'esposa'],                // Same contrast against the stored key.
    // Added 2026-09-14 by the curriculum audit: each pair is two words the
    // same lesson teaches, within the typo budget, and accepted by the real
    // grader before this. Evidence: remediation/runtime-independent-review/.
    ['alergia', 'energia'],          // Energy vs allergy, unrelated.
    ['banheiro', 'dinheiro'],        // Money vs bathroom, a classic beginner confusion, both A1.
    ['bravo', 'braço'],              // Angry/brave vs arm, unrelated, both taught. The ç/v contrast is no
    ['cama', 'cara'],                // Face/mate vs bed, unrelated.
    ['cama', 'casa'],                // Bed vs house, both A1 core nouns.
    ['cansado', 'casado'],           // Tired vs married, the same textbook minimal pair as Spanish, both 
    ['cara', 'casa'],                // Face/mate vs house, unrelated.
    ['dieta', 'direita'],            // Right vs diet, unrelated.
    ['falácia', 'farmácia'],         // Pharmacy vs fallacy, unrelated, taught four bands apart.
    ['filha', 'filho'],              // Gender minimal pair. The final-vowel contrast IS the A1 lesson con
    ['formal', 'informal'],          // Polarity pair and the subject of B1 Adapting Register, where Forma
    ['irmã', 'irmão'],               // Sister vs brother, glossed on adjacent rows of the same A1 lesson.
    ['mesa', 'meta'],                // Goal vs table, unrelated.
    ['namorada', 'namorado'],        // Gender minimal pair. The final-vowel contrast IS the A1 lesson con
    ['resenha', 'reserva'],          // Review vs reservation, unrelated.
    ['resenha', 'senha'],            // Review vs password, unrelated.
    ['sobrinha', 'sobrinho'],        // Gender minimal pair. The final-vowel contrast IS the A1 lesson con
    ['triste', 'turista'],           // Tourist vs sad, unrelated.
    ['avô', 'avó'],        // grandfather vs. grandmother
    ['pais', 'país'],       // parents vs. country
    ['pode', 'pôde'],       // can vs. could
    ['por', 'pôr'],         // by/for vs. to put
  ],
  ru: [
    // Added 2026-09-14 after a sweep found that the audit's own accepted-answer
    // additions were readmitting wrong answers: every accepted answer carries a
    // typo neighbourhood, so adding one can admit whatever already sits inside
    // it. These are the cases that flip meaning outright.
    ['дорогой', 'недорогой'],            // Expensive vs not-expensive; the negating prefix is two characters, so a seven-character key earns budget 2 and the antonym lands inside it.
    ['дешёвый', 'дорогой'],              // Cheap vs expensive, taught as a contrast.
    ['дешевый', 'дорогой'],              // Same pair with the ё written as е, which learners and the corpus both do.
    // Added 2026-09-14 by the curriculum audit: each pair is two words the
    // same lesson teaches, within the typo budget, and accepted by the real
    // grader before this. Evidence: remediation/runtime-independent-review/.
    ['вдруг', 'друг'],               // "Suddenly" vs "friend"; one deleted initial letter, adverb vs noun
    ['девушка', 'дедушка'],          // Grandfather vs girl/young woman; one substitution, and a confusion
    ['дешевле', 'дешевый'],          // Second spelling of the same pair. isConfusablePair compares string
    ['дешевле', 'дешёвый'],          // Comparative vs positive. Same contract note as the German comparat
    ['жанр', 'жар'],                 // Genre vs heat/fever; one deletion, B2 arts vs A1 health.
    ['завтра', 'завтрак'],           // Breakfast vs tomorrow; one trailing letter, both A1/A2 and both ex
    ['картина', 'квартира'],         // Picture vs apartment; a textbook Russian learner confusion, two tr
    ['конец', 'наконец'],            // "Finally" (adverb) vs "end" (noun); the на- prefix is two characte
    ['мать', 'мыть'],                // To wash vs mother; one substitution, verb vs noun.
    ['мнение', 'сомнение'],          // Doubt vs opinion; сомнение contains мнение but the meanings are op
    ['начало', 'сначала'],           // "At first" (adverb) vs "beginning" (noun); different part of speec
    ['неформальный', 'формальный'],  // Polarity reversal via the не- prefix, same as the French and Germa
    ['племянник', 'племянница'],     // Niece vs nephew; the gender suffix is the whole point of the A2 fa
    ['пока', 'полка'],               // "Bye"/"while" vs shelf; one inserted letter, unrelated meanings.
    ['потом', 'поэтому'],            // "Therefore" vs "then/later"; two edits between two B1 discourse ma
    ['предложение', 'приложение'],   // App/attachment vs sentence/proposal; two substitutions between two
    ['рейс', 'рис'],                 // Flight vs rice; one deletion after й→и folding, B1 travel vs A1 fo
    ['сознание', 'сомнение'],        // Consciousness vs doubt; two substitutions between two B2 abstract 
    ['мыло', 'мило'],       // soap vs. nicely
    ['кот', 'код'],         // cat vs. code
    ['лук', 'люк'],         // onion/bow vs. hatch
    ['тушь', 'туш'],        // mascara vs. fanfare
    ['плач', 'плащ'],       // crying vs. raincoat
    ['гриб', 'грипп'],      // mushroom vs. flu
    ['компания', 'кампания'], // company vs. campaign
    ['шить', 'жить'],       // to sew vs. to live
    ['балл', 'бал'],        // score/point vs. ball/dance
    ['мука', 'мука'],       // flour (мукá) vs. torment (мýка) — stress difference
    ['ветер', 'вечер'],     // wind vs. evening — вечер is taught at A1 ("Добрый вечер")
    ['ложка', 'ножка'],     // spoon vs. little leg / leg of a piece of furniture
    ['стол', 'стул'],       // table vs. chair — both taught in the same "In the Kitchen" lesson
  ],
  /**
   * English pairs, for the ANSWER side of `translate_to_native` rows.
   *
   * `ExerciseHints.language` carries the course's TARGET language, which the
   * lesson runner passes for both directions, so on a target-to-English row
   * the target list cannot match what the learner typed. `gradeAnswer`
   * therefore consults this list as well as the target one — see the
   * `confusable` block in lib/grading.ts. Without it, "shirt" for Skirt (both
   * taught in the same lesson), "diver" for Driver and "Place" for Plate were
   * all scored "Correct! (Minor typo)" and reinforced by SRS.
   */
  en: [
    /**
     * Added 2026-09-15, and measured across every course rather than the one
     * row it was reported on. `Preservation` is accepted by tolerance on the
     * `Presentation` and `Reservation` rows of ALL NINE languages — 18 rows —
     * because the English side of a translate-to-native row is graded like any
     * other string and these are two edits apart.
     *
     * `Conservation` is deliberately NOT paired with `Preservation`, though it
     * is the same shape and was the case first suspected. Six curricula list
     * `Preservation` as an accepted answer on their `Conservation` rows, so
     * the pair would contradict a judgement the content already made in six
     * places. The remaining oddity there — a French `translate_to_target`
     * Conservation row accepting it by tolerance while the French
     * translate-to-native row lists it outright — is a levelling question for
     * content, not a pair.
     */
    ['presentation', 'preservation'],  // A talk vs keeping something intact.
    ['reservation', 'preservation'],   // A booking vs keeping something intact.
    // Added 2026-09-14. These two are opposites in a hiring unit and sit two
    // edits apart, so the tolerance was forgiving each as a typo of the other.
    // Found in the FROZEN curriculum with no patch involved, so this is a
    // defect in the shipped product rather than one the remediation caused.
    ['to fire', 'to hire'],      // Opposite sides of the same transaction.
    // Added 2026-09-14 after a sweep found that the audit's own accepted-answer
    // additions were readmitting wrong answers: every accepted answer carries a
    // typo neighbourhood, so adding one can admit whatever already sits inside
    // it. These are the cases that flip meaning outright.
    ['later', 'water'],                  // Both taught keys; one is the gloss of Luego and the other of Agua.
    ['lead', 'head'],                    // Both taught keys.
    // Added 2026-09-14 by the curriculum audit: each pair is two words the
    // same lesson teaches, within the typo budget, and accepted by the real
    // grader before this. Evidence: remediation/runtime-independent-review/.
    ['brother', 'mother'],           // Different family members, both taught in the same A1 lesson with e
    ['could', 'would'],              // Different modals. B1 First Conditional teaches exactly the could/w
    ['grandfather', 'grandmother'],  // Different family members, both taught in the same A1 lesson. Two e
    ['married', 'worried'],          // Worried vs married, unrelated, both taught at A2.
    ['passport', 'password'],        // Passport vs password, unrelated, both taught (Hotel Check-in and T
    ['purpose', 'suppose'],          // Suppose vs purpose, unrelated, both taught at B1/B2.
    ['skirt', 'shirt'],     // garment vs. garment — both taught in "Clothes & Colors"
    ['driver', 'diver'],    // occupation vs. occupation
    ['plate', 'place'],     // tableware vs. location
  ],
  ja: [
    // Added 2026-09-14, same class as to fire / to hire: an antonym pair inside
    // the typo budget, present in the frozen curriculum with no patch.
    ['背が高い', '背が低い'],      // Tall vs short; the contrast the unit teaches.
    // Added 2026-09-14 by the curriculum audit; see remediation/runtime-independent-review/.
    ['おじさん', 'おばさん'],                // Unrelated lexemes one character apart: "おばさん" = aunt / middle-aged
    ['その間に', 'の間に'],                 // Not a typo but a scope change: "その間に" = meanwhile, during that tim
    ['もっと安い', 'もっと悪い'],              // Unrelated lexemes one character apart: "もっと悪い" = worse, "もっと安い" = 
    ['もっと安い', 'もっと良い'],              // Unrelated lexemes one character apart: "もっと良い" = better, "もっと安い" =
    ['もっと安い', 'もっと速い'],              // Unrelated lexemes one character apart: "もっと速い" = faster, "もっと安い" =
    ['もっと安い', 'もっと遅い'],              // Unrelated lexemes one character apart: "もっと遅い" = slower / later, "
    ['もっと安い', 'もっと高い'],              // Direct antonyms taught in the same A2 comparative/superlative unit
    ['もっと悪い', 'もっと良い'],              // Direct antonyms taught in the same A2 comparative/superlative unit
    ['もっと悪い', 'もっと速い'],              // Unrelated lexemes one character apart: "もっと悪い" = worse, "もっと速い" = 
    ['もっと悪い', 'もっと遅い'],              // Unrelated lexemes one character apart: "もっと悪い" = worse, "もっと遅い" = 
    ['もっと悪い', 'もっと高い'],              // Unrelated lexemes one character apart: "もっと悪い" = worse, "もっと高い" = 
    ['もっと背が低い', 'もっと背が高い'],          // Direct antonyms taught in the same A2 comparative/superlative unit
    ['もっと背が高い', 'もっと高い'],            // Not a typo but a scope change: "もっと背が高い" = taller vs "もっと高い" = mor
    ['もっと良い', 'もっと速い'],              // Unrelated lexemes one character apart: "もっと良い" = better, "もっと速い" =
    ['もっと良い', 'もっと遅い'],              // Unrelated lexemes one character apart: "もっと良い" = better, "もっと遅い" =
    ['もっと良い', 'もっと高い'],              // Unrelated lexemes one character apart: "もっと良い" = better, "もっと高い" =
    ['もっと速い', 'もっと遅い'],              // Direct antonyms taught in the same A2 comparative/superlative unit
    ['もっと速い', 'もっと高い'],              // Unrelated lexemes one character apart: "もっと速い" = faster, "もっと高い" =
    ['もっと遅い', 'もっと高い'],              // Unrelated lexemes one character apart: "もっと遅い" = slower / later, "
    ['一番悪い', '一番良い'],                // Direct antonyms taught in the same A2 comparative/superlative unit
    ['働きました', '書きました'],              // Unrelated lexemes one character apart: "書きました" = wrote, "働きました" = 
    ['働きました', '行きました'],              // Unrelated lexemes one character apart: "行きました" = went, "働きました" = w
    ['働きます', '行きます'],                // Unrelated lexemes one character apart: "行きます" = go / will go, "働きま
    ['書きました', '行きました'],              // Unrelated lexemes one character apart: "書きました" = wrote, "行きました" =
    // Second batch, 2026-09-14: newly inside tolerance after the typo budget
    // moved to the decomposed length. Confirmed accepted by the shipped grader
    // on the named row before this entry; see korean-goodbye-evidence.json.
    ['朝ご飯', 'ご飯'],                    // Breakfast vs rice/a meal — a scope change, not a typo. Accepted on ja-E0219 (listening_type, key 朝ご飯, d=1 vs budget 1). The reverse never fires: ご飯 has budget 0.
    /**
     * Third batch, 2026-09-15: the kana kinship keys, and only those.
     *
     * Round-2 triage found that adding the correct kanji spellings of おばあさん
     * and おじいさん — which the transcription additions must do, because the
     * learner hears them and can write them either way — brings お母さん,
     * お父さん, お姉さん, お嬢さん and お隣さん inside the typo budget on the four
     * rows whose whole job is telling kinship terms apart. お婆さん is four
     * characters, so the budget is one, and each of those five is one
     * substitution away.
     *
     * Those five entries are NOT in this list, because they would never fire.
     * Japanese fuzzy tolerance is now gated off for any answer carrying a
     * kanji (lib/grading.ts), and every string in that collision carries one,
     * so the comparison never reaches the budget. Measured across all four
     * combinations of the gate and this list, on both `translate_to_target`
     * and `listening_type`: with the gate on and no pairs at all, the five are
     * already refused. `scripts/grading/widening-check.mjs` reproduces the
     * readmission the moment the gate is relaxed, which makes it a better
     * guard than a page of entries that cannot run.
     *
     * What the gate does NOT close is this: the kana keys already accept each
     * other, with no addition involved and nothing pending. Measured across
     * all 2,121 taught Japanese strings — 23 acceptances on 12 rows. Kana is
     * exactly what the gate leaves tolerant, and correctly so, which is what
     * leaves these two live and load-bearing.
     */
    ['おじいさん', 'おじさん'],              // Grandfather vs uncle, one character apart, accepted in both directions today on ja-E0373 and ja-E0569 (d=1 vs budget 1) with no addition involved. おじさん/おばさん is already listed above.
    ['おばあさん', 'おばさん'],              // Grandmother vs aunt. The same shape on ja-E0361 and ja-E0581.
    /**
     * Also found by the whole-language check, outside the kinship frame and
     * live in both directions: プレゼン is a presentation and プレゼント is a
     * present, one character apart, both taught, and each accepted on the
     * other's row. Katakana on both sides, so the kanji gate does not reach it.
     */
    ['プレゼン', 'プレゼント'],              // Presentation vs present.
  ],
  ko: [
    /**
     * Added 2026-09-15. ko-E0368 keys 할머니 (grandmother) and the formal 조모
     * is correct there; adding it admits 고모, the PATERNAL AUNT, one jamo
     * away. A kinship contrast the row exists to draw, and 고모 is an
     * alternative elsewhere rather than a key, so the sibling rule cannot see
     * it.
     */
    ['조모', '고모'],                      // Grandmother (formal) vs paternal aunt.
    // Added 2026-09-14 by the curriculum audit; see remediation/runtime-independent-review/.
    ['공식적', '비공식적'],                 // Polarity pair: "비공식적" = unofficial, informal, "공식적" = official, fo
    ['남자친구', '여자친구'],                // Unrelated lexemes one character apart: "남자친구" = boyfriend, "여자친구"
    ['말했어요', '일했어요'],                // Unrelated lexemes one character apart: "일했어요" = worked, "말했어요" = s
    ['아버지', '할아버지'],                 // Unrelated lexemes one character apart: "할아버지" = grandfather, "아버지"
    /**
     * Second batch, 2026-09-14. These are the pairs the Hangul budget fix
     * newly brought inside tolerance: the budget is now measured on the
     * decomposed (jamo) form, the same string the distance is measured on, so
     * Korean keys that previously had a budget of zero now have one or two.
     * Every entry below was confirmed ACCEPTED by the shipped grader on a
     * named curriculum row before it was added, and rejected after. Row-level
     * evidence, both directions, is in
     * `docs/audits/question-verification/remediation/es-ja-ko/korean-goodbye-evidence.json`.
     *
     * Two of the four entries above are inert and stay only as a guard:
     * 남자친구/여자친구 and 아버지/할아버지 are at distance 3 against a budget of
     * 2, so the budget rejects them before the list is consulted. Only
     * 공식적/비공식적 and 말했어요/일했어요 actually fire.
     */
    // The A2 past-tense block teaches five forms that are all mutually within
    // budget — the Korean analogue of the Japanese もっと+ADJ set. A closed set
    // of five gives ten pairs, and all ten are accepted today.
    ['갔어요', '봤어요'],                   // went vs saw/watched. Accepted on ko-E0862/E0881 (key 갔어요) and ko-E0905/E0886 (key 봤어요), d=2 vs budget 2.
    ['갔어요', '샀어요'],                   // went vs bought. Accepted on ko-E0862/E0881 and ko-E0917/E0898, d=1 vs budget 2. ㄱ and ㅅ are adjacent on the 2-set keyboard, so this one can also be a genuine slip; it is still listed, because both are taught in the same unit and SM-2 reinforces whichever is accepted.
    ['갔어요', '썼어요'],                   // went vs wrote/used. Accepted on ko-E0862/E0881 and ko-E0904/E0919, d=2 vs budget 2.
    ['갔어요', '했어요'],                   // went vs did. Accepted on ko-E0862/E0881 and ko-E0888/E0900, d=2 vs budget 2.
    ['경제', '형제'],                     // economy vs sibling. Accepted on ko-E1163/E1144 (B1 opinions) and ko-E0395 (A1 family), d=1 vs budget 1.
    ['대명사', '동명사'],                 // pronoun vs gerund — two B2 grammar terms. Accepted on ko-E2269 and ko-E2295, d=2 vs budget 2.
    ['바다', '싸다'],                     // sea vs to be cheap. Accepted on ko-E1455/E1432 (key 바다) and ko-E1008 (key 싸다, prompt "더 _____ (Cheaper)"), d=1 vs budget 1.
    ['바다', '하다'],                     // sea vs to do. Accepted on ko-E1455/E1432 and on all 14 "NOUN_____ (To VERB)" rows keyed 하다, d=1 vs budget 1.
    ['봤어요', '샀어요'],                   // saw vs bought. Accepted on ko-E0905/E0886 and ko-E0917/E0898, d=2 vs budget 2.
    ['봤어요', '썼어요'],                   // saw vs wrote/used. Accepted on ko-E0905/E0886 and ko-E0904/E0919, d=2 vs budget 2.
    ['봤어요', '했어요'],                   // saw vs did. Accepted on ko-E0905/E0886 and ko-E0888/E0900, d=2 vs budget 2.
    ['사촌', '삼촌'],                     // cousin vs uncle — two kinship terms taught in the same A2 family unit, the same shape as 남자친구/여자친구 above but inside budget. Accepted on ko-E0574/E0593 and ko-E0628/E0569, d=1 vs budget 1.
    ['샀어요', '썼어요'],                   // bought vs wrote/used. Accepted on ko-E0917/E0898 and ko-E0904/E0919, d=2 vs budget 2.
    ['샀어요', '했어요'],                   // bought vs did. Accepted on ko-E0917/E0898 and ko-E0888/E0900, d=2 vs budget 2.
    ['예약', '계약'],                     // reservation/appointment vs contract. The widest-reaching entry: 예약 is the key of seven rows across A2 health, B1 travel and B2 business. Accepted on ko-E0991/E0689/E0670/E0976/E1334/E1357 and ko-E2015/E1992, d=1 vs budget 1.
    ['우유', '이유'],                     // milk vs reason. Accepted on ko-E0127/E0108 (A1 food) and ko-E1205/E1173/E1186 (B1 discourse), d=1 vs budget 1.
    ['의사', '의상'],                     // doctor vs costume/outfit. Accepted on ko-E0301/E0282/E0672 and ko-E1135/E1120, d=1 vs budget 1.
    ['의사', '의자'],                     // doctor vs chair. Accepted on ko-E0301/E0282/E0672 and ko-E0462/E0455, d=1 vs budget 1. ko-E0672 is "치과_____ (Dentist)": 치과의자 is a real word (dentist's chair) and still not the answer.
    ['의식', '의심'],                     // consciousness vs doubt/suspicion. Accepted on ko-E1861/E1838 and ko-E1885/E1891, d=1 vs budget 1.
    ['자요', '자유'],                     // sleeps vs freedom. Accepted on ko-E0016 ("잘 _____ (Good night)") and ko-E1819, d=1 vs budget 1.
    ['청소하다', '취소하다'],                 // to clean vs to cancel. Accepted on ko-E0761/E0742 and ko-E1313/E1326/E1345, d=2 vs budget 2.
    ['하다', '싸다'],                     // to do vs to be cheap. Accepted on all 14 rows keyed 하다 and on ko-E1008, d=1 vs budget 1.
    ['했어요', '썼어요'],                   // did vs wrote/used. Accepted on ko-E0888/E0900 and ko-E0904/E0919, d=2 vs budget 2.
    /**
     * 안녕히 가세요 is said to the person LEAVING, 안녕히 계세요 to the person
     * STAYING. Both gloss as "Goodbye", so the two rows that accept the wrong
     * one want opposite treatment: on ko-E0021 (`listening_type`) the audio
     * fixes which phrase is right, while on ko-E0002 (`translate_to_target`,
     * prompt "Translate to Korean: Goodbye") the prompt fixes nothing and
     * 안녕히 계세요 is a correct translation.
     *
     * The list does not have to tell them apart, because an authored
     * `accepted_answers` entry hits the exact-match return at the top of
     * `gradeAnswer` before the pair list is ever consulted. So a pair and an
     * authored alternative cannot conflict, and the row that legitimately
     * takes both simply authors it. That is a HARD PRECONDITION, not a
     * preference: `scripts/question-audit/korean-goodbye-fixes.mjs` authors
     * 안녕히 계세요 on ko-E0002, and ko-E0068 ("안녕히 _____ (Goodbye)") already
     * gains it from an earlier batch in the same draft. Ship the pairs and
     * that content patch together, or a correct translation of "Goodbye"
     * starts being rejected.
     *
     * Both shapes are needed because `isConfusablePair` matches the WHOLE
     * normalized answer, never a substring: the short pair does nothing on a
     * row keyed with the full phrase, and the long pair does nothing on
     * ko-E0068, whose `fill_blank` key is the bare verb.
     */
    ['가세요', '계세요'],                   // go in peace (to the one leaving) vs stay in peace (to the one staying). Accepted today on ko-E0068, d=1 vs budget 1; once the draft authors 계세요 there it exact-matches instead, and this entry is a guard for any future row keyed on the bare verb.
    ['안녕히 가세요', '안녕히 계세요'],           // The same contrast as the full phrase. Accepted today on ko-E0021 and ko-E0002, d=1 vs budget 2. After the fix, ko-E0021 rejects (the audio says 가세요) and ko-E0002 exact-matches the authored alternative.
    /**
     * Third batch, 2026-09-14. Every entry here exists because the Korean
     * accepted-alternatives batch adds a CORRECT answer whose typo ball then
     * reaches a string the curriculum teaches as something else, which
     * `scripts/question-audit/readmission.test.mjs` refuses. Dropping the
     * addition would delete a right answer, so the pair is the remedy.
     *
     * Each is keyed on the ADDED ALTERNATIVE, not on the row's stored key. The
     * grader consults this list with `expectedForTolerance`, the accepted
     * answer that best matches what the learner typed, so a pair written
     * against the key never fires when the addition is what matched. Verified
     * per entry: the readmission is present before the pair and gone after,
     * and the addition itself still grades exactly "Correct!".
     */
    ['더 나쁜', '더 나은'],                  // Worse vs better — an antonym pair, the Korean twin of the Spanish menor/mejor case. ko-E1006 keys 더 좋은 "Better" and gains 더 나은; 더 나쁜 is the stored key of ko-E0996 in the same Comparisons unit.
    ['더 빠른', '더 나은'],                  // Faster vs better, both taught in Comparisons; 더 빠른 is the key of ko-E1012 and reached 더 나은 on the same row.
    ['놀았어요', '보았어요'],                 // I played vs I saw. ko-E0886 keys 봤어요 and gains the uncontracted 보았어요, whose ball reaches 놀았어요, the key of ko-E0868 in the same A2 past-tense unit.
    ['일했어요', '을 했어요'],                 // I worked vs the light-verb completion of 여행___ "I traveled". ko-E0888 gains 을 했어요; 일했어요 is the key of ko-E0880. The pair member is the whole accepted string because `isConfusablePair` matches whole normalized answers, never substrings.
    ['아픈', '아픔'],                      // Sick vs pain — one jamo apart and taught as two separate A1 cards. ko-E0520 keys 통증 "Pain" and gains 아픔; 아픈 is the key of ko-E0528 "Sick" in the same Health & Body unit.
    ['나는', '하는'],                      // The 신___ "Excited" completion vs the 걱정___ "Worried" one. ko-E0780 gains 하는 and its ball reaches 나는, the key of ko-E0792; 걱정나는 is not a Korean word.
    ['잘 가요', '잘 자요'],                  // Go well (goodbye) vs sleep well (good night) — one jamo apart, and the reason the ko-E0002 merge is safe. ko-E0002 gains 잘 가요 from the alternatives batch alongside 안녕히 계세요 from korean-goodbye-fixes; without this pair that row would grade "Sleep well" as a correct translation of "Goodbye". 잘 자요 is the key of ko-E0038.
  ],
  zh: [
    // Added 2026-09-14 by the curriculum audit; see remediation/runtime-independent-review/.
    ['我不同意', '我同意'],                 // Polarity pair: "我不同意" = I disagree, "我同意" = I agree. The single di
  ],
};

/**
 * Check if two words form a confusable pair in the given language.
 * Returns true if they are confusable (i.e., the fuzzy match should be REJECTED).
 */
export function isConfusablePair(
  word1: string,
  word2: string,
  language: LanguageCode,
  /**
   * Optional folding applied to BOTH the arguments and the stored pairs.
   *
   * The list stores words with their diacritics, and the grader's fuzzy branch
   * measures distance on diacritic-stripped strings. Without folding the list
   * too, a pair like irmã/irmão does not catch a learner typing the bare
   * `irmao`: one edit from `irmã`, inside the budget, and accepted as a typo.
   * The caller passes its own fold so there is one definition of "stripped"
   * rather than a second copy here that could drift from it.
   */
  fold: (word: string) => string = (word) => word
): boolean {
  const pairs = CONFUSABLE_PAIRS[language];
  if (!pairs) return false;

  const key = (word: string) => fold(word.toLowerCase().trim());
  const w1 = key(word1);
  const w2 = key(word2);
  // A pair whose members fold together (avô/avó under diacritic folding) would
  // otherwise match itself and refuse an exact answer.
  return pairs.some(([a, b]) => {
    const fa = key(a);
    const fb = key(b);
    return fa !== fb && ((fa === w1 && fb === w2) || (fa === w2 && fb === w1));
  });
}

/**
 * The listed word that differs from `word` in nothing but its diacritics.
 *
 * `isConfusablePair` deliberately skips a pair whose two members fold together,
 * so that folding cannot make a pair match itself. That skip also makes the
 * list silent on exactly the case it was written for: a learner typing `avo`
 * on a Portuguese row keyed `avô`, where the list says plainly that avô and
 * avó are two different words and the accent is the whole difference between
 * them. `gradeAnswer` asks this instead, and refuses the bare stem with a
 * message that names both words — see the accent branch in lib/grading.ts.
 *
 * Returns the partner in its stored spelling, or `null` when the word has no
 * accent-only twin. Only pairs whose members fold together are considered: a
 * pair of genuinely different words (gato/rato) is not an accent question and
 * is left to `isConfusablePair`.
 */
export function accentOnlyPartner(
  word: string,
  language: LanguageCode,
  fold: (word: string) => string,
): string | null {
  const pairs = CONFUSABLE_PAIRS[language];
  if (!pairs) return null;

  const key = (value: string) => fold(value.toLowerCase().trim());
  const folded = key(word);
  const plain = word.toLowerCase().trim();
  for (const [a, b] of pairs) {
    if (key(a) !== folded || key(b) !== folded) continue;
    // The partner is the OTHER member: asked about avô, answer avó.
    return a.toLowerCase().trim() === plain ? b : a;
  }
  return null;
}
