-- ═══════════════════════════════════════════════════════════════════════════
-- Spanish B2 "Complex Grammar" unit rebuild + grammar_rules reference set
-- Replaces the template exercises (which taught grammar TERMINOLOGY as vocab)
-- with real grammar practice following research.md §4.2 (Focus on Form),
-- §7 (explicit + production), §10 (metalinguistic feedback).
--
-- Progression per lesson: recognition (multiple_choice) → structured input
-- (fill_blank / cloze_deletion) → production (word_form, transformation,
-- error_correction, construction, translation).
--
-- All distractors and error-correction traps were verified against
-- lib/grading.ts fuzzy matching: every wrong option/typed error form is
-- > maxAllowedDistance (Levenshtein 1 for len<=4, else 2) from the correct
-- answer and all accepted_answers, so a wrong choice can never grade correct.
--
-- STAGED SEED — do not run automatically. Apply manually after review.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── Unit ────────────────────────────────────────────────────────────────────
UPDATE units
SET description = 'B2 grammar in use: subjunctive, conditionals, reported speech, passive «se», and relative clauses'
WHERE id = 'aabbccdd-1111-4006-0000-b20000000000';

-- ═══════════════════════════════════════════════════════════════════════════
-- Lesson 1 (order_index 0): El subjuntivo: cláusulas sustantivas
-- target_grammar: subjunctive_noun_clauses
-- ═══════════════════════════════════════════════════════════════════════════
UPDATE lessons
SET title = 'El subjuntivo: cláusulas sustantivas',
    description = 'Subjunctive after wish, emotion, doubt and impersonal expressions (quiero que vengas)'
WHERE id = 'aabbccdd-1111-4006-0001-b20000000000';

DELETE FROM exercises WHERE lesson_id = 'aabbccdd-1111-4006-0001-b20000000000';

INSERT INTO exercises (lesson_id, type, order_index, prompt, correct_answer, accepted_answers, options, hint_text, skill_type, subskill, response_mode, target_grammar, distractors, explanation, source_type, metadata) VALUES
-- 0: recognition
('aabbccdd-1111-4006-0001-b20000000000', 'multiple_choice', 0,
 'Quiero que ___ al médico esta semana.',
 'vayas', ARRAY[]::text[],
 ARRAY['vayas','vas','irás','ir'],
 'After «querer que» + a different subject, which mood follows?',
 'grammar', 'grammar', 'tap', 'subjunctive_noun_clauses',
 ARRAY['vas','irás','ir'],
 '«Querer que» expresses a wish about another person, so the verb in the que-clause takes the present subjunctive: vayas. The indicative «vas» states a fact, and the infinitive is only possible with no change of subject (quiero ir).',
 'manual', '{}'::jsonb),
-- 1: recognition
('aabbccdd-1111-4006-0001-b20000000000', 'multiple_choice', 1,
 'Choose the correct sentence.',
 'Dudo que tenga tiempo hoy.', ARRAY[]::text[],
 ARRAY['Dudo que tenga tiempo hoy.','Dudo que tiene tiempo hoy.','Dudo que tendrá tiempo hoy.','Dudo que teniendo tiempo hoy.'],
 '«Dudar que» expresses doubt — doubt triggers a mood change in the que-clause.',
 'grammar', 'grammar', 'tap', 'subjunctive_noun_clauses',
 ARRAY['Dudo que tiene tiempo hoy.','Dudo que tendrá tiempo hoy.','Dudo que teniendo tiempo hoy.'],
 'Verbs of doubt or denial («dudar que», «negar que») require the subjunctive in the following clause: tenga. The indicative (tiene, tendrá) presents the information as a fact, which contradicts the meaning of doubt.',
 'manual', '{}'::jsonb),
-- 2: recognition
('aabbccdd-1111-4006-0001-b20000000000', 'multiple_choice', 2,
 'No creo que ___ una buena idea.',
 'sea', ARRAY[]::text[],
 ARRAY['sea','es','será','siendo'],
 '«Creer» is negated here — does «no creer que» take indicative or subjunctive?',
 'grammar', 'grammar', 'tap', 'subjunctive_noun_clauses',
 ARRAY['es','será','siendo'],
 '«Creo que» takes the indicative, but negated belief («no creo que») expresses doubt and requires the subjunctive: sea. Compare: Creo que es buena idea / No creo que sea buena idea.',
 'manual', '{}'::jsonb),
-- 3: structured input
('aabbccdd-1111-4006-0001-b20000000000', 'fill_blank', 3,
 'Mis padres quieren que yo ___ al gimnasio con ellos. (ir)',
 'vaya', ARRAY[]::text[], NULL,
 'Trigger: «querer que» + change of subject. Give the present subjunctive of «ir».',
 'grammar', 'grammar', 'type', 'subjunctive_noun_clauses',
 ARRAY[]::text[],
 '«Quieren que» introduces a wish about someone else, so the verb goes to the present subjunctive. «Ir» is completely irregular in the present subjunctive: vaya — the indicative «voy» never fits after «querer que».',
 'manual', '{}'::jsonb),
-- 4: structured input
('aabbccdd-1111-4006-0001-b20000000000', 'fill_blank', 4,
 'Es importante que los estudiantes ___ a clase a tiempo. (venir)',
 'vengan', ARRAY[]::text[], NULL,
 'Impersonal judgement «es importante que» — which mood? The subject is «los estudiantes».',
 'grammar', 'grammar', 'type', 'subjunctive_noun_clauses',
 ARRAY[]::text[],
 'Impersonal expressions of judgement («es importante/necesario/mejor que») trigger the subjunctive. «Venir» builds its subjunctive on the irregular yo-form vengo → vengan (third person plural).',
 'manual', '{}'::jsonb),
-- 5: structured input
('aabbccdd-1111-4006-0001-b20000000000', 'cloze_deletion', 5,
 'Es una pena que Luis no ___ a la cena de mañana. (ir)',
 'vaya', ARRAY[]::text[], NULL,
 'Emotion («es una pena que») triggers which mood?',
 'grammar', 'grammar', 'type', 'subjunctive_noun_clauses',
 ARRAY[]::text[],
 'Expressions of emotion or regret («es una pena que», «me alegro de que», «siento que») take the subjunctive: vaya. Spanish marks the mood even when the content is a fact, unlike English.',
 'manual', '{}'::jsonb),
-- 6: production
('aabbccdd-1111-4006-0001-b20000000000', 'word_form', 6,
 'Es fundamental que los alumnos ___ estas reglas antes del examen.',
 'sepan', ARRAY[]::text[], NULL,
 '«Es fundamental que» + new subject → present subjunctive of «saber» (irregular).',
 'grammar', 'grammar', 'type', 'subjunctive_noun_clauses',
 ARRAY[]::text[],
 '«Saber» has an irregular present subjunctive stem: sep-. After the impersonal trigger «es fundamental que», use sepan for «los alumnos». The indicative «saben» would present it as a fact, not a demand.',
 'manual', '{"baseWord": "saber"}'::jsonb),
-- 7: production
('aabbccdd-1111-4006-0001-b20000000000', 'error_correction', 7,
 'Espero que tienes un buen viaje mañana.',
 'Espero que tengas un buen viaje mañana.', ARRAY[]::text[], NULL,
 '«Esperar que» expresses hope — check the mood of the second verb.',
 'grammar', 'grammar', 'type', 'subjunctive_noun_clauses',
 ARRAY[]::text[],
 '«Esperar que» (hope) triggers the subjunctive, so «tienes» must become tengas. English keeps the indicative here (I hope you have...), which is why this is a classic transfer error.',
 'manual', '{"error_sentence": "Espero que tienes un buen viaje mañana."}'::jsonb),
-- 8: production
('aabbccdd-1111-4006-0001-b20000000000', 'sentence_construction', 8,
 'Build the Spanish sentence: "I want you to come with us."',
 'Quiero que vengas con nosotros', ARRAY[]::text[], NULL,
 'English uses an infinitive ("you to come"); Spanish needs «que» + a conjugated mood.',
 'grammar', 'grammar', 'tap', 'subjunctive_noun_clauses',
 ARRAY['vienes','venir'],
 'Spanish cannot copy the English "want you to come" infinitive structure. With a change of subject, use «querer que» + present subjunctive: Quiero que vengas con nosotros.',
 'manual', '{"tiles": ["Quiero","que","vengas","con","nosotros"], "distractors": ["vienes","venir"]}'::jsonb),
-- 9: production
('aabbccdd-1111-4006-0001-b20000000000', 'translate_to_target', 9,
 'Translate to Spanish: "I doubt that he has the money."',
 'Dudo que tenga el dinero', ARRAY['Dudo que él tenga el dinero','Dudo de que tenga el dinero','Dudo de que él tenga el dinero','Yo dudo que tenga el dinero','Yo dudo que él tenga el dinero'], NULL,
 '«Dudar que» → subjunctive. "To have money" = tener dinero.',
 'grammar', 'grammar', 'type', 'subjunctive_noun_clauses',
 ARRAY[]::text[],
 'Doubt triggers the subjunctive: dudo que tenga (not tiene). The subject pronoun «él» is optional because the verb ending already marks the person.',
 'manual', '{}'::jsonb);

-- ═══════════════════════════════════════════════════════════════════════════
-- Lesson 2 (order_index 1): Las oraciones condicionales (si...)
-- target_grammar: si_clauses
-- ═══════════════════════════════════════════════════════════════════════════
UPDATE lessons
SET title = 'Las oraciones condicionales',
    description = 'Real and hypothetical si-clauses: si tengo / si tuviera / si hubiera tenido'
WHERE id = 'aabbccdd-1111-4006-0002-b20000000000';

DELETE FROM exercises WHERE lesson_id = 'aabbccdd-1111-4006-0002-b20000000000';

INSERT INTO exercises (lesson_id, type, order_index, prompt, correct_answer, accepted_answers, options, hint_text, skill_type, subskill, response_mode, target_grammar, distractors, explanation, source_type, metadata) VALUES
-- 0: recognition
('aabbccdd-1111-4006-0002-b20000000000', 'multiple_choice', 0,
 'Si ___ más dinero, compraría una casa en la playa.',
 'tuviera', ARRAY[]::text[],
 ARRAY['tuviera','tenía','tendría','tenga'],
 'Hypothetical si-clause: «compraría» (conditional) in the main clause — which form goes after «si»?',
 'grammar', 'grammar', 'tap', 'si_clauses',
 ARRAY['tenía','tendría','tenga'],
 'Unreal or hypothetical conditions use «si» + imperfect subjunctive with a conditional main clause: Si tuviera..., compraría. Never use the conditional (tendría) or present subjunctive (tenga) directly after «si».',
 'manual', '{}'::jsonb),
-- 1: recognition
('aabbccdd-1111-4006-0002-b20000000000', 'multiple_choice', 1,
 'Choose the correct sentence.',
 'Si hubiera estudiado más, habría aprobado el examen.', ARRAY[]::text[],
 ARRAY['Si hubiera estudiado más, habría aprobado el examen.','Si habría estudiado más, habría aprobado el examen.','Si estudiaría más, habría aprobado el examen.','Si había estudiado más, habría aprobado el examen.'],
 'Third conditional (past unreal): «si» + pluperfect subjunctive, conditional perfect in the main clause.',
 'grammar', 'grammar', 'tap', 'si_clauses',
 ARRAY['Si habría estudiado más, habría aprobado el examen.','Si estudiaría más, habría aprobado el examen.','Si había estudiado más, habría aprobado el examen.'],
 'Past unreal conditions take «si» + hubiera + participle, with habría + participle in the result clause. The conditional (habría) never appears inside the si-clause itself — a very common error, even among native speakers.',
 'manual', '{}'::jsonb),
-- 2: recognition
('aabbccdd-1111-4006-0002-b20000000000', 'multiple_choice', 2,
 'Si ___ buen tiempo el sábado, iremos a la sierra.',
 'hace', ARRAY[]::text[],
 ARRAY['hace','haga','hiciera','hará'],
 'This is a real, likely condition — «si» + which mood and tense?',
 'grammar', 'grammar', 'tap', 'si_clauses',
 ARRAY['haga','hiciera','hará'],
 'Real conditions about the future use «si» + present indicative: Si hace buen tiempo, iremos. Spanish never uses the future (hará) or the present subjunctive (haga) after «si» in this pattern.',
 'manual', '{}'::jsonb),
-- 3: structured input
('aabbccdd-1111-4006-0002-b20000000000', 'fill_blank', 3,
 'Si ___ rico, no trabajaría ni un día más. (ser, yo)',
 'fuera', ARRAY['fuese'], NULL,
 'Hypothetical: the main clause has «trabajaría». Imperfect subjunctive of «ser» — both -ra and -se forms are valid.',
 'grammar', 'grammar', 'type', 'si_clauses',
 ARRAY[]::text[],
 'Unreal present conditions need the imperfect subjunctive after «si»: fuera (or fuese) — never «si sería». Note that «ser» and «ir» share this form: fuera.',
 'manual', '{}'::jsonb),
-- 4: structured input
('aabbccdd-1111-4006-0002-b20000000000', 'fill_blank', 4,
 'Si me lo ___ antes, te habría ayudado con la mudanza. (decir, tú)',
 'hubieras dicho', ARRAY['hubieses dicho'], NULL,
 'Past unreal condition: «si» + pluperfect subjunctive (haber + participle).',
 'grammar', 'grammar', 'type', 'si_clauses',
 ARRAY[]::text[],
 'The help never happened because the telling never happened: a past unreal condition. Use «si» + hubieras/hubieses + dicho. «Decir» has the irregular participle dicho.',
 'manual', '{}'::jsonb),
-- 5: structured input
('aabbccdd-1111-4006-0002-b20000000000', 'cloze_deletion', 5,
 '¿Qué harías si ___ un millón de euros? (tener, tú)',
 'tuvieras', ARRAY['tuvieses'], NULL,
 'The question uses «harías» (conditional), so the si-clause needs the imperfect subjunctive.',
 'grammar', 'grammar', 'type', 'si_clauses',
 ARRAY[]::text[],
 'With a conditional main verb (harías), the si-clause takes the imperfect subjunctive: tuvieras/tuvieses. «Si tendrías» is a well-known error — the conditional never follows «si» here.',
 'manual', '{}'::jsonb),
-- 6: production
('aabbccdd-1111-4006-0002-b20000000000', 'sentence_transformation', 6,
 'Rewrite as one hypothetical sentence starting with «Si...»: No tengo tiempo, así que no voy al gimnasio.',
 'Si tuviera tiempo, iría al gimnasio', ARRAY['Si tuviera tiempo iría al gimnasio','Si tuviese tiempo, iría al gimnasio','Si tuviese tiempo iría al gimnasio','Si yo tuviera tiempo, iría al gimnasio','Si yo tuviera tiempo iría al gimnasio','Si yo tuviese tiempo, iría al gimnasio','Si yo tuviese tiempo iría al gimnasio'], NULL,
 'Flip the real situation into its unreal mirror: imperfect subjunctive + conditional.',
 'grammar', 'grammar', 'type', 'si_clauses',
 ARRAY[]::text[],
 'A real negative fact becomes an unreal positive hypothesis: Si tuviera tiempo (imperfect subjunctive), iría (conditional). Both verbs must change — a common slip is leaving one in the indicative.',
 'manual', '{"originalSentence": "No tengo tiempo, así que no voy al gimnasio.", "instruction": "Rewrite as one hypothetical sentence starting with «Si...»"}'::jsonb),
-- 7: production
('aabbccdd-1111-4006-0002-b20000000000', 'error_correction', 7,
 'Si tendría más tiempo, aprendería a tocar el piano.',
 'Si tuviera más tiempo, aprendería a tocar el piano.', ARRAY['Si tuviese más tiempo, aprendería a tocar el piano','Si tuviera más tiempo aprendería a tocar el piano','Si tuviese más tiempo aprendería a tocar el piano'], NULL,
 'One verb is in an impossible form — remember: the conditional never follows «si».',
 'grammar', 'grammar', 'type', 'si_clauses',
 ARRAY[]::text[],
 '«Si tendría» is ungrammatical: after «si» in hypothetical conditions Spanish requires the imperfect subjunctive (tuviera/tuviese). The conditional belongs only in the main clause (aprendería).',
 'manual', '{"error_sentence": "Si tendría más tiempo, aprendería a tocar el piano."}'::jsonb),
-- 8: production
('aabbccdd-1111-4006-0002-b20000000000', 'sentence_construction', 8,
 'Build the Spanish sentence: "If I had known, I would have called you."',
 'Si lo hubiera sabido te habría llamado', ARRAY['Te habría llamado si lo hubiera sabido'], NULL,
 'Past unreal: hubiera + participle after «si»; habría + participle in the result.',
 'grammar', 'grammar', 'tap', 'si_clauses',
 ARRAY['llamaría','sabré'],
 'Third-conditional pattern: si + hubiera sabido (pluperfect subjunctive) and habría llamado (conditional perfect). «Lo» stands for the thing known and goes right after «si».',
 'manual', '{"tiles": ["Si","lo","hubiera","sabido","te","habría","llamado"], "distractors": ["llamaría","sabré"]}'::jsonb),
-- 9: production
('aabbccdd-1111-4006-0002-b20000000000', 'translate_to_target', 9,
 'Translate to Spanish: "If it rains tomorrow, we will stay at home."',
 'Si llueve mañana, nos quedaremos en casa', ARRAY['Si llueve mañana nos quedaremos en casa','Si mañana llueve, nos quedaremos en casa','Si mañana llueve nos quedaremos en casa','Si llueve mañana, nos quedamos en casa','Si llueve mañana nos quedamos en casa','Si mañana llueve, nos quedamos en casa','Si mañana llueve nos quedamos en casa'], NULL,
 'Real future condition: «si» + present indicative, future (or present) in the main clause.',
 'grammar', 'grammar', 'type', 'si_clauses',
 ARRAY[]::text[],
 'Even for future events, the si-clause stays in the present indicative: si llueve (never «si lloverá»). The main clause takes the future (nos quedaremos) or a colloquial present.',
 'manual', '{}'::jsonb);

-- ═══════════════════════════════════════════════════════════════════════════
-- Lesson 3 (order_index 2): El estilo indirecto
-- target_grammar: reported_speech
-- ═══════════════════════════════════════════════════════════════════════════
UPDATE lessons
SET title = 'El estilo indirecto',
    description = 'Reported speech: tense backshift, reported questions and commands'
WHERE id = 'aabbccdd-1111-4006-0003-b20000000000';

DELETE FROM exercises WHERE lesson_id = 'aabbccdd-1111-4006-0003-b20000000000';

INSERT INTO exercises (lesson_id, type, order_index, prompt, correct_answer, accepted_answers, options, hint_text, skill_type, subskill, response_mode, target_grammar, distractors, explanation, source_type, metadata) VALUES
-- 0: recognition
('aabbccdd-1111-4006-0003-b20000000000', 'multiple_choice', 0,
 '«Estoy cansada». → Ana dijo que ___ cansada.',
 'estaba', ARRAY[]::text[],
 ARRAY['estaba','estuviera','estuvo','esté'],
 'Backshift: a present tense in the quote → which past tense in the report?',
 'grammar', 'grammar', 'tap', 'reported_speech',
 ARRAY['estuviera','estuvo','esté'],
 'After a past reporting verb (dijo), a quoted present backshifts to the imperfect: estoy → estaba. The preterite (estuvo) would change the meaning to a finished event, and the subjunctives (esté, estuviera) have no trigger in a reported statement.',
 'manual', '{}'::jsonb),
-- 1: recognition
('aabbccdd-1111-4006-0003-b20000000000', 'multiple_choice', 1,
 'Yesterday Juan said: «Vendré mañana». Choose the correct report.',
 'Juan dijo que vendría al día siguiente.', ARRAY[]::text[],
 ARRAY['Juan dijo que vendría al día siguiente.','Juan dijo que vendré mañana.','Juan dijo que viniera al día siguiente.','Juan dice que vendrá mañana.'],
 'Two things change in reports from yesterday: the tense (future → ?) and the time word «mañana».',
 'grammar', 'grammar', 'tap', 'reported_speech',
 ARRAY['Juan dijo que vendré mañana.','Juan dijo que viniera al día siguiente.','Juan dice que vendrá mañana.'],
 'A quoted future backshifts to the conditional: vendré → vendría. Time expressions also shift once the moment has passed: mañana → al día siguiente. Present reporting (dice... vendrá) contradicts "yesterday said".',
 'manual', '{}'::jsonb),
-- 2: recognition
('aabbccdd-1111-4006-0003-b20000000000', 'multiple_choice', 2,
 '«Cierra la ventana, por favor». → Mi madre me pidió que ___ la ventana.',
 'cerrara', ARRAY[]::text[],
 ARRAY['cerrara','cierra','cerró','iba a cerrar'],
 'Reported commands: «pedir que» + which mood (after a past reporting verb)?',
 'grammar', 'grammar', 'tap', 'reported_speech',
 ARRAY['cierra','cerró','iba a cerrar'],
 'Commands are reported with «pedir/decir que» + subjunctive. Because the reporting verb is past (pidió), use the imperfect subjunctive: cerrara (or cerrase). The imperative itself never survives in reported speech.',
 'manual', '{}'::jsonb),
-- 3: structured input
('aabbccdd-1111-4006-0003-b20000000000', 'fill_blank', 3,
 '«Vivo en Madrid». → Elena dijo que ___ en Madrid, pero ya no vive allí. (vivir)',
 'vivía', ARRAY[]::text[], NULL,
 'Backshift: present → imperfect after «dijo».',
 'grammar', 'grammar', 'type', 'reported_speech',
 ARRAY[]::text[],
 'Present-tense quotes backshift to the imperfect after a past reporting verb: vivo → vivía. Since she no longer lives there, keeping the present («dijo que vive») is impossible here.',
 'manual', '{}'::jsonb),
-- 4: structured input
('aabbccdd-1111-4006-0003-b20000000000', 'fill_blank', 4,
 '«He perdido las llaves». → Carlos dijo que ___ las llaves, aunque ya las ha encontrado. (perder)',
 'había perdido', ARRAY[]::text[], NULL,
 'Backshift: present perfect (he perdido) → pluperfect.',
 'grammar', 'grammar', 'type', 'reported_speech',
 ARRAY[]::text[],
 'The present perfect backshifts to the pluperfect in reported speech: he perdido → había perdido. The auxiliary «haber» carries the tense change; the participle (perdido) never changes. Since the keys have already turned up, «ha perdido» no longer holds.',
 'manual', '{}'::jsonb),
-- 5: structured input
('aabbccdd-1111-4006-0003-b20000000000', 'cloze_deletion', 5,
 '«¿Estás bien?» → Ayer mi amigo me preguntó si ___ bien. (estar)',
 'estaba', ARRAY[]::text[], NULL,
 'Reported yes/no questions use «si» + backshifted indicative — no question marks, no subjunctive.',
 'grammar', 'grammar', 'type', 'reported_speech',
 ARRAY[]::text[],
 'Yes/no questions are reported with «preguntar si» + indicative. The quoted present (estás) backshifts to the imperfect: estaba. Unlike reported commands, reported questions never take the subjunctive.',
 'manual', '{}'::jsonb),
-- 6: production
('aabbccdd-1111-4006-0003-b20000000000', 'sentence_transformation', 6,
 'Report this, starting with «Marta dijo que...» (the meeting already took place): «No puedo ir a la reunión».',
 'Marta dijo que no podía ir a la reunión', ARRAY['Dijo que no podía ir a la reunión'], NULL,
 'Backshift «puedo» to the imperfect. Keep the negative.',
 'grammar', 'grammar', 'type', 'reported_speech',
 ARRAY[]::text[],
 'The present «puedo» backshifts to the imperfect «podía» after the past reporting verb — the meeting is over, so the present is impossible. Everything else stays in place: Marta dijo que no podía ir a la reunión.',
 'manual', '{"originalSentence": "«No puedo ir a la reunión».", "instruction": "Report it, starting with «Marta dijo que...». The meeting already took place."}'::jsonb),
-- 7: production
('aabbccdd-1111-4006-0003-b20000000000', 'error_correction', 7,
 'En 2010 Luis dijo que tiene veinte años.',
 'En 2010 Luis dijo que tenía veinte años.', ARRAY[]::text[], NULL,
 'The reporting verb is past — check the tense in the que-clause.',
 'grammar', 'grammar', 'type', 'reported_speech',
 ARRAY[]::text[],
 'After «dijo», the quoted present (tengo) must backshift to the imperfect: tenía. Keeping «tiene» would mean Luis is still twenty today — impossible for something said back in 2010.',
 'manual', '{"error_sentence": "En 2010 Luis dijo que tiene veinte años."}'::jsonb),
-- 8: production
('aabbccdd-1111-4006-0003-b20000000000', 'sentence_construction', 8,
 'Build the reported sentence for: «Compraré el pan» (said by Mamá, yesterday).',
 'Mamá dijo que compraría el pan', ARRAY[]::text[], NULL,
 'Future in the quote → conditional in the report.',
 'grammar', 'grammar', 'tap', 'reported_speech',
 ARRAY['compra','compró'],
 'A quoted future (compraré) becomes a conditional (compraría) after a past reporting verb: Mamá dijo que compraría el pan.',
 'manual', '{"tiles": ["Mamá","dijo","que","compraría","el","pan"], "distractors": ["compra","compró"]}'::jsonb),
-- 9: production
('aabbccdd-1111-4006-0003-b20000000000', 'translate_to_target', 9,
 'Translate, reporting the statement: "She said that she was tired."',
 'Dijo que estaba cansada', ARRAY['Ella dijo que estaba cansada'], NULL,
 '"Said that..." → dijo que + imperfect.',
 'grammar', 'grammar', 'type', 'reported_speech',
 ARRAY[]::text[],
 'English "was tired" maps to the Spanish imperfect in reports: estaba cansada. The preterite (estuvo) would present the tiredness as a closed, completed event rather than a state.',
 'manual', '{}'::jsonb);

-- ═══════════════════════════════════════════════════════════════════════════
-- Lesson 4 (order_index 3): La pasiva y el «se» impersonal
-- target_grammar: passive_impersonal_se
-- ═══════════════════════════════════════════════════════════════════════════
UPDATE lessons
SET title = 'La pasiva y el «se» impersonal',
    description = 'Pasiva refleja, impersonal «se» and ser + participle passives'
WHERE id = 'aabbccdd-1111-4006-0004-b20000000000';

DELETE FROM exercises WHERE lesson_id = 'aabbccdd-1111-4006-0004-b20000000000';

INSERT INTO exercises (lesson_id, type, order_index, prompt, correct_answer, accepted_answers, options, hint_text, skill_type, subskill, response_mode, target_grammar, distractors, explanation, source_type, metadata) VALUES
-- 0: recognition (form-meaning mapping)
('aabbccdd-1111-4006-0004-b20000000000', 'multiple_choice', 0,
 '«Se dice que el restaurante va a cerrar». What does «se dice» express?',
 'People say / it is said', ARRAY[]::text[],
 ARRAY['People say / it is said','He says it to himself','She said it yesterday','Say it now!'],
 'This «se» has no specific subject — who is doing the saying?',
 'grammar', 'grammar', 'tap', 'passive_impersonal_se',
 ARRAY['He says it to himself','She said it yesterday','Say it now!'],
 '«Se dice que...» is the impersonal «se»: the action has no identified subject, like English "it is said / people say". It is not reflexive (to himself) and carries no past or imperative meaning.',
 'manual', '{}'::jsonb),
-- 1: recognition
('aabbccdd-1111-4006-0004-b20000000000', 'multiple_choice', 1,
 'El Quijote ___ por Cervantes.',
 'fue escrito', ARRAY[]::text[],
 ARRAY['fue escrito','fue escribido','escribió','estaba escribiendo'],
 'Passive with an agent (por Cervantes): ser + past participle — is «escribir» regular?',
 'grammar', 'grammar', 'tap', 'passive_impersonal_se',
 ARRAY['fue escribido','escribió','estaba escribiendo'],
 'With an explicit agent («por Cervantes»), use the ser-passive: fue escrito. «Escribir» has the irregular participle escrito (not «escribido»). The active «escribió» would need Cervantes as subject, not «por Cervantes».',
 'manual', '{}'::jsonb),
-- 2: recognition (form-meaning mapping)
('aabbccdd-1111-4006-0004-b20000000000', 'multiple_choice', 2,
 'You see a sign: «Se alquila habitación en el centro». What does it mean?',
 'Room for rent in the center', ARRAY[]::text[],
 ARRAY['Room for rent in the center','He rents a room for himself','They rented a room downtown','Rent this room right now!'],
 'Signs and ads use «se» + verb to hide the agent.',
 'grammar', 'grammar', 'tap', 'passive_impersonal_se',
 ARRAY['He rents a room for himself','They rented a room downtown','Rent this room right now!'],
 '«Se alquila» is the pasiva refleja typical of signs and ads: "room for rent". The person renting it out is irrelevant, so Spanish removes the agent with «se».',
 'manual', '{}'::jsonb),
-- 3: structured input
('aabbccdd-1111-4006-0004-b20000000000', 'fill_blank', 3,
 'El año pasado se ___ dos nuevas escuelas en el barrio. (construir)',
 'construyeron', ARRAY[]::text[], NULL,
 'Pasiva refleja: the verb agrees with «dos nuevas escuelas» — singular or plural? Preterite.',
 'grammar', 'grammar', 'type', 'passive_impersonal_se',
 ARRAY[]::text[],
 'In the pasiva refleja the grammatical subject is «dos nuevas escuelas», so the verb is plural: se construyeron. Note the preterite spelling change: construyeron (i → y).',
 'manual', '{}'::jsonb),
-- 4: structured input
('aabbccdd-1111-4006-0004-b20000000000', 'fill_blank', 4,
 'Las ventanas fueron ___ por la tormenta. (romper)',
 'rotas', ARRAY[]::text[], NULL,
 'Ser-passive: the past participle of «romper» is irregular, and it agrees with «las ventanas».',
 'grammar', 'grammar', 'type', 'passive_impersonal_se',
 ARRAY[]::text[],
 '«Romper» has the irregular participle roto. In the ser-passive the participle agrees like an adjective with the subject «las ventanas»: feminine plural → rotas.',
 'manual', '{}'::jsonb),
-- 5: structured input
('aabbccdd-1111-4006-0004-b20000000000', 'cloze_deletion', 5,
 'En esta oficina se ___ mucho y se descansa poco. (trabajar)',
 'trabaja', ARRAY[]::text[], NULL,
 'Impersonal «se» with no plural noun after it — the verb stays in which form?',
 'grammar', 'grammar', 'type', 'passive_impersonal_se',
 ARRAY[]::text[],
 'With intransitive verbs (or no noun subject), «se» is impersonal and the verb is always third person singular: se trabaja. Plural agreement (se trabajan) only happens in the pasiva refleja with a plural noun.',
 'manual', '{}'::jsonb),
-- 6: production
('aabbccdd-1111-4006-0004-b20000000000', 'sentence_transformation', 6,
 'Rewrite using the pasiva refleja («se»): Construyeron este puente en 1990.',
 'Este puente se construyó en 1990', ARRAY['Se construyó este puente en 1990'], NULL,
 'Turn the object «este puente» into the subject; the verb agrees with it (singular).',
 'grammar', 'grammar', 'type', 'passive_impersonal_se',
 ARRAY[]::text[],
 'Pasiva refleja: «se» + third person verb agreeing with the promoted subject. «Este puente» is singular → se construyó. The anonymous "they" (construyeron) disappears.',
 'manual', '{"originalSentence": "Construyeron este puente en 1990.", "instruction": "Rewrite using the pasiva refleja («se»)."}'::jsonb),
-- 7: production
('aabbccdd-1111-4006-0004-b20000000000', 'error_correction', 7,
 'La novela fue escribida por una autora chilena.',
 'La novela fue escrita por una autora chilena.', ARRAY[]::text[], NULL,
 'Check the past participle — «escribir» is one of the classic irregulars.',
 'grammar', 'grammar', 'type', 'passive_impersonal_se',
 ARRAY[]::text[],
 '«Escribir» has the irregular participle escrito/escrita — «escribida» does not exist. In the ser-passive the participle agrees with «la novela»: escrita.',
 'manual', '{"error_sentence": "La novela fue escribida por una autora chilena."}'::jsonb),
-- 8: production
('aabbccdd-1111-4006-0004-b20000000000', 'sentence_construction', 8,
 'Build the Spanish sentence: "Spanish is spoken here."',
 'Aquí se habla español', ARRAY['Se habla español aquí'], NULL,
 'Spanish prefers «se» + active verb over «está hablando».',
 'grammar', 'grammar', 'tap', 'passive_impersonal_se',
 ARRAY['está','hablando'],
 'English passives usually become the pasiva refleja in Spanish: se habla español. Neither the progressive («está hablando») nor a literal passive works for general statements like signs.',
 'manual', '{"tiles": ["Aquí","se","habla","español"], "distractors": ["está","hablando"]}'::jsonb),
-- 9: production
('aabbccdd-1111-4006-0004-b20000000000', 'translate_to_target', 9,
 'Translate using «se»: "The tickets were sold in one hour."',
 'Las entradas se vendieron en una hora', ARRAY['Se vendieron las entradas en una hora'], NULL,
 '«Las entradas» is plural — make the verb agree. Preterite of «vender».',
 'grammar', 'grammar', 'type', 'passive_impersonal_se',
 ARRAY[]::text[],
 'Pasiva refleja with a plural subject: se vendieron las entradas. The singular «se vendió las entradas» is a frequent error — the noun after «se» controls the agreement.',
 'manual', '{}'::jsonb);

-- ═══════════════════════════════════════════════════════════════════════════
-- Lesson 5 (order_index 4): Las oraciones de relativo
-- target_grammar: relative_clauses
-- ═══════════════════════════════════════════════════════════════════════════
UPDATE lessons
SET title = 'Las oraciones de relativo',
    description = 'que, quien, el que, lo que, cuyo — and the subjunctive with indefinite antecedents'
WHERE id = 'aabbccdd-1111-4006-0005-b20000000000';

DELETE FROM exercises WHERE lesson_id = 'aabbccdd-1111-4006-0005-b20000000000';

INSERT INTO exercises (lesson_id, type, order_index, prompt, correct_answer, accepted_answers, options, hint_text, skill_type, subskill, response_mode, target_grammar, distractors, explanation, source_type, metadata) VALUES
-- 0: recognition
('aabbccdd-1111-4006-0005-b20000000000', 'multiple_choice', 0,
 'La empresa ___ trabaja mi hermano está en Bilbao.',
 'en la que', ARRAY[]::text[],
 ARRAY['en la que','que','cuya','quien'],
 'You work IN a company — the relative needs that preposition plus an article.',
 'grammar', 'grammar', 'tap', 'relative_clauses',
 ARRAY['que','cuya','quien'],
 'When the relative expresses place or means, the preposition must appear before it: en la que (also donde or en la cual). Plain «que» cannot absorb the preposition, and «quien» only refers to people.',
 'manual', '{}'::jsonb),
-- 1: recognition
('aabbccdd-1111-4006-0005-b20000000000', 'multiple_choice', 1,
 'Eso es exactamente ___ necesitaba escuchar.',
 'lo que', ARRAY[]::text[],
 ARRAY['lo que','quien','cuyo','donde'],
 'The antecedent is an idea, not a person or a thing with gender — which neuter relative?',
 'grammar', 'grammar', 'tap', 'relative_clauses',
 ARRAY['quien','cuyo','donde'],
 '«Lo que» is the neuter relative for abstract ideas or whole statements: exactamente lo que necesitaba. «Quien» needs a person, «cuyo» expresses possession, «donde» expresses place.',
 'manual', '{}'::jsonb),
-- 2: recognition
('aabbccdd-1111-4006-0005-b20000000000', 'multiple_choice', 2,
 'El escritor ___ novelas ganaron el premio vive en Sevilla.',
 'cuyas', ARRAY[]::text[],
 ARRAY['cuyas','que','de quien','quienes'],
 'Possession ("whose novels") — the relative agrees with the thing possessed, «novelas».',
 'grammar', 'grammar', 'tap', 'relative_clauses',
 ARRAY['que','de quien','quienes'],
 '«Cuyo» means "whose" and agrees with the possessed noun, not the owner: cuyas novelas (feminine plural). Spanish never says «que sus novelas» — a frequent calque from English.',
 'manual', '{}'::jsonb),
-- 3: structured input
('aabbccdd-1111-4006-0005-b20000000000', 'fill_blank', 3,
 'Busco un piso que ___ tres dormitorios. (tener)',
 'tenga', ARRAY[]::text[], NULL,
 'The flat is hypothetical — you do not know if it exists. Which mood in the relative clause?',
 'grammar', 'grammar', 'type', 'relative_clauses',
 ARRAY[]::text[],
 'With an indefinite or hypothetical antecedent («busco un piso...»), the relative clause takes the subjunctive: tenga. You are describing a wish-list, not a flat you know exists.',
 'manual', '{}'::jsonb),
-- 4: structured input (minimal pair with 3)
('aabbccdd-1111-4006-0005-b20000000000', 'fill_blank', 4,
 'Vivo en un piso que ___ tres dormitorios. (tener)',
 'tiene', ARRAY[]::text[], NULL,
 'This flat exists — you live in it. Compare with the previous exercise.',
 'grammar', 'grammar', 'type', 'relative_clauses',
 ARRAY[]::text[],
 'A specific, known antecedent takes the indicative: vivo en un piso que tiene tres dormitorios. Contrast with «busco un piso que tenga...», where the flat is not (yet) real.',
 'manual', '{}'::jsonb),
-- 5: structured input
('aabbccdd-1111-4006-0005-b20000000000', 'cloze_deletion', 5,
 'No hay nadie que ___ cocinar como mi abuela. (saber)',
 'sepa', ARRAY[]::text[], NULL,
 'Negated antecedent («nadie») — which mood follows in the relative clause?',
 'grammar', 'grammar', 'type', 'relative_clauses',
 ARRAY[]::text[],
 'Negative antecedents (nadie, nada, ningún...) always trigger the subjunctive in the relative clause: no hay nadie que sepa. The person described does not exist, so the indicative is impossible.',
 'manual', '{}'::jsonb),
-- 6: production
('aabbccdd-1111-4006-0005-b20000000000', 'word_form', 6,
 'Necesitamos un guía que ___ con nosotros a la montaña.',
 'venga', ARRAY[]::text[], NULL,
 '«Necesitamos un guía...» — any guide, not a specific one. Present subjunctive of «venir».',
 'grammar', 'grammar', 'type', 'relative_clauses',
 ARRAY[]::text[],
 'The guide is indefinite (any guide who...), so the relative clause takes the present subjunctive: venga. «Venir» is irregular: yo vengo → venga.',
 'manual', '{"baseWord": "venir"}'::jsonb),
-- 7: production
('aabbccdd-1111-4006-0005-b20000000000', 'error_correction', 7,
 'El hotel que nos alojamos estaba en el centro.',
 'El hotel en el que nos alojamos estaba en el centro.', ARRAY['El hotel en que nos alojamos estaba en el centro','El hotel donde nos alojamos estaba en el centro','El hotel en donde nos alojamos estaba en el centro','El hotel en el cual nos alojamos estaba en el centro'], NULL,
 '«Alojarse EN un hotel» — something is missing before the relative.',
 'grammar', 'grammar', 'type', 'relative_clauses',
 ARRAY[]::text[],
 'You stay IN a hotel, so the relative needs the preposition: en el que / en que / donde. Dropping the preposition («el hotel que nos alojamos») is a very common error, also among natives.',
 'manual', '{"error_sentence": "El hotel que nos alojamos estaba en el centro."}'::jsonb),
-- 8: production
('aabbccdd-1111-4006-0005-b20000000000', 'sentence_construction', 8,
 'Build the Spanish sentence: "What I like most is traveling."',
 'Lo que más me gusta es viajar', ARRAY['Lo que me gusta más es viajar'], NULL,
 'Start with the neuter relative «lo que»; «más» usually goes before «me gusta».',
 'grammar', 'grammar', 'tap', 'relative_clauses',
 ARRAY['cuál','gustaría'],
 'Abstract "what" = lo que: Lo que más me gusta es viajar. English speakers often reach for «cuál» or «el que» here, but only the neuter «lo que» works.',
 'manual', '{"tiles": ["Lo","que","más","me","gusta","es","viajar"], "distractors": ["cuál","gustaría"]}'::jsonb),
-- 9: production
('aabbccdd-1111-4006-0005-b20000000000', 'translate_to_target', 9,
 'Translate to Spanish: "I am looking for someone who has sales experience."',
 'Busco a alguien que tenga experiencia en ventas', ARRAY['Estoy buscando a alguien que tenga experiencia en ventas'], NULL,
 'Indefinite person → personal «a» + subjunctive in the relative clause. Sales = ventas.',
 'grammar', 'grammar', 'type', 'relative_clauses',
 ARRAY[]::text[],
 '«Alguien» is indefinite, so the relative verb is subjunctive: tenga. Note the personal «a» before alguien: busco a alguien. Both the mood and the «a» trip up English speakers.',
 'manual', '{}'::jsonb);

-- ═══════════════════════════════════════════════════════════════════════════
-- Lesson 6 (order_index 5): Review & Test — mixes all five topics
-- ═══════════════════════════════════════════════════════════════════════════
UPDATE lessons
SET title = 'Review & Test',
    description = 'Mixed practice of all five B2 grammar topics'
WHERE id = 'aabbccdd-1111-4006-0006-b20000000000';

DELETE FROM exercises WHERE lesson_id = 'aabbccdd-1111-4006-0006-b20000000000';

INSERT INTO exercises (lesson_id, type, order_index, prompt, correct_answer, accepted_answers, options, hint_text, skill_type, subskill, response_mode, target_grammar, distractors, explanation, source_type, metadata) VALUES
-- 0: MC — subjunctive noun clauses
('aabbccdd-1111-4006-0006-b20000000000', 'multiple_choice', 0,
 'Es increíble que el ayuntamiento no ___ nada para arreglar esta calle.',
 'haga', ARRAY[]::text[],
 ARRAY['haga','hace','hará','hacer'],
 '«Es increíble que» — an emotion/judgement trigger.',
 'grammar', 'grammar', 'tap', 'subjunctive_noun_clauses',
 ARRAY['hace','hará','hacer'],
 'Impersonal judgements («es increíble que») take the subjunctive: haga. Review: wish, emotion, doubt and impersonal expressions all push the que-clause into the subjunctive.',
 'manual', '{}'::jsonb),
-- 1: MC — si-clauses (type 3)
('aabbccdd-1111-4006-0006-b20000000000', 'multiple_choice', 1,
 'Si me ___, habría llegado a tiempo a la entrevista.',
 'hubieras avisado', ARRAY[]::text[],
 ARRAY['hubieras avisado','avisarías','habías avisado','avisas'],
 'Past unreal condition (the arriving already failed) → «si» + pluperfect subjunctive.',
 'grammar', 'grammar', 'tap', 'si_clauses',
 ARRAY['avisarías','habías avisado','avisas'],
 'The result clause «habría llegado» marks a past unreal condition, so the si-clause needs hubieras avisado (pluperfect subjunctive). Indicative forms (avisas, habías avisado) and the conditional cannot follow «si» here.',
 'manual', '{}'::jsonb),
-- 2: MC — reported speech
('aabbccdd-1111-4006-0006-b20000000000', 'multiple_choice', 2,
 '«¿Dónde vives?» → Ayer me preguntó dónde ___.',
 'vivía', ARRAY[]::text[],
 ARRAY['vivía','viviera','viviré','he vivido'],
 'Reported information question: backshift the present; no subjunctive.',
 'grammar', 'grammar', 'tap', 'reported_speech',
 ARRAY['viviera','viviré','he vivido'],
 'Reported questions keep the indicative with backshift: vives → vivía. The subjunctive (viviera) is for reported commands, not questions.',
 'manual', '{}'::jsonb),
-- 3: fill_blank — passive/impersonal se
('aabbccdd-1111-4006-0006-b20000000000', 'fill_blank', 3,
 'Durante la crisis se ___ muchas casas en esta zona. (vender)',
 'vendieron', ARRAY[]::text[], NULL,
 'Pasiva refleja — the verb agrees with «muchas casas»; past tense.',
 'grammar', 'grammar', 'type', 'passive_impersonal_se',
 ARRAY[]::text[],
 'Plural subject «muchas casas» → plural verb: se vendieron. Review: in the pasiva refleja the noun after the verb is the grammatical subject and controls the agreement.',
 'manual', '{}'::jsonb),
-- 4: cloze — relative clauses + subjunctive
('aabbccdd-1111-4006-0006-b20000000000', 'cloze_deletion', 4,
 '¿Conoces a alguien que ___ arreglar ordenadores? (saber)',
 'sepa', ARRAY[]::text[], NULL,
 'Indefinite antecedent in a question — which mood?',
 'grammar', 'grammar', 'type', 'relative_clauses',
 ARRAY[]::text[],
 'In questions about the existence of someone («¿Conoces a alguien que...?»), the antecedent is indefinite, so the relative clause takes the subjunctive: sepa.',
 'manual', '{}'::jsonb),
-- 5: word_form — passive participle
('aabbccdd-1111-4006-0006-b20000000000', 'word_form', 5,
 'El problema fue ___ por los técnicos en menos de una hora.',
 'resuelto', ARRAY[]::text[], NULL,
 'Irregular participle of «resolver»; it agrees with «el problema».',
 'grammar', 'grammar', 'type', 'passive_impersonal_se',
 ARRAY[]::text[],
 '«Resolver» has the irregular participle resuelto (like volver → vuelto). It agrees with the masculine singular subject «el problema»: fue resuelto.',
 'manual', '{"baseWord": "resolver"}'::jsonb),
-- 6: sentence_transformation — reported speech
('aabbccdd-1111-4006-0006-b20000000000', 'sentence_transformation', 6,
 'Report this, starting with «Paula dijo que...»: «Llegaré tarde a la cena».',
 'Paula dijo que llegaría tarde a la cena', ARRAY['Dijo que llegaría tarde a la cena'], NULL,
 'Future → conditional after a past reporting verb.',
 'grammar', 'grammar', 'type', 'reported_speech',
 ARRAY[]::text[],
 'A quoted future backshifts to the conditional: llegaré → llegaría. Paula dijo que llegaría tarde a la cena.',
 'manual', '{"originalSentence": "«Llegaré tarde a la cena».", "instruction": "Report it, starting with «Paula dijo que...»"}'::jsonb),
-- 7: error_correction — si-clauses
('aabbccdd-1111-4006-0006-b20000000000', 'error_correction', 7,
 'Si sabría la respuesta, te la diría ahora mismo.',
 'Si supiera la respuesta, te la diría ahora mismo.', ARRAY['Si supiese la respuesta, te la diría ahora mismo','Si supiera la respuesta te la diría ahora mismo','Si supiese la respuesta te la diría ahora mismo'], NULL,
 'One verb form is impossible after «si» — swap it for the imperfect subjunctive.',
 'grammar', 'grammar', 'type', 'si_clauses',
 ARRAY[]::text[],
 'The conditional never follows «si»: «si sabría» must become si supiera/supiese. The main clause keeps the conditional: te la diría.',
 'manual', '{"error_sentence": "Si sabría la respuesta, te la diría ahora mismo."}'::jsonb),
-- 8: sentence_construction — subjunctive noun clauses
('aabbccdd-1111-4006-0006-b20000000000', 'sentence_construction', 8,
 'Build the Spanish sentence: "It is important that they come early."',
 'Es importante que vengan temprano', ARRAY[]::text[], NULL,
 'Impersonal trigger + change of subject → subjunctive.',
 'grammar', 'grammar', 'tap', 'subjunctive_noun_clauses',
 ARRAY['vienen','venir'],
 '«Es importante que» + a new subject requires the subjunctive: vengan. English "that they come" hides the mood change — Spanish marks it on the verb.',
 'manual', '{"tiles": ["Es","importante","que","vengan","temprano"], "distractors": ["vienen","venir"]}'::jsonb),
-- 9: translate — si-clauses
('aabbccdd-1111-4006-0006-b20000000000', 'translate_to_target', 9,
 'Translate to Spanish: "If I were you, I would buy the house."',
 'Si yo fuera tú, compraría la casa', ARRAY['Si fuera tú, compraría la casa','Si yo fuera tú compraría la casa','Si fuera tú compraría la casa','Si yo fuese tú, compraría la casa','Si fuese tú, compraría la casa','Si yo fuese tú compraría la casa','Si fuese tú compraría la casa'], NULL,
 'Fixed pattern: «si» + imperfect subjunctive of «ser», conditional in the main clause.',
 'grammar', 'grammar', 'type', 'si_clauses',
 ARRAY[]::text[],
 'Hypothetical identity uses «si (yo) fuera tú» + conditional: compraría. Both -ra and -se subjunctive forms are correct; the conditional stays in the main clause.',
 'manual', '{}'::jsonb);

-- ═══════════════════════════════════════════════════════════════════════════
-- Grammar rules reference set — language 'es', 5 per CEFR level (A1–B2).
-- B2 rule_names deliberately match the exercises' target_grammar tags so
-- RuleCard (components/lesson/RuleCard.tsx) resolves them on grammar errors.
-- examples shape matches mapGrammarRule/RuleCard: [{"target","native"}].
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO grammar_rules (language, cefr_level, rule_name, title, explanation, examples, common_errors, tags) VALUES
-- ── A1 ──
('es', 'A1', 'noun_gender', 'Gender of Nouns',
 'Every Spanish noun is masculine or feminine. Most nouns ending in -o are masculine (el libro) and most ending in -a are feminine (la casa). Articles and adjectives must match the gender. Common exceptions: el día, la mano, el problema.',
 '[{"target": "el libro rojo", "native": "the red book"}, {"target": "la casa blanca", "native": "the white house"}]'::jsonb,
 '[{"error": "la problema", "correction": "el problema", "note": "Nouns of Greek origin ending in -ma are masculine."}]'::jsonb,
 ARRAY['nouns','gender','basics']),
('es', 'A1', 'definite_indefinite_articles', 'Definite and Indefinite Articles',
 'Spanish articles agree in gender and number with the noun. Definite: el, la, los, las (the). Indefinite: un, una, unos, unas (a / some). Use the definite article for general statements: Me gusta el café.',
 '[{"target": "un amigo, unos amigos", "native": "a friend, some friends"}, {"target": "Me gusta el café.", "native": "I like coffee."}]'::jsonb,
 '[{"error": "Me gusta café.", "correction": "Me gusta el café.", "note": "General likes need the definite article in Spanish."}]'::jsonb,
 ARRAY['articles','basics']),
('es', 'A1', 'present_tense_regular', 'Regular Present Tense',
 'Regular verbs follow three patterns by infinitive ending. -ar: hablo, hablas, habla, hablamos, habláis, hablan. -er: como, comes, come... -ir: vivo, vives, vive... The ending marks the person, so subject pronouns are usually dropped.',
 '[{"target": "Hablo español.", "native": "I speak Spanish."}, {"target": "Vivimos en Madrid.", "native": "We live in Madrid."}]'::jsonb,
 '[{"error": "Yo hablar español.", "correction": "Yo hablo español.", "note": "The verb must be conjugated; the infinitive cannot stand alone."}]'::jsonb,
 ARRAY['present','conjugation','basics']),
('es', 'A1', 'ser_vs_estar_basics', 'Ser vs Estar (Basics)',
 'Both mean "to be". Use ser for identity, origin, profession and permanent traits: Soy médica, es alto. Use estar for location and temporary states: Estoy cansado, está en casa. Location of people and things always takes estar.',
 '[{"target": "Soy de México.", "native": "I am from Mexico."}, {"target": "Estoy en la oficina.", "native": "I am at the office."}]'::jsonb,
 '[{"error": "Soy en casa.", "correction": "Estoy en casa.", "note": "Location always uses estar, never ser."}]'::jsonb,
 ARRAY['ser','estar','basics']),
('es', 'A1', 'plural_nouns', 'Plural of Nouns',
 'Nouns ending in a vowel add -s (casa → casas). Nouns ending in a consonant add -es (ciudad → ciudades). Nouns ending in -z change to -ces (lápiz → lápices). Articles and adjectives also become plural: las casas blancas.',
 '[{"target": "el lápiz → los lápices", "native": "the pencil → the pencils"}, {"target": "la ciudad → las ciudades", "native": "the city → the cities"}]'::jsonb,
 '[{"error": "los ciudads", "correction": "las ciudades", "note": "Consonant-final nouns add -es, and the article must agree."}]'::jsonb,
 ARRAY['nouns','plural','basics']),
-- ── A2 ──
('es', 'A2', 'gustar_verbs', 'Gustar-type Verbs',
 'Gustar works backwards: the thing liked is the subject and the person is an indirect object. Me gusta el cine (singular), me gustan las películas (plural). Add a + person for emphasis or clarity: A Juan le gusta bailar.',
 '[{"target": "Me gustan las películas.", "native": "I like movies."}, {"target": "A Ana le gusta viajar.", "native": "Ana likes traveling."}]'::jsonb,
 '[{"error": "Yo gusto el cine.", "correction": "Me gusta el cine.", "note": "The liker is an object pronoun (me/te/le), not the subject."}]'::jsonb,
 ARRAY['gustar','pronouns']),
('es', 'A2', 'preterite_regular', 'Regular Preterite',
 'The preterite reports completed past actions. -ar: hablé, hablaste, habló, hablamos, hablasteis, hablaron. -er/-ir: comí, comiste, comió, comimos, comisteis, comieron. Watch the accents: hablo (present) vs habló (preterite).',
 '[{"target": "Ayer hablé con mi madre.", "native": "Yesterday I spoke with my mother."}, {"target": "Comieron a las dos.", "native": "They ate at two."}]'::jsonb,
 '[{"error": "Ayer hablo con ella.", "correction": "Ayer hablé con ella.", "note": "Past events need the preterite; the accent changes the tense."}]'::jsonb,
 ARRAY['preterite','past','conjugation']),
('es', 'A2', 'ir_a_infinitive', 'Ir a + Infinitive (Near Future)',
 'To talk about plans and the near future, use the present of ir + a + infinitive: Voy a estudiar esta noche. It works like English "going to". The verb ir is irregular: voy, vas, va, vamos, vais, van.',
 '[{"target": "Voy a estudiar esta noche.", "native": "I am going to study tonight."}, {"target": "Van a viajar en julio.", "native": "They are going to travel in July."}]'::jsonb,
 '[{"error": "Voy estudiar esta noche.", "correction": "Voy a estudiar esta noche.", "note": "The preposition a is required between ir and the infinitive."}]'::jsonb,
 ARRAY['future','ir','periphrasis']),
('es', 'A2', 'reflexive_verbs', 'Reflexive Verbs',
 'Reflexive verbs describe actions done to oneself and need a matching pronoun: me levanto, te levantas, se levanta, nos levantamos, os levantáis, se levantan. The pronoun goes before a conjugated verb or attaches to an infinitive: voy a levantarme.',
 '[{"target": "Me despierto a las siete.", "native": "I wake up at seven."}, {"target": "Se ducha por la mañana.", "native": "He showers in the morning."}]'::jsonb,
 '[{"error": "Levanto a las siete.", "correction": "Me levanto a las siete.", "note": "Without the pronoun, levantar means to lift something else."}]'::jsonb,
 ARRAY['reflexive','pronouns']),
('es', 'A2', 'comparatives', 'Comparatives',
 'More than = más... que; less than = menos... que; as... as = tan... como. Irregular comparatives: mejor (better), peor (worse), mayor (older), menor (younger). Never combine más with these: más mejor is wrong.',
 '[{"target": "Esta película es mejor que la otra.", "native": "This movie is better than the other one."}, {"target": "Soy tan alto como mi padre.", "native": "I am as tall as my father."}]'::jsonb,
 '[{"error": "más mejor", "correction": "mejor", "note": "Mejor already means better; it never takes más."}]'::jsonb,
 ARRAY['comparatives','adjectives']),
-- ── B1 ──
('es', 'B1', 'preterite_vs_imperfect', 'Preterite vs Imperfect',
 'The preterite reports completed events (ayer comí paella); the imperfect describes background, habits and ongoing states (siempre comíamos juntos, era tarde). In stories, the imperfect sets the scene and the preterite moves the action forward.',
 '[{"target": "Llovía cuando salí de casa.", "native": "It was raining when I left home."}, {"target": "De niño jugaba al fútbol.", "native": "As a child I used to play soccer."}]'::jsonb,
 '[{"error": "De niño jugué al fútbol cada día.", "correction": "De niño jugaba al fútbol cada día.", "note": "Habitual past actions take the imperfect."}]'::jsonb,
 ARRAY['past','preterite','imperfect']),
('es', 'B1', 'present_perfect', 'Present Perfect (pretérito perfecto)',
 'Haber (he, has, ha, hemos, habéis, han) + past participle links the past to now: Hoy he trabajado mucho. Common with hoy, esta semana, ya, todavía no. Irregular participles: hecho, dicho, visto, escrito, puesto, vuelto, roto.',
 '[{"target": "Ya he visto esa película.", "native": "I have already seen that movie."}, {"target": "Todavía no hemos comido.", "native": "We have not eaten yet."}]'::jsonb,
 '[{"error": "He escribido la carta.", "correction": "He escrito la carta.", "note": "Escribir has the irregular participle escrito."}]'::jsonb,
 ARRAY['perfect','haber','participles']),
('es', 'B1', 'future_simple', 'Simple Future',
 'Add -é, -ás, -á, -emos, -éis, -án to the infinitive: hablaré, comerás, vivirá. Irregular stems: tendr- (tener), podr- (poder), har- (hacer), dir- (decir), sabr- (saber). The future also expresses probability: Serán las diez.',
 '[{"target": "Mañana te llamaré.", "native": "I will call you tomorrow."}, {"target": "Tendremos más tiempo en verano.", "native": "We will have more time in summer."}]'::jsonb,
 '[{"error": "teneré", "correction": "tendré", "note": "Tener uses the irregular future stem tendr-."}]'::jsonb,
 ARRAY['future','conjugation']),
('es', 'B1', 'informal_commands', 'Informal Commands (tú)',
 'Affirmative tú commands use the third person singular form: habla, come, escribe. Irregulars: di, haz, ve, pon, sal, sé, ten, ven. Negative commands switch to the subjunctive: no hables, no comas. Pronouns attach to affirmatives: dímelo.',
 '[{"target": "Haz los deberes.", "native": "Do your homework."}, {"target": "No llegues tarde.", "native": "Do not arrive late."}]'::jsonb,
 '[{"error": "No habla tan rápido.", "correction": "No hables tan rápido.", "note": "Negative commands use the subjunctive form."}]'::jsonb,
 ARRAY['imperative','commands']),
('es', 'B1', 'por_vs_para', 'Por vs Para',
 'Para marks purpose, destination and deadlines: para aprender, para Madrid, para el lunes. Por marks cause, exchange, duration and movement through: por eso, por diez euros, por dos horas, por el parque. Gracias por, not gracias para.',
 '[{"target": "Estudio para aprobar el examen.", "native": "I study in order to pass the exam."}, {"target": "Caminamos por el centro.", "native": "We walked through downtown."}]'::jsonb,
 '[{"error": "Gracias para tu ayuda.", "correction": "Gracias por tu ayuda.", "note": "Thanking expresses cause, which takes por."}]'::jsonb,
 ARRAY['prepositions','por','para']),
-- ── B2 ── (rule_name matches exercises.target_grammar in the Complex Grammar unit)
('es', 'B2', 'subjunctive_noun_clauses', 'Subjunctive in Noun Clauses',
 'After verbs of wish (querer que), emotion (alegrarse de que), doubt (dudar que) and impersonal judgements (es importante que), the que-clause verb takes the subjunctive when the subject changes: Quiero que vengas. With no change of subject, use the infinitive: Quiero venir.',
 '[{"target": "Espero que tengas suerte.", "native": "I hope you are lucky."}, {"target": "No creo que sea verdad.", "native": "I do not think it is true."}]'::jsonb,
 '[{"error": "Espero que tienes suerte.", "correction": "Espero que tengas suerte.", "note": "English keeps the indicative after hope; Spanish requires the subjunctive."}, {"error": "Quiero que venir.", "correction": "Quiero que vengas. / Quiero venir.", "note": "Que needs a conjugated verb; the infinitive only works without que."}]'::jsonb,
 ARRAY['subjunctive','mood','noun-clauses']),
('es', 'B2', 'si_clauses', 'Conditional Sentences (si-clauses)',
 'Real: si + present indicative, future in the main clause (Si llueve, nos quedaremos). Unreal present: si + imperfect subjunctive + conditional (Si tuviera dinero, viajaría). Unreal past: si + pluperfect subjunctive + conditional perfect (Si hubiera sabido, habría venido). Never put the conditional or future directly after si.',
 '[{"target": "Si tuviera tiempo, iría al gimnasio.", "native": "If I had time, I would go to the gym."}, {"target": "Si hubieras venido, lo habrías visto.", "native": "If you had come, you would have seen it."}]'::jsonb,
 '[{"error": "Si tendría tiempo, iría.", "correction": "Si tuviera tiempo, iría.", "note": "The conditional never follows si; use the imperfect subjunctive."}]'::jsonb,
 ARRAY['conditionals','subjunctive','si-clauses']),
('es', 'B2', 'reported_speech', 'Reported Speech (estilo indirecto)',
 'After a past reporting verb, tenses backshift: present → imperfect (vivo → vivía), present perfect/preterite → pluperfect (he visto → había visto), future → conditional (iré → iría). Commands become que + imperfect subjunctive; yes/no questions use si. Time words shift: hoy → ese día, mañana → al día siguiente.',
 '[{"target": "Dijo que vendría al día siguiente.", "native": "He said he would come the next day."}, {"target": "Me pidió que cerrara la puerta.", "native": "She asked me to close the door."}]'::jsonb,
 '[{"error": "Dijo que vendrá mañana.", "correction": "Dijo que vendría al día siguiente.", "note": "Once the announced moment has passed, backshift the tense and shift the time expression."}]'::jsonb,
 ARRAY['reported-speech','backshift','tenses']),
('es', 'B2', 'passive_impersonal_se', 'Passive and Impersonal «se»',
 'Pasiva refleja: se + third person verb agreeing with the noun (Se venden pisos, se vendió la casa). Impersonal se: always singular, no noun subject (Se vive bien aquí). With an explicit agent, use ser + participle, which agrees with the subject: La novela fue escrita por ella.',
 '[{"target": "Se venden entradas en la taquilla.", "native": "Tickets are sold at the box office."}, {"target": "El puente fue construido en 1990.", "native": "The bridge was built in 1990."}]'::jsonb,
 '[{"error": "Se vende pisos.", "correction": "Se venden pisos.", "note": "In the pasiva refleja the verb agrees with the plural noun."}]'::jsonb,
 ARRAY['passive','se','impersonal']),
('es', 'B2', 'relative_clauses', 'Relative Clauses',
 'Que is the default relative. After prepositions use el/la que, el/la cual, or quien for people: la empresa en la que trabajo. Lo que refers to ideas; cuyo means whose and agrees with the possessed noun. Indefinite or negated antecedents take the subjunctive: Busco un piso que tenga balcón.',
 '[{"target": "El hotel en el que nos alojamos era caro.", "native": "The hotel we stayed in was expensive."}, {"target": "No hay nadie que sepa la respuesta.", "native": "There is nobody who knows the answer."}]'::jsonb,
 '[{"error": "El hotel que nos alojamos...", "correction": "El hotel en el que nos alojamos...", "note": "The preposition cannot be dropped before the relative."}, {"error": "Busco un piso que tiene balcón.", "correction": "Busco un piso que tenga balcón.", "note": "Indefinite antecedents take the subjunctive."}]'::jsonb,
 ARRAY['relatives','subjunctive','cuyo'])
ON CONFLICT (language, rule_name) DO UPDATE SET
  cefr_level = EXCLUDED.cefr_level,
  title = EXCLUDED.title,
  explanation = EXCLUDED.explanation,
  examples = EXCLUDED.examples,
  common_errors = EXCLUDED.common_errors,
  tags = EXCLUDED.tags;

COMMIT;
