-- ═══════════════════════════════════════════════════════════════════════════
-- Fluenci seed: Japanese B2 "Complex Grammar" unit rebuild + grammar_rules (ja)
--
-- Replaces the broken European-template content (Subjunctive Mood etc.) with
-- linguistically correct upper-intermediate Japanese grammar (~JLPT N3/N2):
--   L1 Conditionals (と・ば・たら・なら)   L2 Passive & suffering passive (受身)
--   L3 Causative & causative-passive        L4 Keigo (尊敬語・謙譲語)
--   L5 Hearsay & reported speech            L6 Review & Test (mixed)
--
-- Design notes (verified against components/lesson/* and lib/grading.ts):
--  * gradeAnswer fuzzy-accepts answers within Levenshtein distance 2
--    (1 when the normalized answer is <= 4 chars). All multiple-choice
--    distractors and error_correction source sentences were checked to sit
--    OUTSIDE that radius of the correct/accepted answers.
--  * sentence_construction tokenizes correct_answer on ASCII spaces
--    (Japanese is pre-segmented); metadata.tiles mirrors the tokens.
--  * error_correction reads metadata.error_sentence; sentence_transformation
--    reads metadata.originalSentence / metadata.instruction; word_form reads
--    metadata.baseWord.
--  * Polite (〜ました) variants of long plain-form answers pass automatically
--    via the distance-2 fuzzy window and are intentionally NOT listed.
--  * B2 grammar_rules rule_names (conditional / passive / causative / keigo /
--    hearsay) are substrings of the exercise target_grammar tags so that
--    the RuleCard contains-match finds them.
--
-- STAGED ONLY — do not apply without review. Apply via Supabase MCP/dashboard.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── Unit ────────────────────────────────────────────────────────────────────
UPDATE units SET
  title = 'Complex Grammar',
  description = 'Conditionals, passives, causatives, keigo, and reported speech — the grammar that makes Japanese natural at N3–N2 level'
WHERE id = 'aabbccdd-6666-4006-0000-b20000000000';

-- ─── Lessons (IDs reused; titles/descriptions replaced) ──────────────────────
UPDATE lessons SET
  title = 'Conditionals: と・ば・たら・なら',
  description = 'When to use each of the four conditionals — and when each one is impossible'
WHERE id = 'aabbccdd-6666-4006-0001-b20000000000';

UPDATE lessons SET
  title = 'The Passive: 受身',
  description = 'Direct and suffering passives — the grammar of being affected'
WHERE id = 'aabbccdd-6666-4006-0002-b20000000000';

UPDATE lessons SET
  title = 'Causative & Causative-Passive: 使役',
  description = 'Making, letting, and being made: 〜させる and 〜させられる'
WHERE id = 'aabbccdd-6666-4006-0003-b20000000000';

UPDATE lessons SET
  title = 'Keigo: 尊敬語と謙譲語',
  description = 'Respectful and humble language for work and formal situations'
WHERE id = 'aabbccdd-6666-4006-0004-b20000000000';

UPDATE lessons SET
  title = 'Hearsay & Reported Speech: そうだ・らしい',
  description = 'Reporting what you heard: 〜そうだ, 〜らしい, and 〜と言っていました'
WHERE id = 'aabbccdd-6666-4006-0005-b20000000000';

UPDATE lessons SET
  title = 'Review & Test',
  description = 'Mixed practice across conditionals, passive, causative, keigo, and reported speech'
WHERE id = 'aabbccdd-6666-4006-0006-b20000000000';

-- ─── Wipe old exercises for all six lessons ──────────────────────────────────
DELETE FROM exercises WHERE lesson_id IN (
  'aabbccdd-6666-4006-0001-b20000000000',
  'aabbccdd-6666-4006-0002-b20000000000',
  'aabbccdd-6666-4006-0003-b20000000000',
  'aabbccdd-6666-4006-0004-b20000000000',
  'aabbccdd-6666-4006-0005-b20000000000',
  'aabbccdd-6666-4006-0006-b20000000000'
);

-- ═════════════════════════════════════════════════════════════════════════
-- Lesson 1 — Conditionals: と・ば・たら・なら
-- ═════════════════════════════════════════════════════════════════════════
INSERT INTO exercises
  (lesson_id, type, order_index, prompt, correct_answer, accepted_answers, options, hint_text, skill_type, subskill, response_mode, target_grammar, distractors, explanation, source_type, metadata)
VALUES
('aabbccdd-6666-4006-0001-b20000000000', 'multiple_choice', 0,
 '春になると、桜が咲きます。— What does the「と」conditional express here?',
 'A natural or automatic result', '{}',
 ARRAY['A natural or automatic result','A polite request','A hypothetical wish about the past','Permission to do something'],
 'と states what always or inevitably follows.',
 'grammar', 'grammar', 'tap', 'conditional_to',
 ARRAY['A polite request','A hypothetical wish about the past','Permission to do something'],
 'と links a condition to a result that follows automatically or habitually: whenever spring comes, the blossoms bloom. It cannot introduce requests, suggestions, or wishes, so the other readings are impossible.',
 'manual', '{}'::jsonb),

('aabbccdd-6666-4006-0001-b20000000000', 'multiple_choice', 1,
 '「京都に行きたいんですが…」「京都に___、秋がいちばんきれいですよ。」— Choose the correct conditional.',
 '行くなら', '{}',
 ARRAY['行くと','行くなら','行けば','行ったら'],
 'The speaker is giving advice based on what they just heard.',
 'grammar', 'grammar', 'tap', 'conditional_nara',
 ARRAY['行くと','行けば','行ったら'],
 'なら takes up the other person''s statement ("if it''s Kyoto you''re going to…") and lets the speaker comment before the trip happens. と, ば, and たら would make the advice hinge on the trip already taking place.',
 'manual', '{}'::jsonb),

('aabbccdd-6666-4006-0001-b20000000000', 'multiple_choice', 2,
 '家に帰ると、猫が玄関で待っていた。— What nuance does「と」+ past tense add here?',
 'The speaker discovered something upon returning home', '{}',
 ARRAY['The speaker returns home at the same time every day','The speaker discovered something upon returning home','The cat was told to wait at the door','The speaker regrets coming home'],
 'と + a past-tense main clause narrates two events in sequence.',
 'grammar', 'grammar', 'tap', 'conditional_to',
 ARRAY['The speaker returns home at the same time every day','The cat was told to wait at the door','The speaker regrets coming home'],
 'When the main clause is past tense, と narrates a discovery: the moment the speaker got home, they found the cat already waiting. This is a storytelling use, not a general rule.',
 'manual', '{}'::jsonb),

('aabbccdd-6666-4006-0001-b20000000000', 'fill_blank', 3,
 '天気が良___、明日ハイキングに行きます。(〜ば)',
 'ければ', '{}', NULL,
 'い-adjective + ば: replace the final い.',
 'grammar', 'grammar', 'type', 'conditional_ba',
 '{}',
 'い-adjectives form the ば-conditional by replacing the final い with ければ: 良い→良ければ. Because the condition is stative, the main clause may freely express the speaker''s plan.',
 'manual', '{}'::jsonb),

('aabbccdd-6666-4006-0001-b20000000000', 'cloze_deletion', 4,
 'もし雨が降っ___、試合は中止になります。',
 'たら', '{}', NULL,
 'もし signals a one-time hypothetical.',
 'grammar', 'grammar', 'type', 'conditional_tara',
 '{}',
 'たら attaches to the past-tense stem (降っ+たら) and marks a single hypothetical event: if it rains, the match will be called off. もし reinforces the hypothetical reading.',
 'manual', '{}'::jsonb),

('aabbccdd-6666-4006-0001-b20000000000', 'word_form', 5,
 'この薬を___、すぐ良くなりますよ。(飲む — ば conditional)',
 '飲めば', ARRAY['のめば'], NULL,
 'Godan verb: change the final -u to -eba.',
 'grammar', 'grammar', 'type', 'conditional_ba',
 '{}',
 'Godan verbs form the ば-conditional by shifting the final う-row syllable to its え-row + ば: 飲む→飲めば. The sentence states a general truth: if you take it, you''ll get better.',
 'manual', '{"baseWord":"飲む"}'::jsonb),

('aabbccdd-6666-4006-0001-b20000000000', 'sentence_transformation', 6,
 'Rewrite using たら: 春になると、暖かくなります。',
 '春になったら、暖かくなります。',
 ARRAY['春になったら、暖かくなります','春になったら暖かくなります。','春になったら暖かくなります','はるになったら、あたたかくなります。','はるになったらあたたかくなります'],
 NULL,
 'なる → なった + ら.',
 'grammar', 'grammar', 'type', 'conditional_tara',
 '{}',
 'たら also covers natural results when framed as "once X happens." Attach ら to the plain past: なる→なった→なったら. The rest of the sentence stays unchanged.',
 'manual', '{"originalSentence":"春になると、暖かくなります。","instruction":"Rewrite the sentence using たら instead of と."}'::jsonb),

('aabbccdd-6666-4006-0001-b20000000000', 'error_correction', 7,
 '日本に着くと、電話してください。',
 '日本に着いたら、電話してください。',
 ARRAY['日本に着いたら、電話してください','日本に着いたら電話してください。','日本に着いたら電話してください','にほんについたら、でんわしてください。','にほんについたらでんわしてください'],
 NULL,
 'と cannot be followed by a request. Use たら.',
 'grammar', 'grammar', 'type', 'conditional_tara',
 '{}',
 'The main clause is a request (〜てください), which the と conditional does not allow. たら has no such restriction: 着く→着いたら, "once you arrive in Japan, please call me."',
 'manual', '{"error_sentence":"日本に着くと、電話してください。"}'::jsonb),

('aabbccdd-6666-4006-0001-b20000000000', 'sentence_construction', 8,
 'Build the sentence: "If you''re going to study Japanese, this dictionary is good."',
 '日本語を 勉強する なら この 辞書が いいですよ', '{}', NULL,
 'なら attaches directly to the plain verb; the recommendation follows.',
 'grammar', 'grammar', 'tap', 'conditional_nara',
 '{}',
 'なら follows the plain form directly: 勉強する+なら. The advice clause この辞書がいいですよ comes after, and この must sit immediately before 辞書が.',
 'manual', '{"tiles":["日本語を","勉強する","なら","この","辞書が","いいですよ"]}'::jsonb),

('aabbccdd-6666-4006-0001-b20000000000', 'translate_to_target', 9,
 'Translate into Japanese: "If it''s cheap, I''ll buy it."',
 '安かったら、買います。',
 ARRAY['安かったら、買います','安かったら買います。','安かったら買います','やすかったら、かいます。','やすかったらかいます','安ければ、買います。','安ければ買います','やすければかいます','安いなら買います','安かったら買う','安ければ買う','やすければかう'],
 NULL,
 'い-adjective: 安い → 安かったら or 安ければ.',
 'grammar', 'grammar', 'type', 'conditional_tara',
 '{}',
 'Both たら and ば are natural here: 安かったら／安ければ買います. い-adjectives form たら from the past stem: 安い→安かった+ら. と would turn the decision into an automatic habit.',
 'manual', '{}'::jsonb);

-- ═════════════════════════════════════════════════════════════════════════
-- Lesson 2 — The Passive: 受身 (direct + suffering passive)
-- ═════════════════════════════════════════════════════════════════════════
INSERT INTO exercises
  (lesson_id, type, order_index, prompt, correct_answer, accepted_answers, options, hint_text, skill_type, subskill, response_mode, target_grammar, distractors, explanation, source_type, metadata)
VALUES
('aabbccdd-6666-4006-0002-b20000000000', 'multiple_choice', 0,
 '私は先生に褒められました。— What does this sentence mean?',
 'I was praised by my teacher.', '{}',
 ARRAY['I was praised by my teacher.','I praised my teacher.','I made my teacher praise me.','I want my teacher to praise me.'],
 '〜られる marks the passive; に marks the doer.',
 'grammar', 'grammar', 'tap', 'passive_basic',
 ARRAY['I praised my teacher.','I made my teacher praise me.','I want my teacher to praise me.'],
 '褒められました is the passive of 褒める. The subject 私 receives the action and the agent 先生 is marked with に: "I was praised by my teacher."',
 'manual', '{}'::jsonb),

('aabbccdd-6666-4006-0002-b20000000000', 'multiple_choice', 1,
 'What is the passive (受身) form of「読む」?',
 '読まれる', '{}',
 ARRAY['読もう','読める','読まれる','読みたい'],
 'Godan: -u → -a + れる.',
 'grammar', 'grammar', 'tap', 'passive_basic',
 ARRAY['読もう','読める','読みたい'],
 'Godan verbs form the passive with the あ-row stem + れる: 読む→読ま+れる. 読める is the potential ("can read") — the most common mix-up — while 読もう is volitional and 読みたい expresses desire.',
 'manual', '{}'::jsonb),

('aabbccdd-6666-4006-0002-b20000000000', 'multiple_choice', 2,
 '昨日、隣の人に一晩中ピアノを弾かれました。— What happened?',
 'The neighbor played the piano all night, and it bothered me.', '{}',
 ARRAY['The neighbor played the piano all night, and it bothered me.','I played the piano for my neighbor all night.','I asked my neighbor to play the piano.','My neighbor let me play the piano all night.'],
 'The passive of someone else''s action often means you suffered from it.',
 'grammar', 'grammar', 'tap', 'suffering_passive',
 ARRAY['I played the piano for my neighbor all night.','I asked my neighbor to play the piano.','My neighbor let me play the piano all night.'],
 'This is the "suffering passive" (迷惑の受身): the neighbor''s playing is presented from the speaker''s point of view as an annoyance. The agent takes に, and the nuisance is implied by the passive itself.',
 'manual', '{}'::jsonb),

('aabbccdd-6666-4006-0002-b20000000000', 'multiple_choice', 3,
 '昨日、電車で財布を盗まれました。— What does this sentence mean?',
 'Someone stole my wallet on the train.', '{}',
 ARRAY['Someone stole my wallet on the train.','I stole a wallet on the train.','I made someone steal a wallet on the train.','I found a wallet on the train.'],
 'Victim passive: the victim keeps を on the stolen item.',
 'grammar', 'grammar', 'tap', 'passive_basic',
 ARRAY['I stole a wallet on the train.','I made someone steal a wallet on the train.','I found a wallet on the train.'],
 '盗まれました is the passive of 盗む: the unstated topic 私 is the victim and the stolen item keeps を — "I had my wallet stolen." Active 盗みました would mean you did the stealing yourself.',
 'manual', '{}'::jsonb),

('aabbccdd-6666-4006-0002-b20000000000', 'cloze_deletion', 4,
 '私の写真がコンテストで___。(選ぶ — passive, plain past)',
 '選ばれた', ARRAY['えらばれた'], NULL,
 '選ぶ is godan: ぶ → ば + れた.',
 'grammar', 'grammar', 'type', 'passive_basic',
 '{}',
 'When the doer is unimportant, Japanese uses the passive with the thing as subject: 写真が選ばれた, "my photo was chosen." 選ぶ→選ばれる, plain past 選ばれた.',
 'manual', '{}'::jsonb),

('aabbccdd-6666-4006-0002-b20000000000', 'word_form', 5,
 '昨日、帰り道で雨に___。(降る — passive, plain past)',
 '降られた', ARRAY['ふられた'], NULL,
 'Intransitive verbs can be passive in Japanese when someone is affected.',
 'grammar', 'grammar', 'type', 'suffering_passive',
 '{}',
 '降られる is the classic suffering passive of an intransitive verb: the rain fell and I was affected. English cannot mirror this — it literally reads "I was fallen on by the rain."',
 'manual', '{"baseWord":"降る"}'::jsonb),

('aabbccdd-6666-4006-0002-b20000000000', 'multiple_choice', 6,
 '「先生が私を叱った」— Choose the correct passive version, with 私 as the subject.',
 '私は先生に叱られた。', '{}',
 ARRAY['私は先生に叱られた。','私は先生を叱った。','先生は私に叱られた。','先生は私に叱った。'],
 'Object → subject; the doer takes に; 叱った → 叱られた.',
 'grammar', 'grammar', 'tap', 'passive_basic',
 ARRAY['私は先生を叱った。','先生は私に叱られた。','先生は私に叱った。'],
 'The active object 私を becomes the passive subject 私は, the agent 先生 takes に, and the verb becomes passive past 叱られた. 先生は私に叱られた reverses who got scolded, and the other two keep the verb active.',
 'manual', '{}'::jsonb),

('aabbccdd-6666-4006-0002-b20000000000', 'error_correction', 7,
 '私は犬が手を噛みました。(Intended meaning: "I got my hand bitten by a dog.")',
 '私は犬に手を噛まれました。',
 ARRAY['私は犬に手を噛まれました','わたしはいぬにてをかまれました。','わたしはいぬにてをかまれました','私は犬に手をかまれました。','私は犬に手をかまれました'],
 NULL,
 'Make 私 the victim: agent に + passive verb.',
 'grammar', 'grammar', 'type', 'passive_basic',
 '{}',
 'With 私は as the topic-victim, the biter must take に and the verb must be passive: 噛みました→噛まれました. As written, the sentence mixes an active verb with a victim frame.',
 'manual', '{"error_sentence":"私は犬が手を噛みました。"}'::jsonb),

('aabbccdd-6666-4006-0002-b20000000000', 'sentence_construction', 8,
 'Build the sentence: "I had my camera broken by my little brother."',
 '私は 弟に カメラを 壊された',
 ARRAY['私は カメラを 弟に 壊された'],
 NULL,
 'Victim は + agent に + object を + passive verb.',
 'grammar', 'grammar', 'tap', 'suffering_passive',
 '{}',
 'The victim passive keeps を on the damaged item: 私は弟にカメラを壊された. The agent (弟) takes に and the verb is passive past 壊された.',
 'manual', '{"tiles":["私は","弟に","カメラを","壊された"]}'::jsonb),

('aabbccdd-6666-4006-0002-b20000000000', 'translate_to_target', 9,
 'Translate into Japanese: "My mother read my diary (and I''m not happy about it)."',
 '母に日記を読まれた。',
 ARRAY['母に日記を読まれた','私は母に日記を読まれた。','私は母に日記を読まれた','日記を母に読まれた。','日記を母に読まれた','ははににっきをよまれた。','ははににっきをよまれた'],
 NULL,
 'Suffering passive: 読む → 読まれた; keep を on 日記.',
 'grammar', 'grammar', 'type', 'suffering_passive',
 '{}',
 'The annoyance reading comes from the suffering passive: 母に日記を読まれた. A plain active sentence (母が日記を読んだ) reports the fact without the nuance of being affected.',
 'manual', '{}'::jsonb);

-- ═════════════════════════════════════════════════════════════════════════
-- Lesson 3 — Causative & Causative-Passive: 使役・使役受身
-- ═════════════════════════════════════════════════════════════════════════
INSERT INTO exercises
  (lesson_id, type, order_index, prompt, correct_answer, accepted_answers, options, hint_text, skill_type, subskill, response_mode, target_grammar, distractors, explanation, source_type, metadata)
VALUES
('aabbccdd-6666-4006-0003-b20000000000', 'multiple_choice', 0,
 '母は弟に野菜を食べさせました。— What does this sentence mean?',
 'Mom made my little brother eat vegetables.', '{}',
 ARRAY['My little brother made Mom eat vegetables.','Mom made my little brother eat vegetables.','Mom was made to eat vegetables by my little brother.','Mom and my little brother ate vegetables together.'],
 'させる = make/let someone do; the causer is the subject.',
 'grammar', 'grammar', 'tap', 'causative_basic',
 ARRAY['My little brother made Mom eat vegetables.','Mom was made to eat vegetables by my little brother.','Mom and my little brother ate vegetables together.'],
 '食べさせる is the causative of 食べる. The subject 母 causes the action, and the person made to act (弟) takes に because the verb also has a direct object (野菜を).',
 'manual', '{}'::jsonb),

('aabbccdd-6666-4006-0003-b20000000000', 'multiple_choice', 1,
 'What is the causative (使役) form of「行く」?',
 '行かせる', '{}',
 ARRAY['行ける','行かせる','行かない','行こう'],
 'Godan: -u → -a + せる.',
 'grammar', 'grammar', 'tap', 'causative_basic',
 ARRAY['行ける','行かない','行こう'],
 'Godan verbs form the causative with the あ-row stem + せる: 行く→行か+せる, "make/let someone go." 行ける is the potential, 行こう the volitional, and 行かない the plain negative.',
 'manual', '{}'::jsonb),

('aabbccdd-6666-4006-0003-b20000000000', 'multiple_choice', 2,
 '私は部長に残業させられました。— What happened?',
 'I was made to work overtime by my manager.', '{}',
 ARRAY['I was made to work overtime by my manager.','I made my manager work overtime.','My manager let me go home early.','I chose to work overtime for my manager.'],
 'させられる = causative + passive: forced, from the subject''s view.',
 'grammar', 'grammar', 'tap', 'causative_passive',
 ARRAY['I made my manager work overtime.','My manager let me go home early.','I chose to work overtime for my manager.'],
 'させられる stacks the passive onto the causative: the subject was made to act. The forcer (部長) takes に. The construction carries a nuance of unwillingness — I had no choice.',
 'manual', '{}'::jsonb),

('aabbccdd-6666-4006-0003-b20000000000', 'multiple_choice', 3,
 '母は子どもを公園で遊ばせた。— What does this sentence mean?',
 'Mom let the child play in the park.', '{}',
 ARRAY['Mom let the child play in the park.','Mom played in the park with the child.','The child made Mom play in the park.','Mom was allowed to play in the park.'],
 '遊ばせる = causative of 遊ぶ; the causer is the subject.',
 'grammar', 'grammar', 'tap', 'causative_basic',
 ARRAY['Mom played in the park with the child.','The child made Mom play in the park.','Mom was allowed to play in the park.'],
 '遊ばせた is the causative of 遊ぶ: "let/made someone play." With an intransitive verb the causee takes を: 子どもを遊ばせた. Only one kana separates it from passive 遊ばれた — a completely different meaning.',
 'manual', '{}'::jsonb),

('aabbccdd-6666-4006-0003-b20000000000', 'multiple_choice', 4,
 '先生は学生に漢字を百回書かせた。— What does this sentence mean?',
 'The teacher made the students write the kanji 100 times.', '{}',
 ARRAY['The teacher made the students write the kanji 100 times.','The students made the teacher write the kanji 100 times.','The teacher wrote the kanji 100 times for the students.','The teacher was made to write the kanji 100 times.'],
 'Causative: the causee takes に when the verb has a direct object.',
 'grammar', 'grammar', 'tap', 'causative_basic',
 ARRAY['The students made the teacher write the kanji 100 times.','The teacher wrote the kanji 100 times for the students.','The teacher was made to write the kanji 100 times.'],
 '書かせた is the causative of 書く. The subject 先生 causes the action; because 漢字を already takes を, the causee 学生 is marked with に. Passive 書かれた or causative-passive 書かされた would flip who is affected.',
 'manual', '{}'::jsonb),

('aabbccdd-6666-4006-0003-b20000000000', 'multiple_choice', 5,
 '子どものころ、私は母に毎日ピアノを習わされた。— What does this sentence mean?',
 'My mother made me take piano lessons every day.', '{}',
 ARRAY['My mother made me take piano lessons every day.','I made my mother take piano lessons every day.','My mother taught me piano because I asked her to.','I was allowed to skip piano lessons every day.'],
 '〜わされた = contracted causative-passive: forced, from the subject''s view.',
 'grammar', 'grammar', 'tap', 'causative_passive',
 ARRAY['I made my mother take piano lessons every day.','My mother taught me piano because I asked her to.','I was allowed to skip piano lessons every day.'],
 '習わされた is the contracted causative-passive of 習う (full form 習わせられた): the subject 私 was made to learn, and the forcer 母 takes に. The construction carries a nuance of unwillingness — I had no choice.',
 'manual', '{}'::jsonb),

('aabbccdd-6666-4006-0003-b20000000000', 'sentence_transformation', 6,
 'Rewrite from the point of view of 私, using the causative-passive: 母は私に部屋を掃除させた。',
 '私は母に部屋を掃除させられた。',
 ARRAY['私は母に部屋を掃除させられた','わたしはははにへやをそうじさせられた。','わたしはははにへやをそうじさせられた','私は母に部屋をそうじさせられた。','私は母に部屋をそうじさせられた'],
 NULL,
 'Causer 母 takes に; させた → させられた.',
 'grammar', 'grammar', 'type', 'causative_passive',
 '{}',
 'Switching to the causee''s perspective turns the causative into a causative-passive: the causee 私 becomes the subject, the causer 母 takes に, and させた becomes させられた.',
 'manual', '{"originalSentence":"母は私に部屋を掃除させた。","instruction":"Rewrite from the point of view of 私, using the causative-passive."}'::jsonb),

('aabbccdd-6666-4006-0003-b20000000000', 'error_correction', 7,
 '私は先週、部長に二時間も残業しました。(Intended: "My manager made me do two hours of overtime.")',
 '私は先週、部長に二時間も残業させられました。',
 ARRAY['私は先週、部長に二時間も残業させられました','私は先週部長に二時間も残業させられました。','私は先週部長に二時間も残業させられました','わたしはせんしゅう、ぶちょうににじかんもざんぎょうさせられました。'],
 NULL,
 '部長に + a forced action → causative-passive of する.',
 'grammar', 'grammar', 'type', 'causative_passive',
 '{}',
 '部長に marks the person who forced the action, so the verb must be causative-passive: する→させられる→残業させられました. Plain しました clashes with the "was forced by" frame.',
 'manual', '{"error_sentence":"私は先週、部長に二時間も残業しました。"}'::jsonb),

('aabbccdd-6666-4006-0003-b20000000000', 'sentence_construction', 8,
 'Build the sentence: "The teacher made the students memorize kanji."',
 '先生は 学生に 漢字を 覚えさせた',
 ARRAY['先生は 漢字を 学生に 覚えさせた'],
 NULL,
 'Causer は + causee に + object を + causative verb.',
 'grammar', 'grammar', 'tap', 'causative_basic',
 '{}',
 'With a transitive verb the causee takes に: 先生は学生に漢字を覚えさせた. 覚える is ichidan, so the causative is 覚えさせる, plain past 覚えさせた.',
 'manual', '{"tiles":["先生は","学生に","漢字を","覚えさせた"]}'::jsonb),

('aabbccdd-6666-4006-0003-b20000000000', 'multiple_choice', 9,
 'コーチは私たちを毎朝走らせた。— What does this sentence mean?',
 'The coach made us run every morning.', '{}',
 ARRAY['The coach made us run every morning.','The coach ran with us every morning.','We made the coach run every morning.','The coach was made to run every morning.'],
 '走らせる = causative of 走る; the causee of an intransitive verb takes を.',
 'grammar', 'grammar', 'tap', 'causative_basic',
 ARRAY['The coach ran with us every morning.','We made the coach run every morning.','The coach was made to run every morning.'],
 '走る is intransitive, so the people made to run take を: 私たちを走らせた. Coercive causatives prefer を; に would suggest permission. Passive 走られた — one kana away — would mean the coach was affected by our running.',
 'manual', '{}'::jsonb);

-- ═════════════════════════════════════════════════════════════════════════
-- Lesson 4 — Keigo: 尊敬語と謙譲語
-- ═════════════════════════════════════════════════════════════════════════
INSERT INTO exercises
  (lesson_id, type, order_index, prompt, correct_answer, accepted_answers, options, hint_text, skill_type, subskill, response_mode, target_grammar, distractors, explanation, source_type, metadata)
VALUES
('aabbccdd-6666-4006-0004-b20000000000', 'multiple_choice', 0,
 'Which is the respectful (尊敬語) way to say「食べる」when talking about your professor?',
 '召し上がる', '{}',
 ARRAY['いただく','召し上がる','拝見する','お目にかかる'],
 '尊敬語 raises the other person; 謙譲語 lowers yourself.',
 'grammar', 'grammar', 'tap', 'keigo_sonkeigo',
 ARRAY['いただく','拝見する','お目にかかる'],
 '召し上がる is the respectful suppletive for 食べる／飲む. いただく is its humble mirror (your own eating), 拝見する is humble "see," and お目にかかる is humble "meet" — all three would lower the professor instead of honoring them.',
 'manual', '{}'::jsonb),

('aabbccdd-6666-4006-0004-b20000000000', 'multiple_choice', 1,
 '先生は明日、大学に___そうです。— Choose the respectful form.',
 'いらっしゃる', '{}',
 ARRAY['いらっしゃる','参る','伺う','おる'],
 'The teacher is the subject — raise them.',
 'grammar', 'grammar', 'tap', 'keigo_sonkeigo',
 ARRAY['参る','伺う','おる'],
 'いらっしゃる is respectful "go/come/be" and honors the teacher as subject. 参る and 伺う are humble equivalents for your own movement, and おる is humble "be" — all three point the politeness the wrong way.',
 'manual', '{}'::jsonb),

('aabbccdd-6666-4006-0004-b20000000000', 'multiple_choice', 2,
 'You answer the phone at work. A client asks for your company president, Tanaka. What do you say?',
 '田中は、ただいま席を外しております。', '{}',
 ARRAY['田中社長は、ただいま席を外していらっしゃいます。','田中は、ただいま席を外しております。','田中様は、ただいま席をお外しになっています。','田中社長は、ただいま席を外されています。'],
 'Your own boss is in-group when you speak to outsiders.',
 'grammar', 'grammar', 'tap', 'keigo_kenjougo',
 ARRAY['田中社長は、ただいま席を外していらっしゃいます。','田中様は、ただいま席をお外しになっています。','田中社長は、ただいま席を外されています。'],
 'To outsiders, everyone in your company is in-group: drop the title and use humble おります. Honoring your own president with いらっしゃいます, 〜様, or 外されています reverses the politeness direction.',
 'manual', '{}'::jsonb),

('aabbccdd-6666-4006-0004-b20000000000', 'fill_blank', 3,
 '部長はもうお帰り___ました。(お〜になる pattern)',
 'になり', '{}', NULL,
 'お + masu-stem + になる.',
 'grammar', 'grammar', 'type', 'keigo_sonkeigo',
 '{}',
 'The productive respectful pattern is お + masu-stem + になる: お帰りになりました. Adding られ on top (お帰りになられました) is double keigo (二重敬語) and considered incorrect.',
 'manual', '{}'::jsonb),

('aabbccdd-6666-4006-0004-b20000000000', 'cloze_deletion', 4,
 '明日の午後、こちらから御社(おんしゃ)に___。(訪ねる — humble, polite non-past)',
 '伺います', ARRAY['うかがいます','参ります','まいります','お伺いします','おうかがいします'], NULL,
 'Humble verb for visiting someone of higher status.',
 'grammar', 'grammar', 'type', 'keigo_kenjougo',
 '{}',
 '伺います is the humble verb for visiting or asking — it lowers the visitor and thereby honors the client. 参ります (humble "go") also works. Plain 行きます carries no humility and misses the register.',
 'manual', '{}'::jsonb),

('aabbccdd-6666-4006-0004-b20000000000', 'word_form', 5,
 '社長が「あとで来てください」と___。(言う — special 尊敬語 verb, polite past)',
 'おっしゃいました', '{}', NULL,
 '言う has a suppletive respectful verb.',
 'grammar', 'grammar', 'type', 'keigo_sonkeigo',
 '{}',
 '言う→おっしゃる when the quoted speaker outranks you: おっしゃいました. 申しました is humble and would lower the president — the opposite of what the situation requires.',
 'manual', '{"baseWord":"言う"}'::jsonb),

('aabbccdd-6666-4006-0004-b20000000000', 'sentence_transformation', 6,
 'Make the question respectful (尊敬語) using 召し上がる: 先生はもう昼ご飯を食べましたか。',
 '先生はもう昼ご飯を召し上がりましたか。',
 ARRAY['先生はもう昼ご飯を召し上がりましたか','せんせいはもうひるごはんをめしあがりましたか。','せんせいはもうひるごはんをめしあがりましたか','先生はもう昼ご飯をめしあがりましたか。','先生はもう昼ご飯をめしあがりましたか'],
 NULL,
 'Replace 食べました with the respectful suppletive.',
 'grammar', 'grammar', 'type', 'keigo_sonkeigo',
 '{}',
 'Only the verb needs upgrading: 食べましたか→召し上がりましたか. The respectful suppletive raises the teacher; particles and word order stay exactly the same.',
 'manual', '{"originalSentence":"先生はもう昼ご飯を食べましたか。","instruction":"Make the question respectful (尊敬語) using 召し上がる."}'::jsonb),

('aabbccdd-6666-4006-0004-b20000000000', 'error_correction', 7,
 '先生、昨日の映画はもう拝見しましたか。(You are asking your teacher.)',
 '先生、昨日の映画はもうご覧になりましたか。',
 ARRAY['先生、昨日の映画はもうご覧になりましたか','せんせい、きのうのえいがはもうごらんになりましたか。','先生、昨日の映画はもう見られましたか。','先生、昨日の映画はもう見られましたか'],
 NULL,
 '拝見する is humble — you cannot use it for the teacher''s action.',
 'grammar', 'grammar', 'type', 'keigo_sonkeigo',
 '{}',
 '拝見する lowers the person who watches, so it can only describe your own viewing. For the teacher''s action use respectful ご覧になる (or the honorific passive 見られる).',
 'manual', '{"error_sentence":"先生、昨日の映画はもう拝見しましたか。"}'::jsonb),

('aabbccdd-6666-4006-0004-b20000000000', 'sentence_construction', 8,
 'Build the very polite question: "May I ask your name?"',
 'お名前を 伺っても よろしい でしょうか', '{}', NULL,
 'Humble 伺う + 〜てもよろしいでしょうか.',
 'grammar', 'grammar', 'tap', 'keigo_kenjougo',
 '{}',
 '伺う humbly frames your own asking, and 〜てもよろしいでしょうか is the formal version of 〜てもいいですか. Together: お名前を伺ってもよろしいでしょうか.',
 'manual', '{"tiles":["お名前を","伺っても","よろしい","でしょうか"]}'::jsonb),

('aabbccdd-6666-4006-0004-b20000000000', 'translate_to_target', 9,
 'Translate into Japanese (humble, to a client): "I will send the documents tomorrow."',
 '明日、書類をお送りいたします。',
 ARRAY['明日、書類をお送りいたします','明日書類をお送りいたします。','明日書類をお送りいたします','あした、しょるいをおおくりいたします。','あしたしょるいをおおくりいたします','書類は明日お送りいたします。','書類は明日お送りいたします'],
 NULL,
 'お + masu-stem + いたします.',
 'grammar', 'grammar', 'type', 'keigo_kenjougo',
 '{}',
 'The humble pattern お + stem + する／いたす lowers the sender: お送りいたします (お送りします is also fine and is accepted). Plain 送ります would be neutral, not humble.',
 'manual', '{}'::jsonb);

-- ═════════════════════════════════════════════════════════════════════════
-- Lesson 5 — Hearsay & Reported Speech: そうだ・らしい・と言っていた
-- ═════════════════════════════════════════════════════════════════════════
INSERT INTO exercises
  (lesson_id, type, order_index, prompt, correct_answer, accepted_answers, options, hint_text, skill_type, subskill, response_mode, target_grammar, distractors, explanation, source_type, metadata)
VALUES
('aabbccdd-6666-4006-0005-b20000000000', 'multiple_choice', 0,
 '天気予報によると、明日は雪が降るそうです。— What does そうです express?',
 'Hearsay — the speaker is passing on what the forecast said', '{}',
 ARRAY['Hearsay — the speaker is passing on what the forecast said','Appearance — the sky looks like snow to the speaker','The speaker''s own intuition about tomorrow','A polite suggestion to bring an umbrella'],
 'Plain form + そうだ, often introduced by 〜によると.',
 'grammar', 'grammar', 'tap', 'hearsay_sou',
 ARRAY['Appearance — the sky looks like snow to the speaker','The speaker''s own intuition about tomorrow','A polite suggestion to bring an umbrella'],
 'Dictionary form 降る + そうだ reports information from another source — flagged here by 天気予報によると. Appearance そう would attach to the masu-stem instead: 降りそう.',
 'manual', '{}'::jsonb),

('aabbccdd-6666-4006-0005-b20000000000', 'multiple_choice', 1,
 '空が暗いですね。今にも雨が降り___ですね。— Choose the correct form.',
 'そう', '{}',
 ARRAY['らしい','という','そう','はず'],
 'The speaker is judging from what they can see right now.',
 'grammar', 'grammar', 'tap', 'hearsay_sou',
 ARRAY['らしい','という','はず'],
 'Masu-stem 降り + そう expresses appearance: "it looks about to rain." らしい and はず require a plain form before them, and という cannot follow a masu-stem at all.',
 'manual', '{}'::jsonb),

('aabbccdd-6666-4006-0005-b20000000000', 'multiple_choice', 2,
 '田中さんは来月、会社を辞めるらしいですよ。— What does らしい express?',
 'The speaker infers it from indirect information and is not fully certain', '{}',
 ARRAY['The speaker heard it directly from Tanaka and is certain','The speaker infers it from indirect information and is not fully certain','The speaker is watching Tanaka quit right now','The speaker hopes Tanaka will quit'],
 'らしい = "apparently / it seems, from what I gather."',
 'grammar', 'grammar', 'tap', 'hearsay_rashii',
 ARRAY['The speaker heard it directly from Tanaka and is certain','The speaker is watching Tanaka quit right now','The speaker hopes Tanaka will quit'],
 'らしい marks an inference drawn from indirect evidence — rumors or circumstances — with some distance from the claim. Direct quotation would use 〜と言っていました instead.',
 'manual', '{}'::jsonb),

('aabbccdd-6666-4006-0005-b20000000000', 'multiple_choice', 3,
 'ニュースによると、九州で大きな地震があった___です。— Choose the correct form.',
 'そう', '{}',
 ARRAY['そう','はず','つもり','べき'],
 '〜によると + plain past + そうだ.',
 'grammar', 'grammar', 'tap', 'hearsay_sou',
 ARRAY['はず','つもり','べき'],
 'Hearsay そうだ follows the plain form — including past あった — and pairs naturally with 〜によると. はず (deduction), つもり (intention), and べき (obligation) do not report information from a source, so the によると frame rules them out.',
 'manual', '{}'::jsonb),

('aabbccdd-6666-4006-0005-b20000000000', 'cloze_deletion', 4,
 '佐藤さんは会議に少し遅れる___。(Report his words using 言う.)',
 'と言っていました', ARRAY['と言いました','といっていました','といいました','と言っていた','といっていた'], NULL,
 'Quote + と + 言っていました.',
 'grammar', 'grammar', 'type', 'hearsay_quotation',
 '{}',
 '〜と言っていました is the standard way to relay someone''s words; the quoted clause stays plain (遅れる). Simple と言いました is also correct, reporting the utterance as a one-time event.',
 'manual', '{}'::jsonb),

('aabbccdd-6666-4006-0005-b20000000000', 'word_form', 5,
 '彼女は「パーティーには行かない」と___。(言う — plain past, reporting what she said)',
 '言っていた', ARRAY['いっていた','言った','いった'], NULL,
 'Reporting speech usually uses the 〜ていた form of 言う.',
 'grammar', 'grammar', 'type', 'hearsay_quotation',
 '{}',
 '言っていた reports her words as information still relevant now; 言った simply narrates the moment of speaking. Both are grammatical after the quotation particle と.',
 'manual', '{"baseWord":"言う"}'::jsonb),

('aabbccdd-6666-4006-0005-b20000000000', 'sentence_transformation', 6,
 'Report this indirectly with 〜と言っていました (plain form inside the quote): 田中さん：「明日は休みます」',
 '田中さんは明日は休むと言っていました。',
 ARRAY['田中さんは明日は休むと言っていました','田中さんは明日休むと言っていました。','田中さんは明日休むと言っていました','たなかさんはあしたはやすむといっていました。','たなかさんはあしたやすむといっていました'],
 NULL,
 '休みます → plain 休む before と.',
 'grammar', 'grammar', 'type', 'hearsay_quotation',
 '{}',
 'In indirect quotation the polite 休みます drops to plain 休む before と. The reporting verb 言っていました carries the politeness for the whole sentence.',
 'manual', '{"originalSentence":"田中さん：「明日は休みます」","instruction":"Report this indirectly with 〜と言っていました (plain form inside the quote)."}'::jsonb),

('aabbccdd-6666-4006-0005-b20000000000', 'error_correction', 7,
 '私は明日、会社を休むらしいです。(You are talking about your own plan.)',
 '私は明日、会社を休むつもりです。',
 ARRAY['私は明日、会社を休むつもりです','私は明日、会社を休む予定です。','私は明日、会社を休む予定です','私は明日、会社を休みます。','私は明日、会社を休みます','わたしはあした、かいしゃをやすむつもりです。'],
 NULL,
 'らしい reports information about others, not your own intentions.',
 'grammar', 'grammar', 'type', 'hearsay_rashii',
 '{}',
 'らしい marks inference from outside information, so it cannot describe your own plan. State intentions directly: 休むつもりです, 休む予定です, or simply 休みます.',
 'manual', '{"error_sentence":"私は明日、会社を休むらしいです。"}'::jsonb),

('aabbccdd-6666-4006-0005-b20000000000', 'sentence_construction', 8,
 'Build the sentence: "I heard from Sato that that shop closed down."',
 '佐藤さんに 聞いたんですが あの店は 閉店した そうです', '{}', NULL,
 'Source first, then plain past + そうです.',
 'grammar', 'grammar', 'tap', 'hearsay_sou',
 '{}',
 'The information source comes first (佐藤さんに聞いたんですが), then the reported content in plain past + hearsay そうです: あの店は閉店したそうです.',
 'manual', '{"tiles":["佐藤さんに","聞いたんですが","あの店は","閉店した","そうです"]}'::jsonb),

('aabbccdd-6666-4006-0005-b20000000000', 'multiple_choice', 9,
 '山田さんは仕事を辞めるそうです。— Which English translation is correct?',
 'I hear Yamada is going to quit his job.', '{}',
 ARRAY['I hear Yamada is going to quit his job.','Yamada looks like he is about to quit his job.','Yamada intends to quit his job.','I hope Yamada quits his job.'],
 'Dictionary form + そうです = hearsay; masu-stem + そうです = appearance.',
 'grammar', 'grammar', 'tap', 'hearsay_sou',
 ARRAY['Yamada looks like he is about to quit his job.','Yamada intends to quit his job.','I hope Yamada quits his job.'],
 'Hearsay keeps the dictionary form: 辞める+そうです — "I hear he will quit." Dropping the る (辞めそうです) would flip the meaning to appearance, "he looks about to quit," so the translation must keep the reported-information nuance.',
 'manual', '{}'::jsonb);

-- ═════════════════════════════════════════════════════════════════════════
-- Lesson 6 — Review & Test (mixed)
-- ═════════════════════════════════════════════════════════════════════════
INSERT INTO exercises
  (lesson_id, type, order_index, prompt, correct_answer, accepted_answers, options, hint_text, skill_type, subskill, response_mode, target_grammar, distractors, explanation, source_type, metadata)
VALUES
('aabbccdd-6666-4006-0006-b20000000000', 'multiple_choice', 0,
 'このボタンを押す___、ドアが開きます。— Choose the correct particle.',
 'と', '{}',
 ARRAY['なら','ながら','と','けど'],
 'Automatic mechanism → と.',
 'grammar', 'grammar', 'tap', 'conditional_to',
 ARRAY['なら','ながら','けど'],
 'A machine''s automatic response calls for と: press the button and the door (always) opens. なら gives advice about a topic, ながら marks simultaneous action, and けど contrasts.',
 'manual', '{}'::jsonb),

('aabbccdd-6666-4006-0006-b20000000000', 'multiple_choice', 1,
 '弟にパソコンを壊されました。— What does this sentence mean?',
 'My brother broke my computer, and I''m annoyed about it.', '{}',
 ARRAY['I broke my brother''s computer.','My brother broke my computer, and I''m annoyed about it.','My brother had someone break his computer.','I let my brother break the computer.'],
 'Victim passive: agent に + を + passive verb.',
 'grammar', 'grammar', 'tap', 'suffering_passive',
 ARRAY['I broke my brother''s computer.','My brother had someone break his computer.','I let my brother break the computer.'],
 'The victim passive presents the event from the sufferer''s viewpoint: my brother (に) broke my computer (を) on me. The annoyance is built into the construction itself.',
 'manual', '{}'::jsonb),

('aabbccdd-6666-4006-0006-b20000000000', 'multiple_choice', 2,
 '社長はもう___。("The president has already gone home" — respectful)',
 'お帰りになりました', '{}',
 ARRAY['お帰りされました','お帰りになりました','お帰りをしました','帰りました'],
 'お + masu-stem + になる.',
 'grammar', 'grammar', 'tap', 'keigo_sonkeigo',
 ARRAY['お帰りされました','お帰りをしました','帰りました'],
 'The respectful pattern is お + stem + になる: お帰りになりました. お帰りされました and お帰りをしました wrongly mix する into the respectful slot, and plain 帰りました shows no respect at all.',
 'manual', '{}'::jsonb),

('aabbccdd-6666-4006-0006-b20000000000', 'multiple_choice', 3,
 '母は毎朝、妹に牛乳を飲ませた。— What does this sentence mean?',
 'Mom made my little sister drink milk every morning.', '{}',
 ARRAY['Mom made my little sister drink milk every morning.','My little sister made Mom drink milk every morning.','Mom drank milk with my little sister every morning.','Mom was made to drink milk by my little sister.'],
 'せる/させる = causative; the causer is the subject.',
 'grammar', 'grammar', 'tap', 'causative_basic',
 ARRAY['My little sister made Mom drink milk every morning.','Mom drank milk with my little sister every morning.','Mom was made to drink milk by my little sister.'],
 '飲ませた is the causative of 飲む: 母 causes the drinking, and the causee 妹 takes に because 牛乳を already occupies を. Passive 飲まれた — one kana away — would mean something completely different.',
 'manual', '{}'::jsonb),

('aabbccdd-6666-4006-0006-b20000000000', 'multiple_choice', 4,
 '新聞によると、来年この町で国際会議が開かれる___です。— Choose the correct form.',
 'そう', '{}',
 ARRAY['そう','はず','つもり','べき'],
 'によると + plain form + そうだ.',
 'grammar', 'grammar', 'tap', 'hearsay_sou',
 ARRAY['はず','つもり','べき'],
 '〜によると announces a source, so the sentence must end in hearsay そうです after the plain form 開かれる — itself a passive: "will be held." はず, つもり, and べき state deduction, intention, or opinion — none of them report a source.',
 'manual', '{}'::jsonb),

('aabbccdd-6666-4006-0006-b20000000000', 'word_form', 5,
 'お客様は何時に___か。(来る — 尊敬語, polite non-past)',
 'いらっしゃいます', ARRAY['おいでになります','来られます','こられます','お見えになります','おみえになります','見えます','みえます'], NULL,
 '来る has a suppletive respectful verb.',
 'grammar', 'grammar', 'type', 'keigo_sonkeigo',
 '{}',
 '来る→いらっしゃる for an honored guest: いらっしゃいますか. おいでになります, お見えになります, and the passive-form honorific 来られます are also correct.',
 'manual', '{"baseWord":"来る"}'::jsonb),

('aabbccdd-6666-4006-0006-b20000000000', 'sentence_transformation', 6,
 'Rewrite with 私 as the victim, using the passive: 泥棒が私の自転車を盗んだ。',
 '私は泥棒に自転車を盗まれた。',
 ARRAY['私は泥棒に自転車を盗まれた','わたしはどろぼうにじてんしゃをぬすまれた。','わたしはどろぼうにじてんしゃをぬすまれた','私は泥棒に自転車をぬすまれた。','私は泥棒に自転車をぬすまれた'],
 NULL,
 'Victim は + agent に + object を + passive.',
 'grammar', 'grammar', 'type', 'passive_basic',
 '{}',
 'The victim passive: 私 becomes the topic, 泥棒 takes に, 自転車 keeps を, and 盗んだ becomes passive 盗まれた. The frame "someone did this to me" replaces the neutral active report.',
 'manual', '{"originalSentence":"泥棒が私の自転車を盗んだ。","instruction":"Rewrite with 私 as the victim, using the passive."}'::jsonb),

('aabbccdd-6666-4006-0006-b20000000000', 'error_correction', 7,
 '先生はさっき、職員室で昼ご飯をいただきました。(You are describing your teacher''s action.)',
 '先生はさっき、職員室で昼ご飯を召し上がりました。',
 ARRAY['先生はさっき、職員室で昼ご飯を召し上がりました','せんせいはさっき、しょくいんしつでひるごはんをめしあがりました。','先生はさっき、職員室で昼ご飯を食べられました。','先生はさっき、職員室で昼ご飯を食べられました'],
 NULL,
 'いただく is humble — wrong for the teacher''s own action.',
 'grammar', 'grammar', 'type', 'keigo_sonkeigo',
 '{}',
 'いただく lowers the eater, so it can only describe your own eating. For the teacher use respectful 召し上がりました (or the honorific passive 食べられました).',
 'manual', '{"error_sentence":"先生はさっき、職員室で昼ご飯をいただきました。"}'::jsonb),

('aabbccdd-6666-4006-0006-b20000000000', 'sentence_construction', 8,
 'Build the sentence: "Tanaka said he''ll be a little late tomorrow."',
 '田中さんは 明日 少し 遅れると 言っていました',
 ARRAY['明日 田中さんは 少し 遅れると 言っていました'],
 NULL,
 'Quoted clause plain + と + 言っていました.',
 'grammar', 'grammar', 'tap', 'hearsay_quotation',
 '{}',
 'The quoted clause stays plain (明日少し遅れる) and と links it to the reporting verb 言っていました. 明日 may come before or after the topic 田中さんは.',
 'manual', '{"tiles":["田中さんは","明日","少し","遅れると","言っていました"]}'::jsonb),

('aabbccdd-6666-4006-0006-b20000000000', 'multiple_choice', 9,
 '一時間も待たされた。— What does this sentence mean?',
 'I was made to wait for a whole hour.', '{}',
 ARRAY['I was made to wait for a whole hour.','I waited for a whole hour on purpose.','I made someone wait for a whole hour.','I had someone wait for me for a whole hour.'],
 'Causative-passive of 待つ: 待たされる = made to wait against your will.',
 'grammar', 'grammar', 'tap', 'causative_passive',
 ARRAY['I waited for a whole hour on purpose.','I made someone wait for a whole hour.','I had someone wait for me for a whole hour.'],
 '待たされた is the contracted causative-passive of 待つ (full form 待たせられた): the subject was forced to wait. も after 一時間 adds the "a whole hour!" nuance of unwilling endurance. Plain 待った (waited) and causative 待たせた (made someone wait) miss the "was forced" meaning.',
 'manual', '{}'::jsonb);

-- ═════════════════════════════════════════════════════════════════════════
-- Grammar rules reference (language = 'ja') — 5 per CEFR level
-- CEFR↔JLPT mapping: A1≈N5, A2≈N4, B1≈N3, B2≈N2
-- B2 rule_names are substrings of exercise target_grammar tags (RuleCard match)
-- ═════════════════════════════════════════════════════════════════════════
INSERT INTO grammar_rules (language, cefr_level, rule_name, title, explanation, examples, common_errors, tags) VALUES
-- ── A1 (≈ JLPT N5) ──
('ja', 'A1', 'topic_particle_wa', 'The Topic Particle は',
 'は marks the topic — what the sentence is about — and is pronounced "wa". The rest of the sentence comments on that topic. It often replaces が or を, and contrasting two topics is one of its core jobs.',
 '[{"target":"私は学生です。","native":"I am a student."},{"target":"猫は魚が好きです。","native":"As for cats, they like fish."}]'::jsonb,
 '[{"error":"わたしわ学生です。","correction":"わたしは学生です。","note":"The topic particle is written は, not わ."}]'::jsonb,
 ARRAY['particles','topic','n5']),

('ja', 'A1', 'subject_particle_ga', 'The Subject Particle が',
 'が marks the grammatical subject — especially new information, things that exist, and answers to question words. Question words themselves (誰, 何, どこ) always take が, never は.',
 '[{"target":"部屋に猫がいます。","native":"There is a cat in the room."},{"target":"誰が来ましたか。","native":"Who came?"}]'::jsonb,
 '[{"error":"誰は来ましたか。","correction":"誰が来ましたか。","note":"Question words take が, never は."}]'::jsonb,
 ARRAY['particles','subject','n5']),

('ja', 'A1', 'object_particle_wo', 'The Object Particle を',
 'を marks the direct object of an action verb — the thing eaten, read, or bought. It is pronounced "o". Motion verbs also use を for the space moved through: 公園を歩く.',
 '[{"target":"水を飲みます。","native":"I drink water."},{"target":"公園を散歩します。","native":"I take a walk through the park."}]'::jsonb,
 '[{"error":"水が飲みます。","correction":"水を飲みます。","note":"The object of an action verb takes を, not が."}]'::jsonb,
 ARRAY['particles','object','n5']),

('ja', 'A1', 'polite_desu_masu', 'Polite Style: です・ます',
 'Polite sentences end in です (after nouns and adjectives) or 〜ます (attached to the verb stem). Use polite style with strangers, teachers, and at work; plain form with family and close friends. Keep one register within a conversation.',
 '[{"target":"明日、学校に行きます。","native":"I will go to school tomorrow."},{"target":"これは私の本です。","native":"This is my book."}]'::jsonb,
 '[{"error":"行くです。","correction":"行きます。","note":"Attach ます to the verb stem; never put です after a plain verb."}]'::jsonb,
 ARRAY['politeness','verb-endings','n5']),

('ja', 'A1', 'existence_aru_iru', 'Existence: ある and いる',
 'ある states that inanimate things exist; いる is for people and animals. The standard pattern is PLACE に THING が あります／います.',
 '[{"target":"机の上に本があります。","native":"There is a book on the desk."},{"target":"公園に子どもがいます。","native":"There are children in the park."}]'::jsonb,
 '[{"error":"犬があります。","correction":"犬がいます。","note":"Living things take いる, not ある."}]'::jsonb,
 ARRAY['existence','verbs','n5']),

-- ── A2 (≈ JLPT N4) ──
('ja', 'A2', 'te_form_request', 'Requests: 〜てください',
 'The te-form + ください makes a polite request. Te-form endings depend on the verb group: 読む→読んで, 書く→書いて, 待つ→待って, 食べる→食べて, する→して, 来る→来て.',
 '[{"target":"ちょっと待ってください。","native":"Please wait a moment."},{"target":"もう一度言ってください。","native":"Please say it one more time."}]'::jsonb,
 '[{"error":"読みてください。","correction":"読んでください。","note":"Godan te-forms change sound: む→んで."}]'::jsonb,
 ARRAY['te-form','requests','n4']),

('ja', 'A2', 'potential_form', 'The Potential Form',
 'The "can do" form: godan verbs shift the final -u to -eru (読む→読める); ichidan verbs take られる (食べる→食べられる). The object usually switches from を to が: 漢字が読めます.',
 '[{"target":"漢字が読めます。","native":"I can read kanji."},{"target":"明日は来られますか。","native":"Can you come tomorrow?"}]'::jsonb,
 '[{"error":"食べれる","correction":"食べられる","note":"Dropping ら (ら抜き) is common in speech but avoid it in writing and tests."}]'::jsonb,
 ARRAY['potential','conjugation','n4']),

('ja', 'A2', 'advice_ta_hou_ga_ii', 'Advice: 〜たほうがいい',
 'Plain past + ほうがいい gives advice: "you had better…". The negative version uses the plain negative, not the past: 〜ないほうがいい.',
 '[{"target":"早く寝たほうがいいですよ。","native":"You should go to bed early."},{"target":"無理をしないほうがいいです。","native":"You had better not overdo it."}]'::jsonb,
 '[{"error":"行かなかったほうがいい (for advice now)","correction":"行かないほうがいい","note":"Negative advice uses ない, not the past form."}]'::jsonb,
 ARRAY['advice','n4']),

('ja', 'A2', 'giving_receiving', 'Giving and Receiving: あげる・くれる・もらう',
 'あげる = I/we give outward; くれる = someone gives to me or my group; もらう = receive, with the giver marked に. The choice encodes direction and viewpoint, not just the act of giving.',
 '[{"target":"友達が辞書をくれました。","native":"My friend gave me a dictionary."},{"target":"先生に本をもらいました。","native":"I received a book from my teacher."}]'::jsonb,
 '[{"error":"友達が私にあげました。","correction":"友達が私にくれました。","note":"Giving toward me/my group uses くれる, not あげる."}]'::jsonb,
 ARRAY['giving','viewpoint','n4']),

('ja', 'A2', 'comparison_yori', 'Comparison: 〜より〜のほうが',
 '"B is more X than A" is AよりBのほうがX: the losing item takes より, the preferred item takes のほうが. The order of the two phrases can flip, but the particles must stay with their items.',
 '[{"target":"バスより電車のほうが速いです。","native":"The train is faster than the bus."},{"target":"夏より冬のほうが好きです。","native":"I like winter more than summer."}]'::jsonb,
 '[{"error":"夏より冬が好きです。","correction":"夏より冬のほうが好きです。","note":"Use のほうが to mark the preferred item in a comparison."}]'::jsonb,
 ARRAY['comparison','n4']),

-- ── B1 (≈ JLPT N3) ──
('ja', 'B1', 'conditional_tara_ba', 'Conditionals: 〜たら and 〜ば',
 'たら = plain past + ら (降ったら) and covers most "if/when" situations. ば attaches -eba to verbs (行けば) and ければ to い-adjectives (安ければ), preferring general or stative conditions.',
 '[{"target":"雨が降ったら、家にいます。","native":"If it rains, I will stay home."},{"target":"安ければ、買います。","native":"If it is cheap, I will buy it."}]'::jsonb,
 '[{"error":"降るたら","correction":"降ったら","note":"たら attaches to the plain past stem, not the dictionary form."}]'::jsonb,
 ARRAY['conditionals','n3']),

('ja', 'B1', 'passive_basic', 'The Passive: 〜れる・〜られる',
 'Godan verbs form the passive with -a + れる (読む→読まれる); ichidan verbs take られる (食べる→食べられる). The receiver becomes the subject and the doer takes に.',
 '[{"target":"先生に褒められました。","native":"I was praised by my teacher."},{"target":"この歌は世界中で歌われています。","native":"This song is sung all over the world."}]'::jsonb,
 '[{"error":"読める (intended passive)","correction":"読まれる","note":"読める is the potential (can read); the passive is 読まれる."}]'::jsonb,
 ARRAY['passive','voice','n3']),

('ja', 'B1', 'causative_basic', 'The Causative: 〜せる・〜させる',
 'Godan: -a + せる (書く→書かせる); ichidan: させる (食べる→食べさせる). It means "make" or "let" someone act. The causee takes に with transitive verbs and を with intransitive ones.',
 '[{"target":"母は子どもに野菜を食べさせました。","native":"Mom made the child eat vegetables."},{"target":"子どもを公園で遊ばせた。","native":"I let the child play in the park."}]'::jsonb,
 '[{"error":"食べらせる","correction":"食べさせる","note":"Ichidan causatives take させる directly on the stem."}]'::jsonb,
 ARRAY['causative','voice','n3']),

('ja', 'B1', 'appearance_sou', 'Appearance: 〜そうだ',
 'Masu-stem + そうだ means "looks like / about to": 降りそうだ, おいしそうだ. い-adjectives drop the い (高そう), and いい becomes よさそう. Do not confuse it with hearsay そうだ, which follows the plain form.',
 '[{"target":"今にも雨が降りそうです。","native":"It looks like it is about to rain."},{"target":"このケーキ、おいしそうですね。","native":"This cake looks delicious."}]'::jsonb,
 '[{"error":"いいそう","correction":"よさそう","note":"いい has the irregular appearance form よさそう."}]'::jsonb,
 ARRAY['evidentials','appearance','n3']),

('ja', 'B1', 'noun_modification', 'Noun-Modifying Clauses',
 'Japanese relative clauses come before the noun, use the plain form, and need no linking word: 昨日買った本 "the book I bought yesterday." Inside the clause, the subject often takes が or の.',
 '[{"target":"昨日買った本はとても面白いです。","native":"The book I bought yesterday is very interesting."},{"target":"眼鏡をかけている人は田中さんです。","native":"The person wearing glasses is Tanaka."}]'::jsonb,
 '[{"error":"買ったの本","correction":"買った本","note":"No の between a verb clause and the noun it modifies."}]'::jsonb,
 ARRAY['relative-clauses','n3']),

-- ── B2 (≈ JLPT N2) ──
('ja', 'B2', 'conditional', 'Choosing Between と・ば・たら・なら',
 'と states automatic results and cannot precede requests or suggestions. たら handles one-time "if/when" and is safest before commands. ば prefers stative conditions. なら reacts to known information and can apply before the action even happens.',
 '[{"target":"春になると、桜が咲きます。","native":"When spring comes, the cherry blossoms bloom."},{"target":"日本へ行くなら、JRパスを買ったほうがいいですよ。","native":"If you are going to Japan, you should buy a JR Pass."}]'::jsonb,
 '[{"error":"時間があると、遊びに来てください。","correction":"時間があったら、遊びに来てください。","note":"と cannot introduce a request; use たら."}]'::jsonb,
 ARRAY['conditionals','n2']),

('ja', 'B2', 'passive', 'The Suffering Passive',
 'Beyond the direct passive, Japanese uses the passive to show an event affected someone — often negatively — even with intransitive verbs: 雨に降られた "I got rained on." The affected person is the subject, the agent takes に, and possessions keep を.',
 '[{"target":"財布を盗まれました。","native":"I had my wallet stolen."},{"target":"赤ちゃんに泣かれて、眠れませんでした。","native":"The baby cried on me and I could not sleep."}]'::jsonb,
 '[{"error":"雨が降られた。","correction":"雨に降られた。","note":"The agent of a suffering passive takes に, not が."}]'::jsonb,
 ARRAY['passive','suffering-passive','n2']),

('ja', 'B2', 'causative', 'Causative-Passive: 〜させられる',
 'Stacking the passive onto the causative means "was made to do": 行かせられる. Godan verbs (except those ending in す) usually contract: 待たせられる→待たされる. The person who forced the action takes に.',
 '[{"target":"部長に残業させられました。","native":"My manager made me work overtime."},{"target":"子どものころ、ピアノを習わされました。","native":"I was made to take piano lessons as a child."}]'::jsonb,
 '[{"error":"待たさせられた","correction":"待たされた／待たせられた","note":"Use either the contracted or the full form — not a blend of both."}]'::jsonb,
 ARRAY['causative','causative-passive','n2']),

('ja', 'B2', 'keigo', 'Keigo: 尊敬語 and 謙譲語',
 '尊敬語 raises the other person (いらっしゃる, 召し上がる, おっしゃる, お〜になる). 謙譲語 lowers your own side (伺う, 参る, いただく, 申す, お〜する). Choose by whose action it is — and treat your own company as in-group when speaking to outsiders.',
 '[{"target":"先生はもう召し上がりましたか。","native":"Has the teacher already eaten?"},{"target":"明日、御社に伺います。","native":"I will visit your company tomorrow."}]'::jsonb,
 '[{"error":"先生が申しました。","correction":"先生がおっしゃいました。","note":"申す is humble — never use it for a superior''s speech."}]'::jsonb,
 ARRAY['keigo','politeness','n2']),

('ja', 'B2', 'hearsay', 'Hearsay and Reported Speech',
 'Plain form + そうだ reports what you heard, often with 〜によると. らしい marks inference from indirect evidence. 〜と言っていた relays someone''s actual words, with the quote in plain form. Appearance そう (masu-stem) is a different construction.',
 '[{"target":"ニュースによると、台風が来るそうです。","native":"According to the news, a typhoon is coming."},{"target":"田中さんは少し遅れると言っていました。","native":"Tanaka said he would be a little late."}]'::jsonb,
 '[{"error":"雨が降りそうです (intended hearsay)","correction":"雨が降るそうです","note":"Stem + そう = looks like; plain form + そう = I heard."}]'::jsonb,
 ARRAY['evidentials','reported-speech','n2'])
ON CONFLICT (language, rule_name) DO UPDATE SET
  cefr_level = EXCLUDED.cefr_level,
  title = EXCLUDED.title,
  explanation = EXCLUDED.explanation,
  examples = EXCLUDED.examples,
  common_errors = EXCLUDED.common_errors,
  tags = EXCLUDED.tags;

COMMIT;
