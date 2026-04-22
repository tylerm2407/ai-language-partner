-- ============================================================================
-- Migration: Allow authenticated users to INSERT their own correction_log rows
-- ============================================================================
-- Migration 026 created correction_log with only SELECT RLS for users —
-- writes came from ai-chat (service-role) only. Stream 1 of the evidence-
-- based feedback swarm now writes from client-side exercise failures via
-- `logExerciseCorrection` in lib/supabase-queries.ts (Lyster & Ranta —
-- differentiated feedback wiring). Add a narrow INSERT policy so the
-- authenticated user can only log their own corrections (user_id must
-- equal auth.uid()).
--
-- Additive only — no schema changes, no drops, no renames.
-- ============================================================================

CREATE POLICY "Users can insert own correction log"
  ON public.correction_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);
