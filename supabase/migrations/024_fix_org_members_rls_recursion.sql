-- ============================================================================
-- Migration: Fix infinite recursion in organization_members RLS
-- ============================================================================
-- The policy "Members can read other members in same org" on
-- public.organization_members subqueries public.organization_members in its
-- USING clause, so evaluating the policy re-enters the same policy → recursion
-- (Postgres error 42P17).
--
-- Two other policies cascade into the same table and inherit the loop:
--   organizations."Org members can read their organization"
--   classrooms."Org admins can read all classrooms in org"
--
-- Fix: move the membership/admin lookup into SECURITY DEFINER functions. When
-- the policy calls the function, the function body runs as the function owner
-- and bypasses RLS on the inner SELECT, so the loop terminates.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_member_of_org(org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_of_org(org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND org_role = 'admin'
  );
$$;

-- Lock down execution to authenticated users only (not anon)
REVOKE ALL ON FUNCTION public.is_member_of_org(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin_of_org(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_member_of_org(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_of_org(UUID) TO authenticated;

-- ─── Replace the recursive policy on organization_members ─────────────────
DROP POLICY IF EXISTS "Members can read other members in same org"
  ON public.organization_members;

CREATE POLICY "Members can read other members in same org"
  ON public.organization_members FOR SELECT
  USING (public.is_member_of_org(organization_id));

-- ─── Replace the cascading policy on organizations ────────────────────────
DROP POLICY IF EXISTS "Org members can read their organization"
  ON public.organizations;

CREATE POLICY "Org members can read their organization"
  ON public.organizations FOR SELECT
  USING (public.is_member_of_org(id));

-- ─── Replace the cascading policy on classrooms ───────────────────────────
DROP POLICY IF EXISTS "Org admins can read all classrooms in org"
  ON public.classrooms;

CREATE POLICY "Org admins can read all classrooms in org"
  ON public.classrooms FOR SELECT
  USING (public.is_admin_of_org(organization_id));
