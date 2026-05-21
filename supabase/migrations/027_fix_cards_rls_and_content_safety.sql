-- Migration 027: Fix Cards Table RLS — restrict INSERT to teachers/admins only
-- The previous policy (migration 004) allowed ANY authenticated user to INSERT
-- into the cards table, enabling spam/malicious content injection.
-- This migration restricts card creation to users with 'teacher' or 'school_admin' roles.

-- 1. Drop the overly permissive INSERT policy
DROP POLICY IF EXISTS "Authenticated users can insert cards" ON public.cards;

-- 2. Create a restrictive INSERT policy: only teachers and school admins
CREATE POLICY "Teachers and admins can insert cards"
  ON public.cards
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('teacher', 'school_admin')
    )
  );
