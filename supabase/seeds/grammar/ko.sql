-- ═══════════════════════════════════════════════════════════════════════════
-- Fluenci — Korean B2 "Complex Grammar" unit rebuild + Korean grammar_rules
--
-- Replaces the broken European-template unit (Subjunctive Mood etc. — Korean
-- has no subjunctive) with linguistically correct upper-intermediate Korean
-- grammar content (TOPIK 3-4 / course CEFR label B2).
--
-- Reuses the 6 existing lesson IDs. Deletes and re-inserts all exercises.
-- Also seeds 20 grammar_rules rows for language='ko' (5 each A1/A2/B1/B2).
--
-- STAGED SEED — review before applying. Do NOT run db reset/push against the
-- shared prod project; apply via MCP execute_sql/apply_migration per CLAUDE.md.
--
-- Authoring notes (grading-aware, see lib/grading.ts):
--  * gradeAnswer fuzzy-accepts answers within Levenshtein distance 2 (1 when
--    the user's answer is <= 4 chars). Every multiple-choice distractor here
--    is >= 3 edits from the correct answer so a tapped distractor can never
--    be fuzzy-graded correct. Every error_correction fix changes >= 3 chars
--    so retyping the erroneous sentence verbatim is always graded incorrect.
--  * multiple_choice accepted_answers stays '{}' — MultipleChoice.tsx styles
--    any option found in accepted_answers as a correct option.
--  * sentence_construction tiles come from correct_answer.split(' ');
--    accepted_answers lists legitimate alternate word orders.
--  * sentence_transformation reads metadata.originalSentence / .instruction;
--    word_form reads metadata.baseWord.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── Unit ────────────────────────────────────────────────────────────────────

UPDATE units SET
  title = 'Complex Grammar',
  description = 'Indirect quotation, passive and causative verbs, conditionals, honorifics, and connective endings (TOPIK 3-4)'
WHERE id = 'aabbccdd-7777-4006-0000-b20000000000';

-- ─── Lessons (retitled, IDs reused) ─────────────────────────────────────────

UPDATE lessons SET
  title = 'Indirect Quotation (간접화법)',
  description = 'Report statements, questions, commands, and suggestions with -다고, -냐고, -(으)라고, and -자고'
WHERE id = 'aabbccdd-7777-4006-0001-b20000000000';

UPDATE lessons SET
  title = 'Passive & Causative (피동과 사동)',
  description = 'Passive and causative verbs with the suffixes -이/히/리/기 and the pattern -게 하다'
WHERE id = 'aabbccdd-7777-4006-0002-b20000000000';

UPDATE lessons SET
  title = 'Conditionals & Suppositions (조건과 가정)',
  description = 'Real conditions with -(으)면 and -거든, and past counterfactuals with -았/었더라면'
WHERE id = 'aabbccdd-7777-4006-0003-b20000000000';

UPDATE lessons SET
  title = 'Honorifics & Speech Levels (높임말)',
  description = 'Subject honorific -(으)시-, honorific and humble vocabulary, and 해요체 vs 합쇼체'
WHERE id = 'aabbccdd-7777-4006-0004-b20000000000';

UPDATE lessons SET
  title = 'Reason & Contrast Connectives (연결어미)',
  description = 'Cause and contrast with -느라고, -는 바람에, -는데도, and -더니'
WHERE id = 'aabbccdd-7777-4006-0005-b20000000000';

UPDATE lessons SET
  title = 'Review & Test',
  description = 'Mixed review of quotation, passive and causative, conditionals, honorifics, and connectives'
WHERE id = 'aabbccdd-7777-4006-0006-b20000000000';

-- ═══════════════════════════════════════════════════════════════════════════
-- Lesson 1 — Indirect Quotation (간접화법)
-- ═══════════════════════════════════════════════════════════════════════════

DELETE FROM exercises WHERE lesson_id = 'aabbccdd-7777-4006-0001-b20000000000';

INSERT INTO exercises
  (lesson_id, type, order_index, prompt, correct_answer, accepted_answers, options, hint_text, skill_type, subskill, response_mode, target_grammar, distractors, explanation, source_type, metadata)
VALUES
  ('aabbccdd-7777-4006-0001-b20000000000', 'multiple_choice', 0,
   '민수 씨가 내일 온다고 했어요. — What is the speaker telling you?',
   'Minsu said he will come tomorrow.',
   '{}',
   ARRAY['Minsu said he will come tomorrow.', 'Minsu asked if I will come tomorrow.', 'Minsu told me to come tomorrow.', 'Minsu suggested that we come tomorrow.'],
   '-다고 하다 reports a statement.',
   'grammar', 'grammar', 'tap', 'indirect_quotation',
   ARRAY['Minsu asked if I will come tomorrow.', 'Minsu told me to come tomorrow.', 'Minsu suggested that we come tomorrow.'],
   'The ending -ㄴ다고 attaches to a verb stem to report a statement: 온다고 했어요 = "(he) said he is coming." Questions use -냐고, commands -(으)라고, and suggestions -자고.',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0001-b20000000000', 'multiple_choice', 1,
   '선생님이 학생들에게 숙제를 다 하라고 하셨어요. — What did the teacher do?',
   'She told the students to finish the homework.',
   '{}',
   ARRAY['She told the students to finish the homework.', 'She said she finished the homework.', 'She asked if the students did the homework.', 'She suggested doing the homework together.'],
   '-(으)라고 하다 reports a command.',
   'grammar', 'grammar', 'tap', 'indirect_quotation',
   ARRAY['She said she finished the homework.', 'She asked if the students did the homework.', 'She suggested doing the homework together.'],
   '-(으)라고 하다 reports commands or instructions: 하라고 하셨어요 = "(she) told them to do it." A reported statement would be 한다고, a question 하냐고, and a suggestion 하자고.',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0001-b20000000000', 'multiple_choice', 2,
   'Your friend said: “같이 영화를 보자.” Which sentence reports this correctly?',
   '친구가 같이 영화를 보자고 했어요',
   '{}',
   ARRAY['친구가 같이 영화를 보자고 했어요', '친구가 같이 영화를 봤냐고 물었어요', '친구가 같이 영화를 보라고 명령했어요', '친구가 영화가 재미있다고 했어요'],
   'The quote ends in -자 (“let''s”) — suggestions are reported with -자고.',
   'grammar', 'grammar', 'tap', 'indirect_quotation',
   ARRAY['친구가 같이 영화를 봤냐고 물었어요', '친구가 같이 영화를 보라고 명령했어요', '친구가 영화가 재미있다고 했어요'],
   'The direct quote ends in -자 ("let''s"), so it is a suggestion and must be reported with -자고 하다. -냐고 물었어요 reports a question, -라고 reports a command, and 재미있다고 changes the meaning entirely.',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0001-b20000000000', 'fill_blank', 3,
   '동생이 지금 많이 ___ 했어요. (바쁘다 → reported statement)',
   '바쁘다고',
   '{}',
   NULL,
   'Adjectives take plain -다고 in reported speech — no -ㄴ/는.',
   'grammar', 'grammar', 'type', 'indirect_quotation',
   '{}',
   'Adjectives attach -다고 directly: 바쁘다 → 바쁘다고. The -ㄴ/는다고 pattern (간다고, 먹는다고) is only for action verbs, so 바쁜다고 is wrong.',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0001-b20000000000', 'cloze_deletion', 4,
   '의사가 저에게 푹 ___ 했어요. (쉬다 → reported command)',
   '쉬라고',
   '{}',
   NULL,
   'Report commands with -(으)라고.',
   'grammar', 'grammar', 'type', 'indirect_quotation',
   '{}',
   'The doctor''s command 푹 쉬세요 is reported with -(으)라고 하다. After a vowel-final stem like 쉬-, use -라고: 쉬라고 했어요 = "(he) told me to rest well."',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0001-b20000000000', 'word_form', 5,
   '친구가 주말마다 등산을 ___ 했어요. (가다 → reported present statement)',
   '간다고',
   '{}',
   NULL,
   'Action verbs take -ㄴ/는다고 for reported present statements.',
   'grammar', 'grammar', 'type', 'indirect_quotation',
   '{}',
   'Present-tense verb statements are reported with -ㄴ/는다고: vowel-final stems take -ㄴ다고 (가다 → 간다고), consonant-final stems take -는다고 (먹다 → 먹는다고). Plain 가다고 is incorrect.',
   'manual', '{"baseWord": "가다"}'::jsonb),

  ('aabbccdd-7777-4006-0001-b20000000000', 'sentence_transformation', 6,
   '수진: “머리가 아파요.” → Report Sujin''s statement with -다고 했어요. Start with 수진 씨가.',
   '수진 씨가 머리가 아프다고 했어요',
   ARRAY['수진씨가 머리가 아프다고 했어요', '수진 씨가 머리가 아프다고 말했어요', '수진씨가 머리가 아프다고 말했어요'],
   NULL,
   '아파요 → dictionary form 아프다 + -다고.',
   'grammar', 'grammar', 'type', 'indirect_quotation',
   '{}',
   'To report a polite statement, strip -아/어요 back to the dictionary form and add -다고 for adjectives: 아파요 → 아프다 → 아프다고 했어요. The politeness of the original is not preserved inside the quote.',
   'manual', '{"originalSentence": "수진: “머리가 아파요.”", "instruction": "Report Sujin''s statement with -다고 했어요. Start with 수진 씨가."}'::jsonb),

  ('aabbccdd-7777-4006-0001-b20000000000', 'error_correction', 7,
   '어머니가 창문을 닫아 주세요라고 부탁했어요.',
   '어머니가 창문을 닫아 달라고 부탁했어요',
   ARRAY['어머니가 창문을 닫아 달라고 했어요'],
   NULL,
   'Requests for the speaker''s own benefit use 달라고; polite endings never stay inside indirect quotes.',
   'grammar', 'grammar', 'type', 'indirect_quotation',
   '{}',
   'In indirect speech, -아/어 주세요 becomes -아/어 달라고 when the requester benefits from the action. Keeping the polite ending 주세요 inside the quote is ungrammatical: 닫아 달라고 부탁했어요.',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0001-b20000000000', 'sentence_construction', 8,
   'Arrange the words: “My friend suggested studying together tomorrow.”',
   '친구가 내일 같이 공부하자고 했어요',
   ARRAY['내일 친구가 같이 공부하자고 했어요'],
   NULL,
   'Subject or time word first; the quoted verb with -자고 comes right before 했어요.',
   'grammar', 'grammar', 'tap', 'indirect_quotation',
   '{}',
   'Suggestions are reported with -자고 하다: 공부하자고 했어요. Korean word order is subject – time – adverb – verb, though the time word 내일 may also open the sentence.',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0001-b20000000000', 'translate_to_target', 9,
   'Translate into Korean: “My friend said that she is busy these days.” (these days = 요즘)',
   '친구가 요즘 바쁘다고 했어요',
   ARRAY['친구는 요즘 바쁘다고 했어요', '친구가 요즘 바쁘다고 말했어요', '친구는 요즘 바쁘다고 말했어요'],
   NULL,
   'Adjective + -다고 하다.',
   'grammar', 'grammar', 'type', 'indirect_quotation',
   '{}',
   '바쁘다 is an adjective, so the reported form is 바쁘다고: 친구가 요즘 바쁘다고 했어요. Korean keeps the original tense inside the quote — no tense shift is needed.',
   'manual', '{}'::jsonb);

-- ═══════════════════════════════════════════════════════════════════════════
-- Lesson 2 — Passive & Causative (피동과 사동)
-- ═══════════════════════════════════════════════════════════════════════════

DELETE FROM exercises WHERE lesson_id = 'aabbccdd-7777-4006-0002-b20000000000';

INSERT INTO exercises
  (lesson_id, type, order_index, prompt, correct_answer, accepted_answers, options, hint_text, skill_type, subskill, response_mode, target_grammar, distractors, explanation, source_type, metadata)
VALUES
  ('aabbccdd-7777-4006-0002-b20000000000', 'multiple_choice', 0,
   '아기가 모기한테 물렸어요. — What does this sentence mean?',
   'The baby was bitten by a mosquito.',
   '{}',
   ARRAY['The baby was bitten by a mosquito.', 'The baby bit a mosquito.', 'The mosquito was caught by the baby.', 'The mom let the baby touch a mosquito.'],
   '물리다 is the passive of 물다 (to bite); 한테 marks the agent.',
   'grammar', 'grammar', 'tap', 'passive_causative',
   ARRAY['The baby bit a mosquito.', 'The mosquito was caught by the baby.', 'The mom let the baby touch a mosquito.'],
   '물리다 is the passive of 물다, so the subject 아기 is affected by the action, and 모기한테 marks who did it. The active version would be 모기가 아기를 물었어요.',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0002-b20000000000', 'multiple_choice', 1,
   '엄마가 아이에게 신발을 신겼어요. — What does this sentence mean?',
   'The mom put the shoes on the child.',
   '{}',
   ARRAY['The mom put the shoes on the child.', 'The child put on the shoes alone.', 'The mom took the shoes off the child.', 'The shoes were thrown away by the mom.'],
   '신기다 is the causative of 신다 — someone makes or helps someone else wear.',
   'grammar', 'grammar', 'tap', 'passive_causative',
   ARRAY['The child put on the shoes alone.', 'The mom took the shoes off the child.', 'The shoes were thrown away by the mom.'],
   '신기다 is the causative of 신다 (to wear on the feet): the mom causes the child to wear the shoes. If the child acted alone, it would be 아이가 신발을 신었어요.',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0002-b20000000000', 'multiple_choice', 2,
   'Which sentence uses the passive to say “The door was closed by the wind”?',
   '바람에 문이 닫혔어요',
   '{}',
   ARRAY['바람에 문이 닫혔어요', '바람이 문을 닫았어요', '문이 바람을 닫았어요', '제가 문을 닫았어요'],
   'Passive 닫히다 + inanimate cause marked with 에.',
   'grammar', 'grammar', 'tap', 'passive_causative',
   ARRAY['바람이 문을 닫았어요', '문이 바람을 닫았어요', '제가 문을 닫았어요'],
   'The passive 닫히다 makes 문 the subject, and the inanimate cause 바람 takes the particle 에. 바람이 문을 닫았어요 is active voice, and the other options change who does what.',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0002-b20000000000', 'fill_blank', 3,
   '도둑이 결국 경찰에게 ___. (잡다 → passive, past tense)',
   '잡혔어요',
   '{}',
   NULL,
   '잡다 + -히- = 잡히다 (to be caught).',
   'grammar', 'grammar', 'type', 'passive_causative',
   '{}',
   '잡다 takes the passive suffix -히-: 잡히다. In the past polite form this is 잡혔어요. The agent (the police) is marked with 에게 or 한테.',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0002-b20000000000', 'cloze_deletion', 4,
   '이 노래는 요즘 라디오에서 자주 ___. (듣다 → passive, present tense)',
   '들려요',
   '{}',
   NULL,
   '듣다 → 들리다 (to be heard); the ㄷ changes to ㄹ.',
   'grammar', 'grammar', 'type', 'passive_causative',
   '{}',
   '듣다 becomes the passive 들리다 — the ㄷ-irregular stem changes to ㄹ before the suffix -리-. Present polite: 들려요. "This song is heard often" means you often hear it.',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0002-b20000000000', 'word_form', 5,
   '엄마가 아기에게 우유를 ___. (먹다 → causative, past tense)',
   '먹였어요',
   '{}',
   NULL,
   '먹다 + -이- = 먹이다 (to feed).',
   'grammar', 'grammar', 'type', 'passive_causative',
   '{}',
   'The causative of 먹다 is 먹이다 (to make someone eat, i.e. to feed). Past polite: 먹였어요. The person being fed is marked with 에게: 아기에게 우유를 먹였어요.',
   'manual', '{"baseWord": "먹다"}'::jsonb),

  ('aabbccdd-7777-4006-0002-b20000000000', 'sentence_transformation', 6,
   '바람이 창문을 열었어요. → Rewrite as a passive sentence with 창문 as the subject.',
   '창문이 바람에 열렸어요',
   ARRAY['바람에 창문이 열렸어요'],
   NULL,
   '열다 → 열리다; inanimate causes take 에, not 에게.',
   'grammar', 'grammar', 'type', 'passive_causative',
   '{}',
   'In the passive, the object 창문 becomes the subject with 이, the verb takes -리- (열다 → 열리다 → 열렸어요), and the inanimate cause 바람 is marked with 에 rather than 에게.',
   'manual', '{"originalSentence": "바람이 창문을 열었어요.", "instruction": "Rewrite as a passive sentence. Make 창문 the subject and mark 바람 with 에."}'::jsonb),

  ('aabbccdd-7777-4006-0002-b20000000000', 'error_correction', 7,
   '도둑이 경찰을 잡았어요. (Intended meaning: The thief was caught by the police.)',
   '도둑이 경찰에게 잡혔어요',
   ARRAY['도둑이 경찰한테 잡혔어요'],
   NULL,
   'For “was caught,” use passive 잡히다 and mark the police as the agent with 에게/한테.',
   'grammar', 'grammar', 'type', 'passive_causative',
   '{}',
   'As written, the sentence says the thief caught the police. For the intended passive meaning, 경찰 needs the agent particle 에게 or 한테 and the verb must be passive: 잡혔어요.',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0002-b20000000000', 'sentence_construction', 8,
   'Arrange the words: “The mom fed the child vegetables.”',
   '엄마가 아이에게 야채를 먹였어요',
   ARRAY['엄마가 야채를 아이에게 먹였어요'],
   NULL,
   'The person made to eat is marked with 에게; the food keeps 를.',
   'grammar', 'grammar', 'tap', 'passive_causative',
   '{}',
   'With the causative 먹이다, the one who is made to eat (아이) takes 에게 and the food keeps the object particle 를: 엄마가 아이에게 야채를 먹였어요.',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0002-b20000000000', 'translate_to_target', 9,
   'Translate into Korean: “I was bitten by a mosquito.” (mosquito = 모기)',
   '모기한테 물렸어요',
   ARRAY['모기에게 물렸어요', '저는 모기한테 물렸어요', '저는 모기에게 물렸어요', '제가 모기한테 물렸어요', '제가 모기에게 물렸어요'],
   NULL,
   'Passive 물리다 + agent particle 한테/에게.',
   'grammar', 'grammar', 'type', 'passive_causative',
   '{}',
   'Use the passive 물리다 with the biter marked by 한테 or 에게: 모기한테 물렸어요. The subject 저는 can be dropped because it is understood from context.',
   'manual', '{}'::jsonb);

-- ═══════════════════════════════════════════════════════════════════════════
-- Lesson 3 — Conditionals & Suppositions (조건과 가정)
-- ═══════════════════════════════════════════════════════════════════════════

DELETE FROM exercises WHERE lesson_id = 'aabbccdd-7777-4006-0003-b20000000000';

INSERT INTO exercises
  (lesson_id, type, order_index, prompt, correct_answer, accepted_answers, options, hint_text, skill_type, subskill, response_mode, target_grammar, distractors, explanation, source_type, metadata)
VALUES
  ('aabbccdd-7777-4006-0003-b20000000000', 'multiple_choice', 0,
   '시간이 있으면 같이 저녁 먹어요. — What does this mean?',
   'If you have time, let''s have dinner together.',
   '{}',
   ARRAY['If you have time, let''s have dinner together.', 'Because I have time, I had dinner.', 'Even if you have time, don''t eat dinner.', 'Whenever I had time, I used to eat dinner alone.'],
   '-(으)면 marks a condition: “if / when.”',
   'grammar', 'grammar', 'tap', 'conditionals_suppositions',
   ARRAY['Because I have time, I had dinner.', 'Even if you have time, don''t eat dinner.', 'Whenever I had time, I used to eat dinner alone.'],
   '-(으)면 attaches to 있다 to form the condition "if you have time." The main clause 같이 저녁 먹어요 works as a soft suggestion, so the sentence proposes having dinner together.',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0003-b20000000000', 'multiple_choice', 1,
   '어제 일찍 잤더라면 지금 안 피곤할 거예요. — What does the speaker mean?',
   'If I had gone to bed early yesterday, I wouldn''t be tired now.',
   '{}',
   ARRAY['If I had gone to bed early yesterday, I wouldn''t be tired now.', 'If I go to bed early, I won''t be tired tomorrow.', 'I went to bed early, so I''m not tired.', 'Even though I slept early, I am still tired.'],
   '-았/었더라면 = a past that did NOT happen (counterfactual).',
   'grammar', 'grammar', 'tap', 'conditionals_suppositions',
   ARRAY['If I go to bed early, I won''t be tired tomorrow.', 'I went to bed early, so I''m not tired.', 'Even though I slept early, I am still tired.'],
   '-았/었더라면 marks a counterfactual: the speaker did not sleep early and imagines the opposite. It pairs with suppositional endings like -(으)ㄹ 거예요 or -았/었을 텐데.',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0003-b20000000000', 'multiple_choice', 2,
   'Choose the correct sentence for: “Call me when you get home.”',
   '집에 도착하거든 전화하세요',
   '{}',
   ARRAY['집에 도착하거든 전화하세요', '집에 도착하면 전화했어요', '집에 도착하자마자 전화했어요', '집에 도착해도 전화하세요'],
   '-거든 links a condition to a following command or request.',
   'grammar', 'grammar', 'tap', 'conditionals_suppositions',
   ARRAY['집에 도착하면 전화했어요', '집에 도착하자마자 전화했어요', '집에 도착해도 전화하세요'],
   '-거든 introduces a condition whose main clause must be a command, suggestion, or promise — 전화하세요 fits. The distractors use past tense 했어요, which cannot express this instruction, or -아/어도 ("even if"), which changes the meaning.',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0003-b20000000000', 'fill_blank', 3,
   '돈이 ___ 그 가방을 살 거예요. (많다 + condition)',
   '많으면',
   '{}',
   NULL,
   'Consonant-final stems take -으면.',
   'grammar', 'grammar', 'type', 'conditionals_suppositions',
   '{}',
   '많다 has a consonant-final stem, so the conditional is 많으면: "if I have a lot of money." Vowel-final stems take just -면 (가다 → 가면).',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0003-b20000000000', 'cloze_deletion', 4,
   '혹시 민수 씨를 ___ 이 책 좀 전해 주세요. (만나다 + -거든)',
   '만나거든',
   '{}',
   NULL,
   'Use -거든, not -(으)면 — the main clause is a request.',
   'grammar', 'grammar', 'type', 'conditionals_suppositions',
   '{}',
   '-거든 attaches directly to the stem: 만나거든 = "if you happen to meet Minsu." It is preferred over -(으)면 when the condition is uncertain and the main clause is a command or request.',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0003-b20000000000', 'word_form', 5,
   '내일 날씨가 ___ 등산을 갑시다. (좋다 + condition)',
   '좋으면',
   '{}',
   NULL,
   'Consonant-final stem + -으면.',
   'grammar', 'grammar', 'type', 'conditionals_suppositions',
   '{}',
   '좋다 has a consonant-final stem, so it takes -으면: 좋으면 = "if the weather is good." The suggestion 갑시다 in the main clause is a natural partner for a condition.',
   'manual', '{"baseWord": "좋다"}'::jsonb),

  ('aabbccdd-7777-4006-0003-b20000000000', 'sentence_transformation', 6,
   '열심히 공부하지 않아서 시험에 떨어졌어요. → Say the opposite as a past counterfactual using 합격하다 (to pass).',
   '열심히 공부했더라면 시험에 합격했을 거예요',
   ARRAY['열심히 공부했다면 시험에 합격했을 거예요', '열심히 공부했더라면 시험에 합격했을 텐데요', '열심히 공부했다면 시험에 합격했을 텐데요'],
   NULL,
   '-았/었더라면 + -았/었을 거예요.',
   'grammar', 'grammar', 'type', 'conditionals_suppositions',
   '{}',
   'Past counterfactuals need past marking on both clauses: 공부했더라면 ("if I had studied") and 합격했을 거예요 ("would have passed"). Plain 공부하면 ... 합격할 거예요 would be a real future condition instead.',
   'manual', '{"originalSentence": "열심히 공부하지 않아서 시험에 떨어졌어요.", "instruction": "Rewrite as a past counterfactual: If I had studied hard, I would have passed the exam. Use -았/었더라면 and 합격하다."}'::jsonb),

  ('aabbccdd-7777-4006-0003-b20000000000', 'error_correction', 7,
   '돈이 많으면 작년에 그 집을 샀을 거예요.',
   '돈이 많았더라면 작년에 그 집을 샀을 거예요',
   ARRAY['돈이 많았더라면 작년에 그 집을 샀을 텐데요'],
   NULL,
   '작년에 + -았을 거예요 is an unreal PAST — the condition must be counterfactual too.',
   'grammar', 'grammar', 'type', 'conditionals_suppositions',
   '{}',
   'The result clause 샀을 거예요 refers to an unreal past (작년), so the condition cannot be the plain 많으면; it must carry past counterfactual marking: 많았더라면 (or 많았다면).',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0003-b20000000000', 'sentence_construction', 8,
   'Arrange the words: “If it rains tomorrow, I will stay home.”',
   '내일 비가 오면 집에 있을 거예요',
   ARRAY['비가 내일 오면 집에 있을 거예요'],
   NULL,
   'Condition clause first: time – subject – verb + -면.',
   'grammar', 'grammar', 'tap', 'conditionals_suppositions',
   '{}',
   'The conditional clause 내일 비가 오면 comes first, followed by the result 집에 있을 거예요. -(으)ㄹ 거예요 expresses the speaker''s plan or prediction.',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0003-b20000000000', 'translate_to_target', 9,
   'Translate into Korean: “If I have time, I want to travel.” (travel = 여행)',
   '시간이 있으면 여행을 가고 싶어요',
   ARRAY['시간이 있으면 여행하고 싶어요', '시간이 있으면 여행을 하고 싶어요', '시간 있으면 여행 가고 싶어요', '시간이 있으면 여행 가고 싶어요'],
   NULL,
   '있다 + -(으)면; “want to” = -고 싶어요.',
   'grammar', 'grammar', 'type', 'conditionals_suppositions',
   '{}',
   'The condition is 시간이 있으면 ("if I have time"), and the desire is -고 싶어요 attached to 가다 or 하다: 여행을 가고 싶어요. Both 여행을 가다 and 여행하다 are natural.',
   'manual', '{}'::jsonb);

-- ═══════════════════════════════════════════════════════════════════════════
-- Lesson 4 — Honorifics & Speech Levels (높임말)
-- ═══════════════════════════════════════════════════════════════════════════

DELETE FROM exercises WHERE lesson_id = 'aabbccdd-7777-4006-0004-b20000000000';

INSERT INTO exercises
  (lesson_id, type, order_index, prompt, correct_answer, accepted_answers, options, hint_text, skill_type, subskill, response_mode, target_grammar, distractors, explanation, source_type, metadata)
VALUES
  ('aabbccdd-7777-4006-0004-b20000000000', 'multiple_choice', 0,
   'Which sentence correctly honors the subject?',
   '선생님께서 학교에 오셨어요',
   '{}',
   ARRAY['선생님께서 학교에 오셨어요', '선생님이 학교에 왔어요', '제가 학교에 오셨어요', '친구가 학교에 오셨어요'],
   '께서 + -(으)시- honor a respected subject; never honor yourself or a friend.',
   'grammar', 'grammar', 'tap', 'honorific_speech',
   ARRAY['선생님이 학교에 왔어요', '제가 학교에 오셨어요', '친구가 학교에 오셨어요'],
   '선생님 deserves honorifics: the subject particle 께서 plus -(으)시- in the verb (오셨어요). Using them for yourself (제가 오셨어요) or a friend is incorrect, and dropping them for a teacher is impolite.',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0004-b20000000000', 'multiple_choice', 1,
   '사장님, 이쪽으로 앉으십시오. — What speech style is this?',
   'Formal polite style (합쇼체) used with a superior',
   '{}',
   ARRAY['Formal polite style (합쇼체) used with a superior', 'Casual style (반말) used with a close friend', 'Intimate style used with a small child', 'Written diary style used to oneself'],
   '-(으)십시오 is the formal honorific command form.',
   'grammar', 'grammar', 'tap', 'honorific_speech',
   ARRAY['Casual style (반말) used with a close friend', 'Intimate style used with a small child', 'Written diary style used to oneself'],
   '-(으)십시오 combines the honorific -(으)시- with the formal 합쇼체 imperative -ㅂ시오. It is the register for customers, bosses, and formal announcements. The casual equivalent would be 앉아.',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0004-b20000000000', 'multiple_choice', 2,
   'You want to ask your professor''s age politely. Which is correct?',
   '연세가 어떻게 되세요?',
   '{}',
   ARRAY['연세가 어떻게 되세요?', '나이가 몇 살이에요?', '몇 살이야?', '나이가 어떻게 되니?'],
   'Use the honorific noun 연세 instead of 나이.',
   'grammar', 'grammar', 'tap', 'honorific_speech',
   ARRAY['나이가 몇 살이에요?', '몇 살이야?', '나이가 어떻게 되니?'],
   'For elders and superiors, use honorific vocabulary: 연세 replaces 나이, and the verb takes -(으)세요. 나이가 몇 살이에요? is fine for peers, and 반말 forms like 몇 살이야? are only for close friends.',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0004-b20000000000', 'fill_blank', 3,
   '할머니께서 지금 방에서 ___. (자다 → honorific present)',
   '주무세요',
   ARRAY['주무십니다', '주무시고 계세요'],
   NULL,
   '자다 has a special honorific verb.',
   'grammar', 'grammar', 'type', 'honorific_speech',
   '{}',
   'Some verbs have dedicated honorific replacements: 자다 → 주무시다, 먹다 → 드시다, 있다 → 계시다. With grandmother as the subject, 주무세요 is required; plain 자요 would be disrespectful.',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0004-b20000000000', 'cloze_deletion', 4,
   '어제 부모님께 생신 선물을 ___. (주다 → humble, past tense)',
   '드렸어요',
   '{}',
   NULL,
   'Giving TO a respected person uses the humble verb 드리다.',
   'grammar', 'grammar', 'type', 'honorific_speech',
   '{}',
   'When you give something to someone you respect, use the humble verb 드리다 instead of 주다: 드렸어요. The recipient takes 께 instead of 에게. Note that 생신 is the honorific word for 생일.',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0004-b20000000000', 'word_form', 5,
   '사장님께서 지금 회의실에 ___. (있다 → honorific present)',
   '계세요',
   ARRAY['계십니다'],
   NULL,
   'For a person''s location or existence, 있다 → 계시다.',
   'grammar', 'grammar', 'type', 'honorific_speech',
   '{}',
   'When the subject is an honored person, 있다 becomes 계시다: 계세요. Contrast: 있으시다 is used when the honored person''s possession is the subject (시간이 있으세요?), but for the person themselves use 계시다.',
   'manual', '{"baseWord": "있다"}'::jsonb),

  ('aabbccdd-7777-4006-0004-b20000000000', 'sentence_transformation', 6,
   '선생님이 학교에 왔어요. → Rewrite with full subject honorifics.',
   '선생님께서 학교에 오셨어요',
   ARRAY['선생님께서 학교에 오셨습니다'],
   NULL,
   '이/가 → 께서, and add -(으)시- to the verb.',
   'grammar', 'grammar', 'type', 'honorific_speech',
   '{}',
   'Full subject honorification has two parts: the particle 께서 replaces 이/가, and -(으)시- enters the verb. 왔어요 → 오셨어요 (오- + -시- + -었- + -어요).',
   'manual', '{"originalSentence": "선생님이 학교에 왔어요.", "instruction": "Rewrite with subject honorifics: change the particle and add -(으)시- to the verb."}'::jsonb),

  ('aabbccdd-7777-4006-0004-b20000000000', 'error_correction', 7,
   '할아버지께서 지금 자요.',
   '할아버지께서 지금 주무세요',
   ARRAY['할아버지께서 지금 주무십니다', '할아버지께서 지금 주무시고 계세요'],
   NULL,
   '께서 must agree with an honorific verb.',
   'grammar', 'grammar', 'type', 'honorific_speech',
   '{}',
   'The particle 께서 signals an honored subject, so the verb must also be honorific. 자다 has the special honorific 주무시다, giving 주무세요. Mixing 께서 with plain 자요 is an agreement error.',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0004-b20000000000', 'sentence_construction', 8,
   'Arrange the words: “Grandmother is reading a newspaper.”',
   '할머니께서 신문을 읽고 계세요',
   ARRAY['신문을 할머니께서 읽고 계세요'],
   NULL,
   'Progressive -고 있다 becomes -고 계시다 for honored subjects.',
   'grammar', 'grammar', 'tap', 'honorific_speech',
   '{}',
   'The progressive -고 있어요 upgrades to -고 계세요 when the subject is honored: 읽고 계세요 = "is reading." 할머니 takes the honorific subject particle 께서.',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0004-b20000000000', 'translate_to_target', 9,
   'Translate into Korean: “Professor, do you have time now?” (professor = 교수님)',
   '교수님 지금 시간이 있으세요',
   ARRAY['교수님, 지금 시간이 있으세요', '교수님 지금 시간 있으세요', '교수님, 지금 시간 있으세요', '교수님 지금 시간이 있으십니까', '교수님 지금 시간 있으십니까'],
   NULL,
   'The professor''s time is the subject — use 있으세요, not 계세요.',
   'grammar', 'grammar', 'type', 'honorific_speech',
   '{}',
   'Here 시간 (the professor''s time) is the grammatical subject, so use 있으시다 → 있으세요. 계세요 would treat 시간 as a person. This indirect honorification (간접 높임) is standard for possessions of an honored person.',
   'manual', '{}'::jsonb);

-- ═══════════════════════════════════════════════════════════════════════════
-- Lesson 5 — Reason & Contrast Connectives (연결어미)
-- ═══════════════════════════════════════════════════════════════════════════

DELETE FROM exercises WHERE lesson_id = 'aabbccdd-7777-4006-0005-b20000000000';

INSERT INTO exercises
  (lesson_id, type, order_index, prompt, correct_answer, accepted_answers, options, hint_text, skill_type, subskill, response_mode, target_grammar, distractors, explanation, source_type, metadata)
VALUES
  ('aabbccdd-7777-4006-0005-b20000000000', 'multiple_choice', 0,
   '숙제를 하느라고 잠을 못 잤어요. — What does this mean?',
   'I couldn''t sleep because I was doing homework.',
   '{}',
   ARRAY['I couldn''t sleep because I was doing homework.', 'Even though I did homework, I slept well.', 'I did homework in order to sleep.', 'Whenever I do homework, I fall asleep.'],
   '-느라고 gives a reason for a negative result.',
   'grammar', 'grammar', 'tap', 'reason_contrast_connectives',
   ARRAY['Even though I did homework, I slept well.', 'I did homework in order to sleep.', 'Whenever I do homework, I fall asleep.'],
   '-느라고 links an activity that took up time or energy (doing homework) to a negative outcome (not sleeping). Both clauses share the same subject, and the outcome is typically something failed or missed.',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0005-b20000000000', 'multiple_choice', 1,
   '약을 먹었는데도 감기가 안 나아요. — What does this mean?',
   'Even though I took medicine, my cold isn''t getting better.',
   '{}',
   ARRAY['Even though I took medicine, my cold isn''t getting better.', 'Because I took medicine, my cold got better.', 'If I take medicine, my cold will get better.', 'I took medicine as soon as I caught a cold.'],
   '-는데도 = “even though / despite.”',
   'grammar', 'grammar', 'tap', 'reason_contrast_connectives',
   ARRAY['Because I took medicine, my cold got better.', 'If I take medicine, my cold will get better.', 'I took medicine as soon as I caught a cold.'],
   '-았/었는데도 marks concession: the expected result (getting better) did not happen despite the action (taking medicine). 나아요 comes from the ㅅ-irregular verb 낫다 (to recover).',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0005-b20000000000', 'multiple_choice', 2,
   '갑자기 비가 오___ 옷이 다 젖었어요. — Which ending fits?',
   '는 바람에',
   '{}',
   ARRAY['는 바람에', '느라고', '는데도', '려고'],
   'A sudden, unexpected cause with a bad result.',
   'grammar', 'grammar', 'tap', 'reason_contrast_connectives',
   ARRAY['느라고', '는데도', '려고'],
   '-는 바람에 marks a sudden or unexpected cause of a negative result — perfect for sudden rain. -느라고 needs an intentional activity by the subject, -는데도 means "even though," and -(으)려고 marks a purpose, which rain cannot have.',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0005-b20000000000', 'fill_blank', 3,
   '시험 공부를 ___ 주말에 아무 데도 못 갔어요. (하다 + -느라고)',
   '하느라고',
   '{}',
   NULL,
   '-느라고 attaches directly to the verb stem — never to past tense.',
   'grammar', 'grammar', 'type', 'reason_contrast_connectives',
   '{}',
   '-느라고 attaches to the plain stem: 하느라고, never 했느라고. The exam studying occupied the weekend, causing the negative result of not going anywhere.',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0005-b20000000000', 'cloze_deletion', 4,
   '열심히 운동을 ___ 살이 안 빠져요. (하다 + concession)',
   '하는데도',
   ARRAY['했는데도'],
   NULL,
   '“Even though I exercise…” — use -는데도.',
   'grammar', 'grammar', 'type', 'reason_contrast_connectives',
   '{}',
   '-는데도 concedes a fact that should lead to a different result: exercising hard should cause weight loss, but it doesn''t. Present 하는데도 and past 했는데도 are both natural here.',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0005-b20000000000', 'word_form', 5,
   '동생이 아까는 ___ 지금은 웃어요. (울다 + -더니)',
   '울더니',
   '{}',
   NULL,
   '-더니 reports an observed change: “was doing X, but now…”',
   'grammar', 'grammar', 'type', 'reason_contrast_connectives',
   '{}',
   '-더니 attaches to what the speaker directly observed (the sibling crying) and introduces a contrasting or consequent change (now laughing). It attaches straight to the stem: 울더니.',
   'manual', '{"baseWord": "울다"}'::jsonb),

  ('aabbccdd-7777-4006-0005-b20000000000', 'sentence_transformation', 6,
   '늦잠을 잤어요. 그래서 비행기를 놓쳤어요. → Combine into one sentence with -는 바람에.',
   '늦잠을 자는 바람에 비행기를 놓쳤어요',
   '{}',
   NULL,
   '-는 바람에 always uses the present -는 form, even for past events.',
   'grammar', 'grammar', 'type', 'reason_contrast_connectives',
   '{}',
   '-는 바람에 expresses an unexpected cause with a bad result. The first verb always keeps the present-tense -는 form (자는 바람에), while the final verb carries the past tense (놓쳤어요).',
   'manual', '{"originalSentence": "늦잠을 잤어요. 그래서 비행기를 놓쳤어요.", "instruction": "Combine into one sentence using -는 바람에."}'::jsonb),

  ('aabbccdd-7777-4006-0005-b20000000000', 'error_correction', 7,
   '어제 비가 오느라고 소풍을 못 갔어요.',
   '어제 비가 와서 소풍을 못 갔어요',
   ARRAY['어제 비가 오는 바람에 소풍을 못 갔어요', '어제 비가 왔기 때문에 소풍을 못 갔어요'],
   NULL,
   '-느라고 needs an intentional action by the same subject — rain isn''t “doing” anything on purpose.',
   'grammar', 'grammar', 'type', 'reason_contrast_connectives',
   '{}',
   '-느라고 requires a volitional activity performed by the same subject as the main clause. Rain is not intentional, so use -아/어서 (와서) or -는 바람에 for a sudden natural cause.',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0005-b20000000000', 'sentence_construction', 8,
   'Arrange the words: “Because I was doing homework, I couldn''t sleep.”',
   '숙제를 하느라고 잠을 못 잤어요',
   '{}',
   NULL,
   'Reason clause with -느라고 first, then the negative result.',
   'grammar', 'grammar', 'tap', 'reason_contrast_connectives',
   '{}',
   'The time-consuming activity (숙제를 하느라고) comes first, followed by the negative result (잠을 못 잤어요). 못 immediately precedes the verb it negates.',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0005-b20000000000', 'translate_to_target', 9,
   'Translate into Korean: “Even though I studied hard, the exam was difficult.”',
   '열심히 공부했는데도 시험이 어려웠어요',
   ARRAY['공부를 열심히 했는데도 시험이 어려웠어요', '열심히 공부를 했는데도 시험이 어려웠어요'],
   NULL,
   'Past concession: -았/었는데도.',
   'grammar', 'grammar', 'type', 'reason_contrast_connectives',
   '{}',
   'The concession is in the past, so use -았/었는데도: 공부했는데도. The unexpected fact follows: 시험이 어려웠어요. Compare -는데도 for present-tense concessions.',
   'manual', '{}'::jsonb);

-- ═══════════════════════════════════════════════════════════════════════════
-- Lesson 6 — Review & Test (mixed)
-- ═══════════════════════════════════════════════════════════════════════════

DELETE FROM exercises WHERE lesson_id = 'aabbccdd-7777-4006-0006-b20000000000';

INSERT INTO exercises
  (lesson_id, type, order_index, prompt, correct_answer, accepted_answers, options, hint_text, skill_type, subskill, response_mode, target_grammar, distractors, explanation, source_type, metadata)
VALUES
  ('aabbccdd-7777-4006-0006-b20000000000', 'multiple_choice', 0,
   '부장님이 회의가 세 시에 시작된다고 하셨어요. — What did the manager say?',
   'The manager said the meeting starts at three.',
   '{}',
   ARRAY['The manager said the meeting starts at three.', 'The manager asked if the meeting starts at three.', 'The manager told us to start the meeting at three.', 'The manager suggested starting the meeting at three.'],
   '-ㄴ다고 하다 reports a statement.',
   'grammar', 'grammar', 'tap', 'indirect_quotation',
   ARRAY['The manager asked if the meeting starts at three.', 'The manager told us to start the meeting at three.', 'The manager suggested starting the meeting at three.'],
   '시작된다고 하셨어요 uses -ㄴ다고 하다, the reported-statement pattern. A question would be 시작되냐고 물으셨어요, a command 시작하라고, and a suggestion 시작하자고.',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0006-b20000000000', 'multiple_choice', 1,
   'Which sentence uses honorifics correctly?',
   '할아버지께서 지금 주무세요',
   '{}',
   ARRAY['할아버지께서 지금 주무세요', '할아버지가 지금 자요', '할아버지가 지금 주무어요', '할아버지께서 지금 잡니다'],
   '께서 requires an honorific verb; 자다 → 주무시다.',
   'grammar', 'grammar', 'tap', 'honorific_speech',
   ARRAY['할아버지가 지금 자요', '할아버지가 지금 주무어요', '할아버지께서 지금 잡니다'],
   'With 께서, the verb must be honorific: 자다 becomes 주무시다 → 주무세요. 자요 and 잡니다 lack the honorific verb, and 주무어요 is a wrong conjugation of 주무시다.',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0006-b20000000000', 'multiple_choice', 2,
   '친구를 만나느라고 숙제를 못 했어요. — What does this mean?',
   'I couldn''t do my homework because I was meeting a friend.',
   '{}',
   ARRAY['I couldn''t do my homework because I was meeting a friend.', 'Even though I met a friend, I did my homework.', 'I met a friend in order to do homework.', 'If I meet a friend, I won''t do homework.'],
   '-느라고: an activity that used up your time caused a failure.',
   'grammar', 'grammar', 'tap', 'reason_contrast_connectives',
   ARRAY['Even though I met a friend, I did my homework.', 'I met a friend in order to do homework.', 'If I meet a friend, I won''t do homework.'],
   '-느라고 links the time-consuming activity (meeting a friend) to the failed outcome (not doing homework). The subject of both clauses is the same speaker.',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0006-b20000000000', 'fill_blank', 3,
   '선생님께서 내일까지 숙제를 ___ 하셨어요. (내다 → reported command)',
   '내라고',
   '{}',
   NULL,
   'Report commands with -(으)라고.',
   'grammar', 'grammar', 'type', 'indirect_quotation',
   '{}',
   'The teacher''s command 숙제를 내세요 is reported with -(으)라고 하다: 내라고 하셨어요. A reported statement would be 낸다고, which would change the meaning to "said she submits."',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0006-b20000000000', 'cloze_deletion', 4,
   '갑자기 문이 ___ 깜짝 놀랐어요. (열다 → passive + -아/어서)',
   '열려서',
   '{}',
   NULL,
   '열다 → 열리다, then add the reason ending -어서.',
   'grammar', 'grammar', 'type', 'passive_causative',
   '{}',
   '열다 takes the passive suffix -리- (열리다) because the door opened on its own from the speaker''s viewpoint. Adding the reason connective -어서 gives 열려서: "because the door suddenly opened."',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0006-b20000000000', 'word_form', 5,
   '그 사실을 미리 ___ 실수하지 않았을 거예요. (알다 + past counterfactual)',
   '알았더라면',
   ARRAY['알았다면'],
   NULL,
   '-았/었더라면 for “if I had known.”',
   'grammar', 'grammar', 'type', 'conditionals_suppositions',
   '{}',
   'The result clause 않았을 거예요 ("wouldn''t have made a mistake") requires a past counterfactual condition: 알았더라면 = "if I had known." Plain 알면 would state a real, open condition instead.',
   'manual', '{"baseWord": "알다"}'::jsonb),

  ('aabbccdd-7777-4006-0006-b20000000000', 'sentence_transformation', 6,
   '지수: “내일 같이 점심 먹자.” → Report Jisu''s suggestion with -자고 했어요. Start with 지수 씨가.',
   '지수 씨가 내일 같이 점심을 먹자고 했어요',
   ARRAY['지수 씨가 내일 같이 점심 먹자고 했어요', '지수씨가 내일 같이 점심을 먹자고 했어요', '지수씨가 내일 같이 점심 먹자고 했어요'],
   NULL,
   '-자 → -자고 하다.',
   'grammar', 'grammar', 'type', 'indirect_quotation',
   '{}',
   'The direct quote ends in the suggestion form -자, which is reported with -자고 하다: 먹자고 했어요. The casual register of the original disappears in indirect speech.',
   'manual', '{"originalSentence": "지수: “내일 같이 점심 먹자.”", "instruction": "Report Jisu''s suggestion with -자고 했어요. Start with 지수 씨가."}'::jsonb),

  ('aabbccdd-7777-4006-0006-b20000000000', 'error_correction', 7,
   '할머니께서 저에게 빨리 오라고 말했어요.',
   '할머니께서 저에게 빨리 오라고 말씀하셨어요',
   ARRAY['할머니께서 저에게 빨리 오라고 말씀하셨습니다'],
   NULL,
   'The one speaking is 할머니 — her verb needs honorific 말씀하시다.',
   'grammar', 'grammar', 'type', 'honorific_speech',
   '{}',
   'The subject 할머니께서 requires an honorific verb of speaking: 말하다 → 말씀하시다, giving 말씀하셨어요. The quoted command 오라고 stays plain because it targets the speaker (저).',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0006-b20000000000', 'sentence_construction', 8,
   'Arrange the words: “The teacher said there is an exam tomorrow.”',
   '선생님께서 내일 시험이 있다고 하셨어요',
   ARRAY['내일 선생님께서 시험이 있다고 하셨어요', '선생님께서 시험이 내일 있다고 하셨어요', '내일 시험이 있다고 선생님께서 하셨어요'],
   NULL,
   '있다 is reported with plain -다고.',
   'grammar', 'grammar', 'tap', 'indirect_quotation',
   '{}',
   '있다 reports with plain -다고 (있다고), not -ㄴ다고, because 있다 patterns with adjectives in quotation. The honored source of the statement takes 께서 and -(으)시-: 하셨어요.',
   'manual', '{}'::jsonb),

  ('aabbccdd-7777-4006-0006-b20000000000', 'translate_to_target', 9,
   'Translate into Korean: “If you are busy, please call me tomorrow.” (call = 전화하다)',
   '바쁘면 내일 전화하세요',
   ARRAY['바쁘시면 내일 전화하세요', '바쁘면 내일 전화해 주세요', '바쁘시면 내일 전화해 주세요'],
   NULL,
   'Adjective + -(으)면; polite request -(으)세요.',
   'grammar', 'grammar', 'type', 'conditionals_suppositions',
   '{}',
   '바쁘다 + -면 gives the condition 바쁘면; adding the honorific -시- (바쁘시면) is even more polite. The request uses -(으)세요 or -아/어 주세요: 전화하세요 / 전화해 주세요.',
   'manual', '{}'::jsonb);

-- ═══════════════════════════════════════════════════════════════════════════
-- Grammar rules reference set — language 'ko' (5 each: A1, A2, B1, B2)
-- B2 rule_name values match the exercise target_grammar tags above so
-- RuleCard.tsx can surface them on grammar errors.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO grammar_rules (language, cefr_level, rule_name, title, explanation, examples, common_errors, tags) VALUES
-- ── A1 ──
('ko', 'A1', 'topic_subject_particles', 'Topic vs subject particles: 은/는 and 이/가',
 '은/는 marks the topic — what the sentence is about, or a contrast. 이/가 marks the grammatical subject, often new or emphasized information. Use 은 and 이 after consonants, 는 and 가 after vowels.',
 '[{"target": "저는 학생이에요.", "native": "As for me, I am a student."}, {"target": "날씨가 정말 좋아요.", "native": "The weather is really nice."}]'::jsonb,
 '[{"error": "제가 학생이에요. (as a neutral self-introduction)", "correction": "저는 학생이에요.", "note": "이/가 puts focus on the subject; introductions normally use the topic particle."}]'::jsonb,
 ARRAY['particles', 'topic', 'subject']),

('ko', 'A1', 'object_particle_eul_reul', 'Object particle 을/를',
 'The direct object of a verb takes 을 after a consonant and 를 after a vowel: 밥을 먹어요, 커피를 마셔요. In casual speech it is often dropped, but writing keeps it.',
 '[{"target": "아침에 빵을 먹어요.", "native": "I eat bread in the morning."}, {"target": "커피를 마셔요.", "native": "I drink coffee."}]'::jsonb,
 '[{"error": "커피을 마셔요", "correction": "커피를 마셔요", "note": "커피 ends in a vowel, so it takes 를."}]'::jsonb,
 ARRAY['particles', 'object']),

('ko', 'A1', 'polite_present_haeyo', 'Polite present tense -아/어요 (해요체)',
 'The everyday polite ending: stems whose last vowel is ㅏ or ㅗ take -아요 (가다 → 가요, 살다 → 살아요); all others take -어요 (먹다 → 먹어요). 하다 becomes 해요.',
 '[{"target": "매일 한국어를 공부해요.", "native": "I study Korean every day."}, {"target": "저녁에 밥을 먹어요.", "native": "I eat dinner in the evening."}]'::jsonb,
 '[{"error": "먹아요", "correction": "먹어요", "note": "The stem vowel ㅓ is not ㅏ/ㅗ, so the ending is -어요."}]'::jsonb,
 ARRAY['verb-endings', 'present-tense', 'politeness']),

('ko', 'A1', 'past_tense_at_eot', 'Past tense -았/었어요',
 'Past polite: stems with last vowel ㅏ/ㅗ take -았어요, others take -었어요, and 하다 becomes 했어요. Vowel contraction is required: 가다 → 갔어요 (not 가았어요), 마시다 → 마셨어요.',
 '[{"target": "어제 친구를 만났어요.", "native": "I met a friend yesterday."}, {"target": "주말에 영화를 봤어요.", "native": "I watched a movie on the weekend."}]'::jsonb,
 '[{"error": "만나었어요", "correction": "만났어요", "note": "The stem vowel and 았 must contract: 만나 + 았 → 만났."}]'::jsonb,
 ARRAY['verb-endings', 'past-tense']),

('ko', 'A1', 'location_particles_e_eseo', 'Location particles 에 vs 에서',
 '에 marks a destination, a static location, or a time (학교에 가요, 집에 있어요, 세 시에). 에서 marks the place where an action happens, or a starting point (학교에서 공부해요, 서울에서 왔어요).',
 '[{"target": "지금 학교에 가요.", "native": "I am going to school now."}, {"target": "도서관에서 공부해요.", "native": "I study at the library."}]'::jsonb,
 '[{"error": "학교에 공부해요", "correction": "학교에서 공부해요", "note": "공부하다 is an action, so the place takes 에서."}]'::jsonb,
 ARRAY['particles', 'location']),

-- ── A2 ──
('ko', 'A2', 'future_eul_geoyeyo', 'Future / intention -(으)ㄹ 거예요',
 'Expresses plans, intentions, or predictions. Consonant-final stems take -을 거예요 (먹을 거예요), vowel-final stems take -ㄹ 거예요 (갈 거예요). With third-person subjects it often means "probably."',
 '[{"target": "내일 영화를 볼 거예요.", "native": "I am going to watch a movie tomorrow."}, {"target": "오후에 비가 올 거예요.", "native": "It will probably rain in the afternoon."}]'::jsonb,
 '[{"error": "볼 거이에요", "correction": "볼 거예요", "note": "거 + 이에요 always contracts to 거예요."}]'::jsonb,
 ARRAY['verb-endings', 'future-tense']),

('ko', 'A2', 'negation_an_mot', 'Negation: 안 vs 못',
 '안 negates by choice or simple fact ("don''t"); 못 negates ability or possibility ("can''t"). Both precede the verb: 안 가요, 못 가요. With 하다 verbs they split the noun: 공부 안 해요, 공부 못 해요.',
 '[{"target": "오늘은 커피를 안 마셔요.", "native": "I am not drinking coffee today (by choice)."}, {"target": "바빠서 파티에 못 가요.", "native": "I can''t go to the party because I am busy."}]'::jsonb,
 '[{"error": "다리를 다쳐서 안 걸어요", "correction": "다리를 다쳐서 못 걸어요", "note": "An injury is an inability, so use 못, not 안."}]'::jsonb,
 ARRAY['negation', 'adverbs']),

('ko', 'A2', 'reason_aseo_eoseo', 'Reason and sequence -아서/어서',
 'Connects a reason to a result (배가 고파서 먹었어요) or two sequential actions (친구를 만나서 영화를 봤어요). The past marker never appears before it, and commands or suggestions cannot follow it — use -(으)니까 instead.',
 '[{"target": "피곤해서 일찍 잤어요.", "native": "I went to bed early because I was tired."}, {"target": "시장에 가서 과일을 샀어요.", "native": "I went to the market and bought fruit."}]'::jsonb,
 '[{"error": "피곤했어서 일찍 잤어요", "correction": "피곤해서 일찍 잤어요", "note": "-아/어서 never takes the past marker -았/었-."}, {"error": "늦어서 빨리 오세요", "correction": "늦으니까 빨리 오세요", "note": "Commands after a reason require -(으)니까."}]'::jsonb,
 ARRAY['connectives', 'reason']),

('ko', 'A2', 'desire_go_sipda', 'Desire -고 싶다',
 'Attach -고 싶다 to a verb stem to say what YOU want to do: 가고 싶어요. For a third person, use -고 싶어하다: 동생이 가고 싶어해요. The object may take 이/가 or 을/를.',
 '[{"target": "한국에 가고 싶어요.", "native": "I want to go to Korea."}, {"target": "동생이 강아지를 키우고 싶어해요.", "native": "My younger sibling wants to raise a puppy."}]'::jsonb,
 '[{"error": "친구가 쉬고 싶어요", "correction": "친구가 쉬고 싶어해요", "note": "-고 싶다 describes the speaker; third parties take -고 싶어하다."}]'::jsonb,
 ARRAY['verb-endings', 'desire']),

('ko', 'A2', 'ability_eul_su_itda', 'Ability -(으)ㄹ 수 있다/없다',
 'Expresses ability or possibility: -(으)ㄹ 수 있다 ("can"), -(으)ㄹ 수 없다 ("cannot"). Consonant-final stems take -을 수 (읽을 수 있어요), vowel-final stems take -ㄹ 수 (갈 수 있어요).',
 '[{"target": "한국어 책을 읽을 수 있어요.", "native": "I can read Korean books."}, {"target": "오늘은 만날 수 없어요.", "native": "I can''t meet today."}]'::jsonb,
 '[{"error": "수영할 수 있다요", "correction": "수영할 수 있어요", "note": "The polite form conjugates 있다 → 있어요; -다요 is not a valid ending."}]'::jsonb,
 ARRAY['verb-endings', 'ability']),

-- ── B1 ──
('ko', 'B1', 'noun_modifier_forms', 'Noun-modifying forms -(으)ㄴ / -는 / -(으)ㄹ',
 'Verbs modify nouns with -는 (present: 읽는 책), -(으)ㄴ (past: 읽은 책), or -(으)ㄹ (future: 읽을 책). Adjectives use -(으)ㄴ for the present: 예쁜 꽃, 좋은 사람.',
 '[{"target": "어제 본 영화가 재미있었어요.", "native": "The movie I watched yesterday was fun."}, {"target": "내일 만날 친구가 서울에 살아요.", "native": "The friend I will meet tomorrow lives in Seoul."}]'::jsonb,
 '[{"error": "예쁘는 꽃", "correction": "예쁜 꽃", "note": "Adjectives never take -는; they use -(으)ㄴ."}]'::jsonb,
 ARRAY['modifiers', 'relative-clauses']),

('ko', 'B1', 'obligation_aya_hada', 'Obligation -아야/어야 하다',
 'Expresses "must / have to": stems with last vowel ㅏ/ㅗ take -아야 하다, others -어야 하다, 하다 verbs become 해야 하다. 되다 can replace 하다 with the same meaning: 가야 돼요.',
 '[{"target": "내일까지 숙제를 내야 해요.", "native": "I have to submit the homework by tomorrow."}, {"target": "약속을 지켜야 돼요.", "native": "You must keep your promises."}]'::jsonb,
 '[{"error": "먹야 해요", "correction": "먹어야 해요", "note": "The connective vowel -어- cannot be dropped after a consonant stem."}]'::jsonb,
 ARRAY['modality', 'obligation']),

('ko', 'B1', 'conjecture_geot_gatda', 'Conjecture -(으)ㄴ/는/(으)ㄹ 것 같다',
 'Softens statements into guesses: 비가 오는 것 같아요 ("it seems to be raining"), 비가 온 것 같아요 (past guess), 비가 올 것 같아요 (future guess). Widely used to sound less assertive, even about one''s own opinions.',
 '[{"target": "밖에 비가 오는 것 같아요.", "native": "It seems to be raining outside."}, {"target": "내일은 추울 것 같아요.", "native": "I think it will be cold tomorrow."}]'::jsonb,
 '[{"error": "어제 비가 오는 것 같아요 (about yesterday)", "correction": "어제 비가 온 것 같아요", "note": "A guess about a completed event uses the past modifier -(으)ㄴ."}]'::jsonb,
 ARRAY['modality', 'conjecture']),

('ko', 'B1', 'experience_eun_jeok_itda', 'Experience -(으)ㄴ 적이 있다/없다',
 'States whether you have ever done something: 가 본 적이 있어요 ("I have been there"). Often combined with -아/어 보다 (to try). The negative is -(으)ㄴ 적이 없다.',
 '[{"target": "제주도에 가 본 적이 있어요.", "native": "I have been to Jeju Island."}, {"target": "김치를 만든 적이 없어요.", "native": "I have never made kimchi."}]'::jsonb,
 '[{"error": "가는 적이 있어요", "correction": "간 적이 있어요", "note": "Experience always uses the past modifier -(으)ㄴ, never -는."}]'::jsonb,
 ARRAY['aspect', 'experience']),

('ko', 'B1', 'background_neunde', 'Background and contrast -는데 / -(으)ㄴ데',
 'Sets background for what follows, adds soft contrast, or softens requests: 지금 바쁜데 나중에 얘기해요. Verbs take -는데, adjectives -(으)ㄴ데, past tense -았/었는데. Sentence-final -는데요 leaves a polite trailing nuance.',
 '[{"target": "비가 오는데 우산이 없어요.", "native": "It''s raining, but I don''t have an umbrella."}, {"target": "지금 바쁜데 나중에 전화해도 돼요?", "native": "I''m busy right now — can I call you later?"}]'::jsonb,
 '[{"error": "바쁘는데", "correction": "바쁜데", "note": "Adjectives take -(으)ㄴ데, not -는데."}]'::jsonb,
 ARRAY['connectives', 'contrast', 'background']),

-- ── B2 (rule_name matches exercise target_grammar) ──
('ko', 'B2', 'indirect_quotation', 'Indirect quotation -다고/-냐고/-(으)라고/-자고 하다',
 'Reported speech by sentence type: statements take -ㄴ/는다고 (verbs) or -다고 (adjectives, past, 있다); questions -냐고; commands -(으)라고; suggestions -자고; nouns -(이)라고. Requests benefiting the original speaker use -아/어 달라고.',
 '[{"target": "친구가 요즘 바쁘다고 했어요.", "native": "My friend said she is busy these days."}, {"target": "어디에 가냐고 물었어요.", "native": "He asked where I was going."}]'::jsonb,
 '[{"error": "바쁘냐고 말했어요 (reporting a statement)", "correction": "바쁘다고 말했어요", "note": "-냐고 is only for reported questions."}, {"error": "닫아 주라고 부탁했어요 (for the speaker''s benefit)", "correction": "닫아 달라고 부탁했어요", "note": "달라고 is used when the requester receives the benefit."}]'::jsonb,
 ARRAY['reported-speech', 'quotation', 'topik3-4']),

('ko', 'B2', 'passive_causative', 'Passive and causative verbs (피동/사동)',
 'Passive suffixes -이/히/리/기 make the subject affected: 문이 닫히다, 모기한테 물리다; agents take 에게/한테 (people) or 에 (things). Causative suffixes -이/히/리/기/우/구/추 or -게 하다 mean making someone do something: 아이에게 옷을 입히다.',
 '[{"target": "문이 바람에 닫혔어요.", "native": "The door was closed by the wind."}, {"target": "엄마가 아기에게 우유를 먹였어요.", "native": "The mom fed the baby milk."}]'::jsonb,
 '[{"error": "도둑이 경찰을 잡혔어요", "correction": "도둑이 경찰에게 잡혔어요", "note": "A passive verb cannot take a direct object; the agent takes 에게/한테."}]'::jsonb,
 ARRAY['passive', 'causative', 'voice', 'topik3-4']),

('ko', 'B2', 'conditionals_suppositions', 'Conditionals -(으)면, -거든, and -았/었더라면',
 '-(으)면 states a general or open condition. -거든 marks a condition whose main clause must be a command, suggestion, or promise. -았/었더라면 marks a past counterfactual and pairs with -았/었을 거예요 or -았/었을 텐데.',
 '[{"target": "시간이 있으면 여행을 가고 싶어요.", "native": "If I have time, I want to travel."}, {"target": "일찍 출발했더라면 늦지 않았을 거예요.", "native": "If we had left early, we wouldn''t have been late."}]'::jsonb,
 '[{"error": "돈이 많으면 작년에 샀을 거예요", "correction": "돈이 많았더라면 작년에 샀을 거예요", "note": "An unreal past result needs a counterfactual condition."}, {"error": "집에 도착하거든 잤어요", "correction": "집에 도착하거든 주무세요", "note": "-거든 must be followed by a command, suggestion, or promise."}]'::jsonb,
 ARRAY['conditionals', 'counterfactual', 'topik3-4']),

('ko', 'B2', 'honorific_speech', 'Honorifics and speech levels (높임말)',
 'Honor a respected subject with 께서 plus -(으)시-, and honorific vocabulary: 주무시다, 계시다, 드시다, 말씀하시다, 연세, 생신. Humble verbs (드리다, 뵙다) lower the speaker. Formal 합쇼체 (-ㅂ/습니다) contrasts with polite 해요체.',
 '[{"target": "할머니께서 신문을 읽고 계세요.", "native": "Grandmother is reading a newspaper."}, {"target": "부모님께 선물을 드렸어요.", "native": "I gave my parents a present."}]'::jsonb,
 '[{"error": "할아버지께서 자요", "correction": "할아버지께서 주무세요", "note": "께서 must agree with an honorific verb."}, {"error": "교수님이 시간이 계세요?", "correction": "교수님이 시간이 있으세요?", "note": "Indirect honorification of possessions uses 있으시다, not 계시다."}]'::jsonb,
 ARRAY['honorifics', 'register', 'speech-levels', 'topik3-4']),

('ko', 'B2', 'reason_contrast_connectives', 'Reason and contrast connectives -느라고, -는 바람에, -는데도, -더니',
 '-느라고: a volitional, time-consuming activity by the same subject causes a negative result; no past marker. -는 바람에: a sudden, unexpected cause. -는데도: "even though." -더니: an observed action or state followed by a change or consequence.',
 '[{"target": "숙제를 하느라고 잠을 못 잤어요.", "native": "I couldn''t sleep because I was doing homework."}, {"target": "약을 먹었는데도 감기가 안 나아요.", "native": "Even though I took medicine, my cold isn''t getting better."}]'::jsonb,
 '[{"error": "비가 오느라고 못 갔어요", "correction": "비가 오는 바람에 못 갔어요", "note": "-느라고 requires a volitional action by the subject; rain is not volitional."}, {"error": "했느라고", "correction": "하느라고", "note": "-느라고 never attaches to the past tense."}]'::jsonb,
 ARRAY['connectives', 'reason', 'contrast', 'topik3-4'])

ON CONFLICT (language, rule_name) DO UPDATE SET
  cefr_level = EXCLUDED.cefr_level,
  title = EXCLUDED.title,
  explanation = EXCLUDED.explanation,
  examples = EXCLUDED.examples,
  common_errors = EXCLUDED.common_errors,
  tags = EXCLUDED.tags;

COMMIT;
