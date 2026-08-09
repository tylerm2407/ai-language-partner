-- 061_content_audit_idioms.sql
-- Content audit 2026-08-08, part 2 of 5: wrong-meaning idioms, false friends,
-- and literal calques. Scope: BOTH `cards` and `exercises` (see 060 header).
--
-- Two groups, different severity:
--
--   A. WRONG MEANING. The target phrase does not mean what the English says.
--      A learner who trusts the deck comes away with a false belief.
--
--   B. LITERAL CALQUE. The target phrase is a word-for-word translation of the
--      English idiom that no native speaker uses. Comprehensible, but it is not
--      the language. These are the phrases a learner would be embarrassed by.
--
-- Group B replacements are a judgement call, not a dictionary lookup, and were
-- made without native-speaker review. They are all *safer* than what they
-- replace — none introduces a new meaning error — but a ja/ko reviewer should
-- confirm register before these ship to a paying cohort.
--
-- Every UPDATE is scoped by a LIKE/equality on the exact old string. The full
-- matching row set was enumerated before writing this file; no other rows in
-- either table contain these strings.

-- ============================================================================
-- GROUP A — wrong meaning
-- ============================================================================

-- A1. es "Estar en las nubes" means to be DISTRACTED / head in the clouds —
--     close to the opposite of elated. fr/it/de already use the correct idiom.
UPDATE cards SET target_text = 'Estar en el séptimo cielo' WHERE id = 'aabbccdd-1111-4005-c006-b20000000000';
UPDATE exercises SET
  prompt          = replace(prompt,          'Estar en las nubes', 'Estar en el séptimo cielo'),
  correct_answer  = replace(correct_answer,  'Estar en las nubes', 'Estar en el séptimo cielo'),
  accepted_answers = (select coalesce(array_agg(replace(a, 'Estar en las nubes', 'Estar en el séptimo cielo')), '{}') from unnest(accepted_answers) a)
WHERE prompt LIKE '%Estar en las nubes%' OR correct_answer LIKE '%Estar en las nubes%';

-- A2. pt "Estar nas nuvens" carries the same distracted reading. Use the
--     unambiguous seventh-heaven idiom, matching es/it.
UPDATE cards SET target_text = 'Estar no sétimo céu' WHERE id = 'aabbccdd-5555-4005-c006-b20000000000';
UPDATE exercises SET
  prompt          = replace(prompt,         'Estar nas nuvens', 'Estar no sétimo céu'),
  correct_answer  = replace(correct_answer, 'Estar nas nuvens', 'Estar no sétimo céu'),
  accepted_answers = (select coalesce(array_agg(replace(a, 'Estar nas nuvens', 'Estar no sétimo céu')), '{}') from unnest(accepted_answers) a)
WHERE prompt LIKE '%Estar nas nuvens%' OR correct_answer LIKE '%Estar nas nuvens%';

-- A3. ko "눈이 휘둥그레지다" means eyes widening in SURPRISE. It says nothing
--     about cost. ja uses the eyes-popping-at-the-price image; mirror it.
UPDATE cards SET target_text = '눈이 튀어나올 정도로 비싸다' WHERE id = 'aabbccdd-7777-4005-c004-b20000000000';
UPDATE exercises SET
  prompt          = replace(prompt,         '눈이 휘둥그레지다', '눈이 튀어나올 정도로 비싸다'),
  correct_answer  = replace(correct_answer, '눈이 휘둥그레지다', '눈이 튀어나올 정도로 비싸다'),
  accepted_answers = (select coalesce(array_agg(replace(a, '눈이 휘둥그레지다', '눈이 튀어나올 정도로 비싸다')), '{}') from unnest(accepted_answers) a)
WHERE prompt LIKE '%눈이 휘둥그레지다%' OR correct_answer LIKE '%눈이 휘둥그레지다%';

-- A4. pt "De vez em quando" means FROM TIME TO TIME — far more frequent than
--     "once in a blue moon", which is the whole point of the idiom.
UPDATE cards SET target_text = 'Uma vez na vida, outra na morte' WHERE id = 'aabbccdd-5555-4005-c008-b20000000000';
UPDATE exercises SET
  prompt          = replace(prompt,         'De vez em quando', 'Uma vez na vida, outra na morte'),
  correct_answer  = replace(correct_answer, 'De vez em quando', 'Uma vez na vida, outra na morte'),
  accepted_answers = (select coalesce(array_agg(replace(a, 'De vez em quando', 'Uma vez na vida, outra na morte')), '{}') from unnest(accepted_answers) a)
WHERE prompt LIKE '%De vez em quando%' OR correct_answer LIKE '%De vez em quando%';

-- A5. ko "가물에" is a truncated fragment ("in a drought"), not an idiom. The
--     complete expression is 가뭄에 콩 나듯 — like beans sprouting in a drought.
UPDATE cards SET target_text = '가뭄에 콩 나듯' WHERE id = 'aabbccdd-7777-4005-c008-b20000000000';
UPDATE exercises SET
  prompt          = replace(prompt,         '가물에', '가뭄에 콩 나듯'),
  correct_answer  = replace(correct_answer, '가물에', '가뭄에 콩 나듯'),
  accepted_answers = (select coalesce(array_agg(replace(a, '가물에', '가뭄에 콩 나듯')), '{}') from unnest(accepted_answers) a)
WHERE prompt LIKE '%가물에%' OR correct_answer LIKE '%가물에%';

-- A6. fr "Excité" is a false friend. Applied to a person it reads as sexually
--     aroused, not enthusiastic. This is the single highest-embarrassment row
--     in the deck.
UPDATE cards SET target_text = 'Enthousiaste' WHERE id = 'aabbccdd-2222-2004-c005-a20000000000';
UPDATE exercises SET
  prompt          = replace(prompt,         'Excité', 'Enthousiaste'),
  correct_answer  = replace(correct_answer, 'Excité', 'Enthousiaste'),
  accepted_answers = (select coalesce(array_agg(replace(a, 'Excité', 'Enthousiaste')), '{}') from unnest(accepted_answers) a)
WHERE prompt LIKE '%Excité%' OR correct_answer LIKE '%Excité%';

-- A7. fr "Bon matin" is Québécois. In standard French the morning greeting is
--     "Bonjour", which the deck already teaches for "Hello" — genuine overlap,
--     not a mistake. Cross-acceptance is added in 062.
UPDATE cards SET target_text = 'Bonjour' WHERE id = 'aabbccdd-2222-1001-c003-000000000000';
UPDATE exercises SET
  prompt          = replace(prompt,         'Bon matin', 'Bonjour'),
  correct_answer  = replace(correct_answer, 'Bon matin', 'Bonjour'),
  accepted_answers = (select coalesce(array_agg(replace(a, 'Bon matin', 'Bonjour')), '{}') from unnest(accepted_answers) a)
WHERE prompt LIKE '%Bon matin%' OR correct_answer LIKE '%Bon matin%';

-- A8. zh "当时" means "at that time" (a past reference), not the conjunction
--     "while". Every other language in this slot has a temporal conjunction.
--     当…的时候 is a bound form, consistent with ja の間に and ko 하는 동안.
UPDATE cards SET target_text = '当…的时候' WHERE id = 'aabbccdd-8888-3006-c004-b10000000000';
UPDATE exercises SET
  prompt          = replace(prompt,         '当时', '当…的时候'),
  correct_answer  = replace(correct_answer, '当时', '当…的时候'),
  accepted_answers = (select coalesce(array_agg(replace(a, '当时', '当…的时候')), '{}') from unnest(accepted_answers) a)
WHERE prompt LIKE '%当时%' OR correct_answer LIKE '%当时%';

-- ============================================================================
-- GROUP B — literal calques
-- ============================================================================

-- B1. ja 氷を破る is a word-for-word rendering of "break the ice" and is not
--     used socially in Japanese. 場を和ませる = soften the atmosphere.
UPDATE cards SET target_text = '場を和ませる' WHERE id = 'aabbccdd-6666-4005-c001-b20000000000';
UPDATE exercises SET
  prompt          = replace(prompt,         '氷を破る', '場を和ませる'),
  correct_answer  = replace(correct_answer, '氷を破る', '場を和ませる'),
  accepted_answers = (select coalesce(array_agg(replace(a, '氷を破る', '場を和ませる')), '{}') from unnest(accepted_answers) a)
WHERE prompt LIKE '%氷を破る%' OR correct_answer LIKE '%氷を破る%';

-- B2. ko 얼음을 깨다 — same calque, literally breaking ice.
UPDATE cards SET target_text = '어색한 분위기를 깨다' WHERE id = 'aabbccdd-7777-4005-c001-b20000000000';
UPDATE exercises SET
  prompt          = replace(prompt,         '얼음을 깨다', '어색한 분위기를 깨다'),
  correct_answer  = replace(correct_answer, '얼음을 깨다', '어색한 분위기를 깨다'),
  accepted_answers = (select coalesce(array_agg(replace(a, '얼음을 깨다', '어색한 분위기를 깨다')), '{}') from unnest(accepted_answers) a)
WHERE prompt LIKE '%얼음을 깨다%' OR correct_answer LIKE '%얼음을 깨다%';

-- B3. ko 구름 위에 떠있다 — "floating above the clouds", not a set phrase.
UPDATE cards SET target_text = '하늘을 날 것 같다' WHERE id = 'aabbccdd-7777-4005-c006-b20000000000';
UPDATE exercises SET
  prompt          = replace(prompt,         '구름 위에 떠있다', '하늘을 날 것 같다'),
  correct_answer  = replace(correct_answer, '구름 위에 떠있다', '하늘을 날 것 같다'),
  accepted_answers = (select coalesce(array_agg(replace(a, '구름 위에 떠있다', '하늘을 날 것 같다')), '{}') from unnest(accepted_answers) a)
WHERE prompt LIKE '%구름 위에 떠있다%' OR correct_answer LIKE '%구름 위에 떠있다%';

-- B4. ko 공은 당신에게 있다 — calque of the tennis metaphor, which does not
--     carry in Korean. "이제 당신 차례다" = now it is your turn.
UPDATE cards SET target_text = '이제 당신 차례다' WHERE id = 'aabbccdd-7777-4005-c011-b20000000000';
UPDATE exercises SET
  prompt          = replace(prompt,         '공은 당신에게 있다', '이제 당신 차례다'),
  correct_answer  = replace(correct_answer, '공은 당신에게 있다', '이제 당신 차례다'),
  accepted_answers = (select coalesce(array_agg(replace(a, '공은 당신에게 있다', '이제 당신 차례다')), '{}') from unnest(accepted_answers) a)
WHERE prompt LIKE '%공은 당신에게 있다%' OR correct_answer LIKE '%공은 당신에게 있다%';

-- B5. pt "Puxar a perna de alguém" is a calque and means nothing idiomatic.
UPDATE cards SET target_text = 'Pegar no pé de alguém' WHERE id = 'aabbccdd-5555-4005-c007-b20000000000';
UPDATE exercises SET
  prompt          = replace(prompt,         'Puxar a perna de alguém', 'Pegar no pé de alguém'),
  correct_answer  = replace(correct_answer, 'Puxar a perna de alguém', 'Pegar no pé de alguém'),
  accepted_answers = (select coalesce(array_agg(replace(a, 'Puxar a perna de alguém', 'Pegar no pé de alguém')), '{}') from unnest(accepted_answers) a)
WHERE prompt LIKE '%Puxar a perna de alguém%' OR correct_answer LIKE '%Puxar a perna de alguém%';

-- ============================================================================
-- ERROR_CORRECTION ROWS — deliberately mangled prompts
-- ============================================================================
-- These rows show the learner a corrupted string to repair, so their prompt does
-- NOT contain the clean phrase and the replace() statements above cannot reach
-- them. Each is re-mangled by hand against its new phrase, preserving the
-- one-character-substitution style of the originals.
-- (aabbccdd-5555-4005-0003-e00000000005 had no visible corruption at all — its
-- prompt was the clean phrase — so it was unsolvable as an exercise. Fixed here.)
UPDATE exercises SET prompt = 'Find and correct the error: Esxar en el séptimo cielo'         WHERE id = 'aabbccdd-1111-4005-0002-e00000000005';
UPDATE exercises SET prompt = 'Find and correct the error: Esxar no sétimo céu'               WHERE id = 'aabbccdd-5555-4005-0002-e00000000005';
UPDATE exercises SET prompt = 'Find and correct the error: Pegax no pé de alguém'             WHERE id = 'aabbccdd-5555-4005-0003-e00000000005';
UPDATE exercises SET prompt = 'Find and correct the error: Umax vez na vida, outra na morte'  WHERE id = 'aabbccdd-5555-4005-0004-e00000000005';
UPDATE exercises SET prompt = 'Find and correct the error: 하늘을x날 것 같다'                   WHERE id = 'aabbccdd-7777-4005-0002-e00000000005';
UPDATE exercises SET prompt = 'Find and correct the error: 가뭄에 콩 나듯x'                     WHERE id = 'aabbccdd-7777-4005-0004-e00000000005';

-- ============================================================================
-- VERIFICATION — all must return zero
-- ============================================================================
--   SELECT count(*) FROM cards WHERE target_text IN
--     ('Estar en las nubes','Estar nas nuvens','눈이 휘둥그레지다','De vez em quando',
--      'Excité','Bon matin','当时','氷を破る','얼음을 깨다','Puxar a perna de alguém',
--      '구름 위에 떠있다','공은 당신에게 있다','가물에');
--   SELECT count(*) FROM exercises WHERE prompt LIKE ANY (ARRAY[
--     '%Estar en las nubes%','%Estar nas nuvens%','%눈이 휘둥그레지다%','%De vez em quando%',
--     '%Excité%','%Bon matin%','%当时%','%氷を破る%','%얼음을 깨다%','%Puxar a perna%',
--     '%구름 위에 떠있다%','%공은 당신에게 있다%','%가물에%']);
--   -- same predicate against correct_answer
--   -- MC integrity still intact:
--   SELECT count(*) FROM exercises WHERE options IS NOT NULL AND NOT (correct_answer = ANY (options));
