-- 029: Allow 'chunk' (formulaic multi-word expression) as a first-class
-- skill_type on cards. Wray 2002 / N. Ellis 1996 — a significant portion
-- of fluent speech is prefabricated chunks. Treating them as their own
-- SRS-trackable items fixes the L2-chunk-underuse problem (improvements.md
-- §A.8 / §8). research.md §8.
--
-- Additive: extends the CHECK constraint without dropping existing rows.
-- Rows with skill_type='vocabulary' or 'grammar' continue to work unchanged.

alter table public.cards drop constraint if exists cards_skill_type_check;

alter table public.cards
  add constraint cards_skill_type_check
  check (skill_type in ('vocabulary', 'grammar', 'chunk'));

comment on column public.cards.skill_type is
  'Classification of the card: single-word vocab, grammar drill, or multi-word formulaic chunk (collocation, phrase, sentence frame).';
