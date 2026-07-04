-- ============================================================================
-- Fluenci — Russian B2 "Complex Grammar" unit rebuild + grammar_rules (ru)
-- STAGED SEED — review before applying. Do NOT run automatically.
--
-- Replaces the broken European-template unit (Subjunctive Mood / Complex
-- Tenses) with linguistically correct Russian B2 grammar:
--   L1 Verbal aspect (вид глагола)      L2 Prefixed verbs of motion
--   L3 Participles (причастия)          L4 Verbal adverbs (деепричастия)
--   L5 Conditional with бы              L6 Review & Test (mixed)
--
-- Authoring constraints honored (lib/grading.ts):
--   * gradeAnswer fuzzy-accepts Levenshtein <= 2 (<=1 for answers of <=4
--     chars), so every MC distractor and every error-correction source
--     sentence is >= 3 edits from the correct answer.
--   * normalize() lowercases and strips trailing .!? but does NOT fold
--     ё -> е, so accepted_answers include е-spellings where relevant.
--   * Components: fill_blank/cloze/word_form prompts contain "___";
--     sentence_transformation uses metadata.originalSentence/instruction;
--     sentence_construction uses metadata.tiles/distractors (tiles join
--     with single spaces to exactly correct_answer);
--     error_correction prompt IS the erroneous sentence.
--   * target_grammar tags are prefixed by the matching B2 grammar_rules
--     rule_name so RuleCard fuzzy lookup (needle.includes(ruleName)) hits.
-- ============================================================================

BEGIN;

-- ─── Unit ───────────────────────────────────────────────────────────────────

UPDATE units SET
  title = 'Complex Grammar',
  description = 'B2 Russian grammar: verbal aspect in depth, prefixed motion verbs, participles, verbal adverbs, and conditional constructions with бы'
WHERE id = 'aabbccdd-9999-4006-0000-b20000000000';

-- ─── Lessons (retitled, IDs reused) ────────────────────────────────────────

UPDATE lessons SET
  title = 'Verbal Aspect: Perfective & Imperfective',
  description = 'Choosing between perfective and imperfective verbs: process, habit and duration versus a single completed result'
WHERE id = 'aabbccdd-9999-4006-0001-b20000000000';

UPDATE lessons SET
  title = 'Prefixed Verbs of Motion',
  description = 'Motion verbs with the prefixes при-, у-, вы-, за-, до-, пере- and the идти/ходить contrast'
WHERE id = 'aabbccdd-9999-4006-0002-b20000000000';

UPDATE lessons SET
  title = 'Participles (Причастия)',
  description = 'Present and past active participles, passive participles, agreement, and replacing который clauses'
WHERE id = 'aabbccdd-9999-4006-0003-b20000000000';

UPDATE lessons SET
  title = 'Verbal Adverbs (Деепричастия)',
  description = 'Simultaneous action with -я and completed prior action with -в/-вшись'
WHERE id = 'aabbccdd-9999-4006-0004-b20000000000';

UPDATE lessons SET
  title = 'Conditional & Subjunctive with бы',
  description = 'Unreal conditions with если бы + past, wishes with чтобы + past, and polite requests with хотел бы'
WHERE id = 'aabbccdd-9999-4006-0005-b20000000000';

UPDATE lessons SET
  title = 'Review & Test',
  description = 'Mixed review: aspect, motion verbs, participles, verbal adverbs, and бы constructions'
WHERE id = 'aabbccdd-9999-4006-0006-b20000000000';

-- ─── Lesson 1: Verbal Aspect ───────────────────────────────────────────────

DELETE FROM exercises WHERE lesson_id = 'aabbccdd-9999-4006-0001-b20000000000';

INSERT INTO exercises
  (lesson_id, type, order_index, prompt, correct_answer, accepted_answers, options, hint_text, skill_type, subskill, response_mode, target_grammar, distractors, explanation, source_type, metadata)
VALUES
('aabbccdd-9999-4006-0001-b20000000000', 'multiple_choice', 0,
 'Вчера я весь вечер ___ книгу. (Yesterday I was reading a book all evening.)',
 'читал',
 ARRAY[]::text[],
 ARRAY['прочитал','читал','прочитаю','буду читать'],
 'A duration phrase like «весь вечер» signals an ongoing process.',
 'grammar', 'grammar', 'tap', 'aspect_choice_duration',
 ARRAY['прочитал','прочитаю','буду читать'],
 'The phrase «весь вечер» describes how long the action lasted, so the imperfective past «читал» is required. Perfective «прочитал» would claim a completed result, and both future forms clash with «вчера».',
 'seed', '{}'::jsonb),

('aabbccdd-9999-4006-0001-b20000000000', 'multiple_choice', 1,
 'Она наконец ___ новую квартиру. (She finally bought a new apartment.)',
 'купила',
 ARRAY[]::text[],
 ARRAY['купила','покупала','покупает','будет покупать'],
 '«Наконец» points to a single achieved result.',
 'grammar', 'grammar', 'tap', 'aspect_choice_result',
 ARRAY['покупала','покупает','будет покупать'],
 '«Наконец» marks a one-time completed result, which requires the perfective past «купила». Imperfective «покупала» would describe an unfinished or repeated process, and the present and future forms do not fit a finished event.',
 'seed', '{}'::jsonb),

('aabbccdd-9999-4006-0001-b20000000000', 'fill_blank', 2,
 'Каждое утро он ___ кофе. (Every morning he drinks coffee.)',
 'пьёт',
 ARRAY['пьет'],
 NULL,
 'Habitual repeated action: imperfective present of пить.',
 'grammar', 'grammar', 'type', 'aspect_choice_habitual',
 ARRAY[]::text[],
 '«Каждое утро» marks a repeated habit, and habits always take the imperfective. The present-tense form of пить for он is «пьёт» (also typed «пьет»). A perfective verb cannot express a present habitual meaning.',
 'seed', '{}'::jsonb),

('aabbccdd-9999-4006-0001-b20000000000', 'cloze_deletion', 3,
 'Извини, я забыл ___ хлеб. (Sorry, I forgot to buy bread.)',
 'купить',
 ARRAY[]::text[],
 NULL,
 'One single intended purchase — use the perfective infinitive.',
 'grammar', 'grammar', 'type', 'aspect_choice_single_event',
 ARRAY[]::text[],
 'After «забыл» we name one specific action that should have been completed once, so the perfective infinitive «купить» is needed. Imperfective «покупать» would suggest a repeated or ongoing activity, which makes no sense here.',
 'seed', '{}'::jsonb),

('aabbccdd-9999-4006-0001-b20000000000', 'fill_blank', 4,
 'Раньше я всегда ___ книги в библиотеке. (I always used to borrow books from the library.)',
 'брал',
 ARRAY['брала'],
 NULL,
 'Repeated past habit: imperfective past of брать.',
 'grammar', 'grammar', 'type', 'aspect_choice_past_habitual',
 ARRAY[]::text[],
 '«Раньше» and «всегда» describe a repeated past habit, which takes the imperfective past «брал» (feminine «брала»). The perfective «взял» would refer to one single taking, contradicting «всегда».',
 'seed', '{}'::jsonb),

('aabbccdd-9999-4006-0001-b20000000000', 'word_form', 5,
 'Завтра я обязательно ___ тебе. (Tomorrow I will definitely call you.)',
 'позвоню',
 ARRAY[]::text[],
 NULL,
 'Perfective verbs form the future with present-tense endings.',
 'grammar', 'grammar', 'type', 'aspect_choice_future',
 ARRAY[]::text[],
 'Perfective verbs have no present tense: their conjugated form refers to the future. From «позвонить», the я-form «позвоню» means «I will call (once, to completion)». The imperfective future would be «буду звонить» for an open-ended activity.',
 'seed', '{"baseWord": "позвонить"}'::jsonb),

('aabbccdd-9999-4006-0001-b20000000000', 'sentence_transformation', 6,
 'Я читал эту книгу.',
 'Я прочитал эту книгу.',
 ARRAY['я прочитала эту книгу'],
 NULL,
 'Add the prefix that makes читать perfective.',
 'grammar', 'grammar', 'type', 'aspect_choice_completion',
 ARRAY[]::text[],
 'Adding the prefix про- turns imperfective «читал» (was reading / used to read) into perfective «прочитал» (read to the end). The perfective asserts that the reading reached its natural endpoint — the whole book was finished.',
 'seed', '{"originalSentence": "Я читал эту книгу.", "instruction": "Change the verb to the perfective to say you finished the whole book."}'::jsonb),

('aabbccdd-9999-4006-0001-b20000000000', 'error_correction', 7,
 'Я весь день прочитал статьи.',
 'Я весь день читал статьи.',
 ARRAY['я за весь день прочитал статьи','за весь день я прочитал статьи','я за день прочитал статьи','за день я прочитал статьи'],
 NULL,
 'A duration phrase cannot combine with a perfective verb.',
 'grammar', 'grammar', 'type', 'aspect_choice_duration',
 ARRAY[]::text[],
 'The duration phrase «весь день» is incompatible with the perfective «прочитал», which presents the action as one completed whole. Ongoing activity measured by time requires the imperfective «читал».',
 'seed', '{}'::jsonb),

('aabbccdd-9999-4006-0001-b20000000000', 'sentence_construction', 8,
 'Build the Russian sentence: We finally bought a new house.',
 'Мы наконец купили новый дом',
 ARRAY['наконец мы купили новый дом','мы купили наконец новый дом'],
 NULL,
 'A completed one-time result takes the perfective.',
 'grammar', 'grammar', 'tap', 'aspect_choice_result',
 ARRAY['покупали'],
 '«Наконец» signals a completed result, so the perfective «купили» is correct. The extra tile «покупали» is imperfective and would wrongly present the purchase as an unfinished or repeated process.',
 'seed', '{"tiles": ["Мы","наконец","купили","новый","дом"], "distractors": ["покупали"]}'::jsonb),

('aabbccdd-9999-4006-0001-b20000000000', 'translate_to_target', 9,
 'Translate to Russian: "Yesterday I bought bread." (start with «Вчера»)',
 'Вчера я купил хлеб.',
 ARRAY['вчера я купила хлеб','я купил хлеб вчера','я купила хлеб вчера','я вчера купил хлеб','я вчера купила хлеб'],
 NULL,
 'One completed purchase in the past: perfective past of купить.',
 'grammar', 'grammar', 'type', 'aspect_choice_result',
 ARRAY[]::text[],
 'A single completed purchase takes the perfective past: «купил» (or «купила» for a female speaker). Imperfective «покупал» would mean repeated or unfinished buying, which the English sentence does not express.',
 'seed', '{}'::jsonb);

-- ─── Lesson 2: Prefixed Verbs of Motion ────────────────────────────────────

DELETE FROM exercises WHERE lesson_id = 'aabbccdd-9999-4006-0002-b20000000000';

INSERT INTO exercises
  (lesson_id, type, order_index, prompt, correct_answer, accepted_answers, options, hint_text, skill_type, subskill, response_mode, target_grammar, distractors, explanation, source_type, metadata)
VALUES
('aabbccdd-9999-4006-0002-b20000000000', 'multiple_choice', 0,
 'Анна ___ в офис в девять часов утра. (Anna arrives at the office at nine in the morning.)',
 'приходит',
 ARRAY[]::text[],
 ARRAY['уходит','приходит','выходит','заходит'],
 'The prefix при- means arrival at a destination.',
 'grammar', 'grammar', 'tap', 'motion_verbs_pri',
 ARRAY['уходит','выходит','заходит'],
 'Arrival is expressed with при-: «приходит» = arrives. «Уходит» means leaves for good, «выходит» means exits or steps out, and «заходит» means drops in briefly — none of them matches «arrives at the office».',
 'seed', '{}'::jsonb),

('aabbccdd-9999-4006-0002-b20000000000', 'multiple_choice', 1,
 'Извините, я на минуту ___ из комнаты. (Excuse me, I stepped out of the room for a minute.)',
 'вышел',
 ARRAY[]::text[],
 ARRAY['пришёл','дошёл','вышел','зашёл'],
 'The prefix вы- means movement out of an enclosed space.',
 'grammar', 'grammar', 'tap', 'motion_verbs_vy',
 ARRAY['пришёл','дошёл','зашёл'],
 'Stepping out briefly («на минуту… из комнаты») takes вы-: «вышел». «Пришёл» means arrived, «зашёл» means dropped in, and «дошёл» means reached a point and requires «до» — none of them fits a brief exit «из комнаты».',
 'seed', '{}'::jsonb),

('aabbccdd-9999-4006-0002-b20000000000', 'fill_blank', 2,
 'Автобус уже ___ , нам придётся ждать следующего. (The bus has already left, we will have to wait for the next one.)',
 'ушёл',
 ARRAY['ушел','уехал'],
 NULL,
 'The prefix у- expresses departure.',
 'grammar', 'grammar', 'type', 'motion_verbs_u',
 ARRAY[]::text[],
 'Departure is marked by the prefix у-: «автобус ушёл» (also «уехал», since a bus moves by wheels). The point is that the bus is gone — при- (arrival) or вы- (stepping out) would contradict having to wait for the next one.',
 'seed', '{}'::jsonb),

('aabbccdd-9999-4006-0002-b20000000000', 'cloze_deletion', 3,
 'По дороге домой я ___ в аптеку за лекарством. (On the way home I stopped by the pharmacy for medicine.)',
 'зашёл',
 ARRAY['зашел','зашла','заехал','заехала','забежал','забежала'],
 NULL,
 'The prefix за- means a short stop on the way somewhere.',
 'grammar', 'grammar', 'type', 'motion_verbs_za',
 ARRAY[]::text[],
 'A brief stop while heading somewhere else is expressed with за-: «зашёл в аптеку» (on foot) or «заехал» (by vehicle). «По дороге домой» makes the dropping-in meaning explicit.',
 'seed', '{}'::jsonb),

('aabbccdd-9999-4006-0002-b20000000000', 'fill_blank', 4,
 'Сейчас он ___ в школу. (He is walking to school right now.)',
 'идёт',
 ARRAY['идет'],
 NULL,
 'One direction, happening right now: unidirectional идти.',
 'grammar', 'grammar', 'type', 'motion_verbs_unidirectional',
 ARRAY[]::text[],
 '«Сейчас» plus movement toward one goal requires the unidirectional verb: «идёт». Multidirectional «ходит» describes repeated trips or walking around in general and cannot refer to one journey in progress.',
 'seed', '{}'::jsonb),

('aabbccdd-9999-4006-0002-b20000000000', 'word_form', 5,
 'В прошлом году мы ___ в другой город. (Last year we moved to another city.)',
 'переехали',
 ARRAY[]::text[],
 NULL,
 'The prefix пере- means movement from one place to another.',
 'grammar', 'grammar', 'type', 'motion_verbs_pere',
 ARRAY[]::text[],
 'The prefix пере- expresses relocation across a boundary or from one place to another: «переехали» = moved (changed residence). The plural past of переехать agrees with «мы».',
 'seed', '{"baseWord": "переехать"}'::jsonb),

('aabbccdd-9999-4006-0002-b20000000000', 'sentence_transformation', 6,
 'Он пришёл на работу в восемь.',
 'Он ушёл с работы в восемь.',
 ARRAY['он ушел с работы в восемь'],
 NULL,
 'Arrival при- + на becomes departure у- + с.',
 'grammar', 'grammar', 'type', 'motion_verbs_u',
 ARRAY[]::text[],
 'Arrival and departure are mirror pairs: «пришёл на работу» (came to work) becomes «ушёл с работы» (left work). The prefix changes при- to у-, and the preposition flips from на + accusative to с + genitive.',
 'seed', '{"originalSentence": "Он пришёл на работу в восемь.", "instruction": "Say the opposite — he LEFT work at eight. Change the prefix and the preposition."}'::jsonb),

('aabbccdd-9999-4006-0002-b20000000000', 'error_correction', 7,
 'Когда урок закончился, студенты пришли из класса.',
 'Когда урок закончился, студенты вышли из класса.',
 ARRAY['когда урок закончился студенты вышли из класса','когда урок закончился, студенты ушли из класса','когда урок закончился студенты ушли из класса'],
 NULL,
 'Movement out of a room takes вы-, not при-.',
 'grammar', 'grammar', 'type', 'motion_verbs_vy',
 ARRAY[]::text[],
 '«Пришли из класса» is contradictory: при- means arrival, but «из класса» describes movement out of the room. Exiting an enclosed space requires вы-: «вышли из класса».',
 'seed', '{}'::jsonb),

('aabbccdd-9999-4006-0002-b20000000000', 'sentence_construction', 8,
 'Build the Russian sentence: We rode the metro all the way to the center.',
 'Мы доехали до центра на метро',
 ARRAY['мы на метро доехали до центра','мы доехали на метро до центра','до центра мы доехали на метро','на метро мы доехали до центра'],
 NULL,
 'The prefix до- pairs with the preposition до (as far as).',
 'grammar', 'grammar', 'tap', 'motion_verbs_do',
 ARRAY['приехали'],
 'Reaching a specific endpoint uses до- with the preposition до: «доехали до центра». The distractor «приехали» (arrived) does not combine with «до центра» — при- takes в or на with the destination.',
 'seed', '{"tiles": ["Мы","доехали","до","центра","на","метро"], "distractors": ["приехали"]}'::jsonb),

('aabbccdd-9999-4006-0002-b20000000000', 'translate_to_target', 9,
 'Translate to Russian: "She left the house at seven."',
 'Она вышла из дома в семь.',
 ARRAY['она ушла из дома в семь','она вышла из дома в семь часов','она ушла из дома в семь часов','она в семь вышла из дома','она в семь ушла из дома'],
 NULL,
 'Leaving an enclosed space: вы- or у- + из + genitive.',
 'grammar', 'grammar', 'type', 'motion_verbs_vy',
 ARRAY[]::text[],
 'Going out of a building is «вышла из дома» (stepped out) or «ушла из дома» (left, departed); both translate the English here. The preposition из takes the genitive «дома», and the feminine past agrees with «она».',
 'seed', '{}'::jsonb);

-- ─── Lesson 3: Participles ─────────────────────────────────────────────────

DELETE FROM exercises WHERE lesson_id = 'aabbccdd-9999-4006-0003-b20000000000';

INSERT INTO exercises
  (lesson_id, type, order_index, prompt, correct_answer, accepted_answers, options, hint_text, skill_type, subskill, response_mode, target_grammar, distractors, explanation, source_type, metadata)
VALUES
('aabbccdd-9999-4006-0003-b20000000000', 'multiple_choice', 0,
 '«Человек, читающий газету, — мой отец.» What does «читающий» mean?',
 'who is reading',
 ARRAY[]::text[],
 ARRAY['who is reading','who has read','which was read','having read'],
 'The suffix -ющ- marks a present active participle.',
 'grammar', 'grammar', 'tap', 'participles_present_active',
 ARRAY['who has read','which was read','having read'],
 'The suffix -ющ- forms a present active participle: «читающий» = who is reading (now). «Who has read» would be past active «читавший», «which was read» is passive «прочитанная», and «having read» is a verbal adverb «прочитав».',
 'seed', '{}'::jsonb),

('aabbccdd-9999-4006-0003-b20000000000', 'multiple_choice', 1,
 'Письмо, ___ вчера, лежит на столе. (The letter written yesterday is on the table.)',
 'написанное',
 ARRAY[]::text[],
 ARRAY['пишущее','написанное','написавшее','написан'],
 'The letter did not write — it WAS written. Passive, neuter agreement.',
 'grammar', 'grammar', 'tap', 'participles_passive_past',
 ARRAY['пишущее','написавшее','написан'],
 'The letter undergoes the action, so the past passive participle «написанное» is needed, agreeing with neuter «письмо». Active «написавшее» would mean the letter itself wrote something; the short form «написан» cannot modify a noun inside a sentence and is masculine.',
 'seed', '{}'::jsonb),

('aabbccdd-9999-4006-0003-b20000000000', 'cloze_deletion', 2,
 'Студенты, ___ русский язык, часто ездят в Москву. (Students studying Russian often travel to Moscow.)',
 'изучающие',
 ARRAY[]::text[],
 NULL,
 'Present active participle of изучать: stem + -ющ- + plural ending.',
 'grammar', 'grammar', 'type', 'participles_present_active',
 ARRAY[]::text[],
 'From «изучают» drop -т and add -щ-: «изучающий». It must agree with plural «студенты», giving «изучающие». The participle replaces the clause «которые изучают русский язык».',
 'seed', '{}'::jsonb),

('aabbccdd-9999-4006-0003-b20000000000', 'fill_blank', 3,
 'Писатель, ___ этот роман, получил премию. (The writer who wrote this novel received a prize.)',
 'написавший',
 ARRAY[]::text[],
 NULL,
 'Past active participle of написать: -вш- + masculine ending.',
 'grammar', 'grammar', 'type', 'participles_past_active',
 ARRAY[]::text[],
 'The writer performed the action, so the past active participle «написавший» (написа- + -вш- + -ий) is required, agreeing with masculine «писатель». It replaces «который написал этот роман».',
 'seed', '{}'::jsonb),

('aabbccdd-9999-4006-0003-b20000000000', 'word_form', 4,
 'Дом был ___ в прошлом году. (The house was built last year.)',
 'построен',
 ARRAY[]::text[],
 NULL,
 'After был use the SHORT form of the passive participle.',
 'grammar', 'grammar', 'type', 'participles_short_passive',
 ARRAY[]::text[],
 'In a predicate after «был», Russian uses the short passive participle: «Дом был построен». The long form «построенный» is only for modifying a noun directly. The short masculine form agrees with «дом».',
 'seed', '{"baseWord": "построить"}'::jsonb),

('aabbccdd-9999-4006-0003-b20000000000', 'word_form', 5,
 'Книга, ___ известным автором, стала бестселлером. (The book written by a famous author became a bestseller.)',
 'написанная',
 ARRAY[]::text[],
 NULL,
 'Long past passive participle, feminine to agree with книга.',
 'grammar', 'grammar', 'type', 'participles_passive_past',
 ARRAY[]::text[],
 'The agent in the instrumental («известным автором») signals a passive construction: «написанная» — long past passive participle, feminine singular to agree with «книга». Note the double н in the long form.',
 'seed', '{"baseWord": "написать"}'::jsonb),

('aabbccdd-9999-4006-0003-b20000000000', 'sentence_transformation', 6,
 'Девушка, которая поёт на сцене, моя сестра.',
 'Девушка, поющая на сцене, моя сестра.',
 ARRAY['девушка, поющая на сцене, — моя сестра','девушка поющая на сцене моя сестра'],
 NULL,
 'From поют: drop -т, add -щ-, agree with девушка.',
 'grammar', 'grammar', 'type', 'participles_present_active',
 ARRAY[]::text[],
 'A который-clause with a present-tense verb can be replaced by a present active participle: «которая поёт» becomes «поющая» (пою- + -щ- + feminine -ая), agreeing with «девушка» in gender, number and case.',
 'seed', '{"originalSentence": "Девушка, которая поёт на сцене, моя сестра.", "instruction": "Replace «которая поёт» with the present active participle of петь."}'::jsonb),

('aabbccdd-9999-4006-0003-b20000000000', 'error_correction', 7,
 'Роман, написавший Толстым, очень длинный.',
 'Роман, написанный Толстым, очень длинный.',
 ARRAY['роман написанный толстым очень длинный'],
 NULL,
 'The agent «Толстым» (instrumental) demands a PASSIVE participle.',
 'grammar', 'grammar', 'type', 'participles_passive_past',
 ARRAY[]::text[],
 '«Написавший» is active — it would mean the novel itself wrote. With an instrumental agent («Толстым»), the passive participle is required: «написанный Толстым» = written by Tolstoy. Active and passive participles must not be confused.',
 'seed', '{}'::jsonb),

('aabbccdd-9999-4006-0003-b20000000000', 'sentence_construction', 8,
 'Build the Russian sentence: We live in a house built a hundred years ago.',
 'Мы живём в доме, построенном сто лет назад',
 ARRAY[]::text[],
 NULL,
 'The participle takes the same case as the noun it modifies (prepositional).',
 'grammar', 'grammar', 'tap', 'participles_case_agreement',
 ARRAY['построившем'],
 'The participle agrees with «доме» in the prepositional case: «построенном». The distractor «построившем» is a past ACTIVE participle — it would absurdly mean the house built something itself.',
 'seed', '{"tiles": ["Мы","живём","в","доме,","построенном","сто","лет","назад"], "distractors": ["построившем"]}'::jsonb),

('aabbccdd-9999-4006-0003-b20000000000', 'translate_to_target', 9,
 'Translate to Russian: "the broken window" (use a past passive participle)',
 'разбитое окно',
 ARRAY['сломанное окно'],
 NULL,
 'Verbs from roots like бить, крыть, мыть form the passive participle with -т-: разбить → разбитый.',
 'grammar', 'grammar', 'type', 'participles_passive_past',
 ARRAY[]::text[],
 'From «разбить» the past passive participle is formed with -т-: «разбитый». It agrees with neuter «окно», giving «разбитое окно». Participles from many monosyllabic-root verbs take -т- instead of -нн-.',
 'seed', '{}'::jsonb);

-- ─── Lesson 4: Verbal Adverbs ──────────────────────────────────────────────

DELETE FROM exercises WHERE lesson_id = 'aabbccdd-9999-4006-0004-b20000000000';

INSERT INTO exercises
  (lesson_id, type, order_index, prompt, correct_answer, accepted_answers, options, hint_text, skill_type, subskill, response_mode, target_grammar, distractors, explanation, source_type, metadata)
VALUES
('aabbccdd-9999-4006-0004-b20000000000', 'multiple_choice', 0,
 '«Читая книгу, он делал заметки.» When did he take notes?',
 'While reading',
 ARRAY[]::text[],
 ARRAY['While reading','After reading','Before reading','Instead of reading'],
 'Imperfective verbal adverbs in -я mean simultaneous action.',
 'grammar', 'grammar', 'tap', 'verbal_adverbs_imperfective',
 ARRAY['After reading','Before reading','Instead of reading'],
 'The imperfective verbal adverb «читая» (-я) expresses an action simultaneous with the main verb: he took notes WHILE reading. «After reading» would need the perfective form «прочитав».',
 'seed', '{}'::jsonb),

('aabbccdd-9999-4006-0004-b20000000000', 'multiple_choice', 1,
 '___ работу, она пошла домой. (Having finished work, she went home.)',
 'Закончив',
 ARRAY[]::text[],
 ARRAY['Заканчивая','Закончив','Закончена','Закончившая'],
 'First finish, then go: perfective verbal adverb in -в.',
 'grammar', 'grammar', 'tap', 'verbal_adverbs_perfective',
 ARRAY['Заканчивая','Закончена','Закончившая'],
 'The work was completed before she left, so the perfective verbal adverb «закончив» is required. «Заканчивая» would mean she left while still finishing; «закончена» is a short passive participle and «закончившая» a full participle — neither can modify the verb here.',
 'seed', '{}'::jsonb),

('aabbccdd-9999-4006-0004-b20000000000', 'fill_blank', 2,
 '___ по парку, мы говорили о планах. (While strolling in the park, we talked about our plans.)',
 'гуляя',
 ARRAY['прогуливаясь'],
 NULL,
 'Simultaneous action: imperfective verbal adverb of гулять.',
 'grammar', 'grammar', 'type', 'verbal_adverbs_imperfective',
 ARRAY[]::text[],
 'The two actions happen at the same time, so the imperfective verbal adverb is used: from «гуляют» drop the ending and add -я, giving «гуляя». Perfective «погуляв» would wrongly sequence the actions.',
 'seed', '{}'::jsonb),

('aabbccdd-9999-4006-0004-b20000000000', 'cloze_deletion', 3,
 '___ письмо, он сразу позвонил директору. (Having read the letter, he immediately called the director.)',
 'прочитав',
 ARRAY[]::text[],
 NULL,
 'Completed prior action: perfective verbal adverb of прочитать.',
 'grammar', 'grammar', 'type', 'verbal_adverbs_perfective',
 ARRAY[]::text[],
 '«Сразу» shows the call came right after the reading was finished. Perfective verbal adverbs are formed from the past stem with -в: «прочитав». The imperfective «читая» would mean he called while still reading.',
 'seed', '{}'::jsonb),

('aabbccdd-9999-4006-0004-b20000000000', 'word_form', 4,
 '___ домой, она сразу легла спать. (Having returned home, she went straight to bed.)',
 'вернувшись',
 ARRAY[]::text[],
 NULL,
 'Reflexive verbs form the verbal adverb with -вшись.',
 'grammar', 'grammar', 'type', 'verbal_adverbs_reflexive',
 ARRAY[]::text[],
 'Reflexive perfective verbs take -вшись: «вернуться» gives «вернувшись». The reflexive particle -ся becomes -сь after the vowel of the suffix. The form marks a completed action before the main verb.',
 'seed', '{"baseWord": "вернуться"}'::jsonb),

('aabbccdd-9999-4006-0004-b20000000000', 'sentence_transformation', 5,
 'Когда он закончил университет, он уехал в Москву.',
 'Закончив университет, он уехал в Москву.',
 ARRAY['закончив университет он уехал в москву'],
 NULL,
 'Perfective past stem + -в; drop «когда» and the repeated subject.',
 'grammar', 'grammar', 'type', 'verbal_adverbs_perfective',
 ARRAY[]::text[],
 'When both clauses share a subject, the «когда»-clause can compress into a verbal adverb phrase: «Закончив университет, …». The perfective -в form keeps the sequence: first graduation, then the move.',
 'seed', '{"originalSentence": "Когда он закончил университет, он уехал в Москву.", "instruction": "Replace the «когда» clause with a perfective verbal adverb (деепричастие)."}'::jsonb),

('aabbccdd-9999-4006-0004-b20000000000', 'sentence_transformation', 6,
 'Он слушает музыку и готовит ужин.',
 'Слушая музыку, он готовит ужин.',
 ARRAY['слушая музыку он готовит ужин'],
 NULL,
 'Imperfective verbal adverb in -я for two simultaneous actions.',
 'grammar', 'grammar', 'type', 'verbal_adverbs_imperfective',
 ARRAY[]::text[],
 'Two simultaneous actions of one subject can be joined by an imperfective verbal adverb: from «слушают» comes «слушая». The main action stays finite («готовит»), the background action becomes the adverb.',
 'seed', '{"originalSentence": "Он слушает музыку и готовит ужин.", "instruction": "Rewrite so the first action becomes a verbal adverb: start with «Слушая…»."}'::jsonb),

('aabbccdd-9999-4006-0004-b20000000000', 'error_correction', 7,
 'Заканчивая работу, она пошла домой.',
 'Закончив работу, она пошла домой.',
 ARRAY['закончив работу она пошла домой'],
 NULL,
 'She left AFTER finishing — the verbal adverb must be perfective.',
 'grammar', 'grammar', 'type', 'verbal_adverbs_perfective',
 ARRAY[]::text[],
 'Imperfective «заканчивая» claims she went home while still finishing the work — a contradiction. A completed prior action requires the perfective verbal adverb «закончив»: first the work ended, then she left.',
 'seed', '{}'::jsonb),

('aabbccdd-9999-4006-0004-b20000000000', 'sentence_construction', 8,
 'Build the Russian sentence: Having returned home, he drank some tea.',
 'Вернувшись домой, он выпил чаю',
 ARRAY[]::text[],
 NULL,
 'The verbal adverb phrase comes first, set off by a comma.',
 'grammar', 'grammar', 'tap', 'verbal_adverbs_reflexive',
 ARRAY['Вернулся'],
 'The verbal adverb «вернувшись» frames the completed prior action. The distractor «Вернулся» is a finite verb — using it would produce two main verbs with no conjunction, which Russian does not allow here.',
 'seed', '{"tiles": ["Вернувшись","домой,","он","выпил","чаю"], "distractors": ["Вернулся"]}'::jsonb),

('aabbccdd-9999-4006-0004-b20000000000', 'translate_to_target', 9,
 'Translate to Russian: "While working, he listens to music." (start with «Работая»)',
 'Работая, он слушает музыку.',
 ARRAY['работая он слушает музыку'],
 NULL,
 'Imperfective verbal adverb: from работают drop the ending, add -я.',
 'grammar', 'grammar', 'type', 'verbal_adverbs_imperfective',
 ARRAY[]::text[],
 'Simultaneous action is expressed by the imperfective verbal adverb «работая». The comma after the verbal adverb phrase is standard punctuation; the main clause keeps the present tense «слушает».',
 'seed', '{}'::jsonb);

-- ─── Lesson 5: Conditional & Subjunctive with бы ───────────────────────────

DELETE FROM exercises WHERE lesson_id = 'aabbccdd-9999-4006-0005-b20000000000';

INSERT INTO exercises
  (lesson_id, type, order_index, prompt, correct_answer, accepted_answers, options, hint_text, skill_type, subskill, response_mode, target_grammar, distractors, explanation, source_type, metadata)
VALUES
('aabbccdd-9999-4006-0005-b20000000000', 'multiple_choice', 0,
 'Если бы у меня было время, я ___ тебе. (If I had time, I would help you.)',
 'помог бы',
 ARRAY[]::text[],
 ARRAY['помогу','помог бы','помогал','буду помогать'],
 'Unreal condition: both clauses need бы + past.',
 'grammar', 'grammar', 'tap', 'conditional_by_unreal',
 ARRAY['помогу','помогал','буду помогать'],
 'An unreal condition introduced by «если бы» requires бы + past tense in the result clause too: «помог бы». Future «помогу» or plain past «помогал» without бы break the hypothetical meaning.',
 'seed', '{}'::jsonb),

('aabbccdd-9999-4006-0005-b20000000000', 'multiple_choice', 1,
 'Если завтра будет дождь, мы ___ дома. (If it rains tomorrow, we will stay home.)',
 'останемся',
 ARRAY[]::text[],
 ARRAY['останемся','остались бы','оставались','остаёмся бы'],
 'A REAL possible condition takes the future, with no бы.',
 'grammar', 'grammar', 'tap', 'conditional_by_real',
 ARRAY['остались бы','оставались','остаёмся бы'],
 'This condition is real and possible («если … будет»), so the plain future «останемся» is correct. «Бы» is only for unreal hypotheses, and it can never attach to a present-tense form like «остаёмся бы».',
 'seed', '{}'::jsonb),

('aabbccdd-9999-4006-0005-b20000000000', 'fill_blank', 2,
 'Если бы я знал ответ, я ___ сказал тебе. (If I knew the answer, I would tell you.)',
 'бы',
 ARRAY[]::text[],
 NULL,
 'The result clause of an unreal condition also needs the particle.',
 'grammar', 'grammar', 'type', 'conditional_by_unreal',
 ARRAY[]::text[],
 'Both halves of an unreal conditional carry «бы»: «Если бы я знал…, я БЫ сказал…». The particle usually stands before or right after the verb, and always combines with the past-tense form.',
 'seed', '{}'::jsonb),

('aabbccdd-9999-4006-0005-b20000000000', 'cloze_deletion', 3,
 'Я хочу, чтобы ты наконец ___ мне правду. (I want you to finally tell me the truth.)',
 'сказал',
 ARRAY['сказала','рассказал','рассказала'],
 NULL,
 'After чтобы the verb is always PAST tense; «наконец» also cues the perfective.',
 'grammar', 'grammar', 'type', 'conditional_by_chtoby',
 ARRAY[]::text[],
 '«Чтобы» historically contains бы, so the verb after it must be past tense regardless of real time: «чтобы ты сказал» = that you tell. Future or present forms after «чтобы» are ungrammatical.',
 'seed', '{}'::jsonb),

('aabbccdd-9999-4006-0005-b20000000000', 'word_form', 4,
 'Если бы он ___ здесь, он бы нам помог. (If he were here, he would help us.)',
 'был',
 ARRAY[]::text[],
 NULL,
 'Even the verb быть takes its past form after если бы.',
 'grammar', 'grammar', 'type', 'conditional_by_unreal',
 ARRAY[]::text[],
 'Russian has no special subjunctive conjugation: the unreal mood is always past tense + бы. So «if he were here» is «если бы он был здесь», with the ordinary past «был» of быть.',
 'seed', '{"baseWord": "быть"}'::jsonb),

('aabbccdd-9999-4006-0005-b20000000000', 'sentence_transformation', 5,
 'Если у меня будут деньги, я куплю машину.',
 'Если бы у меня были деньги, я бы купил машину.',
 ARRAY['если бы у меня были деньги, я купил бы машину','если бы у меня были деньги я бы купил машину','если бы у меня были деньги, я бы купила машину','если бы у меня были деньги, я купила бы машину','если бы у меня были деньги, то я бы купил машину','если бы у меня были деньги, то я купил бы машину'],
 NULL,
 'Add бы to both clauses and shift both verbs to the past.',
 'grammar', 'grammar', 'type', 'conditional_by_unreal',
 ARRAY[]::text[],
 'To make a condition unreal, add «бы» to both clauses and move both verbs to the past: «будут» becomes «были», «куплю» becomes «купил бы / бы купил». The future-tense real conditional disappears entirely.',
 'seed', '{"originalSentence": "Если у меня будут деньги, я куплю машину.", "instruction": "Make the condition unreal (hypothetical): add бы and put both verbs in the past."}'::jsonb),

('aabbccdd-9999-4006-0005-b20000000000', 'error_correction', 6,
 'Если бы я видел его вчера, я скажу ему об этом.',
 'Если бы я видел его вчера, я сказал бы ему об этом.',
 ARRAY['если бы я видел его вчера, я бы сказал ему об этом','если бы я видел его вчера я сказал бы ему об этом','если бы я видел его вчера я бы сказал ему об этом'],
 NULL,
 'The result clause cannot be future — it needs бы + past.',
 'grammar', 'grammar', 'type', 'conditional_by_unreal',
 ARRAY[]::text[],
 'Mixing an unreal «если бы» clause with a future result («скажу») is ungrammatical. The result clause must mirror the unreal form: past tense plus бы — «я сказал бы (я бы сказал) ему об этом».',
 'seed', '{}'::jsonb),

('aabbccdd-9999-4006-0005-b20000000000', 'sentence_construction', 7,
 'Build the Russian sentence: I would like to go to Russia.',
 'Я хотел бы поехать в Россию',
 ARRAY['я бы хотел поехать в россию'],
 NULL,
 'Polite wish: хотел бы + infinitive.',
 'grammar', 'grammar', 'tap', 'conditional_by_polite',
 ARRAY['хочу'],
 '«Хотел бы» + infinitive is the polite, softened way to express a wish, like English «would like». The distractor «хочу» cannot combine with «бы» — the particle only attaches to past-tense forms.',
 'seed', '{"tiles": ["Я","хотел","бы","поехать","в","Россию"], "distractors": ["хочу"]}'::jsonb),

('aabbccdd-9999-4006-0005-b20000000000', 'translate_to_target', 8,
 'Translate to Russian: "I would like to order coffee."',
 'Я хотел бы заказать кофе.',
 ARRAY['я бы хотел заказать кофе','я хотела бы заказать кофе','я бы хотела заказать кофе'],
 NULL,
 'Use the polite хотел(а) бы + perfective infinitive.',
 'grammar', 'grammar', 'type', 'conditional_by_polite',
 ARRAY[]::text[],
 'Polite requests use бы + past of хотеть plus an infinitive: «Я хотел бы заказать кофе» (feminine «хотела бы»). The particle бы may come before or after the verb with no change in meaning.',
 'seed', '{}'::jsonb),

('aabbccdd-9999-4006-0005-b20000000000', 'translate_to_target', 9,
 'Translate to Russian: "I want him to come." (use чтобы)',
 'Я хочу, чтобы он пришёл.',
 ARRAY['я хочу, чтобы он пришел','я хочу чтобы он пришёл','я хочу чтобы он пришел','я хочу, чтобы он приехал','я хочу чтобы он приехал'],
 NULL,
 'Wish about another person: хочу, чтобы + past tense.',
 'grammar', 'grammar', 'type', 'conditional_by_chtoby',
 ARRAY[]::text[],
 'When the wisher and the doer are different people, Russian uses «чтобы» + past: «Я хочу, чтобы он пришёл». An infinitive («Я хочу прийти») would mean I myself intend to come.',
 'seed', '{}'::jsonb);

-- ─── Lesson 6: Review & Test (mixes all five topics) ───────────────────────

DELETE FROM exercises WHERE lesson_id = 'aabbccdd-9999-4006-0006-b20000000000';

INSERT INTO exercises
  (lesson_id, type, order_index, prompt, correct_answer, accepted_answers, options, hint_text, skill_type, subskill, response_mode, target_grammar, distractors, explanation, source_type, metadata)
VALUES
('aabbccdd-9999-4006-0006-b20000000000', 'multiple_choice', 0,
 'Я ___ этот роман целый месяц. (I was reading this novel for a whole month.)',
 'читал',
 ARRAY[]::text[],
 ARRAY['читал','прочитал','прочитаю','буду читать'],
 'A time-span phrase signals process, not result.',
 'grammar', 'grammar', 'tap', 'aspect_choice_duration',
 ARRAY['прочитал','прочитаю','буду читать'],
 '«Целый месяц» measures the duration of the activity, so the imperfective «читал» is required. Perfective «прочитал» presents the action as one completed point and cannot combine with a duration phrase.',
 'seed', '{}'::jsonb),

('aabbccdd-9999-4006-0006-b20000000000', 'multiple_choice', 1,
 'Каждое лето мы ___ к бабушке в деревню. (Every summer we go to visit grandma in the village.)',
 'ездим',
 ARRAY[]::text[],
 ARRAY['поедем','ездим','идём','ушли'],
 'Repeated round trips by vehicle: multidirectional verb.',
 'grammar', 'grammar', 'tap', 'motion_verbs_multidirectional',
 ARRAY['поедем','идём','ушли'],
 'Habitual round trips take the multidirectional verb: «ездим» (by vehicle). Unidirectional «идём» describes one walking trip in progress, «поедем» is a one-time future trip, and «ушли» means departed on foot for good.',
 'seed', '{}'::jsonb),

('aabbccdd-9999-4006-0006-b20000000000', 'multiple_choice', 2,
 'Мальчик, ___ у окна, — мой брат. (The boy standing by the window is my brother.)',
 'стоящий',
 ARRAY[]::text[],
 ARRAY['стоя','стоящий','стоит','стоять'],
 'You need a form that modifies the noun «мальчик».',
 'grammar', 'grammar', 'tap', 'participles_present_active',
 ARRAY['стоя','стоит','стоять'],
 'Only a participle can modify a noun: «стоящий» agrees with «мальчик». «Стоя» is a verbal adverb and would describe the manner of another verb; «стоит» and «стоять» are finite and infinitive forms that cannot serve as a modifier here.',
 'seed', '{}'::jsonb),

('aabbccdd-9999-4006-0006-b20000000000', 'cloze_deletion', 3,
 '___ лекцию, студенты делали заметки. (While listening to the lecture, the students took notes.)',
 'слушая',
 ARRAY[]::text[],
 NULL,
 'Simultaneous actions: imperfective verbal adverb of слушать.',
 'grammar', 'grammar', 'type', 'verbal_adverbs_imperfective',
 ARRAY[]::text[],
 'Listening and note-taking happen at the same time, so the imperfective verbal adverb «слушая» is used. The perfective «послушав» would incorrectly mean the notes came only after the listening finished.',
 'seed', '{}'::jsonb),

('aabbccdd-9999-4006-0006-b20000000000', 'fill_blank', 4,
 'Если бы вчера не было дождя, мы ___ бы в парк. (If it had not rained yesterday, we would have gone to the park.)',
 'пошли',
 ARRAY['поехали','сходили','съездили'],
 NULL,
 'Unreal past condition: past tense verb + бы.',
 'grammar', 'grammar', 'type', 'conditional_by_unreal',
 ARRAY[]::text[],
 'The unreal result clause needs a past-tense verb with «бы»: «мы пошли бы в парк» (or «поехали бы» if by vehicle). Russian uses the same бы + past pattern for unreal present and unreal past alike.',
 'seed', '{}'::jsonb),

('aabbccdd-9999-4006-0006-b20000000000', 'word_form', 5,
 'Ужин, ___ мамой, был очень вкусный. (The dinner prepared by mom was very tasty.)',
 'приготовленный',
 ARRAY[]::text[],
 NULL,
 'Instrumental agent — long past passive participle, masculine.',
 'grammar', 'grammar', 'type', 'participles_passive_past',
 ARRAY[]::text[],
 'The instrumental agent «мамой» calls for a past passive participle: «приготовленный», masculine to agree with «ужин». The long form with double н modifies the noun directly.',
 'seed', '{"baseWord": "приготовить"}'::jsonb),

('aabbccdd-9999-4006-0006-b20000000000', 'sentence_transformation', 6,
 'Я пишу доклад.',
 'Завтра я напишу доклад.',
 ARRAY['завтра я напишу доклад'],
 NULL,
 'Perfective future = perfective verb with present-type endings.',
 'grammar', 'grammar', 'type', 'aspect_choice_future',
 ARRAY[]::text[],
 'To promise completion, switch to the perfective future: «напишу» (write and finish). Perfective verbs use present-tense endings with future meaning; the imperfective «буду писать» would only promise activity, not completion.',
 'seed', '{"originalSentence": "Я пишу доклад.", "instruction": "Say you will finish it tomorrow: rewrite in the perfective future, starting with «Завтра»."}'::jsonb),

('aabbccdd-9999-4006-0006-b20000000000', 'error_correction', 7,
 'Каждое утро я иду в бассейн.',
 'Каждое утро я хожу в бассейн.',
 ARRAY[]::text[],
 NULL,
 '«Каждое утро» means repeated trips — check the motion verb type.',
 'grammar', 'grammar', 'type', 'motion_verbs_multidirectional',
 ARRAY[]::text[],
 'Unidirectional «иду» describes one trip in progress right now, which contradicts «каждое утро». Habitual repeated trips require the multidirectional verb: «хожу в бассейн».',
 'seed', '{}'::jsonb),

('aabbccdd-9999-4006-0006-b20000000000', 'sentence_construction', 8,
 'Build the Russian sentence: If I knew, I would help.',
 'Если бы я знал, я бы помог',
 ARRAY['если бы я знал, я помог бы'],
 NULL,
 'Unreal condition: бы + past in both clauses.',
 'grammar', 'grammar', 'tap', 'conditional_by_unreal',
 ARRAY[]::text[],
 'Both clauses of an unreal conditional take past tense plus «бы»: «Если бы я знал, я бы помог». The particle may stand before or after the verb in the result clause («я помог бы» is equally correct).',
 'seed', '{"tiles": ["Если","бы","я","знал,","я","бы","помог"], "distractors": []}'::jsonb),

('aabbccdd-9999-4006-0006-b20000000000', 'translate_to_target', 9,
 'Translate to Russian: "Yesterday he came home late." (start with «Вчера»)',
 'Вчера он пришёл домой поздно.',
 ARRAY['вчера он пришел домой поздно','вчера он поздно пришёл домой','вчера он поздно пришел домой','вчера он приехал домой поздно','вчера он поздно приехал домой'],
 NULL,
 'Arrival on foot: при- + шёл. Note «домой», not «в дом».',
 'grammar', 'grammar', 'type', 'motion_verbs_pri',
 ARRAY[]::text[],
 'Arrival is expressed with при-: «пришёл домой» = came home. A single completed arrival takes the perfective, and the adverb «домой» (homeward) is used instead of a prepositional phrase.',
 'seed', '{}'::jsonb);

-- ─── Grammar rules reference set (language = ru) ───────────────────────────
-- 5 rules per CEFR level A1–B2. B2 rule_name values are prefixes of the
-- exercise target_grammar tags above so RuleCard fuzzy lookup resolves them.

INSERT INTO grammar_rules (language, cefr_level, rule_name, title, explanation, examples, common_errors, tags)
VALUES
-- ── A1 ──
('ru', 'A1', 'noun_gender', 'Gender of Nouns',
 'Every Russian noun is masculine, feminine, or neuter, and the ending usually shows which: a consonant is masculine (стол), -а/-я is feminine (книга), -о/-е is neuter (окно). Nouns ending in -ь can be either gender and must be memorized. Adjectives and past-tense verbs agree with the gender.',
 '[{"target": "новый стол, новая книга, новое окно", "native": "a new table, a new book, a new window"}, {"target": "Мой брат читал. Моя сестра читала.", "native": "My brother was reading. My sister was reading."}]'::jsonb,
 '[{"target": "моя стол → мой стол", "native": "стол ends in a consonant, so it is masculine"}]'::jsonb,
 ARRAY['nouns','gender','agreement']),

('ru', 'A1', 'no_present_tense_be', 'No «to be» in the Present Tense',
 'Russian omits the verb «to be» in the present tense: Он врач = He is a doctor, with no verb at all. Between two nouns a dash is written: Москва — столица. The verb быть reappears in the past (был) and the future (будет).',
 '[{"target": "Он студент.", "native": "He is a student."}, {"target": "Было холодно. Будет холодно.", "native": "It was cold. It will be cold."}]'::jsonb,
 '[{"target": "Он есть врач → Он врач", "native": "есть is not used to link a subject and a profession"}]'::jsonb,
 ARRAY['verbs','present','be']),

('ru', 'A1', 'present_tense_conjugation', 'Present Tense Conjugation',
 'Russian verbs fall into two conjugations. First conjugation (читать): я читаю, ты читаешь, он читает, мы читаем, вы читаете, они читают. Second conjugation (говорить): я говорю, ты говоришь, он говорит, они говорят. The ты-form ending (-ешь or -ишь) tells you the type.',
 '[{"target": "Я работаю, а ты отдыхаешь.", "native": "I am working, and you are resting."}, {"target": "Она говорит по-русски.", "native": "She speaks Russian."}]'::jsonb,
 '[{"target": "он говорят → он говорит", "native": "the verb must agree with the singular subject"}]'::jsonb,
 ARRAY['verbs','present','conjugation']),

('ru', 'A1', 'noun_plurals', 'Plural of Nouns',
 'Most masculine and feminine nouns form the plural with -ы, or -и after к, г, х and the hushers ж, ч, ш, щ: стол — столы, книга — книги. Neuter nouns swap -о for -а and -е for -я: окно — окна. Some frequent nouns are irregular: дом — дома, друг — друзья.',
 '[{"target": "стол — столы, книга — книги, окно — окна", "native": "table — tables, book — books, window — windows"}, {"target": "Мои друзья живут в Москве.", "native": "My friends live in Moscow."}]'::jsonb,
 '[{"target": "книгы → книги", "native": "after к you must write и, never ы"}]'::jsonb,
 ARRAY['nouns','plural','spelling']),

('ru', 'A1', 'possession_u_menya', 'Possession with У меня есть',
 'Russian usually expresses «to have» with у + genitive + есть: У меня есть брат = I have a brother. The owner goes into the genitive after у, and the thing owned stays in the nominative. In the negative, есть becomes нет and the thing owned takes the genitive: У меня нет времени.',
 '[{"target": "У неё есть машина.", "native": "She has a car."}, {"target": "У нас нет вопросов.", "native": "We have no questions."}]'::jsonb,
 '[{"target": "Я имею брат → У меня есть брат", "native": "иметь is rarely used for everyday possession"}]'::jsonb,
 ARRAY['possession','genitive','constructions']),

-- ── A2 ──
('ru', 'A2', 'accusative_direct_object', 'Accusative for Direct Objects',
 'The direct object of a verb takes the accusative case. Feminine nouns in -а/-я change to -у/-ю: читаю книгу. Masculine inanimate nouns look like the nominative, but masculine animate nouns take the genitive-looking ending: вижу брата. Neuter nouns do not change.',
 '[{"target": "Я читаю книгу и вижу брата.", "native": "I am reading a book and I see my brother."}, {"target": "Мы смотрим фильм.", "native": "We are watching a film."}]'::jsonb,
 '[{"target": "Я люблю музыка → Я люблю музыку", "native": "the direct object музыка must take the accusative -у"}]'::jsonb,
 ARRAY['cases','accusative','objects']),

('ru', 'A2', 'prepositional_location', 'Prepositional Case for Location',
 'To say where something is, use в or на plus the prepositional case, which usually ends in -е: в Москве, на работе. Some masculine nouns take stressed -у instead: в лесу, в углу. Use в for enclosed spaces and на for surfaces, events, and certain fixed nouns (на почте, на вокзале).',
 '[{"target": "Я живу в Москве и работаю на заводе.", "native": "I live in Moscow and work at a factory."}, {"target": "Книга лежит на столе.", "native": "The book is lying on the table."}]'::jsonb,
 '[{"target": "в Москва → в Москве", "native": "location with в/на requires the prepositional case"}]'::jsonb,
 ARRAY['cases','prepositional','location']),

('ru', 'A2', 'past_tense_formation', 'Past Tense Formation',
 'The past tense is formed from the infinitive stem plus -л, and it agrees in gender and number, not person: он читал, она читала, оно читало, они читали. A few verbs drop the -л in the masculine: он мог, он нёс. The verb быть also follows this pattern: был, была, были.',
 '[{"target": "Она работала, а он отдыхал.", "native": "She was working while he was resting."}, {"target": "Мы были дома.", "native": "We were at home."}]'::jsonb,
 '[{"target": "она читал → она читала", "native": "the past tense must agree with the feminine subject"}]'::jsonb,
 ARRAY['verbs','past','agreement']),

('ru', 'A2', 'unprefixed_motion_verbs', 'Unidirectional vs Multidirectional Motion',
 'Basic motion verbs come in pairs: идти/ходить (on foot), ехать/ездить (by vehicle). The first member describes one trip in one direction, happening now or at a specific moment: Сейчас я иду домой. The second describes repeated trips, round trips, or general ability: Я часто хожу в кино.',
 '[{"target": "Сейчас он идёт в школу.", "native": "He is walking to school right now."}, {"target": "Каждый день он ходит в школу.", "native": "He goes to school every day."}]'::jsonb,
 '[{"target": "Каждый день я иду на работу → Каждый день я хожу на работу", "native": "repeated trips need the multidirectional verb"}]'::jsonb,
 ARRAY['verbs','motion','aspect']),

('ru', 'A2', 'dative_case_uses', 'Dative for Recipients and Age',
 'The dative case marks the person something is given, said, or shown to: Я дал книгу брату. It is also used for age (Мне двадцать лет) and in impersonal expressions of feeling and necessity: Мне холодно, Ему нужно работать. Common endings: -у/-ю (masculine), -е (feminine).',
 '[{"target": "Я позвонил маме.", "native": "I called mom."}, {"target": "Мне двадцать лет.", "native": "I am twenty years old."}]'::jsonb,
 '[{"target": "Я имею 20 лет → Мне двадцать лет", "native": "age is expressed with the dative, not with a verb of having"}]'::jsonb,
 ARRAY['cases','dative','impersonal']),

-- ── B1 ──
('ru', 'B1', 'genitive_negation_quantity', 'Genitive for Negation and Quantity',
 'The genitive case appears after нет (У меня нет времени), after numbers from two upward (два часа, пять минут), and after quantity words like много, мало, несколько: много друзей. It also marks possession between nouns: машина брата = the car of my brother.',
 '[{"target": "В городе нет театра.", "native": "There is no theater in the city."}, {"target": "У меня много работы и мало времени.", "native": "I have a lot of work and little time."}]'::jsonb,
 '[{"target": "нет время → нет времени", "native": "нет always requires the genitive"}]'::jsonb,
 ARRAY['cases','genitive','negation','quantity']),

('ru', 'B1', 'instrumental_case_uses', 'Instrumental Case Uses',
 'The instrumental marks the tool or means of an action (писать ручкой), accompaniment with с (кофе с молоком), and the complement of быть, стать, работать: Он работает врачом, Она стала инженером. Typical endings are -ом/-ем (masculine, neuter) and -ой/-ей (feminine).',
 '[{"target": "Он пишет карандашом.", "native": "He writes with a pencil."}, {"target": "Она работает учителем.", "native": "She works as a teacher."}]'::jsonb,
 '[{"target": "Он работает врач → Он работает врачом", "native": "professions after работать take the instrumental"}]'::jsonb,
 ARRAY['cases','instrumental','professions']),

('ru', 'B1', 'aspect_in_future', 'Two Futures: буду + Infinitive vs Perfective',
 'Russian has two futures. The imperfective future — буду + imperfective infinitive — promises activity without saying it will be finished: Я буду читать. The perfective future uses present-type endings on a perfective verb and promises completion: Я прочитаю книгу = I will read the book to the end.',
 '[{"target": "Вечером я буду читать.", "native": "In the evening I will be reading."}, {"target": "Я прочитаю эту статью сегодня.", "native": "I will finish reading this article today."}]'::jsonb,
 '[{"target": "Я буду прочитать книгу → Я прочитаю книгу", "native": "буду never combines with a perfective infinitive"}]'::jsonb,
 ARRAY['verbs','future','aspect']),

('ru', 'B1', 'imperative_formation', 'Imperative Formation',
 'Form the imperative from the они-stem. After a vowel add -й: читают → читай. After a consonant add stressed -и (говорят → говори) or soft sign -ь when the stress is fixed on the stem: будут → будь. Add -те for polite or plural address: читайте, говорите. Aspect matters: perfective for single requests, imperfective for invitations and general advice.',
 '[{"target": "Скажите, пожалуйста, где метро?", "native": "Please tell me where the metro is."}, {"target": "Читай каждый день!", "native": "Read every day!"}]'::jsonb,
 '[{"target": "Говорите мне сейчас ваш адрес → Скажите мне ваш адрес", "native": "a single concrete request usually takes the perfective imperative"}]'::jsonb,
 ARRAY['verbs','imperative','aspect']),

('ru', 'B1', 'reflexive_verbs_sya', 'Reflexive Verbs in -ся',
 'The particle -ся (-сь after a vowel) attaches to the end of the verb: учиться, я учусь, она училась. It covers true reflexives (одеваться = dress oneself), reciprocals (встречаться = meet each other), and many verbs that are simply always reflexive: смеяться, надеяться, бояться. Verbs in -ся never take a direct object in the accusative.',
 '[{"target": "Я учусь в университете.", "native": "I study at a university."}, {"target": "Мы встретились в парке.", "native": "We met in the park."}]'::jsonb,
 '[{"target": "Я учу в университете → Я учусь в университете", "native": "to be a student is учиться, with the reflexive particle"}]'::jsonb,
 ARRAY['verbs','reflexive','conjugation']),

-- ── B2 (rule_name values match exercise target_grammar prefixes) ──
('ru', 'B2', 'aspect_choice', 'Choosing the Aspect in the Past',
 'Use the imperfective past for process, duration, and repetition — especially with phrases like весь день, каждый день, всегда, долго: Я весь вечер читал. Use the perfective past for a single completed action with a result, often signalled by наконец, уже, сразу: Я наконец прочитал книгу.',
 '[{"target": "Я весь вечер читал книгу.", "native": "I was reading a book all evening."}, {"target": "Я наконец прочитал книгу.", "native": "I finally finished the book."}]'::jsonb,
 '[{"target": "Я весь день прочитал статьи → Я весь день читал статьи", "native": "a duration phrase cannot combine with a perfective verb"}]'::jsonb,
 ARRAY['verbs','aspect','past']),

('ru', 'B2', 'motion_verbs', 'Prefixed Verbs of Motion',
 'Prefixes give motion verbs precise meanings: при- arrival (пришёл), у- departure (ушёл), вы- out of (вышел из), в- into, за- a short stop on the way (зашёл в аптеку), до- reaching a point (доехал до центра), пере- across or relocation (переехал). Each prefix pairs with its own preposition: при- with в/на, вы- with из, до- with до.',
 '[{"target": "Она пришла на работу в девять.", "native": "She arrived at work at nine."}, {"target": "По дороге домой я зашёл в магазин.", "native": "On the way home I stopped by the store."}]'::jsonb,
 '[{"target": "студенты пришли из класса → студенты вышли из класса", "native": "movement out of a room takes вы-, not при-"}]'::jsonb,
 ARRAY['verbs','motion','prefixes']),

('ru', 'B2', 'participles', 'Participles (Причастия)',
 'Participles are verbal adjectives that replace который-clauses. Present active -ущ-/-ющ-/-ащ-/-ящ-: читающий = who is reading. Past active -вш-: написавший = who wrote. Past passive -нн-/-т-: написанный, разбитый = which was written, broken. After быть use the short passive form: Дом был построен. Participles agree with their noun in gender, number, and case.',
 '[{"target": "Студенты, изучающие русский язык, ездят в Москву.", "native": "Students studying Russian travel to Moscow."}, {"target": "Роман, написанный Толстым, очень длинный.", "native": "The novel written by Tolstoy is very long."}]'::jsonb,
 '[{"target": "Роман, написавший Толстым → Роман, написанный Толстым", "native": "an instrumental agent requires the passive participle, not the active"}]'::jsonb,
 ARRAY['participles','adjectives','clauses']),

('ru', 'B2', 'verbal_adverbs', 'Verbal Adverbs (Деепричастия)',
 'Verbal adverbs describe a secondary action of the same subject. Imperfective -я means simultaneous action: Читая книгу, он делал заметки = while reading. Perfective -в/-вшись means completed prior action: Прочитав письмо, он позвонил = having read. The subject of the verbal adverb must be the subject of the main clause.',
 '[{"target": "Гуляя по парку, мы говорили о планах.", "native": "While strolling in the park, we talked about our plans."}, {"target": "Вернувшись домой, она легла спать.", "native": "Having returned home, she went to bed."}]'::jsonb,
 '[{"target": "Заканчивая работу, она пошла домой → Закончив работу, она пошла домой", "native": "a completed prior action needs the perfective form in -в"}]'::jsonb,
 ARRAY['verbal-adverbs','aspect','clauses']),

('ru', 'B2', 'conditional_by', 'Conditional and Subjunctive with бы',
 'Unreal situations use бы + past in BOTH clauses: Если бы я знал, я бы сказал. Real conditions take если + future, without бы. The same бы hides inside чтобы, so чтобы is always followed by the past: Я хочу, чтобы ты пришёл. Polite wishes: хотел бы + infinitive.',
 '[{"target": "Если бы у меня были деньги, я бы купил машину.", "native": "If I had money, I would buy a car."}, {"target": "Я хочу, чтобы он пришёл.", "native": "I want him to come."}]'::jsonb,
 '[{"target": "Если бы я видел его, я скажу ему → Если бы я видел его, я сказал бы ему", "native": "the result clause of an unreal condition must be бы + past, never future"}]'::jsonb,
 ARRAY['conditional','subjunctive','particles'])

ON CONFLICT (language, rule_name) DO UPDATE SET
  cefr_level = EXCLUDED.cefr_level,
  title = EXCLUDED.title,
  explanation = EXCLUDED.explanation,
  examples = EXCLUDED.examples,
  common_errors = EXCLUDED.common_errors,
  tags = EXCLUDED.tags;

COMMIT;
