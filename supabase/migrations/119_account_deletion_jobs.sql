-- 119 — Resumable account-deletion progress ledger.
-- No FK is intentional: the final auth deletion must not erase evidence of a
-- partial workflow before the edge function verifies and removes this row.
BEGIN;

CREATE TABLE public.fluenci_account_deletion_jobs (
  user_id uuid PRIMARY KEY,
  stage text NOT NULL CHECK (stage IN (
    'started','billing_cancelled','auxiliary_deleted','storage_deleted',
    'audit_scrubbed','auth_deleted'
  )),
  last_error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fluenci_account_deletion_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fluenci_account_deletion_jobs FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.fluenci_account_deletion_jobs TO service_role;

COMMENT ON TABLE public.fluenci_account_deletion_jobs IS
  'Short-lived service-only ledger for resumable account deletion; removed after verified erasure.';

COMMIT;
