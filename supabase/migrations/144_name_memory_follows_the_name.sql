-- 144 — Sol learns the learner's name whenever the name is actually set.
--
-- Migration 142 seeded the name note inside `apply_onboarding_draft`, on the
-- reasonable assumption that the draft carries the name. It does not. Onboarding
-- v2 moved "pick a name and a look" to AFTER sign-up, so the flush runs with an
-- empty `display_name` and the name arrives in a later, ordinary profile update.
-- Caught on a simulator run-through: the new account ended up with the goal note
-- and no name note, while `user_profiles.display_name` said 'Mara'.
--
-- The fix is to put the note where the fact is, rather than where the fact was
-- assumed to be. A trigger on `display_name` catches every path that can set it
-- — the onboarding name step, a later rename in Settings, an admin correction —
-- and there is now exactly one writer for this note instead of one writer per
-- screen that can change a name.
--
-- Three rules it follows:
--   * The learner's own version wins. If they have rewritten the note (source
--     'learner'), this leaves it alone entirely — they own what Sol remembers
--     about them, and a rename is not consent to overwrite their words.
--   * A rename REPLACES the seeded note rather than adding a second one. A tutor
--     that believes you are called two things has not remembered anything.
--   * It is best-effort, like every other writer here: a memory note may never
--     cost somebody their profile write (migration 143).

CREATE OR REPLACE FUNCTION public.fluenci_sync_name_memory()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_name text := NULLIF(btrim(COALESCE(NEW.display_name, '')), '');
BEGIN
  -- An empty name is not a fact about anybody. This is the normal case during
  -- the onboarding flush itself, which writes the row before the name step.
  IF v_name IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND COALESCE(OLD.display_name, '') = COALESCE(NEW.display_name, '') THEN
    RETURN NEW;
  END IF;

  BEGIN
    -- Their own wording is untouchable.
    IF EXISTS (
      SELECT 1 FROM public.tutor_memory
       WHERE user_id = NEW.user_id
         AND kind = 'personal_fact'
         AND source = 'learner'
         AND content ILIKE 'Their name is %'
    ) THEN
      RETURN NEW;
    END IF;

    DELETE FROM public.tutor_memory
     WHERE user_id = NEW.user_id
       AND kind = 'personal_fact'
       AND source = 'onboarding'
       AND content ILIKE 'Their name is %';

    -- The language argument is discarded by `tutor_memory_scope` for
    -- `personal_fact` (the note is account-wide), but the RPC refuses a NULL
    -- language outright, so a profile mid-onboarding with no language yet still
    -- needs something to pass.
    PERFORM public.upsert_learner_memory(
      NEW.user_id, COALESCE(NEW.target_language, 'es'), 'personal_fact',
      'Their name is ' || v_name || '.',
      'onboarding'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'name memory sync skipped for %: % (%)', NEW.user_id, SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS fluenci_sync_name_memory ON public.user_profiles;
CREATE TRIGGER fluenci_sync_name_memory
  AFTER INSERT OR UPDATE OF display_name ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.fluenci_sync_name_memory();

COMMENT ON FUNCTION public.fluenci_sync_name_memory() IS
  'Keeps the "Their name is X." tutor_memory note in step with '
  'user_profiles.display_name. One writer for the fact, wherever the name is '
  'set; never overwrites a note the learner rewrote themselves (migration 144).';
