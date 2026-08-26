-- ═══════════════════════════════════════════════════════════════
-- 078: Onboarding checklist reconciliation
--
-- The checklist stopped being a set of flags that screens remember to write
-- and became a value derived from what the learner actually did (see
-- lib/onboarding-checklist.ts). Two things follow from that.
--
--   (a) The persisted shape gained `skipped` (steps resolved by opting out
--       rather than by doing them) and `celebratedAt` (the completion was
--       acknowledged — confetti shown, XP paid), and lost `collapsed`, whose
--       only consumer was a dead component.
--
--   (b) The client needs one signal it cannot honestly compute itself: has
--       this learner ever spoken to the AI tutor?
--
-- NO BACKFILL, deliberately. `parseOnboardingChecklist` is null-safe per key
-- and `updateOnboardingChecklist` replaces the whole column, so an existing
-- row simply reads as `skipped: []` / `celebratedAt: null` until the next
-- write. An UPDATE over every row would rewrite `updated_at` for the entire
-- user base to fix something that fixes itself.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. New rows start in the new shape ──
ALTER TABLE public.user_profiles
  ALTER COLUMN onboarding_checklist SET DEFAULT '{
    "chooseLanguage": false,
    "firstLesson": false,
    "aiConversation": false,
    "dailyReminder": false,
    "skipped": [],
    "dismissed": false,
    "completedAt": null,
    "celebratedAt": null
  }'::jsonb;

-- ── 2. The aiConversation signal ──
-- Why an RPC rather than a client query:
--
--   • `chat_messages` carries no `user_id` — ownership is only reachable by
--     joining `chat_sessions` — so the client would have to either denormalise
--     or issue a join PostgREST makes awkward.
--   • A *session* existing is a false signal. app/(app)/chat persists the
--     assistant's opening greeting the moment a scenario is opened, before the
--     learner has typed a word. The only honest evidence of a conversation is
--     at least one message with role = 'user'.
--
-- SECURITY INVOKER, not DEFINER: the caller's RLS still applies (020a's
-- chat_sessions/chat_messages policies scope both to auth.uid()), so this
-- exposes no row a client could not already read. It exists to phrase the
-- question, not to widen access.
CREATE OR REPLACE FUNCTION public.has_ai_conversation()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.chat_messages m
      JOIN public.chat_sessions s ON s.id = m.session_id
     WHERE s.user_id = (select auth.uid())
       AND m.role = 'user'
  );
$$;

-- Postgres grants EXECUTE to PUBLIC on every new function, which hands `anon`
-- a callable RPC. Harmless here — SECURITY INVOKER plus a null `auth.uid()`
-- means an anonymous caller always gets `false` — but migration 054 established
-- that internal helpers are explicitly scoped rather than left on the default,
-- and the Security Advisor flags anon-executable functions. Match the pattern.
REVOKE ALL ON FUNCTION public.has_ai_conversation() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_ai_conversation() TO authenticated;
