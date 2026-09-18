-- 146 — The mascot loses its name.
--
-- "Sol" was the mascot's name, and it has become a liability: it now reads as
-- OpenAI's model rather than as ours. The product decision is that the
-- character stays and the NAME goes — every surface that talks about the tutor
-- says "your tutor" instead, and nothing is called anything.
--
-- Almost all of that is copy in the app. The one thing the database owns is the
-- comment on `tutor_memory`, which migration 141 wrote in the mascot's voice.
-- A comment is documentation rather than behaviour, so this changes nothing at
-- runtime — but it is the only copy of that sentence a future reader will find
-- with `\d+ tutor_memory`, and leaving it would send them looking for a name
-- the codebase no longer uses.

COMMENT ON TABLE public.tutor_memory IS
  'What the tutor remembers about a learner. Read and DELETE belong to the '
  'learner; every write is service-role — the tutor summariser via '
  'upsert_tutor_memory, the learner via upsert_learner_memory/'
  'edit_learner_memory behind the tutor-memory edge function. personal_fact '
  'and preference are account-wide (target_language IS NULL); the rest are '
  'per-language. Every note is derived and disposable — losing one costs '
  'personalisation, never a learning record.';
