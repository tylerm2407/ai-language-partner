-- 075_audit_log_survives_user_deletion.sql
--
-- In-app account deletion was broken. `audit_log.actor_id` referenced
-- auth.users with NO ON DELETE clause, so Postgres defaulted to NO ACTION —
-- and supabase.auth.admin.deleteUser() raised a foreign-key violation for any
-- user who had ever produced an audit row.
--
-- That was not a theoretical path: generate-avatar/index.ts:268 calls
-- logAudit() on every successful avatar generation, and avatar generation is a
-- consumer feature, not one of the org-admin actions behind SCHOOL_ENABLED. So
-- the first user to make an avatar became permanently undeletable.
--
-- Apple App Review Guideline 5.1.1(v) requires working in-app account deletion
-- for any app offering account creation, and education is not in the 5.1.1(ix)
-- regulated-industry exemption list. It is also GDPR Article 17.
--
-- A full sweep of every FK into auth.users found exactly one other
-- non-cascading constraint: organizations.created_by is RESTRICT, which is
-- deliberate — delete-account refuses org owners with a 409 and an actionable
-- message. All 27 remaining FKs are CASCADE. client_events is the only table
-- carrying a user_id with no FK at all, and delete-account already clears it.
--
-- SET NULL rather than CASCADE: audit rows are evidence. Nulling the actor
-- keeps the action, the resource, the organization and the timestamp — which is
-- what a university security review expects to see retained — while removing
-- the link to a person. Deleting them outright would destroy the trail that the
-- table exists to provide.
--
-- The paired change in supabase/functions/delete-account/index.ts scrubs
-- ip_address at the same time, because SET NULL alone would leave an IP behind
-- and an IP is personal data under GDPR. This migration is the backstop that
-- guarantees deletion can never be BLOCKED again even if that step is skipped.

ALTER TABLE public.audit_log
  ALTER COLUMN actor_id DROP NOT NULL;

ALTER TABLE public.audit_log
  DROP CONSTRAINT audit_log_actor_id_fkey;

ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.audit_log.actor_id IS
  'The acting user. NULL means that account has since been deleted — the audit '
  'entry is retained with its actor pseudonymised (see migration 075).';

-- ---------------------------------------------------------------------------
-- ROLLBACK
--   ALTER TABLE public.audit_log DROP CONSTRAINT audit_log_actor_id_fkey;
--   ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_actor_id_fkey
--     FOREIGN KEY (actor_id) REFERENCES auth.users(id);
--   -- restoring NOT NULL requires that no rows have a null actor_id:
--   ALTER TABLE public.audit_log ALTER COLUMN actor_id SET NOT NULL;
-- Rolling back reinstates the deletion blocker. Do not.
-- ---------------------------------------------------------------------------
