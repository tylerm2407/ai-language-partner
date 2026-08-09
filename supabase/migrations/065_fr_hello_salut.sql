-- 065_fr_hello_salut.sql
-- Content audit 2026-08-08, follow-up: separate the two French greetings.
--
-- WHY
-- Migration 061 repointed fr "Good morning" from the Québécois "Bon matin" to
-- "Bonjour". That was correct, but it left the fr deck teaching ONE word for TWO
-- concepts: Hello = Bonjour and Good morning = Bonjour. Consequences:
--   * two `cards` rows with identical target text, so the SRS shows the same
--     word twice as if it were two things to learn
--   * duplicated listening/speaking exercises with identical prompts
--   * a listening_choice that 062 had to de-collide by swapping a distractor
--
-- Papering over it in the options was the wrong fix. French has two greetings and
-- the deck should teach both: Salut (informal hi/bye) and Bonjour (hello / good
-- morning, formal). That removes the ambiguity at the source instead of hiding it
-- from the multiple-choice generator.
--
-- This also brings production into line with supabase/generate_seed.py, which was
-- corrected the same way. Prod and the generator disagreeing about a concept is
-- exactly the failure that migration 049 introduced and that this audit spent its
-- time undoing — see 060's header.

UPDATE cards SET target_text = 'Salut' WHERE id = 'aabbccdd-2222-1001-c001-000000000000';

-- Card-linked generated rows
UPDATE exercises SET prompt = 'Salut'
  WHERE id = '46c7c0b3-1367-4b5b-8f68-458902a48905';                       -- listening_choice -> Hello
UPDATE exercises SET prompt = 'Salut', correct_answer = 'Salut', accepted_answers = ARRAY['Salut']
  WHERE id = '94000db1-b00a-4865-a833-495099b51165';                       -- speaking
UPDATE exercises SET prompt = 'Salut', correct_answer = 'Salut'
  WHERE id = '964adc33-e9e0-4f27-91e4-3d39775d6ab7';                       -- listening_type

-- Seeded rows
UPDATE exercises SET prompt = 'What does "Salut" mean in English?'
  WHERE id = 'aabbccdd-2222-1001-0001-e00000000001';                       -- multiple_choice -> Hello
UPDATE exercises SET prompt = 'Sa_____ (Hello)', correct_answer = 'lut'
  WHERE id = 'aabbccdd-2222-1001-0005-e00000000008';                       -- fill_blank, was Bon_____/jour
UPDATE exercises SET prompt = 'Translate to English: Salut', accepted_answers = '{}'
  WHERE id = 'aabbccdd-2222-1001-0006-e00000000007';                       -- translate_to_native -> Hello
--   accepted_answers dropped: it held 'Good morning', which was only valid while
--   this row was about Bonjour. Salut does not mean good morning.

-- Rows that stay on Bonjour are now unambiguous and are deliberately untouched:
--   aabbccdd-2222-1001-0001-e00000000003  t2n Bonjour -> Good morning (accepts 'Hello';
--                                         still linguistically correct, kept generous)
--   aabbccdd-2222-1001-0002-e00000000002  t2t Good morning -> Bonjour
--   aabbccdd-2222-1001-0003-e00000000001  mc  Bonjour -> Good morning
--   33ed17ee / 1fc220fd / 2536e3d3        card-linked rows for the Good morning card

-- ============================================================================
-- VERIFICATION — all must return zero
-- ============================================================================
--   -- no two fr cards share a target:
--   SELECT count(*) FROM (SELECT target_text FROM cards WHERE language = 'fr'
--     GROUP BY target_text HAVING count(DISTINCT native_text) > 1) t;
--   -- no multiple_choice carries two correct answers (see 062's query)
--   -- options still well-formed:
--   SELECT count(*) FROM exercises WHERE options IS NOT NULL
--     AND (NOT (correct_answer = ANY (options))
--          OR cardinality(options) <> cardinality(ARRAY(SELECT DISTINCT unnest(options))));
