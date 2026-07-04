-- ═══════════════════════════════════════════════════════════════════
-- Fluenci — German B2 "Complex Grammar" unit rebuild + grammar_rules
-- Staged seed. Do NOT run automatically; apply via Supabase MCP/dashboard.
--
-- Replaces the template exercises (which taught grammar TERMINOLOGY as
-- vocabulary) with real grammar practice. Design follows
-- docs/strategy/research.md: recognition -> structured input ->
-- production within each lesson (§4.2 Focus on Form, §7 explicit+practice,
-- §5.3 generation effect), <=60-word metalinguistic explanations (§7.2),
-- and metalinguistic hints for corrective feedback (§10 Lyster & Ranta).
--
-- Grading notes (lib/grading.ts): comparison is lowercased, trailing
-- .!? stripped, whitespace collapsed; umlauts are NOT folded, and fuzzy
-- matching tolerates <=2 edits. accepted_answers therefore list
-- word-order variants and ae/oe/ue transliterations where relevant.
-- B2 grammar_rules rule_names deliberately match the exercises
-- target_grammar prefixes so components/lesson/RuleCard.tsx fuzzy lookup
-- resolves (e.g. tag konjunktiv2_irrealis -> rule konjunktiv2).
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─── Unit ────────────────────────────────────────────────────────────
UPDATE units SET
  description = 'Konjunktiv II, Passiv, Relativsätze, indirekte Rede und Plusquamperfekt — the core B2 grammar toolkit'
WHERE id = 'aabbccdd-3333-4006-0000-b20000000000';

-- ─── Lesson 1: Konjunktiv II ────────────────────────────────────────
UPDATE lessons SET
  title = 'Konjunktiv II: Unreal Conditions',
  description = 'hätte, wäre, könnte, würde — hypothetical situations and polite requests'
WHERE id = 'aabbccdd-3333-4006-0001-b20000000000';

DELETE FROM exercises WHERE lesson_id = 'aabbccdd-3333-4006-0001-b20000000000';

INSERT INTO exercises (lesson_id, type, order_index, prompt, correct_answer, accepted_answers, options, hint_text, skill_type, subskill, response_mode, target_grammar, distractors, explanation, source_type, metadata) VALUES
('aabbccdd-3333-4006-0001-b20000000000', 'multiple_choice', 0,
 'Which sentence correctly expresses an unreal condition?',
 'Wenn ich mehr Zeit hätte, würde ich öfter Sport machen.',
 '{}',
 ARRAY['Wenn ich mehr Zeit hätte, würde ich öfter Sport machen.', 'Wenn ich mehr Zeit hätte, ich würde öfter Sport machen.', 'Wenn ich mehr Zeit habe, würde ich öfter Sport machen.', 'Wenn ich mehr Zeit hätte, würde ich öfter Sport gemacht.'],
 'Konjunktiv II in the wenn-clause, and the verb comes right after the comma.',
 'grammar', 'grammar', 'tap', 'konjunktiv2_irrealis',
 ARRAY['Wenn ich mehr Zeit hätte, ich würde öfter Sport machen.', 'Wenn ich mehr Zeit habe, würde ich öfter Sport machen.', 'Wenn ich mehr Zeit hätte, würde ich öfter Sport gemacht.'],
 'Unreal conditions take Konjunktiv II in both clauses: hätte in the wenn-clause, würde + infinitive in the result clause. After a fronted wenn-clause the conjugated verb comes first: würde ich. Present-tense habe makes the condition real, and the participle gemacht after würde is wrong.',
 'seed', '{}'::jsonb),

('aabbccdd-3333-4006-0001-b20000000000', 'multiple_choice', 1,
 'Which sentence uses Konjunktiv II to make a polite request?',
 'Könnten Sie mir bitte das Salz reichen?',
 '{}',
 ARRAY['Geben Sie mir sofort das Salz!', 'Könnten Sie mir bitte das Salz reichen?', 'Kannst du mir mal das Salz geben?', 'Ich will das Salz haben.'],
 'Look for the Konjunktiv II form of können.',
 'grammar', 'grammar', 'tap', 'konjunktiv2_hoeflichkeit',
 ARRAY['Geben Sie mir sofort das Salz!', 'Kannst du mir mal das Salz geben?', 'Ich will das Salz haben.'],
 'Könnten is Konjunktiv II of können and softens the request into a polite question. The imperative Geben Sie mir sofort das Salz!, the informal indicative Kannst du ... and the blunt Ich will ... are all grammatical, but none of them uses Konjunktiv II.',
 'seed', '{}'::jsonb),

('aabbccdd-3333-4006-0001-b20000000000', 'fill_blank', 2,
 'Wenn ich reich ___, würde ich um die Welt reisen.',
 'wäre',
 ARRAY['waere'],
 NULL,
 'Konjunktiv II of sein.',
 'grammar', 'grammar', 'type', 'konjunktiv2_irrealis',
 '{}',
 'Konjunktiv II of sein is wäre (ich wäre, er wäre). The unreal wenn-clause requires it — indicative bin or war would make the condition real instead of hypothetical.',
 'seed', '{}'::jsonb),

('aabbccdd-3333-4006-0001-b20000000000', 'fill_blank', 3,
 'An deiner Stelle ___ ich zuerst mit dem Chef sprechen.',
 'würde',
 ARRAY['wuerde'],
 NULL,
 'Most verbs form Konjunktiv II with this auxiliary + infinitive.',
 'grammar', 'grammar', 'type', 'konjunktiv2_irrealis',
 '{}',
 'For most verbs German uses würde + infinitive instead of a one-word Konjunktiv II form. An deiner Stelle (in your place) signals hypothetical advice, so: würde ... sprechen.',
 'seed', '{}'::jsonb),

('aabbccdd-3333-4006-0001-b20000000000', 'cloze_deletion', 4,
 'Wenn er das Angebot bekommen ___, hätte er sofort Ja gesagt.',
 'hätte',
 ARRAY['haette'],
 NULL,
 'Past unreal condition: hätte/wäre + Partizip II, auxiliary at the clause end.',
 'grammar', 'grammar', 'type', 'konjunktiv2_vergangenheit',
 '{}',
 'Unreal conditions about the past use hätte or wäre plus the past participle. Bekommen takes haben, and in the wenn-clause the auxiliary moves to the very end: bekommen hätte.',
 'seed', '{}'::jsonb),

('aabbccdd-3333-4006-0001-b20000000000', 'word_form', 5,
 'Complete with the Konjunktiv II of "haben": Ich ___ gern mehr Freizeit.',
 'hätte',
 ARRAY['haette'],
 NULL,
 'Take the Präteritum form hatte and add an umlaut.',
 'grammar', 'grammar', 'type', 'konjunktiv2_irrealis',
 '{}',
 'Konjunktiv II of strong and mixed verbs is built from the Präteritum plus umlaut: hatte wird hätte. Ich hätte gern ... is the standard way to say what you would like to have.',
 'seed', '{"baseWord": "haben"}'::jsonb),

('aabbccdd-3333-4006-0001-b20000000000', 'sentence_transformation', 6,
 'Rewrite as one unreal conditional (würde + infinitive): Ich habe kein Auto, deshalb fahre ich mit dem Bus.',
 'Wenn ich ein Auto hätte, würde ich nicht mit dem Bus fahren.',
 ARRAY['Wenn ich ein Auto hätte würde ich nicht mit dem Bus fahren', 'Wenn ich ein Auto hätte, dann würde ich nicht mit dem Bus fahren', 'Wenn ich ein Auto haette, wuerde ich nicht mit dem Bus fahren', 'Wenn ich ein Auto hätte, würde ich nicht mit dem Bus fahren'],
 NULL,
 'Verb-final in the wenn-clause; würde + infinitive at the end of the main clause.',
 'grammar', 'grammar', 'type', 'konjunktiv2_irrealis',
 '{}',
 'The real situation (no car, so bus) becomes hypothetical: hätte at the end of the wenn-clause, würde + fahren framing the main clause. Nicht negates mit dem Bus fahren.',
 'seed', '{"originalSentence": "Ich habe kein Auto, deshalb fahre ich mit dem Bus.", "instruction": "Rewrite as ONE unreal conditional sentence. Start with: Wenn ich ein Auto hätte, ... (use würde + infinitive)"}'::jsonb),

('aabbccdd-3333-4006-0001-b20000000000', 'error_correction', 7,
 'Wenn ich du wäre, ich würde die Stelle nehmen.',
 'Wenn ich du wäre, würde ich die Stelle nehmen.',
 ARRAY['Wenn ich du wäre würde ich die Stelle nehmen', 'Wenn ich du waere, wuerde ich die Stelle nehmen'],
 NULL,
 'After a fronted wenn-clause, the conjugated verb comes immediately.',
 'grammar', 'grammar', 'type', 'konjunktiv2_irrealis',
 '{}',
 'The wenn-clause fills position one of the whole sentence, so the conjugated verb würde must come next, then the subject: würde ich die Stelle nehmen. Copying English word order (I would) is the classic mistake here.',
 'seed', '{"error_sentence": "Wenn ich du wäre, ich würde die Stelle nehmen."}'::jsonb),

('aabbccdd-3333-4006-0001-b20000000000', 'sentence_construction', 8,
 'Build the German sentence: "If I had more money, I would buy a house."',
 'Wenn ich mehr Geld hätte, würde ich ein Haus kaufen.',
 '{}',
 NULL,
 'Start with Wenn; send hätte to the end of its clause.',
 'grammar', 'grammar', 'tap', 'konjunktiv2_irrealis',
 ARRAY['haben', 'will'],
 'Konjunktiv II on both sides: the finite hätte closes the wenn-clause; würde ... kaufen frames the result clause. The distractor tiles do not fit: haben is a bare infinitive, and indicative will cannot express an unreal condition.',
 'seed', '{"distractors": ["haben", "will"]}'::jsonb),

('aabbccdd-3333-4006-0001-b20000000000', 'translate_to_target', 9,
 'Translate to German: If she had known that, she would have come earlier.',
 'Wenn sie das gewusst hätte, wäre sie früher gekommen.',
 ARRAY['Wenn sie das gewusst hätte, dann wäre sie früher gekommen', 'Hätte sie das gewusst, wäre sie früher gekommen', 'Wenn sie das gewusst hätte wäre sie früher gekommen', 'Wenn sie das gewusst haette, waere sie frueher gekommen'],
 NULL,
 'Past unreal: hätte + Partizip II in the wenn-clause, wäre + Partizip II in the result (kommen takes sein).',
 'grammar', 'grammar', 'type', 'konjunktiv2_vergangenheit',
 '{}',
 'Both clauses use past Konjunktiv II. Wissen forms its perfect with haben (gewusst hätte); kommen is a motion verb and takes sein, so the result clause is wäre ... gekommen.',
 'seed', '{}'::jsonb);

-- ─── Lesson 2: Passiv ───────────────────────────────────────────────
UPDATE lessons SET
  title = 'The Passive Voice (Passiv)',
  description = 'wird gebaut, wurde gebaut, ist gebaut worden, muss gebaut werden'
WHERE id = 'aabbccdd-3333-4006-0002-b20000000000';

DELETE FROM exercises WHERE lesson_id = 'aabbccdd-3333-4006-0002-b20000000000';

INSERT INTO exercises (lesson_id, type, order_index, prompt, correct_answer, accepted_answers, options, hint_text, skill_type, subskill, response_mode, target_grammar, distractors, explanation, source_type, metadata) VALUES
('aabbccdd-3333-4006-0002-b20000000000', 'multiple_choice', 0,
 'Which sentence correctly turns "Man baut hier ein Haus." into the passive (Vorgangspassiv)?',
 'Hier wird ein Haus gebaut.',
 '{}',
 ARRAY['Hier wird ein Haus bauen.', 'Hier wird ein Haus gebaut.', 'Hier ist ein Haus gebaut.', 'Hier baut ein Haus.'],
 'Vorgangspassiv = werden + Partizip II.',
 'grammar', 'grammar', 'tap', 'passiv_praesens',
 ARRAY['Hier wird ein Haus bauen.', 'Hier ist ein Haus gebaut.', 'Hier baut ein Haus.'],
 'The Vorgangspassiv is werden + past participle: wird ... gebaut. Man disappears and the accusative object (ein Haus) becomes the subject. Wird + infinitive (bauen) is future tense, and ist gebaut describes a finished state, not the process.',
 'seed', '{}'::jsonb),

('aabbccdd-3333-4006-0002-b20000000000', 'multiple_choice', 1,
 'Which passive sentence with a modal verb is correct?',
 'Der Bericht muss bis Freitag geschrieben werden.',
 '{}',
 ARRAY['Der Bericht muss bis Freitag geschrieben wird.', 'Der Bericht muss bis Freitag schreiben werden.', 'Der Bericht muss bis Freitag werden geschrieben.', 'Der Bericht muss bis Freitag geschrieben werden.'],
 'Modal in position 2, then Partizip II + werden (infinitive) at the very end.',
 'grammar', 'grammar', 'tap', 'passiv_modalverben',
 ARRAY['Der Bericht muss bis Freitag geschrieben wird.', 'Der Bericht muss bis Freitag schreiben werden.', 'Der Bericht muss bis Freitag werden geschrieben.'],
 'With a modal verb the passive pattern is: conjugated modal + past participle + werden as a bare infinitive at the end: muss ... geschrieben werden. Werden must stay uninflected and must follow the participle.',
 'seed', '{}'::jsonb),

('aabbccdd-3333-4006-0002-b20000000000', 'fill_blank', 2,
 'Im Moment ___ das Büro renoviert, deshalb arbeiten wir von zu Hause.',
 'wird',
 '{}',
 NULL,
 'Present passive: conjugated werden + Partizip II.',
 'grammar', 'grammar', 'type', 'passiv_praesens',
 '{}',
 'Im Moment (right now) requires the present tense: wird renoviert. The auxiliary werden agrees with the singular subject das Büro.',
 'seed', '{}'::jsonb),

('aabbccdd-3333-4006-0002-b20000000000', 'fill_blank', 3,
 'Der Roman wurde ___ einer jungen Autorin geschrieben.',
 'von',
 '{}',
 NULL,
 'The agent (the doer) in a passive sentence takes this preposition + dative.',
 'grammar', 'grammar', 'type', 'passiv_agens',
 '{}',
 'The person who performs the action appears with von + dative in passive sentences: von einer jungen Autorin. Durch is reserved for means or intermediaries, not the true agent.',
 'seed', '{}'::jsonb),

('aabbccdd-3333-4006-0002-b20000000000', 'cloze_deletion', 4,
 'Der Fehler ist zum Glück schnell entdeckt ___.',
 'worden',
 '{}',
 NULL,
 'Perfekt passive: sein + Partizip II + wor...',
 'grammar', 'grammar', 'type', 'passiv_perfekt',
 '{}',
 'In the Perfekt passive, werden takes the special participle worden (without ge-): ist entdeckt worden. Geworden is only used when werden means to become.',
 'seed', '{}'::jsonb),

('aabbccdd-3333-4006-0002-b20000000000', 'word_form', 5,
 'Complete with the Partizip II of "bezahlen": Die Rechnung wird morgen ___.',
 'bezahlt',
 '{}',
 NULL,
 'Verbs starting with be- form the participle without ge-.',
 'grammar', 'grammar', 'type', 'passiv_praesens',
 '{}',
 'Inseparable-prefix verbs (be-, er-, ver-, ent- ...) form the Partizip II without ge-: bezahlen wird bezahlt. The full passive is wird bezahlt.',
 'seed', '{"baseWord": "bezahlen"}'::jsonb),

('aabbccdd-3333-4006-0002-b20000000000', 'sentence_transformation', 6,
 'Rewrite in the passive (leave out man): Man diskutiert das Problem seit Jahren.',
 'Das Problem wird seit Jahren diskutiert.',
 ARRAY['Seit Jahren wird das Problem diskutiert'],
 NULL,
 'The accusative object becomes the nominative subject.',
 'grammar', 'grammar', 'type', 'passiv_praesens',
 '{}',
 'Man-sentences drop man entirely in the passive. Das Problem becomes the subject, werden is conjugated for it (wird), and diskutiert stands as the participle at the end.',
 'seed', '{"originalSentence": "Man diskutiert das Problem seit Jahren.", "instruction": "Rewrite in the passive voice (Vorgangspassiv). Leave out man."}'::jsonb),

('aabbccdd-3333-4006-0002-b20000000000', 'sentence_transformation', 7,
 'Rewrite in the passive (leave out man): Man muss die Ergebnisse noch prüfen.',
 'Die Ergebnisse müssen noch geprüft werden.',
 ARRAY['Die Ergebnisse muessen noch geprueft werden'],
 NULL,
 'The modal stays conjugated; add Partizip II + werden at the end.',
 'grammar', 'grammar', 'type', 'passiv_modalverben',
 '{}',
 'The modal now agrees with the plural subject die Ergebnisse: müssen. The main verb becomes participle + werden at the sentence end: geprüft werden.',
 'seed', '{"originalSentence": "Man muss die Ergebnisse noch prüfen.", "instruction": "Rewrite in the passive voice. Leave out man."}'::jsonb),

('aabbccdd-3333-4006-0002-b20000000000', 'error_correction', 8,
 'Die Brücke wurde 1990 von einem berühmten Architekten entworfen worden.',
 'Die Brücke wurde 1990 von einem berühmten Architekten entworfen.',
 ARRAY['Die Brücke ist 1990 von einem berühmten Architekten entworfen worden', 'Die Bruecke wurde 1990 von einem beruehmten Architekten entworfen'],
 NULL,
 'worden belongs to the Perfekt (ist ... worden), never to the Präteritum (wurde).',
 'grammar', 'grammar', 'type', 'passiv_praeteritum',
 '{}',
 'German has two past passives: Präteritum wurde entworfen and Perfekt ist entworfen worden. Mixing them (wurde ... worden) is wrong — either drop worden or change wurde to ist.',
 'seed', '{"error_sentence": "Die Brücke wurde 1990 von einem berühmten Architekten entworfen worden."}'::jsonb),

('aabbccdd-3333-4006-0002-b20000000000', 'translate_to_target', 9,
 'Translate to German: The house was built in 1950.',
 'Das Haus wurde 1950 gebaut.',
 ARRAY['Das Haus wurde im Jahr 1950 gebaut', '1950 wurde das Haus gebaut', 'Im Jahr 1950 wurde das Haus gebaut', 'Das Haus ist 1950 gebaut worden', 'Das Haus ist im Jahr 1950 gebaut worden'],
 NULL,
 'Präteritum passive: wurde + Partizip II. German says 1950 or im Jahr 1950 — never "in 1950".',
 'grammar', 'grammar', 'type', 'passiv_praeteritum',
 '{}',
 'A completed past event in the passive: wurde gebaut (or Perfekt: ist gebaut worden). Note that German uses the bare year or im Jahr 1950; "in 1950" is an anglicism.',
 'seed', '{}'::jsonb);

-- ─── Lesson 3: Relativsätze ─────────────────────────────────────────
UPDATE lessons SET
  title = 'Relative Clauses (Relativsätze)',
  description = 'der, dem, dessen, deren — plus prepositions with relative pronouns'
WHERE id = 'aabbccdd-3333-4006-0003-b20000000000';

DELETE FROM exercises WHERE lesson_id = 'aabbccdd-3333-4006-0003-b20000000000';

INSERT INTO exercises (lesson_id, type, order_index, prompt, correct_answer, accepted_answers, options, hint_text, skill_type, subskill, response_mode, target_grammar, distractors, explanation, source_type, metadata) VALUES
('aabbccdd-3333-4006-0003-b20000000000', 'multiple_choice', 0,
 'Choose the correct relative pronoun: "Der Mann, ___ ich das Buch gegeben habe, ist mein Nachbar."',
 'dem',
 '{}',
 ARRAY['denen', 'dem', 'deren', 'dessen'],
 'geben takes a dative object — to whom did I give the book?',
 'grammar', 'grammar', 'tap', 'relativsatz_dativ',
 ARRAY['denen', 'deren', 'dessen'],
 'The relative pronoun takes its case from its role INSIDE the relative clause. Geben requires a dative recipient (ich gebe dem Mann das Buch), so masculine singular dative dem is correct. Dessen is genitive (whose), while denen and deren belong to plural antecedents — der Mann is singular.',
 'seed', '{}'::jsonb),

('aabbccdd-3333-4006-0003-b20000000000', 'multiple_choice', 1,
 'Choose the correct relative pronoun: "Die Frau, ___ Auto gestohlen wurde, hat die Polizei gerufen."',
 'deren',
 '{}',
 ARRAY['der', 'dem', 'deren', 'die'],
 'Whose car? Feminine antecedent needs the genitive form.',
 'grammar', 'grammar', 'tap', 'relativsatz_genitiv',
 ARRAY['der', 'dem', 'die'],
 'Possession inside a relative clause uses a genitive relative pronoun: deren for feminine and plural antecedents (dessen would be masculine or neuter). Die Frau is feminine, so deren Auto = whose car. Nominative die and the dative forms der and dem cannot express possession.',
 'seed', '{}'::jsonb),

('aabbccdd-3333-4006-0003-b20000000000', 'fill_blank', 2,
 'Das ist der Film, über ___ alle sprechen.',
 'den',
 ARRAY['welchen'],
 NULL,
 'sprechen über + accusative; the antecedent is masculine.',
 'grammar', 'grammar', 'type', 'relativsatz_praeposition',
 '{}',
 'When the verb needs a preposition (sprechen über), the preposition moves in front of the relative pronoun, which takes the case the preposition governs: über + accusative masculine = den.',
 'seed', '{}'::jsonb),

('aabbccdd-3333-4006-0003-b20000000000', 'cloze_deletion', 3,
 'Die Kinder, ___ Eltern beide arbeiten, essen mittags in der Schule.',
 'deren',
 '{}',
 NULL,
 'Plural antecedent + possession (whose parents).',
 'grammar', 'grammar', 'type', 'relativsatz_genitiv',
 '{}',
 'Deren is the genitive relative pronoun for plural antecedents (and feminine singular): die Kinder, deren Eltern = the children whose parents. Its form never changes to match the following noun.',
 'seed', '{}'::jsonb),

('aabbccdd-3333-4006-0003-b20000000000', 'fill_blank', 4,
 'Das Haus, in ___ wir seit zehn Jahren wohnen, wurde vor hundert Jahren gebaut.',
 'dem',
 ARRAY['welchem'],
 NULL,
 'wohnen in + dative (location); the antecedent is neuter.',
 'grammar', 'grammar', 'type', 'relativsatz_praeposition',
 '{}',
 'Location with wohnen takes in + dative. Das Haus is neuter, and the neuter dative relative pronoun is dem: in dem wir wohnen.',
 'seed', '{}'::jsonb),

('aabbccdd-3333-4006-0003-b20000000000', 'fill_blank', 5,
 'Die Freunde, mit ___ ich studiert habe, wohnen jetzt im Ausland.',
 'denen',
 ARRAY['welchen'],
 NULL,
 'mit always takes dative; the antecedent is plural.',
 'grammar', 'grammar', 'type', 'relativsatz_dativ',
 '{}',
 'After a preposition the relative pronoun takes the case that preposition governs. Mit takes dative, and the plural dative relative pronoun is the special form denen: die Freunde, mit denen ...',
 'seed', '{}'::jsonb),

('aabbccdd-3333-4006-0003-b20000000000', 'error_correction', 6,
 'Das ist der Mann, den Auto vor der Tür steht.',
 'Das ist der Mann, dessen Auto vor der Tür steht.',
 ARRAY['Das ist der Mann dessen Auto vor der Tür steht', 'Das ist der Mann, dessen Auto vor der Tuer steht'],
 NULL,
 'Whose car — masculine antecedent needs the genitive relative pronoun.',
 'grammar', 'grammar', 'type', 'relativsatz_genitiv',
 '{}',
 'Possession needs the genitive relative pronoun: der Mann, dessen Auto = the man whose car. Den is accusative and cannot express possession.',
 'seed', '{"error_sentence": "Das ist der Mann, den Auto vor der Tür steht."}'::jsonb),

('aabbccdd-3333-4006-0003-b20000000000', 'sentence_construction', 7,
 'Build the German sentence: "The woman who lives next door is a doctor."',
 'Die Frau, die nebenan wohnt, ist Ärztin.',
 '{}',
 NULL,
 'The relative-clause verb goes to the end; professions after sein take no article.',
 'grammar', 'grammar', 'tap', 'relativsatz_nominativ',
 ARRAY['dessen'],
 'Die Frau is feminine, so the nominative relative pronoun is die (the distractor dessen is a genitive form and cannot be the subject of the clause). Inside the relative clause the verb moves to the end: die nebenan wohnt. Professions after sein take no article: ist Ärztin.',
 'seed', '{"distractors": ["dessen"]}'::jsonb),

('aabbccdd-3333-4006-0003-b20000000000', 'sentence_transformation', 8,
 'Combine into one sentence with a relative clause: Der Roman ist spannend. Ich lese ihn gerade.',
 'Der Roman, den ich gerade lese, ist spannend.',
 ARRAY['Der Roman den ich gerade lese ist spannend'],
 NULL,
 'ihn (accusative masculine) becomes the relative pronoun den.',
 'grammar', 'grammar', 'type', 'relativsatz_akkusativ',
 '{}',
 'The pronoun ihn shows that the relative pronoun must be accusative masculine: den. The relative clause follows its antecedent directly, with the verb lese at the clause end and commas on both sides.',
 'seed', '{"originalSentence": "Der Roman ist spannend. Ich lese ihn gerade.", "instruction": "Combine the two sentences using a relative clause. Start with: Der Roman, ..."}'::jsonb),

('aabbccdd-3333-4006-0003-b20000000000', 'translate_to_target', 9,
 'Translate to German: The friend with whom I traveled lives in Berlin. (der Freund; use wohnen or leben)',
 'Der Freund, mit dem ich gereist bin, wohnt in Berlin.',
 ARRAY['Der Freund, mit dem ich gereist bin, lebt in Berlin', 'Der Freund mit dem ich gereist bin wohnt in Berlin', 'Der Freund, mit dem ich gereist bin, wohnt in Berlin'],
 NULL,
 'mit + dative; reisen forms its Perfekt with sein.',
 'grammar', 'grammar', 'type', 'relativsatz_praeposition',
 '{}',
 'Mit always takes dative: mit dem. Reisen is a motion verb, so the Perfekt uses sein: ich bin gereist, with gereist bin at the end of the relative clause.',
 'seed', '{}'::jsonb);

-- ─── Lesson 4: Konjunktiv I & indirekte Rede ────────────────────────
UPDATE lessons SET
  title = 'Konjunktiv I: Reported Speech',
  description = 'Er sagt, er habe keine Zeit — report statements formally (indirekte Rede)'
WHERE id = 'aabbccdd-3333-4006-0004-b20000000000';

DELETE FROM exercises WHERE lesson_id = 'aabbccdd-3333-4006-0004-b20000000000';

INSERT INTO exercises (lesson_id, type, order_index, prompt, correct_answer, accepted_answers, options, hint_text, skill_type, subskill, response_mode, target_grammar, distractors, explanation, source_type, metadata) VALUES
('aabbccdd-3333-4006-0004-b20000000000', 'multiple_choice', 0,
 'Anna sagt: "Ich bin krank." — Which sentence reports this in formal indirect speech (Konjunktiv I)?',
 'Anna sagt, sie sei krank.',
 '{}',
 ARRAY['Anna sagt, sie sei krank.', 'Anna sagt, sie ist krank.', 'Anna sagt, dass sie sei krank.', 'Anna sagt, ich sei krank.'],
 'Shift the pronoun to the reporter''s perspective and use Konjunktiv I of sein.',
 'grammar', 'grammar', 'tap', 'konjunktiv1_indirekte_rede',
 ARRAY['Anna sagt, sie ist krank.', 'Anna sagt, dass sie sei krank.', 'Anna sagt, ich sei krank.'],
 'Formal reported speech uses Konjunktiv I: sei. The pronoun shifts perspective (ich becomes sie). With dass, the verb would have to go to the end (dass sie krank sei) — dass sie sei krank breaks that rule.',
 'seed', '{}'::jsonb),

('aabbccdd-3333-4006-0004-b20000000000', 'multiple_choice', 1,
 'Choose the Konjunktiv I form: Er behauptet, er ___ keine Zeit.',
 'habe',
 '{}',
 ARRAY['hat', 'habe', 'hätten', 'hätte'],
 'Konjunktiv I, 3rd person singular: infinitive stem + -e.',
 'grammar', 'grammar', 'tap', 'konjunktiv1_indirekte_rede',
 ARRAY['hat', 'hätten', 'hätte'],
 'Konjunktiv I is formed from the infinitive stem plus -e: er habe. Hat is plain indicative, while hätte and hätten are Konjunktiv II forms — the prompt asks for Konjunktiv I.',
 'seed', '{}'::jsonb),

('aabbccdd-3333-4006-0004-b20000000000', 'fill_blank', 2,
 'Der Minister erklärte, die Lage ___ ernst, aber unter Kontrolle. (Konjunktiv I)',
 'sei',
 '{}',
 NULL,
 'Konjunktiv I of sein, 3rd person singular.',
 'grammar', 'grammar', 'type', 'konjunktiv1_indirekte_rede',
 '{}',
 'Sein is the only verb with a fully distinct Konjunktiv I paradigm: ich sei, er/sie/es sei. News style uses it to mark claims as reported: die Lage sei ernst.',
 'seed', '{}'::jsonb),

('aabbccdd-3333-4006-0004-b20000000000', 'cloze_deletion', 3,
 'Sie sagte: "Ich werde am Wochenende nach Hamburg fahren." — Sie sagte, sie ___ am Wochenende nach Hamburg fahren. (Konjunktiv I)',
 'werde',
 '{}',
 NULL,
 'Reported future: Konjunktiv I of werden.',
 'grammar', 'grammar', 'type', 'konjunktiv1_indirekte_rede',
 '{}',
 'Future statements are reported with the Konjunktiv I of werden: sie werde ... fahren. The indicative wird would drop the reported-speech marking.',
 'seed', '{}'::jsonb),

('aabbccdd-3333-4006-0004-b20000000000', 'fill_blank', 4,
 'Die Zeitung berichtet, viele Anwohner ___ von dem Lärm betroffen. (sein, Konjunktiv I)',
 'seien',
 '{}',
 NULL,
 'Konjunktiv I of sein — plural.',
 'grammar', 'grammar', 'type', 'konjunktiv1_indirekte_rede',
 '{}',
 'Plural subjects take seien: viele Anwohner seien betroffen. This form is clearly distinct from indicative sind, so Konjunktiv I is used directly (no fallback to Konjunktiv II needed).',
 'seed', '{}'::jsonb),

('aabbccdd-3333-4006-0004-b20000000000', 'word_form', 5,
 'Complete with the Konjunktiv I of "können": Er sagt, er ___ heute leider nicht kommen.',
 'könne',
 ARRAY['koenne'],
 NULL,
 'Infinitive stem + -e, keep the umlaut.',
 'grammar', 'grammar', 'type', 'konjunktiv1_indirekte_rede',
 '{}',
 'Konjunktiv I keeps the infinitive stem: können wird er könne. Compare indicative er kann and Konjunktiv II er könnte — three different forms with three different jobs.',
 'seed', '{"baseWord": "können"}'::jsonb),

('aabbccdd-3333-4006-0004-b20000000000', 'sentence_transformation', 6,
 'Report in Konjunktiv I — Tom sagt: "Ich habe den Schlüssel verloren."',
 'Tom sagt, er habe den Schlüssel verloren.',
 ARRAY['Tom sagt, dass er den Schlüssel verloren habe', 'Tom sagt er habe den Schlüssel verloren', 'Tom sagt, er habe den Schluessel verloren'],
 NULL,
 'ich becomes er; habe stays — but now it is Konjunktiv I.',
 'grammar', 'grammar', 'type', 'konjunktiv1_indirekte_rede',
 '{}',
 'The pronoun shifts (ich becomes er). The form habe looks like the indicative ich habe, but with er it can only be Konjunktiv I (indicative would be er hat). With dass, the verb cluster moves to the end.',
 'seed', '{"originalSentence": "Tom sagt: \"Ich habe den Schlüssel verloren.\"", "instruction": "Rewrite as indirect speech with Konjunktiv I. Start with: Tom sagt, ..."}'::jsonb),

('aabbccdd-3333-4006-0004-b20000000000', 'error_correction', 7,
 'Die Nachbarin erzählte, ihr Sohn ist jetzt in Kanada und arbeitet dort als Koch.',
 'Die Nachbarin erzählte, ihr Sohn sei jetzt in Kanada und arbeite dort als Koch.',
 ARRAY['Die Nachbarin erzählte, ihr Sohn sei jetzt in Kanada und er arbeite dort als Koch', 'Die Nachbarin erzaehlte, ihr Sohn sei jetzt in Kanada und arbeite dort als Koch'],
 NULL,
 'Two verbs must shift to Konjunktiv I.',
 'grammar', 'grammar', 'type', 'konjunktiv1_indirekte_rede',
 '{}',
 'Reported speech continues across coordinated clauses: both verbs shift to Konjunktiv I — ist becomes sei and arbeitet becomes arbeite. Leaving them indicative would present the claim as the narrator''s own fact.',
 'seed', '{"error_sentence": "Die Nachbarin erzählte, ihr Sohn ist jetzt in Kanada und arbeitet dort als Koch."}'::jsonb),

('aabbccdd-3333-4006-0004-b20000000000', 'sentence_construction', 8,
 'Build the reported version (Konjunktiv I) of — Sie sagt: "Ich komme morgen."',
 'Sie sagt, sie komme morgen.',
 ARRAY['Sie sagt, morgen komme sie'],
 NULL,
 'Konjunktiv I: stem + -e; shift the pronoun.',
 'grammar', 'grammar', 'tap', 'konjunktiv1_indirekte_rede',
 ARRAY['kam'],
 'Komme is Konjunktiv I (sie komme). The distractor kam is Präteritum indicative — not Konjunktiv I, and it clashes with morgen. The pronoun shifts from ich to sie because someone else is reporting her words.',
 'seed', '{"distractors": ["kam"]}'::jsonb),

('aabbccdd-3333-4006-0004-b20000000000', 'translate_to_target', 9,
 'Translate using Konjunktiv I: The professor says the exam is difficult. (die Prüfung, schwierig)',
 'Der Professor sagt, die Prüfung sei schwierig.',
 ARRAY['Der Professor sagt, dass die Prüfung schwierig sei', 'Der Professor sagt die Prüfung sei schwierig', 'Der Professor sagt, die Pruefung sei schwierig', 'Der Professor sagt, dass die Pruefung schwierig sei'],
 NULL,
 'sein becomes sei; with dass the verb goes to the end.',
 'grammar', 'grammar', 'type', 'konjunktiv1_indirekte_rede',
 '{}',
 'Konjunktiv I sei marks the claim as reported. Without dass the clause keeps verb-second order (die Prüfung sei schwierig); with dass the verb moves to the end (dass die Prüfung schwierig sei).',
 'seed', '{}'::jsonb);

-- ─── Lesson 5: Plusquamperfekt & temporale Nebensätze ───────────────
UPDATE lessons SET
  title = 'Plusquamperfekt & Time Clauses',
  description = 'nachdem, bevor, während — sequence past events with the past perfect'
WHERE id = 'aabbccdd-3333-4006-0005-b20000000000';

DELETE FROM exercises WHERE lesson_id = 'aabbccdd-3333-4006-0005-b20000000000';

INSERT INTO exercises (lesson_id, type, order_index, prompt, correct_answer, accepted_answers, options, hint_text, skill_type, subskill, response_mode, target_grammar, distractors, explanation, source_type, metadata) VALUES
('aabbccdd-3333-4006-0005-b20000000000', 'multiple_choice', 0,
 'Which sentence uses the correct tenses with nachdem?',
 'Nachdem wir gegessen hatten, gingen wir spazieren.',
 '{}',
 ARRAY['Nachdem wir gegessen hatten, wir gingen spazieren.', 'Nachdem wir gegessen hatten, gingen wir spazieren.', 'Nachdem wir aßen, gingen wir spazieren.', 'Nachdem wir essen hatten, gingen wir spazieren.'],
 'nachdem + Plusquamperfekt, then the main clause in Präteritum, verb first.',
 'grammar', 'grammar', 'tap', 'plusquamperfekt_nachdem',
 ARRAY['Nachdem wir gegessen hatten, wir gingen spazieren.', 'Nachdem wir aßen, gingen wir spazieren.', 'Nachdem wir essen hatten, gingen wir spazieren.'],
 'Nachdem marks an earlier event, so its clause needs the Plusquamperfekt: gegessen hatten (participle + auxiliary). The main clause follows in Präteritum with the verb directly after the comma: gingen wir.',
 'seed', '{}'::jsonb),

('aabbccdd-3333-4006-0005-b20000000000', 'multiple_choice', 1,
 'Which sentence about two simultaneous actions is correct?',
 'Während er kochte, deckte sie den Tisch.',
 '{}',
 ARRAY['Während er kochte, sie deckte den Tisch.', 'Während kochte er, deckte sie den Tisch.', 'Während er kochte, deckte sie den Tisch.', 'Während er gekocht, deckte sie den Tisch.'],
 'während is a subordinating conjunction — its verb goes to the clause end.',
 'grammar', 'grammar', 'tap', 'temporalsatz_waehrend',
 ARRAY['Während er kochte, sie deckte den Tisch.', 'Während kochte er, deckte sie den Tisch.', 'Während er gekocht, deckte sie den Tisch.'],
 'Während introduces a subordinate clause, so kochte moves to the clause end. After the fronted time clause, the main clause starts with its verb: deckte sie. Simultaneous actions share the same tense — no participle needed.',
 'seed', '{}'::jsonb),

('aabbccdd-3333-4006-0005-b20000000000', 'fill_blank', 2,
 'Nachdem sie die Prüfung bestanden ___, feierte sie mit ihren Freunden.',
 'hatte',
 '{}',
 NULL,
 'Plusquamperfekt auxiliary of bestehen (haben), Präteritum form, singular.',
 'grammar', 'grammar', 'type', 'plusquamperfekt_nachdem',
 '{}',
 'Plusquamperfekt = hatte/war + Partizip II. Bestehen takes haben, and the singular subject sie gives hatte, placed at the very end of the nachdem-clause: bestanden hatte.',
 'seed', '{}'::jsonb),

('aabbccdd-3333-4006-0005-b20000000000', 'cloze_deletion', 3,
 'Als wir am Bahnhof ankamen, ___ der Zug schon abgefahren.',
 'war',
 '{}',
 NULL,
 'abfahren is a motion verb — which auxiliary, and in which past tense?',
 'grammar', 'grammar', 'type', 'plusquamperfekt',
 '{}',
 'The departure happened before the arrival, so Plusquamperfekt is required. Abfahren (motion) takes sein: war abgefahren. Present-perfect ist abgefahren would break the past-before-past sequence.',
 'seed', '{}'::jsonb),

('aabbccdd-3333-4006-0005-b20000000000', 'fill_blank', 4,
 '___ ich ins Bett gehe, putze ich mir immer die Zähne. ("Before I go to bed, I always brush my teeth.")',
 'Bevor',
 ARRAY['ehe'],
 NULL,
 'The conjunction meaning "before".',
 'grammar', 'grammar', 'type', 'temporalsatz_bevor',
 '{}',
 'Bevor (or the more formal ehe) introduces the action that happens later. Unlike nachdem, bevor requires no tense shift: both clauses simply share the same tense.',
 'seed', '{}'::jsonb),

('aabbccdd-3333-4006-0005-b20000000000', 'word_form', 5,
 'Complete with the Partizip II of "arbeiten": Sie war müde, weil sie die ganze Nacht ___ hatte.',
 'gearbeitet',
 '{}',
 NULL,
 'Regular verb: ge- + stem + -et.',
 'grammar', 'grammar', 'type', 'plusquamperfekt',
 '{}',
 'Arbeiten is regular: ge + arbeit + et = gearbeitet. Together with hatte it forms the Plusquamperfekt — the working happened before she was tired.',
 'seed', '{"baseWord": "arbeiten"}'::jsonb),

('aabbccdd-3333-4006-0005-b20000000000', 'sentence_transformation', 6,
 'Combine using Nachdem: Zuerst machte er seine Hausaufgaben. Dann spielte er Fußball.',
 'Nachdem er seine Hausaufgaben gemacht hatte, spielte er Fußball.',
 ARRAY['Nachdem er seine Hausaufgaben gemacht hatte spielte er Fußball', 'Nachdem er seine Hausaufgaben gemacht hatte, spielte er Fussball'],
 NULL,
 'The earlier event goes into the nachdem-clause with gemacht hatte at the end.',
 'grammar', 'grammar', 'type', 'plusquamperfekt_nachdem',
 '{}',
 'The earlier action (homework) takes the Plusquamperfekt inside the nachdem-clause: gemacht hatte. The later action stays in Präteritum, with spielte directly after the comma (verb-second).',
 'seed', '{"originalSentence": "Zuerst machte er seine Hausaufgaben. Dann spielte er Fußball.", "instruction": "Combine into ONE sentence starting with Nachdem (Plusquamperfekt + Präteritum)."}'::jsonb),

('aabbccdd-3333-4006-0005-b20000000000', 'error_correction', 7,
 'Nachdem er das Studium beendet hatte, er zog nach München.',
 'Nachdem er das Studium beendet hatte, zog er nach München.',
 ARRAY['Nachdem er das Studium beendet hatte zog er nach München', 'Nachdem er das Studium beendet hatte, zog er nach Muenchen'],
 NULL,
 'A fronted clause fills position 1 — the conjugated verb must come next.',
 'grammar', 'grammar', 'type', 'plusquamperfekt_nachdem',
 '{}',
 'The whole nachdem-clause counts as position one of the sentence, so the conjugated verb zog must follow immediately: zog er nach München. "Er zog" after a fronted clause copies English word order.',
 'seed', '{"error_sentence": "Nachdem er das Studium beendet hatte, er zog nach München."}'::jsonb),

('aabbccdd-3333-4006-0005-b20000000000', 'sentence_construction', 8,
 'Build the German sentence: "While I was cooking, my brother set the table."',
 'Während ich kochte, deckte mein Bruder den Tisch.',
 '{}',
 NULL,
 'Verb-final in the während-clause; verb-first in the main clause.',
 'grammar', 'grammar', 'tap', 'temporalsatz_waehrend',
 ARRAY['gekocht'],
 'Während sends kochte to the end of its clause. After the fronted time clause the main verb deckte precedes the subject mein Bruder (verb-second rule). The distractor gekocht is a bare participle — it cannot stand alone as the finite verb of the während-clause.',
 'seed', '{"distractors": ["gekocht"]}'::jsonb),

('aabbccdd-3333-4006-0005-b20000000000', 'translate_to_target', 9,
 'Translate to German: After we had eaten, we went for a walk.',
 'Nachdem wir gegessen hatten, gingen wir spazieren.',
 ARRAY['Nachdem wir gegessen hatten, sind wir spazieren gegangen', 'Nachdem wir gegessen hatten, machten wir einen Spaziergang', 'Nachdem wir gegessen hatten gingen wir spazieren'],
 NULL,
 'nachdem + Plusquamperfekt; main clause in Präteritum, verb right after the comma.',
 'grammar', 'grammar', 'type', 'plusquamperfekt_nachdem',
 '{}',
 'Eating precedes walking: gegessen hatten (Plusquamperfekt) in the nachdem-clause, then gingen wir spazieren in the Präteritum with the verb directly after the comma.',
 'seed', '{}'::jsonb);

-- ─── Lesson 6: Review & Test (mixes all five topics) ────────────────
UPDATE lessons SET
  title = 'Review & Test',
  description = 'Mixed practice: Konjunktiv II, Passiv, Relativsätze, indirekte Rede, Plusquamperfekt'
WHERE id = 'aabbccdd-3333-4006-0006-b20000000000';

DELETE FROM exercises WHERE lesson_id = 'aabbccdd-3333-4006-0006-b20000000000';

INSERT INTO exercises (lesson_id, type, order_index, prompt, correct_answer, accepted_answers, options, hint_text, skill_type, subskill, response_mode, target_grammar, distractors, explanation, source_type, metadata) VALUES
('aabbccdd-3333-4006-0006-b20000000000', 'multiple_choice', 0,
 'Which sentence correctly expresses an unreal condition?',
 'Wenn das Wetter besser wäre, würden wir draußen sitzen.',
 '{}',
 ARRAY['Wenn das Wetter besser wäre, wir würden draußen sitzen.', 'Wenn das Wetter besser wäre, würden wir draußen sitzen.', 'Wenn das Wetter besser ist, würden wir draußen sitzen.', 'Wenn das Wetter besser wäre, würden wir draußen gesessen.'],
 'Konjunktiv II in both clauses; verb-second after the comma.',
 'grammar', 'grammar', 'tap', 'konjunktiv2_irrealis',
 ARRAY['Wenn das Wetter besser wäre, wir würden draußen sitzen.', 'Wenn das Wetter besser ist, würden wir draußen sitzen.', 'Wenn das Wetter besser wäre, würden wir draußen gesessen.'],
 'Unreal condition: wäre in the wenn-clause, würden + infinitive sitzen in the main clause, with würden directly after the comma. Indicative ist makes the condition real, and the participle gesessen after würden is wrong.',
 'seed', '{}'::jsonb),

('aabbccdd-3333-4006-0006-b20000000000', 'multiple_choice', 1,
 'Which passive sentence is correct?',
 'Die Rechnung muss noch bezahlt werden.',
 '{}',
 ARRAY['Die Rechnung müssen noch bezahlt werden.', 'Die Rechnung muss noch bezahlt wird.', 'Die Rechnung muss noch bezahlt werden.', 'Die Rechnung muss noch werden bezahlt.'],
 'Modal + Partizip II + werden at the end.',
 'grammar', 'grammar', 'tap', 'passiv_modalverben',
 ARRAY['Die Rechnung müssen noch bezahlt werden.', 'Die Rechnung muss noch bezahlt wird.', 'Die Rechnung muss noch werden bezahlt.'],
 'Passive with a modal verb: conjugated modal in position 2, then past participle + werden as a bare infinitive at the very end. The modal agrees with the singular subject die Rechnung: muss, not müssen.',
 'seed', '{}'::jsonb),

('aabbccdd-3333-4006-0006-b20000000000', 'fill_blank', 2,
 'Der Trainer sagte, die Mannschaft ___ gut vorbereitet. (Konjunktiv I)',
 'sei',
 '{}',
 NULL,
 'Reported speech: Konjunktiv I of sein, singular.',
 'grammar', 'grammar', 'type', 'konjunktiv1_indirekte_rede',
 '{}',
 'Konjunktiv I sei marks the statement as reported: die Mannschaft sei gut vorbereitet. The indicative ist would present it as the speaker''s own fact.',
 'seed', '{}'::jsonb),

('aabbccdd-3333-4006-0006-b20000000000', 'cloze_deletion', 3,
 'Der Autor, ___ neues Buch gerade erschienen ist, gibt morgen eine Lesung.',
 'dessen',
 '{}',
 NULL,
 'Masculine antecedent + possession (whose new book).',
 'grammar', 'grammar', 'type', 'relativsatz_genitiv',
 '{}',
 'Der Autor is masculine, so the genitive relative pronoun is dessen: dessen neues Buch = whose new book. Deren would be needed for a feminine or plural antecedent.',
 'seed', '{}'::jsonb),

('aabbccdd-3333-4006-0006-b20000000000', 'fill_blank', 4,
 'Nachdem die Gäste gegangen ___, räumten wir die Wohnung auf.',
 'waren',
 '{}',
 NULL,
 'gehen takes sein; plural subject, Plusquamperfekt.',
 'grammar', 'grammar', 'type', 'plusquamperfekt_nachdem',
 '{}',
 'Gehen is a motion verb, so its Plusquamperfekt uses sein: die Gäste waren gegangen, with waren at the end of the nachdem-clause. Hatten is impossible with gehen.',
 'seed', '{}'::jsonb),

('aabbccdd-3333-4006-0006-b20000000000', 'word_form', 5,
 'Complete with the Partizip II of "stehlen": Mein Fahrrad wurde letzte Woche ___.',
 'gestohlen',
 '{}',
 NULL,
 'Strong verb: ge- + changed stem + -en.',
 'grammar', 'grammar', 'type', 'passiv_praeteritum',
 '{}',
 'Stehlen is a strong verb with a vowel change in the participle: stehlen wird gestohlen. In the Präteritum passive: wurde gestohlen.',
 'seed', '{"baseWord": "stehlen"}'::jsonb),

('aabbccdd-3333-4006-0006-b20000000000', 'error_correction', 6,
 'Wenn ich das gewusst hätte, ich hätte dir sofort geholfen.',
 'Wenn ich das gewusst hätte, hätte ich dir sofort geholfen.',
 ARRAY['Wenn ich das gewusst hätte hätte ich dir sofort geholfen', 'Wenn ich das gewusst haette, haette ich dir sofort geholfen'],
 NULL,
 'Verb-second after the fronted wenn-clause.',
 'grammar', 'grammar', 'type', 'konjunktiv2_vergangenheit',
 '{}',
 'Past unreal conditional: both clauses use hätte + Partizip II. After the fronted wenn-clause the conjugated verb must come first in the main clause: hätte ich, not ich hätte.',
 'seed', '{"error_sentence": "Wenn ich das gewusst hätte, ich hätte dir sofort geholfen."}'::jsonb),

('aabbccdd-3333-4006-0006-b20000000000', 'sentence_transformation', 7,
 'Rewrite in the passive (leave out man): Man spricht in der Schweiz vier Sprachen.',
 'In der Schweiz werden vier Sprachen gesprochen.',
 ARRAY['Vier Sprachen werden in der Schweiz gesprochen'],
 NULL,
 'Plural subject vier Sprachen — the auxiliary must agree.',
 'grammar', 'grammar', 'type', 'passiv_praesens',
 '{}',
 'The object vier Sprachen becomes the plural subject, so the auxiliary is werden (plural): werden ... gesprochen. Man disappears entirely in the passive.',
 'seed', '{"originalSentence": "Man spricht in der Schweiz vier Sprachen.", "instruction": "Rewrite in the passive voice. Leave out man."}'::jsonb),

('aabbccdd-3333-4006-0006-b20000000000', 'sentence_construction', 8,
 'Build the German sentence: "The film that we watched yesterday was boring."',
 'Der Film, den wir gestern gesehen haben, war langweilig.',
 '{}',
 NULL,
 'Accusative masculine relative pronoun; the verb cluster closes the relative clause.',
 'grammar', 'grammar', 'tap', 'relativsatz_akkusativ',
 ARRAY['dessen'],
 'Inside the relative clause the film is the object of sehen, so the accusative masculine pronoun den is needed (the distractor dessen is genitive and cannot be the object). The Perfekt cluster gesehen haben stands at the clause end; war follows the second comma.',
 'seed', '{"distractors": ["dessen"]}'::jsonb),

('aabbccdd-3333-4006-0006-b20000000000', 'translate_to_target', 9,
 'Translate to German (formal Sie): Could you please help me with this exercise? (die Übung; helfen bei)',
 'Könnten Sie mir bitte bei dieser Übung helfen?',
 ARRAY['Könnten Sie mir bei dieser Übung bitte helfen', 'Koennten Sie mir bitte bei dieser Uebung helfen', 'Könnten Sie mir bitte bei dieser Übung helfen'],
 NULL,
 'Konjunktiv II of können + dative person + bei + dative.',
 'grammar', 'grammar', 'type', 'konjunktiv2_hoeflichkeit',
 '{}',
 'Polite requests use Konjunktiv II: Könnten Sie. Helfen takes a dative person (mir) and bei + dative for the task: bei dieser Übung. The infinitive helfen closes the sentence.',
 'seed', '{}'::jsonb);

-- ═══════════════════════════════════════════════════════════════════
-- Grammar rules reference set — German (language = 'de')
-- 5 rules per CEFR level A1-B2. B2 rule_names match the exercise
-- target_grammar prefixes above so RuleCard fuzzy lookup resolves.
-- examples shape: [{"target": "...", "native": "..."}] (RuleCard.tsx)
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO grammar_rules (language, cefr_level, rule_name, title, explanation, examples, common_errors, tags) VALUES
-- ── A1 ──────────────────────────────────────────────────────────────
('de', 'A1', 'verbzweitstellung', 'Verb-Second Word Order',
 'In a German main clause the conjugated verb is always the second element. If anything other than the subject comes first (like a time word), the subject moves behind the verb.',
 '[{"target": "Ich gehe heute ins Kino.", "native": "I am going to the cinema today."}, {"target": "Heute gehe ich ins Kino.", "native": "Today I am going to the cinema."}]'::jsonb,
 '[{"error": "Heute ich gehe ins Kino.", "correction": "Heute gehe ich ins Kino."}]'::jsonb,
 ARRAY['word_order', 'syntax', 'a1']),

('de', 'A1', 'praesens_konjugation', 'Present Tense Endings',
 'Regular verbs take these present endings: ich -e, du -st, er/sie/es -t, wir -en, ihr -t, sie/Sie -en. Find the stem by removing -en from the infinitive.',
 '[{"target": "Du wohnst in Berlin.", "native": "You live in Berlin."}, {"target": "Sie arbeitet bei einer Bank.", "native": "She works at a bank."}]'::jsonb,
 '[{"error": "Du wohnt in Berlin.", "correction": "Du wohnst in Berlin."}]'::jsonb,
 ARRAY['verbs', 'conjugation', 'a1']),

('de', 'A1', 'artikel_genus', 'Gender & Articles (der, die, das)',
 'Every German noun has a gender: masculine (der), feminine (die) or neuter (das). Gender is often unpredictable, so always learn a noun together with its article.',
 '[{"target": "der Tisch, die Lampe, das Buch", "native": "the table, the lamp, the book"}, {"target": "Das Mädchen ist klein.", "native": "The girl is small."}]'::jsonb,
 '[{"error": "Die Mädchen ist klein.", "correction": "Das Mädchen ist klein."}]'::jsonb,
 ARRAY['nouns', 'articles', 'gender', 'a1']),

('de', 'A1', 'verneinung_nicht_kein', 'Negation: nicht vs. kein',
 'Kein negates nouns that have an indefinite article or no article: kein Auto. Nicht negates verbs, adjectives, and specific parts of a sentence: Ich arbeite nicht.',
 '[{"target": "Ich habe kein Auto.", "native": "I do not have a car."}, {"target": "Ich arbeite heute nicht.", "native": "I am not working today."}]'::jsonb,
 '[{"error": "Ich habe nicht ein Auto.", "correction": "Ich habe kein Auto."}]'::jsonb,
 ARRAY['negation', 'a1']),

('de', 'A1', 'ja_nein_fragen', 'Yes/No Questions',
 'Yes/no questions start with the conjugated verb, followed by the subject: Wohnst du in Berlin? No helper word like English "do" is needed.',
 '[{"target": "Wohnst du in Berlin?", "native": "Do you live in Berlin?"}, {"target": "Haben Sie Zeit?", "native": "Do you have time?"}]'::jsonb,
 '[{"error": "Du wohnst in Berlin?", "correction": "Wohnst du in Berlin?"}]'::jsonb,
 ARRAY['questions', 'word_order', 'a1']),

-- ── A2 ──────────────────────────────────────────────────────────────
('de', 'A2', 'perfekt_haben_sein', 'Perfekt with haben or sein',
 'The Perfekt uses haben or sein plus the past participle. Sein is for verbs of motion (gehen, fahren) and change of state (aufwachen); most other verbs take haben.',
 '[{"target": "Ich bin nach Hause gegangen.", "native": "I went home."}, {"target": "Ich habe Pizza gegessen.", "native": "I ate pizza."}]'::jsonb,
 '[{"error": "Ich habe nach Hause gegangen.", "correction": "Ich bin nach Hause gegangen."}]'::jsonb,
 ARRAY['perfekt', 'past_tense', 'auxiliaries', 'a2']),

('de', 'A2', 'modalverben', 'Modal Verbs + Infinitive',
 'Modal verbs (können, müssen, wollen, dürfen, sollen, mögen) take position two; the main verb goes to the end as a bare infinitive without zu.',
 '[{"target": "Ich kann heute nicht kommen.", "native": "I cannot come today."}, {"target": "Wir müssen morgen früh aufstehen.", "native": "We have to get up early tomorrow."}]'::jsonb,
 '[{"error": "Ich kann heute nicht zu kommen.", "correction": "Ich kann heute nicht kommen."}]'::jsonb,
 ARRAY['modal_verbs', 'word_order', 'a2']),

('de', 'A2', 'trennbare_verben', 'Separable Verbs',
 'Separable prefixes (auf-, an-, ein-, mit- ...) split off and move to the end of a main clause: aufstehen becomes Ich stehe ... auf. In subordinate clauses the verb stays whole.',
 '[{"target": "Ich stehe um sieben Uhr auf.", "native": "I get up at seven."}, {"target": "Er ruft mich morgen an.", "native": "He will call me tomorrow."}]'::jsonb,
 '[{"error": "Ich aufstehe um sieben Uhr.", "correction": "Ich stehe um sieben Uhr auf."}]'::jsonb,
 ARRAY['separable_verbs', 'word_order', 'a2']),

('de', 'A2', 'akkusativ_dativ', 'Accusative & Dative Objects',
 'The direct object takes accusative (den/die/das/einen), the indirect object (recipient) takes dative (dem/der/dem/einem). Verbs like geben and schenken take both.',
 '[{"target": "Ich gebe dem Kind den Ball.", "native": "I give the child the ball."}, {"target": "Sie hilft ihrem Bruder.", "native": "She helps her brother."}]'::jsonb,
 '[{"error": "Ich gebe das Kind den Ball.", "correction": "Ich gebe dem Kind den Ball."}]'::jsonb,
 ARRAY['cases', 'accusative', 'dative', 'a2']),

('de', 'A2', 'komparativ_superlativ', 'Comparative & Superlative',
 'Add -er for the comparative and am ...-sten for the superlative; many one-syllable adjectives take an umlaut (groß, größer, am größten). Use als after a comparative — never "mehr" + adjective.',
 '[{"target": "Berlin ist größer als Bonn.", "native": "Berlin is bigger than Bonn."}, {"target": "Der Winter ist am kältesten.", "native": "Winter is the coldest."}]'::jsonb,
 '[{"error": "Berlin ist mehr groß als Bonn.", "correction": "Berlin ist größer als Bonn."}]'::jsonb,
 ARRAY['adjectives', 'comparison', 'a2']),

-- ── B1 ──────────────────────────────────────────────────────────────
('de', 'B1', 'nebensatz_verbletztstellung', 'Subordinate Clauses: Verb Last',
 'Conjunctions like weil, dass, wenn, ob and als send the conjugated verb to the end of their clause. If the subordinate clause comes first, the main clause starts with its verb.',
 '[{"target": "Ich bleibe zu Hause, weil ich krank bin.", "native": "I am staying home because I am sick."}, {"target": "Wenn es regnet, nehmen wir den Bus.", "native": "If it rains, we take the bus."}]'::jsonb,
 '[{"error": "Ich bleibe zu Hause, weil ich bin krank.", "correction": "Ich bleibe zu Hause, weil ich krank bin."}]'::jsonb,
 ARRAY['subordinate_clauses', 'word_order', 'b1']),

('de', 'B1', 'praeteritum', 'Simple Past (Präteritum)',
 'The Präteritum is the narrative past, standard in writing. Regular verbs add -te (machte); strong verbs change their stem vowel (gehen wird ging, fahren wird fuhr). Haben, sein and the modals prefer Präteritum even in speech.',
 '[{"target": "Er ging nach Hause und hatte keine Zeit.", "native": "He went home and had no time."}, {"target": "Wir waren gestern im Kino.", "native": "We were at the cinema yesterday."}]'::jsonb,
 '[{"error": "Er gehte nach Hause.", "correction": "Er ging nach Hause."}]'::jsonb,
 ARRAY['past_tense', 'praeteritum', 'b1']),

('de', 'B1', 'reflexive_verben', 'Reflexive Verbs',
 'Many German verbs need a reflexive pronoun that English drops: sich freuen, sich erinnern, sich beeilen. The pronoun agrees with the subject (ich freue mich, du freust dich).',
 '[{"target": "Ich freue mich auf das Wochenende.", "native": "I am looking forward to the weekend."}, {"target": "Er erinnert sich an den Urlaub.", "native": "He remembers the vacation."}]'::jsonb,
 '[{"error": "Ich freue auf das Wochenende.", "correction": "Ich freue mich auf das Wochenende."}]'::jsonb,
 ARRAY['reflexive', 'verbs', 'b1']),

('de', 'B1', 'wechselpraepositionen', 'Two-Way Prepositions',
 'In, an, auf, über, unter, vor, hinter, neben and zwischen take accusative for movement toward a goal (wohin?) and dative for location (wo?).',
 '[{"target": "Ich lege das Buch auf den Tisch.", "native": "I put the book onto the table."}, {"target": "Das Buch liegt auf dem Tisch.", "native": "The book is lying on the table."}]'::jsonb,
 '[{"error": "Ich lege das Buch auf dem Tisch.", "correction": "Ich lege das Buch auf den Tisch."}]'::jsonb,
 ARRAY['prepositions', 'cases', 'b1']),

('de', 'B1', 'adjektivdeklination', 'Adjective Endings',
 'Adjectives before a noun take endings that depend on the article, gender, number and case: der kleine Hund, but ein kleiner Hund. After der-words use -e/-en; after ein-words the adjective shows the gender signal.',
 '[{"target": "Der kleine Hund schläft.", "native": "The small dog is sleeping."}, {"target": "Ein kleiner Hund schläft.", "native": "A small dog is sleeping."}]'::jsonb,
 '[{"error": "Ein kleine Hund schläft.", "correction": "Ein kleiner Hund schläft."}]'::jsonb,
 ARRAY['adjectives', 'declension', 'b1']),

-- ── B2 ── (rule_names match exercise target_grammar prefixes) ──────
('de', 'B2', 'konjunktiv2', 'Konjunktiv II: Unreal & Polite',
 'Konjunktiv II expresses unreal conditions, wishes and polite requests. Use hätte, wäre, and modal forms like könnte directly; most other verbs use würde + infinitive. Past unreal: hätte/wäre + Partizip II.',
 '[{"target": "Wenn ich Zeit hätte, würde ich dir helfen.", "native": "If I had time, I would help you."}, {"target": "Könnten Sie mir bitte helfen?", "native": "Could you please help me?"}]'::jsonb,
 '[{"error": "Wenn ich Zeit hätte, ich würde dir helfen.", "correction": "Wenn ich Zeit hätte, würde ich dir helfen."}, {"error": "Wenn ich Zeit habe, würde ich dir helfen.", "correction": "Wenn ich Zeit hätte, würde ich dir helfen."}]'::jsonb,
 ARRAY['konjunktiv', 'conditional', 'politeness', 'b2']),

('de', 'B2', 'konjunktiv1_indirekte_rede', 'Konjunktiv I: Reported Speech',
 'Formal reported speech uses Konjunktiv I: infinitive stem + -e (er habe, er könne); sein has the full paradigm sei/seien. Shift pronouns to the reporter''s perspective. If Konjunktiv I looks identical to the indicative, Konjunktiv II steps in.',
 '[{"target": "Er sagt, er habe keine Zeit.", "native": "He says he has no time."}, {"target": "Sie sagte, sie sei krank.", "native": "She said she was ill."}]'::jsonb,
 '[{"error": "Er sagt, er hat keine Zeit. (formal writing)", "correction": "Er sagt, er habe keine Zeit."}, {"error": "Anna sagt, ich sei krank. (when reporting what Anna said)", "correction": "Anna sagt, sie sei krank."}]'::jsonb,
 ARRAY['konjunktiv', 'reported_speech', 'b2']),

('de', 'B2', 'passiv', 'The Passive Voice',
 'The Vorgangspassiv is werden + Partizip II: wird gebaut, wurde gebaut, ist gebaut worden. With modals: modal + Partizip II + werden. The agent takes von + dative; man-sentences drop man entirely.',
 '[{"target": "Das Haus wurde 1950 gebaut.", "native": "The house was built in 1950."}, {"target": "Der Bericht muss geschrieben werden.", "native": "The report must be written."}]'::jsonb,
 '[{"error": "Das Haus wurde gebaut worden.", "correction": "Das Haus wurde gebaut. / Das Haus ist gebaut worden."}, {"error": "Der Bericht muss geschrieben wird.", "correction": "Der Bericht muss geschrieben werden."}]'::jsonb,
 ARRAY['passive', 'werden', 'b2']),

('de', 'B2', 'relativsatz', 'Relative Clauses',
 'The relative pronoun matches its antecedent in gender and number, but takes its case from its role inside the clause. Genitive dessen/deren shows possession. Prepositions stand before the pronoun (mit dem, über den). The verb goes to the clause end.',
 '[{"target": "Der Mann, dem ich geholfen habe, ist mein Nachbar.", "native": "The man whom I helped is my neighbor."}, {"target": "Die Frau, deren Auto gestohlen wurde, ruft die Polizei.", "native": "The woman whose car was stolen calls the police."}]'::jsonb,
 '[{"error": "Der Mann, den ich geholfen habe, ...", "correction": "Der Mann, dem ich geholfen habe, ... (helfen + dative)"}]'::jsonb,
 ARRAY['relative_clauses', 'pronouns', 'cases', 'b2']),

('de', 'B2', 'plusquamperfekt', 'Plusquamperfekt & nachdem',
 'The Plusquamperfekt (hatte/war + Partizip II) marks an event before another past event. After nachdem it is obligatory: Nachdem-clause in Plusquamperfekt, main clause in Präteritum or Perfekt, with the verb directly after the comma.',
 '[{"target": "Nachdem wir gegessen hatten, gingen wir spazieren.", "native": "After we had eaten, we went for a walk."}, {"target": "Der Zug war schon abgefahren, als wir ankamen.", "native": "The train had already left when we arrived."}]'::jsonb,
 '[{"error": "Nachdem wir gegessen haben, gingen wir spazieren.", "correction": "Nachdem wir gegessen hatten, gingen wir spazieren."}, {"error": "Nachdem wir gegessen hatten, wir gingen spazieren.", "correction": "Nachdem wir gegessen hatten, gingen wir spazieren."}]'::jsonb,
 ARRAY['plusquamperfekt', 'past_tense', 'temporal_clauses', 'b2'])

ON CONFLICT (language, rule_name) DO UPDATE SET
  cefr_level = EXCLUDED.cefr_level,
  title = EXCLUDED.title,
  explanation = EXCLUDED.explanation,
  examples = EXCLUDED.examples,
  common_errors = EXCLUDED.common_errors,
  tags = EXCLUDED.tags;

COMMIT;
