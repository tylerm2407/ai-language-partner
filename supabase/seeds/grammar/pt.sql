-- ═══════════════════════════════════════════════════════════════════════════
-- Portuguese (pt) B2 "Complex Grammar" unit rebuild + grammar_rules reference
-- ═══════════════════════════════════════════════════════════════════════════
-- Replaces the template exercises (which taught grammar TERMINOLOGY as vocab)
-- with real grammar practice. European Portuguese is the default variety;
-- Brazilian forms are included in accepted_answers where both are correct.
--
-- Design (docs/strategy/research.md):
--   §4.2 Focus on Form  — grammar embedded in meaningful sentences, brief
--                         metalinguistic explanations per exercise (≤60 words).
--   §7   Explicit→implicit — rule applied in output repeatedly; recognition
--                         (multiple_choice) → structured input (fill_blank /
--                         cloze) → production (word_form, transformation,
--                         error_correction, construction, translation).
--   §10  Corrective feedback — hint_text gives a metalinguistic cue;
--                         explanation says WHY the answer is right.
--
-- Grading notes (lib/grading.ts): answers are lowercased, trailing .!? is
-- stripped, and typos within Levenshtein distance 2 (1 for answers ≤4 chars)
-- are tolerated. All multiple-choice distractors and error-correction source
-- sentences were verified to sit OUTSIDE this tolerance of the correct answer.
--
-- Staged seed — do NOT run against production without review.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── Unit ────────────────────────────────────────────────────────────────────

UPDATE units
SET description = 'B2 grammar essentials: o conjuntivo presente, o futuro do conjuntivo, o infinitivo pessoal, o discurso indireto e a voz passiva'
WHERE id = 'aabbccdd-5555-4006-0000-b20000000000';

-- ─── Lessons (IDs reused, retitled) ─────────────────────────────────────────

UPDATE lessons SET
  title = 'O Conjuntivo Presente',
  description = 'Express wishes, doubts and emotions: the present subjunctive after querer que, talvez and embora'
WHERE id = 'aabbccdd-5555-4006-0001-b20000000000';

UPDATE lessons SET
  title = 'O Futuro do Conjuntivo',
  description = 'Talk about future conditions with se, quando and assim que — a tense unique to Portuguese'
WHERE id = 'aabbccdd-5555-4006-0002-b20000000000';

UPDATE lessons SET
  title = 'O Infinitivo Pessoal',
  description = 'Portugal''s grammatical gem: infinitives with their own subject endings'
WHERE id = 'aabbccdd-5555-4006-0003-b20000000000';

UPDATE lessons SET
  title = 'O Discurso Indireto',
  description = 'Report what people said: tense backshift and time-word changes'
WHERE id = 'aabbccdd-5555-4006-0004-b20000000000';

UPDATE lessons SET
  title = 'A Voz Passiva e o «se»',
  description = 'The passive with ser + participle, and impersonal se-constructions'
WHERE id = 'aabbccdd-5555-4006-0005-b20000000000';

UPDATE lessons SET
  title = 'Review & Test',
  description = 'Mixed practice of all five grammar topics in this unit'
WHERE id = 'aabbccdd-5555-4006-0006-b20000000000';

-- ─── Wipe the old template exercises ────────────────────────────────────────

DELETE FROM exercises WHERE lesson_id = 'aabbccdd-5555-4006-0001-b20000000000';
DELETE FROM exercises WHERE lesson_id = 'aabbccdd-5555-4006-0002-b20000000000';
DELETE FROM exercises WHERE lesson_id = 'aabbccdd-5555-4006-0003-b20000000000';
DELETE FROM exercises WHERE lesson_id = 'aabbccdd-5555-4006-0004-b20000000000';
DELETE FROM exercises WHERE lesson_id = 'aabbccdd-5555-4006-0005-b20000000000';
DELETE FROM exercises WHERE lesson_id = 'aabbccdd-5555-4006-0006-b20000000000';

-- ═══════════════════════════════════════════════════════════════════════════
-- Lesson 1 — O Conjuntivo Presente  (order_index 0)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO exercises
  (lesson_id, type, order_index, prompt, correct_answer, accepted_answers, options, hint_text, skill_type, subskill, response_mode, target_grammar, distractors, explanation, source_type, metadata)
VALUES
  ('aabbccdd-5555-4006-0001-b20000000000', 'multiple_choice', 0,
   'Choose the expression that requires the conjuntivo: «___ ele chegue a horas.»',
   'Espero que', '{}',
   ARRAY['Espero que','Acho que','Sei que','É verdade que'],
   'Verbs of hoping and wishing trigger the conjuntivo; verbs of knowing and believing take the indicative.',
   'grammar', 'grammar', 'tap', 'conjuntivo_presente',
   ARRAY['Acho que','Sei que','É verdade que'],
   '«Chegue» is a conjuntivo form, so the main clause must express wish, doubt or emotion. «Espero que» (I hope that) does; «acho que», «sei que» and «é verdade que» state beliefs or facts and take the indicative («chega»).',
   'manual', '{}'::jsonb),

  ('aabbccdd-5555-4006-0001-b20000000000', 'multiple_choice', 1,
   'Which sentence uses the conjuntivo correctly after «talvez»?',
   'Talvez eles venham à festa.', '{}',
   ARRAY['Talvez eles venham à festa.','Talvez eles vêm à festa.','Talvez eles vieram à festa.','Talvez eles virão à festa.'],
   'When «talvez» comes before the verb, the verb must be in the conjuntivo.',
   'grammar', 'grammar', 'tap', 'conjuntivo_presente',
   ARRAY['Talvez eles vêm à festa.','Talvez eles vieram à festa.','Talvez eles virão à festa.'],
   '«Talvez» placed before the verb requires the conjuntivo: «venham». The indicative forms «vêm» (present), «vieram» (past) and «virão» (future) are all incorrect after «talvez».',
   'manual', '{}'::jsonb),

  ('aabbccdd-5555-4006-0001-b20000000000', 'fill_blank', 2,
   'É importante que tu ___ (estudar) todos os dias.',
   'estudes', '{}', NULL,
   'Present conjuntivo of an -ar verb: take the eu-form «estudo», change the vowel to -e and add -s for tu.',
   'grammar', 'grammar', 'type', 'conjuntivo_presente', '{}',
   '«É importante que» triggers the conjuntivo. For -ar verbs, the conjuntivo swaps to -e endings: the tu form of «estudar» is «estudes».',
   'manual', '{}'::jsonb),

  ('aabbccdd-5555-4006-0001-b20000000000', 'cloze_deletion', 3,
   'O médico recomenda que a Ana ___ (beber) mais água.',
   'beba', '{}', NULL,
   'Recommendation verbs («recomendar que») take the conjuntivo. For -er verbs the vowel changes to -a.',
   'grammar', 'grammar', 'type', 'conjuntivo_presente', '{}',
   '«Recomendar que» expresses influence over someone else''s action, so the conjuntivo is required. -er verbs take -a endings in the present conjuntivo: «beber» → «beba».',
   'manual', '{}'::jsonb),

  ('aabbccdd-5555-4006-0001-b20000000000', 'word_form', 4,
   'Duvido que eles ___ (saber) a resposta.',
   'saibam', '{}', NULL,
   '«Saber» is irregular in the conjuntivo — its stem is «saib-».',
   'grammar', 'grammar', 'type', 'conjuntivo_presente', '{}',
   '«Duvidar que» expresses doubt and requires the conjuntivo. «Saber» has an irregular conjuntivo stem: saiba, saibas, saiba, saibamos, saibam. The eles form is «saibam».',
   'manual', '{"baseWord": "saber"}'::jsonb),

  ('aabbccdd-5555-4006-0001-b20000000000', 'fill_blank', 5,
   'Não quero que isto ___ (ser) um problema.',
   'seja', '{}', NULL,
   'The conjuntivo of «ser» is irregular: stem sej-.',
   'grammar', 'grammar', 'type', 'conjuntivo_presente', '{}',
   '«Querer que» requires the conjuntivo. «Ser» is irregular: seja, sejas, seja, sejamos, sejam. With «isto» (third person singular) the form is «seja».',
   'manual', '{}'::jsonb),

  ('aabbccdd-5555-4006-0001-b20000000000', 'sentence_transformation', 6,
   'Rewrite the sentence starting with «Duvido que…»: Ele vem à reunião.',
   'Duvido que ele venha à reunião.',
   ARRAY['Duvido que venha à reunião.','Eu duvido que ele venha à reunião.'],
   NULL,
   '«Duvidar que» triggers the conjuntivo. «Vir» has an irregular stem: venh-.',
   'grammar', 'grammar', 'type', 'conjuntivo_presente', '{}',
   'Under «duvido que», the indicative «vem» must become the conjuntivo «venha». «Vir» builds its conjuntivo from the irregular eu-form «venho»: venha, venhas, venha, venhamos, venham.',
   'manual', '{"originalSentence": "Ele vem à reunião.", "instruction": "Rewrite the sentence starting with «Duvido que…»"}'::jsonb),

  ('aabbccdd-5555-4006-0001-b20000000000', 'error_correction', 7,
   'Espero que eles vêm ao jantar amanhã.',
   'Espero que eles venham ao jantar amanhã.',
   ARRAY['Espero que venham ao jantar amanhã.'],
   NULL,
   'Check the verb after «espero que» — hoping requires a special mood.',
   'grammar', 'grammar', 'type', 'conjuntivo_presente', '{}',
   '«Esperar que» requires the conjuntivo, so the indicative «vêm» is wrong. The correct form is «venham», from the irregular stem «venh-».',
   'manual', '{"error_sentence": "Espero que eles vêm ao jantar amanhã."}'::jsonb),

  ('aabbccdd-5555-4006-0001-b20000000000', 'sentence_construction', 8,
   'Build the Portuguese sentence: "It''s better that you stay at home."',
   'É melhor que tu fiques em casa',
   ARRAY['É melhor que fiques em casa'],
   NULL,
   'After «é melhor que», use the conjuntivo of «ficar».',
   'grammar', 'grammar', 'tap', 'conjuntivo_presente',
   ARRAY['ficas','ficar'],
   '«É melhor que» is an impersonal opinion expression, so the verb takes the conjuntivo: «fiques». The indicative «ficas» and the bare infinitive «ficar» are ungrammatical after «que» here.',
   'manual', '{"tiles": ["É","melhor","que","tu","fiques","em","casa"], "distractors": ["ficas","ficar"]}'::jsonb),

  ('aabbccdd-5555-4006-0001-b20000000000', 'translate_to_target', 9,
   'Translate to Portuguese: I hope you (tu) arrive early.',
   'Espero que chegues cedo.',
   ARRAY['Espero que tu chegues cedo.','Eu espero que chegues cedo.','Eu espero que tu chegues cedo.'],
   NULL,
   '«Esperar que» + conjuntivo. The tu form of «chegar» ends in -es.',
   'grammar', 'grammar', 'type', 'conjuntivo_presente', '{}',
   'Hoping about someone else''s action takes «esperar que» + conjuntivo. «Chegar» is regular: the tu conjuntivo form is «chegues». Subject pronouns («eu», «tu») are optional in Portuguese.',
   'manual', '{}'::jsonb);

-- ═══════════════════════════════════════════════════════════════════════════
-- Lesson 2 — O Futuro do Conjuntivo  (order_index 1)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO exercises
  (lesson_id, type, order_index, prompt, correct_answer, accepted_answers, options, hint_text, skill_type, subskill, response_mode, target_grammar, distractors, explanation, source_type, metadata)
VALUES
  ('aabbccdd-5555-4006-0002-b20000000000', 'multiple_choice', 0,
   'Complete: «Quando ___ a Lisboa, visita o Mosteiro dos Jerónimos.» (tu, ir)',
   'fores', '{}',
   ARRAY['fores','vais','irás','vás'],
   'After «quando» with future meaning, use the futuro do conjuntivo of «ir»: stem for-.',
   'grammar', 'grammar', 'tap', 'futuro_do_conjuntivo',
   ARRAY['vais','irás','vás'],
   'When «quando» refers to the future, Portuguese requires the futuro do conjuntivo. «Ir» forms it from the stem «for-»: fores. The present «vais», the future indicative «irás» and the present conjuntivo «vás» are all wrong after «quando».',
   'manual', '{}'::jsonb),

  ('aabbccdd-5555-4006-0002-b20000000000', 'multiple_choice', 1,
   'In «Se puderes, telefona-me», what does «puderes» express?',
   'A possible future condition', '{}',
   ARRAY['A possible future condition','A past habit','A completed action','A polite request in the past'],
   '«Se» + futuro do conjuntivo talks about what may still happen, not about the past.',
   'grammar', 'grammar', 'tap', 'futuro_do_conjuntivo',
   ARRAY['A past habit','A completed action','A polite request in the past'],
   '«Puderes» is the futuro do conjuntivo of «poder». With «se», it presents a real, open condition in the future: "if you can (at some point), call me". It says nothing about the past.',
   'manual', '{}'::jsonb),

  ('aabbccdd-5555-4006-0002-b20000000000', 'fill_blank', 2,
   'Se eu ___ (ter) tempo amanhã, vou ao ginásio.',
   'tiver', '{}', NULL,
   'Futuro do conjuntivo of «ter»: stem «tiver-», from the eles past form «tiveram».',
   'grammar', 'grammar', 'type', 'futuro_do_conjuntivo', '{}',
   'Real future conditions with «se» use the futuro do conjuntivo. Irregular verbs build it from the eles-form of the pretérito perfeito: tiveram → tiver-. The eu form is «tiver».',
   'manual', '{}'::jsonb),

  ('aabbccdd-5555-4006-0002-b20000000000', 'cloze_deletion', 3,
   'Assim que eles ___ (chegar), começamos a reunião.',
   'chegarem', '{}', NULL,
   '«Assim que» + future meaning → futuro do conjuntivo. Regular verbs: infinitive + -em for eles.',
   'grammar', 'grammar', 'type', 'futuro_do_conjuntivo', '{}',
   '«Assim que» (as soon as) referring to the future takes the futuro do conjuntivo. For regular verbs it looks like the infinitive plus personal endings: eles «chegarem».',
   'manual', '{}'::jsonb),

  ('aabbccdd-5555-4006-0002-b20000000000', 'word_form', 4,
   'Enquanto nós não ___ (fazer) o trabalho, ninguém sai.',
   'fizermos', '{}', NULL,
   'Stem from «fizeram» → fizer- + -mos.',
   'grammar', 'grammar', 'type', 'futuro_do_conjuntivo', '{}',
   '«Enquanto» with future reference requires the futuro do conjuntivo. «Fazer» is irregular: fizeram → fizer-, giving «fizermos» for nós.',
   'manual', '{"baseWord": "fazer"}'::jsonb),

  ('aabbccdd-5555-4006-0002-b20000000000', 'fill_blank', 5,
   'Se tu não ___ (trazer) o casaco, vais ter frio.',
   'trouxeres', '{}', NULL,
   '«Trazer» is irregular: the stem comes from «trouxeram».',
   'grammar', 'grammar', 'type', 'futuro_do_conjuntivo', '{}',
   'After «se» in a real future condition, use the futuro do conjuntivo. «Trazer» builds it from «trouxeram»: trouxer-, so the tu form is «trouxeres».',
   'manual', '{}'::jsonb),

  ('aabbccdd-5555-4006-0002-b20000000000', 'sentence_transformation', 6,
   'Combine into one sentence with «se» + futuro do conjuntivo: Tu vens a Lisboa. Nós visitamos o museu.',
   'Se vieres a Lisboa, visitamos o museu.',
   ARRAY['Se tu vieres a Lisboa, visitamos o museu.','Se vieres a Lisboa, nós visitamos o museu.','Se tu vieres a Lisboa, nós visitamos o museu.'],
   NULL,
   'Futuro do conjuntivo of «vir»: from «vieram» → vier-.',
   'grammar', 'grammar', 'type', 'futuro_do_conjuntivo', '{}',
   'The condition clause takes «se» + futuro do conjuntivo. «Vir» is irregular: vieram → vier-, tu form «vieres». The result clause stays in the present indicative.',
   'manual', '{"originalSentence": "Tu vens a Lisboa. Nós visitamos o museu.", "instruction": "Combine into one sentence: Se… + futuro do conjuntivo"}'::jsonb),

  ('aabbccdd-5555-4006-0002-b20000000000', 'error_correction', 7,
   'Quando podes, vem cá jantar.',
   'Quando puderes, vem cá jantar.',
   ARRAY['Quando tu puderes, vem cá jantar.'],
   NULL,
   '«Quando» pointing to the future cannot take the present indicative.',
   'grammar', 'grammar', 'type', 'futuro_do_conjuntivo', '{}',
   'The sentence is an invitation for the future, so «quando» must be followed by the futuro do conjuntivo: «puderes» (from «puderam»). The present indicative «podes» would only fit a habitual statement, not this invitation.',
   'manual', '{"error_sentence": "Quando podes, vem cá jantar."}'::jsonb),

  ('aabbccdd-5555-4006-0002-b20000000000', 'sentence_construction', 8,
   'Build the Portuguese sentence: "Whenever you need help, call me."',
   'Sempre que precisares de ajuda liga-me',
   ARRAY['Liga-me sempre que precisares de ajuda'],
   NULL,
   '«Sempre que» about the future takes the futuro do conjuntivo.',
   'grammar', 'grammar', 'tap', 'futuro_do_conjuntivo',
   ARRAY['quando','ajudares'],
   '«Sempre que» (whenever) with future reference is followed by the futuro do conjuntivo «precisares». The imperative «liga-me» forms the main clause. «Quando» alone means "when", not "whenever", and «ajudares» is the wrong verb (to help, not to need).',
   'manual', '{"tiles": ["Sempre","que","precisares","de","ajuda","liga-me"], "distractors": ["quando","ajudares"]}'::jsonb),

  ('aabbccdd-5555-4006-0002-b20000000000', 'translate_to_target', 9,
   'Translate to Portuguese: If you (tu) see Maria, tell her the truth.',
   'Se vires a Maria, diz-lhe a verdade.',
   ARRAY['Se tu vires a Maria, diz-lhe a verdade.','Se vires a Maria, conta-lhe a verdade.','Se tu vires a Maria, conta-lhe a verdade.','Se vires Maria, diz-lhe a verdade.'],
   NULL,
   'Futuro do conjuntivo of «ver»: from «viram» → vir-. Careful: it looks like the verb «vir»!',
   'grammar', 'grammar', 'type', 'futuro_do_conjuntivo', '{}',
   '«Se» + future condition takes the futuro do conjuntivo: «vires» (from «ver»). «Diz-lhe» / «conta-lhe» use the imperative plus the indirect object pronoun «lhe» (to her).',
   'manual', '{}'::jsonb);

-- ═══════════════════════════════════════════════════════════════════════════
-- Lesson 3 — O Infinitivo Pessoal  (order_index 2)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO exercises
  (lesson_id, type, order_index, prompt, correct_answer, accepted_answers, options, hint_text, skill_type, subskill, response_mode, target_grammar, distractors, explanation, source_type, metadata)
VALUES
  ('aabbccdd-5555-4006-0003-b20000000000', 'multiple_choice', 0,
   'Which sentence uses the infinitivo pessoal (personal infinitive) correctly?',
   'É importante fazermos o trabalho hoje.', '{}',
   ARRAY['É importante fazermos o trabalho hoje.','É importante que fazemos o trabalho hoje.','É importante nós fazer o trabalho hoje.','É importante que nós fazer o trabalho hoje.'],
   'The personal infinitive adds -mos (nós) directly to the infinitive; no «que» is needed.',
   'grammar', 'grammar', 'tap', 'infinitivo_pessoal',
   ARRAY['É importante que fazemos o trabalho hoje.','É importante nós fazer o trabalho hoje.','É importante que nós fazer o trabalho hoje.'],
   'After impersonal expressions like «é importante», Portuguese can use the personal infinitive: «fazermos» = infinitive + -mos. With «que» you would need the conjuntivo («que façamos»); «que fazemos» and bare «nós fazer» are ungrammatical.',
   'manual', '{}'::jsonb),

  ('aabbccdd-5555-4006-0003-b20000000000', 'multiple_choice', 1,
   'In «Antes de saírem, fechem as janelas», who is leaving?',
   'You (plural) — vocês', '{}',
   ARRAY['You (plural) — vocês','I — eu','He — ele','We — nós'],
   'Look at the ending of «saírem» and at the imperative «fechem».',
   'grammar', 'grammar', 'tap', 'infinitivo_pessoal',
   ARRAY['I — eu','He — ele','We — nós'],
   'The ending -em on «saírem» marks a plural subject, and the command «fechem» addresses «vocês». So the people leaving are "you (plural)". Subject marking on an infinitive is the hallmark of the personal infinitive.',
   'manual', '{}'::jsonb),

  ('aabbccdd-5555-4006-0003-b20000000000', 'fill_blank', 2,
   'É melhor ___ (nós, sair) antes do trânsito.',
   'sairmos', '{}', NULL,
   'Infinitive + -mos for «nós».',
   'grammar', 'grammar', 'type', 'infinitivo_pessoal', '{}',
   'With «é melhor» and the subject «nós», use the personal infinitive: «sair» + -mos = «sairmos». No conjunction «que» is needed.',
   'manual', '{}'::jsonb),

  ('aabbccdd-5555-4006-0003-b20000000000', 'cloze_deletion', 3,
   'Antes de ___ (tu, decidir), pensa bem.',
   'decidires', '{}', NULL,
   'After prepositions like «antes de», use the personal infinitive: -es for «tu».',
   'grammar', 'grammar', 'type', 'infinitivo_pessoal', '{}',
   'After the preposition «antes de», the verb stays in the infinitive, but the personal infinitive marks the subject: tu → «decidires» (infinitive + -es).',
   'manual', '{}'::jsonb),

  ('aabbccdd-5555-4006-0003-b20000000000', 'word_form', 4,
   'O professor deu-nos tempo para ___ (nós, acabar) o teste.',
   'acabarmos', '{}', NULL,
   '«Para» + personal infinitive expresses purpose: infinitive + -mos.',
   'grammar', 'grammar', 'type', 'infinitivo_pessoal', '{}',
   'Purpose clauses with «para» use the personal infinitive when the subject is expressed: «para acabarmos» = "so that we can finish". Add -mos to the infinitive for «nós».',
   'manual', '{"baseWord": "acabar"}'::jsonb),

  ('aabbccdd-5555-4006-0003-b20000000000', 'fill_blank', 5,
   'Depois de os convidados ___ (chegar), servimos o jantar.',
   'chegarem', '{}', NULL,
   'The subject «os convidados» is plural: infinitive + -em.',
   'grammar', 'grammar', 'type', 'infinitivo_pessoal', '{}',
   'After «depois de» with its own subject («os convidados»), the personal infinitive is required: «chegarem» (infinitive + -em for the third person plural).',
   'manual', '{}'::jsonb),

  ('aabbccdd-5555-4006-0003-b20000000000', 'sentence_transformation', 6,
   'Combine using the personal infinitive: Nós temos de estudar. É essencial.',
   'É essencial estudarmos.',
   ARRAY['É essencial nós estudarmos.'],
   NULL,
   'Drop «que» and add the -mos ending to the infinitive.',
   'grammar', 'grammar', 'type', 'infinitivo_pessoal', '{}',
   'The impersonal expression «é essencial» can be followed directly by the personal infinitive: «estudarmos» carries the subject «nós» in its ending, so no «que» + conjuntivo is needed.',
   'manual', '{"originalSentence": "Nós temos de estudar. É essencial.", "instruction": "Combine into one sentence: É essencial…"}'::jsonb),

  ('aabbccdd-5555-4006-0003-b20000000000', 'error_correction', 7,
   'É urgente que fazermos alguma coisa.',
   'É urgente fazermos alguma coisa.',
   ARRAY['É urgente que façamos alguma coisa.','É urgente nós fazermos alguma coisa.'],
   NULL,
   'You cannot combine «que» with the personal infinitive — choose one structure.',
   'grammar', 'grammar', 'type', 'infinitivo_pessoal', '{}',
   'The personal infinitive «fazermos» never follows «que». Either drop «que» («É urgente fazermos…») or keep «que» and switch to the conjuntivo («…que façamos…»). Mixing the two structures is the error.',
   'manual', '{"error_sentence": "É urgente que fazermos alguma coisa."}'::jsonb),

  ('aabbccdd-5555-4006-0003-b20000000000', 'sentence_construction', 8,
   'Build the Portuguese sentence: "The best thing is for us to wait until tomorrow."',
   'O melhor é esperarmos até amanhã',
   ARRAY['Esperarmos até amanhã é o melhor'],
   NULL,
   'Personal infinitive: «esperar» + -mos, and no «que».',
   'grammar', 'grammar', 'tap', 'infinitivo_pessoal',
   ARRAY['que','esperem'],
   '«O melhor é» + personal infinitive: «esperarmos» marks the subject "we" in its ending. Adding «que» would require a conjuntivo, and «esperem» would change the subject to "they / you (plural)".',
   'manual', '{"tiles": ["O","melhor","é","esperarmos","até","amanhã"], "distractors": ["que","esperem"]}'::jsonb),

  ('aabbccdd-5555-4006-0003-b20000000000', 'translate_to_target', 9,
   'Translate to Portuguese: It is better for us to leave now.',
   'É melhor irmos embora agora.',
   ARRAY['É melhor sairmos agora.','É melhor irmos agora.','É melhor nós irmos embora agora.','É melhor nós sairmos agora.','É melhor partirmos agora.','É melhor nós irmos agora.','É melhor nós partirmos agora.'],
   NULL,
   'Use the personal infinitive with -mos; "to leave" can be «ir embora» or «sair».',
   'grammar', 'grammar', 'type', 'infinitivo_pessoal', '{}',
   'Impersonal «é melhor» + personal infinitive expresses "for us to…": «irmos (embora)» or «sairmos». The -mos ending already identifies the subject, so «nós» is optional.',
   'manual', '{}'::jsonb);

-- ═══════════════════════════════════════════════════════════════════════════
-- Lesson 4 — O Discurso Indireto  (order_index 3)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO exercises
  (lesson_id, type, order_index, prompt, correct_answer, accepted_answers, options, hint_text, skill_type, subskill, response_mode, target_grammar, distractors, explanation, source_type, metadata)
VALUES
  ('aabbccdd-5555-4006-0004-b20000000000', 'multiple_choice', 0,
   '«Hoje estou cansada», disse a Maria ontem. → A Maria disse que ___ cansada naquele dia.',
   'estava', '{}',
   ARRAY['estava','está','é','foi'],
   'Reporting verb in the past → the present tense shifts to the imperfeito.',
   'grammar', 'grammar', 'tap', 'discurso_indireto',
   ARRAY['está','é','foi'],
   'After a past reporting verb («disse»), the present «estou» backshifts to the imperfeito «estava». «Está» clashes with «naquele dia», and «é»/«foi» use the wrong verb (ser) for a temporary state.',
   'manual', '{}'::jsonb),

  ('aabbccdd-5555-4006-0004-b20000000000', 'multiple_choice', 1,
   'Direct speech last week: «Volto amanhã.» → Ele disse que voltava ___.',
   'no dia seguinte', '{}',
   ARRAY['no dia seguinte','amanhã','ontem','naquele momento'],
   'Time words shift in reported speech: what does «amanhã» become?',
   'grammar', 'grammar', 'tap', 'discurso_indireto',
   ARRAY['amanhã','ontem','naquele momento'],
   'In reported speech, time words shift away from the original speaker''s "now": «amanhã» (tomorrow) becomes «no dia seguinte» (the following day), because the reporting happens later.',
   'manual', '{}'::jsonb),

  ('aabbccdd-5555-4006-0004-b20000000000', 'fill_blank', 2,
   '«Falo português.» → Ela disse que ___ português.',
   'falava', '{}', NULL,
   'Present → imperfeito after «disse que».',
   'grammar', 'grammar', 'type', 'discurso_indireto', '{}',
   'The present indicative «falo» backshifts to the imperfeito «falava» when reported with a past verb: «Ela disse que falava português».',
   'manual', '{}'::jsonb),

  ('aabbccdd-5555-4006-0004-b20000000000', 'cloze_deletion', 3,
   '«Comprei um carro novo.» → O João disse que ___ um carro novo.',
   'tinha comprado',
   ARRAY['comprara','havia comprado'],
   NULL,
   'Pretérito perfeito → mais-que-perfeito: tinha + particípio.',
   'grammar', 'grammar', 'type', 'discurso_indireto', '{}',
   'A completed past action («comprei») moves one step further back when reported: the mais-que-perfeito composto «tinha comprado». The literary simple form «comprara» and «havia comprado» are also correct.',
   'manual', '{}'::jsonb),

  ('aabbccdd-5555-4006-0004-b20000000000', 'word_form', 4,
   '«Vou ajudar-te.» → Ela disse que me ___ ajudar.',
   'ia',
   ARRAY['iria'],
   NULL,
   '«Vou» (present of ir) shifts to the imperfeito of «ir».',
   'grammar', 'grammar', 'type', 'discurso_indireto', '{}',
   'The near-future «vou ajudar» backshifts to «ia ajudar» (imperfeito of ir); the conditional «iria ajudar» is also accepted. Note the pronoun: «te» becomes «me», because the original listener is now the one reporting.',
   'manual', '{"baseWord": "ir"}'::jsonb),

  ('aabbccdd-5555-4006-0004-b20000000000', 'fill_blank', 5,
   '«Ajudarei sempre os meus amigos.» → Ele disse que ___ sempre os seus amigos.',
   'ajudaria',
   ARRAY['ia ajudar'],
   NULL,
   'Futuro → condicional in reported speech.',
   'grammar', 'grammar', 'type', 'discurso_indireto', '{}',
   'The future indicative «ajudarei» becomes the conditional «ajudaria» after a past reporting verb. «Ia ajudar» is a common spoken alternative.',
   'manual', '{}'::jsonb),

  ('aabbccdd-5555-4006-0004-b20000000000', 'sentence_transformation', 6,
   'Rewrite in reported speech: «Não posso ir à festa», disse o Pedro.',
   'O Pedro disse que não podia ir à festa.',
   ARRAY['Pedro disse que não podia ir à festa.','O Pedro disse que ele não podia ir à festa.'],
   NULL,
   '«Posso» (present) → imperfeito of «poder».',
   'grammar', 'grammar', 'type', 'discurso_indireto', '{}',
   'The present «posso» backshifts to the imperfeito «podia»: «disse que não podia ir». The rest of the sentence is unchanged because place and time expressions do not shift here.',
   'manual', '{"originalSentence": "«Não posso ir à festa», disse o Pedro.", "instruction": "Rewrite in reported speech: O Pedro disse que…"}'::jsonb),

  ('aabbccdd-5555-4006-0004-b20000000000', 'error_correction', 7,
   'Ela perguntou-me que horas são agora.',
   'Ela perguntou-me que horas eram.',
   ARRAY['Ela me perguntou que horas eram.','Ela perguntou-me que horas eram naquele momento.'],
   NULL,
   'A reported past question cannot keep the present tense together with «agora».',
   'grammar', 'grammar', 'type', 'discurso_indireto', '{}',
   'With the past reporting verb «perguntou», the embedded question backshifts: «são» → «eram», and «agora» disappears (or becomes «naquele momento»). Keeping «são agora» mixes the original speaker''s time with the reporter''s.',
   'manual', '{"error_sentence": "Ela perguntou-me que horas são agora."}'::jsonb),

  ('aabbccdd-5555-4006-0004-b20000000000', 'sentence_construction', 8,
   'Build the reported sentence: "They said they had missed the train."',
   'Eles disseram que tinham perdido o comboio',
   ARRAY['Disseram que eles tinham perdido o comboio'],
   NULL,
   '"Had missed" = mais-que-perfeito composto: tinham + particípio.',
   'grammar', 'grammar', 'tap', 'discurso_indireto',
   ARRAY['perdem','tem'],
   'The English past perfect "had missed" corresponds to the mais-que-perfeito composto: «tinham perdido». «Comboio» is the European Portuguese word for train (Brazil says «trem»).',
   'manual', '{"tiles": ["Eles","disseram","que","tinham","perdido","o","comboio"], "distractors": ["perdem","tem"]}'::jsonb),

  ('aabbccdd-5555-4006-0004-b20000000000', 'translate_to_target', 9,
   'Translate (reported speech): She said that she lived in Porto.',
   'Ela disse que morava no Porto.',
   ARRAY['Ela disse que vivia no Porto.','Disse que morava no Porto.','Disse que vivia no Porto.','Ela disse que ela morava no Porto.'],
   NULL,
   '"Lived" here is an ongoing past state: use the imperfeito. The city is «o Porto».',
   'grammar', 'grammar', 'type', 'discurso_indireto', '{}',
   'Reported states use the imperfeito: «morava» or «vivia». Note that the city of Porto takes the definite article in Portuguese: «no Porto» (em + o).',
   'manual', '{}'::jsonb);

-- ═══════════════════════════════════════════════════════════════════════════
-- Lesson 5 — A Voz Passiva e o «se»  (order_index 4)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO exercises
  (lesson_id, type, order_index, prompt, correct_answer, accepted_answers, options, hint_text, skill_type, subskill, response_mode, target_grammar, distractors, explanation, source_type, metadata)
VALUES
  ('aabbccdd-5555-4006-0005-b20000000000', 'multiple_choice', 0,
   'Which sentence is in the passive voice?',
   'O bolo foi feito pela avó.', '{}',
   ARRAY['O bolo foi feito pela avó.','A avó fez o bolo.','A avó está a fazer um bolo.','A avó vai fazer um bolo.'],
   'Passive = ser + past participle; the doer appears after «por».',
   'grammar', 'grammar', 'tap', 'voz_passiva',
   ARRAY['A avó fez o bolo.','A avó está a fazer um bolo.','A avó vai fazer um bolo.'],
   'The passive voice combines «ser» with a past participle: «foi feito». The subject («o bolo») receives the action, and the agent takes «por»: «pela avó». The other sentences are active — the grandmother is the subject doing the action.',
   'manual', '{}'::jsonb),

  ('aabbccdd-5555-4006-0005-b20000000000', 'multiple_choice', 1,
   'What does «Aluga-se este apartamento» mean?',
   'This apartment is for rent', '{}',
   ARRAY['This apartment is for rent','Someone already rented this apartment','Rent this apartment!','He rents this apartment from a friend'],
   'The «se» makes the verb passive: the apartment undergoes the action.',
   'grammar', 'grammar', 'tap', 'voz_passiva',
   ARRAY['Someone already rented this apartment','Rent this apartment!','He rents this apartment from a friend'],
   'The pronoun «se» creates a passive meaning without naming an agent: «aluga-se» = "is (being) rented / for rent". It is very common on signs and adverts. It is not a command and not a completed action.',
   'manual', '{}'::jsonb),

  ('aabbccdd-5555-4006-0005-b20000000000', 'fill_blank', 2,
   'O relatório foi ___ (escrever) pela diretora.',
   'escrito', '{}', NULL,
   '«Escrever» has an irregular past participle.',
   'grammar', 'grammar', 'type', 'voz_passiva', '{}',
   'The passive requires the past participle. «Escrever» is irregular: «escrito» (never "escrevido"). It agrees with «o relatório» (masculine singular).',
   'manual', '{}'::jsonb),

  ('aabbccdd-5555-4006-0005-b20000000000', 'cloze_deletion', 3,
   'As encomendas foram ___ (entregar) ontem à tarde.',
   'entregues', '{}', NULL,
   'With «ser», use the short participle of «entregar», agreeing in the feminine plural.',
   'grammar', 'grammar', 'type', 'voz_passiva', '{}',
   '«Entregar» has two participles; with «ser» (the passive), standard usage takes the short form «entregue», agreeing with «as encomendas»: «entregues». The long form «entregado» is reserved for «ter/haver».',
   'manual', '{}'::jsonb),

  ('aabbccdd-5555-4006-0005-b20000000000', 'word_form', 4,
   'Descobriu-se que o quadro tinha sido ___ (roubar).',
   'roubado', '{}', NULL,
   'Passive chain: tinha sido + particípio, agreeing with «o quadro».',
   'grammar', 'grammar', 'type', 'voz_passiva', '{}',
   'In «tinha sido roubado», the participle «roubado» completes the passive («ser» + participle) inside the mais-que-perfeito. It agrees with «o quadro» (masculine singular).',
   'manual', '{"baseWord": "roubar"}'::jsonb),

  ('aabbccdd-5555-4006-0005-b20000000000', 'fill_blank', 5,
   '___-se muitos livros nesta feira. (vender)',
   'Vendem', '{}', NULL,
   'In the passive «se» construction, the verb agrees with «muitos livros» (plural).',
   'grammar', 'grammar', 'type', 'voz_passiva', '{}',
   'With passive «se», the noun («muitos livros») is the grammatical subject, so the verb is plural: «Vendem-se muitos livros». Singular «vende-se» would only be correct with a singular subject.',
   'manual', '{}'::jsonb),

  ('aabbccdd-5555-4006-0005-b20000000000', 'sentence_transformation', 6,
   'Rewrite in the passive voice: O júri anunciou os resultados.',
   'Os resultados foram anunciados pelo júri.',
   ARRAY['Os resultados foram anunciados.'],
   NULL,
   'ser (pretérito perfeito) + particípio agreeing with «os resultados»; agent with «por» (pelo).',
   'grammar', 'grammar', 'type', 'voz_passiva', '{}',
   'The object «os resultados» becomes the subject; «anunciou» becomes «foram anunciados» — «ser» in the same tense plus a participle agreeing in the masculine plural. The old subject takes «por»: «pelo júri».',
   'manual', '{"originalSentence": "O júri anunciou os resultados.", "instruction": "Rewrite in the passive voice: Os resultados…"}'::jsonb),

  ('aabbccdd-5555-4006-0005-b20000000000', 'error_correction', 7,
   'As cartas foi entregado ontem.',
   'As cartas foram entregues ontem.',
   '{}',
   NULL,
   'Both the auxiliary and the participle must agree with «as cartas» — and with «ser», «entregar» takes its short participle.',
   'grammar', 'grammar', 'type', 'voz_passiva', '{}',
   'In the passive, «ser» and the participle agree with the subject «as cartas» (feminine plural): «foram entregues». With «ser», «entregar» takes its short participle «entregue».',
   'manual', '{"error_sentence": "As cartas foi entregado ontem."}'::jsonb),

  ('aabbccdd-5555-4006-0005-b20000000000', 'sentence_construction', 8,
   'Build the Portuguese sentence: "Portuguese is spoken on four continents" (use the «se» construction).',
   'Fala-se português em quatro continentes',
   ARRAY['Em quatro continentes fala-se português'],
   NULL,
   'Singular subject («português») → singular verb + se.',
   'grammar', 'grammar', 'tap', 'voz_passiva',
   ARRAY['falam','línguas'],
   'The passive «se» construction «Fala-se português» means "Portuguese is spoken". The verb is singular because «português» is singular. «Falam» without «se» would make an active sentence with a different meaning.',
   'manual', '{"tiles": ["Fala-se","português","em","quatro","continentes"], "distractors": ["falam","línguas"]}'::jsonb),

  ('aabbccdd-5555-4006-0005-b20000000000', 'translate_to_target', 9,
   'Translate using the passive voice: The bridge was built in 1966.',
   'A ponte foi construída em 1966.',
   '{}',
   NULL,
   'ser (pretérito perfeito) + particípio of «construir», with feminine agreement.',
   'grammar', 'grammar', 'type', 'voz_passiva', '{}',
   '«A ponte» is feminine singular, so the participle agrees: «construída». The passive of a completed past event uses «foi» + participle: «foi construída».',
   'manual', '{}'::jsonb);

-- ═══════════════════════════════════════════════════════════════════════════
-- Lesson 6 — Review & Test  (order_index 5) — mixes all five topics
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO exercises
  (lesson_id, type, order_index, prompt, correct_answer, accepted_answers, options, hint_text, skill_type, subskill, response_mode, target_grammar, distractors, explanation, source_type, metadata)
VALUES
  ('aabbccdd-5555-4006-0006-b20000000000', 'multiple_choice', 0,
   'Complete: «Embora ___ tarde, vamos continuar a reunião.»',
   'seja', '{}',
   ARRAY['seja','é','era','foi'],
   '«Embora» always takes the conjuntivo.',
   'grammar', 'grammar', 'tap', 'conjuntivo_presente',
   ARRAY['é','era','foi'],
   'The concessive conjunction «embora» (although) always requires the conjuntivo: «embora seja tarde». Indicative forms like «é», «era» or «foi» are never used directly after «embora».',
   'manual', '{}'::jsonb),

  ('aabbccdd-5555-4006-0006-b20000000000', 'multiple_choice', 1,
   'What does «Precisa-se de empregados» mean?',
   'Employees are needed', '{}',
   ARRAY['Employees are needed','He needs a new job','The employees are very careful','Someone has already hired employees'],
   'Impersonal «se»: no specific person performs the action.',
   'grammar', 'grammar', 'tap', 'voz_passiva',
   ARRAY['He needs a new job','The employees are very careful','Someone has already hired employees'],
   '«Precisa-se de empregados» uses impersonal «se»: "one needs employees / employees are needed" — typical of job adverts. With verbs that take a preposition («precisar de»), the verb stays singular.',
   'manual', '{}'::jsonb),

  ('aabbccdd-5555-4006-0006-b20000000000', 'cloze_deletion', 2,
   'Logo que eu ___ (saber) alguma coisa, digo-te.',
   'souber', '{}', NULL,
   '«Logo que» + future → futuro do conjuntivo, from «souberam».',
   'grammar', 'grammar', 'type', 'futuro_do_conjuntivo', '{}',
   '«Logo que» (as soon as) with future meaning requires the futuro do conjuntivo. «Saber» is irregular: souberam → souber-. The eu form is «souber».',
   'manual', '{}'::jsonb),

  ('aabbccdd-5555-4006-0006-b20000000000', 'fill_blank', 3,
   'Trouxe fruta para as crianças ___ (comer) no intervalo.',
   'comerem', '{}', NULL,
   'The infinitive takes the -em ending to agree with «as crianças».',
   'grammar', 'grammar', 'type', 'infinitivo_pessoal', '{}',
   'In «para as crianças comerem», the personal infinitive marks its own subject («as crianças») with the ending -em — a purpose-clause structure unique to Portuguese.',
   'manual', '{}'::jsonb),

  ('aabbccdd-5555-4006-0006-b20000000000', 'word_form', 4,
   '«Faço o jantar hoje.» → Ele disse que ___ o jantar naquele dia.',
   'fazia', '{}', NULL,
   'Present → imperfeito after a past reporting verb.',
   'grammar', 'grammar', 'type', 'discurso_indireto', '{}',
   'The present «faço» backshifts to the imperfeito «fazia» in reported speech, and the time word «hoje» shifts to «naquele dia».',
   'manual', '{"baseWord": "fazer"}'::jsonb),

  ('aabbccdd-5555-4006-0006-b20000000000', 'cloze_deletion', 5,
   'O suspeito foi ___ (deter) pela polícia esta manhã.',
   'detido', '{}', NULL,
   '«Deter» conjugates like «ter»; its participle is irregular.',
   'grammar', 'grammar', 'type', 'voz_passiva', '{}',
   'The passive «foi detido» (was detained/arrested) uses the irregular participle of «deter»: «detido», agreeing with «o suspeito» (masculine singular). The agent takes «por»: «pela polícia».',
   'manual', '{}'::jsonb),

  ('aabbccdd-5555-4006-0006-b20000000000', 'sentence_transformation', 6,
   'Rewrite in the passive voice: Milhões de pessoas veem este programa.',
   'Este programa é visto por milhões de pessoas.',
   '{}',
   NULL,
   'Keep the present tense: é + the irregular particípio of «ver».',
   'grammar', 'grammar', 'type', 'voz_passiva', '{}',
   'The active present «veem» becomes «é visto»: «ser» in the present plus the irregular participle «visto», agreeing with «este programa». The agent takes «por»: «por milhões de pessoas».',
   'manual', '{"originalSentence": "Milhões de pessoas veem este programa.", "instruction": "Rewrite in the passive voice: Este programa…"}'::jsonb),

  ('aabbccdd-5555-4006-0006-b20000000000', 'error_correction', 7,
   'É pena que eles não podem vir ao casamento.',
   'É pena que eles não possam vir ao casamento.',
   ARRAY['É pena que não possam vir ao casamento.'],
   NULL,
   '«É pena que» expresses emotion — which mood must follow?',
   'grammar', 'grammar', 'type', 'conjuntivo_presente', '{}',
   'Emotion expressions like «é pena que» (it''s a shame that) require the conjuntivo: «possam» (irregular stem poss-). The indicative «podem» is the error.',
   'manual', '{"error_sentence": "É pena que eles não podem vir ao casamento."}'::jsonb),

  ('aabbccdd-5555-4006-0006-b20000000000', 'sentence_construction', 8,
   'Build the Portuguese sentence: "When you have time, come visit us."',
   'Quando tiveres tempo vem visitar-nos',
   ARRAY['Vem visitar-nos quando tiveres tempo'],
   NULL,
   '«Quando» + future → futuro do conjuntivo of «ter».',
   'grammar', 'grammar', 'tap', 'futuro_do_conjuntivo',
   ARRAY['tens','terás'],
   'Future reference after «quando» requires the futuro do conjuntivo «tiveres» (from «tiveram»). «Tens» (present) and «terás» (future indicative) are both wrong here. «Vem» is the tu imperative.',
   'manual', '{"tiles": ["Quando","tiveres","tempo","vem","visitar-nos"], "distractors": ["tens","terás"]}'::jsonb),

  ('aabbccdd-5555-4006-0006-b20000000000', 'translate_to_target', 9,
   'Translate to Portuguese: It is important for us to arrive early.',
   'É importante chegarmos cedo.',
   ARRAY['É importante nós chegarmos cedo.','É importante que cheguemos cedo.','É importante que nós cheguemos cedo.'],
   NULL,
   'Personal infinitive: chegar + -mos. (A «que» + conjuntivo version also exists.)',
   'grammar', 'grammar', 'type', 'infinitivo_pessoal', '{}',
   '"For us to arrive" maps onto the personal infinitive «chegarmos» after «é importante». The equivalent «que cheguemos» (conjuntivo) is also correct — but never mix «que» with the infinitive.',
   'manual', '{}'::jsonb);

-- ═══════════════════════════════════════════════════════════════════════════
-- Grammar rules reference — Portuguese, 5 per CEFR level (A1–B2)
-- B2 rule_name values match the exercises' target_grammar tags so that
-- RuleCard.tsx can surface them on grammar errors.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO grammar_rules (language, cefr_level, rule_name, title, explanation, examples, common_errors, tags) VALUES

-- ─── A1 ──────────────────────────────────────────────────────────────────────
('pt', 'A1', 'ser_vs_estar', 'Ser vs. Estar (to be)',
 '«Ser» describes permanent or defining qualities: identity, origin, profession, time — «Sou português». «Estar» describes temporary states and location: «Estou cansado», «Estou em casa». Compare: «Ela é alegre» (a cheerful person) vs. «Ela está alegre» (cheerful right now).',
 '[{"target": "Eu sou professor.", "native": "I am a teacher."}, {"target": "Hoje estou muito cansado.", "native": "Today I am very tired."}]'::jsonb,
 '[{"wrong": "Eu sou cansado.", "right": "Eu estou cansado.", "note": "Tiredness is a temporary state, so use «estar»."}]'::jsonb,
 ARRAY['verbs','essentials','a1']),

('pt', 'A1', 'genero_e_artigos', 'Gender and Definite Articles',
 'Every noun is masculine or feminine. Use «o/os» with masculine nouns and «a/as» with feminine ones: «o livro», «a casa». Most nouns ending in -o are masculine and in -a feminine, but watch the exceptions: «o dia», «o problema», «a mão».',
 '[{"target": "O carro é novo.", "native": "The car is new."}, {"target": "As casas são grandes.", "native": "The houses are big."}]'::jsonb,
 '[{"wrong": "a problema", "right": "o problema", "note": "Words of Greek origin ending in -ma are masculine."}]'::jsonb,
 ARRAY['nouns','articles','gender','a1']),

('pt', 'A1', 'presente_do_indicativo', 'Present Tense: Regular Verbs',
 'Three families: -ar (falo, falas, fala, falamos, falam), -er (como, comes, come, comemos, comem) and -ir (parto, partes, parte, partimos, partem). The ending already shows the subject, so subject pronouns are often dropped: «Falo português» = "I speak Portuguese".',
 '[{"target": "Eu falo português todos os dias.", "native": "I speak Portuguese every day."}, {"target": "Nós comemos peixe ao jantar.", "native": "We eat fish for dinner."}]'::jsonb,
 '[{"wrong": "Eu falar português.", "right": "Eu falo português.", "note": "Conjugate the verb — do not use the bare infinitive."}]'::jsonb,
 ARRAY['present','verbs','a1']),

('pt', 'A1', 'negacao_com_nao', 'Negation with «não»',
 'Put «não» directly before the verb: «Não falo inglês». Double negatives are correct and required: «Não vejo nada» (I do not see anything), «Não conheço ninguém». In short answers, repeat the verb: «Falas inglês? — Não falo.»',
 '[{"target": "Não gosto de café.", "native": "I do not like coffee."}, {"target": "Ele não come nada de manhã.", "native": "He does not eat anything in the morning."}]'::jsonb,
 '[{"wrong": "Eu falo não inglês.", "right": "Eu não falo inglês.", "note": "«Não» comes before the verb, never after it."}]'::jsonb,
 ARRAY['negation','a1']),

('pt', 'A1', 'contracoes_de_preposicoes', 'Contractions: de / em / a + Articles',
 'Prepositions merge with the definite articles: de + o = do, de + a = da, em + o = no, em + a = na, a + o = ao, a + a = à. These contractions are compulsory: say «Vou ao cinema», never "a o cinema".',
 '[{"target": "Moro no Porto.", "native": "I live in Porto."}, {"target": "Vou à escola de autocarro.", "native": "I go to school by bus."}]'::jsonb,
 '[{"wrong": "Estou em o escritório.", "right": "Estou no escritório.", "note": "«Em + o» must contract to «no»."}]'::jsonb,
 ARRAY['prepositions','contractions','a1']),

-- ─── A2 ──────────────────────────────────────────────────────────────────────
('pt', 'A2', 'preterito_perfeito_simples', 'Pretérito Perfeito Simples (simple past)',
 'The simple past for completed events: -ar → falei, falaste, falou, falámos, falaram; -er → comi, comeste, comeu. Key irregulars: ser/ir → fui, foste, foi; ter → tive; fazer → fiz; estar → estive. «Ser» and «ir» share the same past forms.',
 '[{"target": "Ontem falei com a minha mãe.", "native": "Yesterday I spoke with my mother."}, {"target": "Eles foram ao cinema no sábado.", "native": "They went to the cinema on Saturday."}]'::jsonb,
 '[{"wrong": "Eu fazi o jantar.", "right": "Eu fiz o jantar.", "note": "«Fazer» is irregular in the past: fiz, fizeste, fez."}]'::jsonb,
 ARRAY['past','tenses','a2']),

('pt', 'A2', 'preterito_imperfeito', 'Pretérito Imperfeito (past habits and states)',
 'The past of habits, descriptions and background: -ar → falava; -er/-ir → comia, partia. Irregulars: ser → era, ter → tinha, vir → vinha, pôr → punha. Use it for "used to" and ongoing past states: «Quando era criança, morava no Porto».',
 '[{"target": "Antigamente eu morava em Lisboa.", "native": "I used to live in Lisbon."}, {"target": "Ela era muito tímida.", "native": "She was very shy."}]'::jsonb,
 '[{"wrong": "Quando fui criança, gostei de futebol.", "right": "Quando era criança, gostava de futebol.", "note": "Habits and states in the past take the imperfeito, not the perfeito."}]'::jsonb,
 ARRAY['past','tenses','a2']),

('pt', 'A2', 'ir_mais_infinitivo', 'Near Future: ir + Infinitive',
 'The most common way to talk about the future: present of «ir» + infinitive — «Vou viajar amanhã» (I am going to travel tomorrow). Do not insert «a» or «para» between them. To say you are going somewhere, «ir» stands alone: «Vou ao cinema».',
 '[{"target": "Vamos jantar fora hoje.", "native": "We are going to eat out tonight."}, {"target": "Ela vai comprar um carro.", "native": "She is going to buy a car."}]'::jsonb,
 '[{"wrong": "Vou a estudar agora.", "right": "Vou estudar agora.", "note": "No preposition between «ir» and the infinitive."}]'::jsonb,
 ARRAY['future','a2']),

('pt', 'A2', 'comparativos_e_superlativos', 'Comparatives and Superlatives',
 'Compare with «mais/menos… (do) que»: «mais alto do que». Equality: «tão… como» («tão alto como»). Superlative: «o mais alto». Irregulars: bom → melhor, mau → pior, grande → maior. Never say "mais bom" or "mais grande".',
 '[{"target": "O Porto é mais pequeno do que Lisboa.", "native": "Porto is smaller than Lisbon."}, {"target": "Este é o melhor restaurante da cidade.", "native": "This is the best restaurant in the city."}]'::jsonb,
 '[{"wrong": "Este bolo é mais bom.", "right": "Este bolo é melhor.", "note": "«Bom» has the irregular comparative «melhor»."}]'::jsonb,
 ARRAY['adjectives','comparison','a2']),

('pt', 'A2', 'estar_a_mais_infinitivo', 'Ongoing Actions: estar a + Infinitive',
 'European Portuguese expresses actions in progress with «estar a» + infinitive: «Estou a trabalhar» (I am working). Brazilian Portuguese uses the gerund instead: «Estou trabalhando». Both are correct in their varieties; choose one pattern and be consistent.',
 '[{"target": "Ela está a ler um livro.", "native": "She is reading a book. (European)"}, {"target": "Ela está lendo um livro.", "native": "She is reading a book. (Brazilian)"}]'::jsonb,
 '[{"wrong": "Estou a trabalhando.", "right": "Estou a trabalhar. / Estou trabalhando.", "note": "Do not mix «a» with the gerund — the two patterns are alternatives."}]'::jsonb,
 ARRAY['progressive','variation','a2']),

-- ─── B1 ──────────────────────────────────────────────────────────────────────
('pt', 'B1', 'imperativo', 'The Imperative (commands)',
 'For «tu», the affirmative imperative equals the present indicative minus -s: «fala!», «come!». Negative commands and all «você/vocês» forms use the conjuntivo: «não fales!», «fale!», «façam!». Irregulars include «sê» (ser), «vai» (ir) and «diz» (dizer).',
 '[{"target": "Fala mais devagar, por favor.", "native": "Speak more slowly, please."}, {"target": "Não te esqueças das chaves.", "native": "Do not forget the keys."}]'::jsonb,
 '[{"wrong": "Não fala tão alto!", "right": "Não fales tão alto!", "note": "Negative tu commands use the conjuntivo form with -es."}]'::jsonb,
 ARRAY['imperative','commands','b1']),

('pt', 'B1', 'futuro_do_indicativo', 'The Simple Future (Futuro do Indicativo)',
 'Formed by adding -ei, -ás, -á, -emos, -ão to the infinitive: «falarei», «comerás». Only three verbs are irregular: dizer → direi, fazer → farei, trazer → trarei. In everyday speech, «ir + infinitive» («vou falar») is more common.',
 '[{"target": "Amanhã falarei com o diretor.", "native": "Tomorrow I will speak with the director."}, {"target": "Eles farão o possível.", "native": "They will do what they can."}]'::jsonb,
 '[{"wrong": "Eu fazerei o trabalho.", "right": "Eu farei o trabalho.", "note": "«Fazer» has the irregular future stem far-."}]'::jsonb,
 ARRAY['future','tenses','b1']),

('pt', 'B1', 'condicional', 'The Conditional (Condicional)',
 'Add -ia, -ias, -íamos, -iam to the infinitive: «gostaria», «seria». Use it for polite requests («Gostaria de um café»), hypotheses («Seria ótimo») and the future-in-the-past in reported speech. Dizer, fazer and trazer keep their short stems: diria, faria, traria.',
 '[{"target": "Gostaria de um café, por favor.", "native": "I would like a coffee, please."}, {"target": "Ele disse que viria mais tarde.", "native": "He said he would come later."}]'::jsonb,
 '[{"wrong": "Eu fazeria isso.", "right": "Eu faria isso.", "note": "«Fazer» keeps its short stem far- in the conditional."}]'::jsonb,
 ARRAY['conditional','politeness','b1']),

('pt', 'B1', 'preterito_perfeito_composto', 'Pretérito Perfeito Composto (ter + participle)',
 'Unlike in other Romance languages, «ter» + participle does NOT describe a single past event. It expresses repetition or continuity up to now: «Tenho trabalhado muito» = "I have been working a lot lately". For one completed event, use the simple past: «Trabalhei ontem».',
 '[{"target": "Tenho estudado todos os dias.", "native": "I have been studying every day (lately)."}, {"target": "Ultimamente temos visto muitos filmes.", "native": "Lately we have been watching a lot of films."}]'::jsonb,
 '[{"wrong": "Tenho visitado Paris em 2020.", "right": "Visitei Paris em 2020.", "note": "A single completed event takes the pretérito perfeito simples."}]'::jsonb,
 ARRAY['tenses','present-perfect','b1']),

('pt', 'B1', 'pronomes_cliticos_colocacao', 'Clitic Pronoun Placement',
 'In European Portuguese, object pronouns normally follow the verb with a hyphen: «Ele viu-me». They move before the verb after triggers such as «não», «que», «já», «também» and question words: «Ele não me viu». Brazilian Portuguese generally prefers the pronoun before the verb.',
 '[{"target": "Ela deu-me um presente.", "native": "She gave me a present."}, {"target": "Ela não me deu nada.", "native": "She did not give me anything."}]'::jsonb,
 '[{"wrong": "Ele não viu-me.", "right": "Ele não me viu.", "note": "«Não» attracts the pronoun to a position before the verb."}]'::jsonb,
 ARRAY['pronouns','clitics','word-order','b1']),

-- ─── B2 (rule_name matches exercises.target_grammar) ────────────────────────
('pt', 'B2', 'conjuntivo_presente', 'The Present Subjunctive (Conjuntivo Presente)',
 'Used after expressions of wish, doubt, emotion and influence («quero que», «duvido que», «é pena que»), after «talvez» before the verb, and after conjunctions like «embora» and «para que». Form it from the eu present form: falo → fale, como → coma, parto → parta.',
 '[{"target": "Espero que venhas cedo.", "native": "I hope you come early."}, {"target": "Embora seja caro, vou comprá-lo.", "native": "Although it is expensive, I am going to buy it."}]'::jsonb,
 '[{"wrong": "Espero que ele vem.", "right": "Espero que ele venha.", "note": "«Esperar que» requires the conjuntivo, not the indicative."}]'::jsonb,
 ARRAY['subjunctive','mood','verbs','b2']),

('pt', 'B2', 'futuro_do_conjuntivo', 'The Future Subjunctive (Futuro do Conjuntivo)',
 'Used after «se», «quando», «assim que», «enquanto» and «sempre que» when they refer to the future. Regular verbs look like the infinitive («falar», «falares», «falarmos»); irregular verbs use the eles-form of the pretérito perfeito minus -am: fizeram → fizer, tiveram → tiver, foram → for.',
 '[{"target": "Quando fores a Lisboa, liga-me.", "native": "When you go to Lisbon, call me."}, {"target": "Se puderes, vem jantar connosco.", "native": "If you can, come have dinner with us."}]'::jsonb,
 '[{"wrong": "Quando chegarás, telefona-me.", "right": "Quando chegares, telefona-me.", "note": "After «quando» with future meaning, use the futuro do conjuntivo, never the future indicative."}]'::jsonb,
 ARRAY['subjunctive','future','conditions','b2']),

('pt', 'B2', 'infinitivo_pessoal', 'The Personal Infinitive (Infinitivo Pessoal)',
 'A uniquely Portuguese form: an infinitive with subject endings — tu -es, nós -mos, eles/vocês -em. Use it after prepositions («antes de saíres», «para acabarmos») and impersonal expressions («é melhor irmos»). Never use it after «que», which requires the conjuntivo instead.',
 '[{"target": "É melhor irmos embora.", "native": "It is better for us to leave."}, {"target": "Antes de saíres, fecha a janela.", "native": "Before you leave, close the window."}]'::jsonb,
 '[{"wrong": "É importante nós estudar.", "right": "É importante nós estudarmos.", "note": "With an expressed subject, the infinitive takes personal endings."}]'::jsonb,
 ARRAY['infinitive','unique-to-portuguese','b2']),

('pt', 'B2', 'discurso_indireto', 'Reported Speech (Discurso Indireto)',
 'After a past reporting verb, tenses shift back: presente → imperfeito («falo» → «falava»), pretérito perfeito → mais-que-perfeito («comprei» → «tinha comprado»), futuro → condicional («ajudarei» → «ajudaria»). Time and place words shift too: «hoje» → «naquele dia», «amanhã» → «no dia seguinte».',
 '[{"target": "Ela disse que estava cansada.", "native": "She said she was tired."}, {"target": "Ele disse que voltaria no dia seguinte.", "native": "He said he would come back the next day."}]'::jsonb,
 '[{"wrong": "Ela disse que vai amanhã.", "right": "Ela disse que ia no dia seguinte.", "note": "Shift both the tense and the time expression when reporting past speech."}]'::jsonb,
 ARRAY['reported-speech','tenses','b2']),

('pt', 'B2', 'voz_passiva', 'Passive Voice and «se»-constructions',
 'The passive uses «ser» + past participle, agreeing in gender and number with the subject: «As cartas foram enviadas». The agent takes «por». Portuguese also has the passive «se» construction, where the verb agrees with the noun: «Vende-se esta casa», «Vendem-se casas».',
 '[{"target": "O livro foi escrito por Saramago.", "native": "The book was written by Saramago."}, {"target": "Vendem-se casas nesta rua.", "native": "Houses for sale on this street."}]'::jsonb,
 '[{"wrong": "Vende-se casas.", "right": "Vendem-se casas.", "note": "With passive «se», the verb agrees with the plural noun."}]'::jsonb,
 ARRAY['passive','se-constructions','b2'])

ON CONFLICT (language, rule_name) DO UPDATE SET
  cefr_level = EXCLUDED.cefr_level,
  title = EXCLUDED.title,
  explanation = EXCLUDED.explanation,
  examples = EXCLUDED.examples,
  common_errors = EXCLUDED.common_errors,
  tags = EXCLUDED.tags;

COMMIT;
