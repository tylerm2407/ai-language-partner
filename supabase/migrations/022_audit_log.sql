-- Migration: 022_audit_log.sql
-- Creates the audit_log table for compliance and security tracking.
-- All administrative mutations (org management, classroom ops, role changes) are logged here.

CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  actor_role TEXT,
  organization_id UUID REFERENCES public.organizations(id),
  action TEXT NOT NULL, -- 'create', 'read', 'update', 'delete', 'grant', 'revoke'
  resource_type TEXT NOT NULL, -- 'classroom', 'assignment', 'submission', 'enrollment', 'role', 'organization'
  resource_id UUID,
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying by org (institution data requests / compliance)
CREATE INDEX idx_audit_log_org ON public.audit_log(organization_id, created_at DESC);

-- Index for querying by actor
CREATE INDEX idx_audit_log_actor ON public.audit_log(actor_id, created_at DESC);

-- Index for querying by resource
CREATE INDEX idx_audit_log_resource ON public.audit_log(resource_type, resource_id);

-- RLS: Only org admins can read audit logs for their org
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can read org audit logs"
  ON public.audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = audit_log.organization_id
        AND user_id = auth.uid()
        AND org_role = 'admin'
    )
  );

-- No INSERT policy for users — inserts happen via service role in Edge Functions
-- No UPDATE/DELETE policies — audit logs are immutable
