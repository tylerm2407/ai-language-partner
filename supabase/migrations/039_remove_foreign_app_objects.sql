-- ═══════════════════════════════════════════════════════════════
-- 039: Remove other-app objects from the shared Supabase project
--
-- Other NovaWealth projects (CostClarity, a legal-assistant app, a
-- student app, trading tools, a social app, course/quiz tooling) had
-- their CLIs accidentally linked to this project and created tables,
-- functions, triggers, and columns here. Tyler confirmed (2026-06-11)
-- that nothing else points at this project at runtime and the data in
-- the four non-empty tables (users 185, profiles 182, waitlist_signups
-- 180, alternatives 52) is disposable.
--
-- KEPT deliberately:
--  • api_cache + increment_rate_limit + cleanup_expired_cache — used by
--    Fluenci's burst limiter (_shared/burst-limit.ts)
--  • ensure_rls event trigger + rls_auto_enable — auto-enables RLS on
--    new tables (safety net)
--  • enforce_bryant_email trigger — Fluenci's own Bryant pilot gate
--    (FLAGGED: it currently blocks ALL non-@bryant.edu signups)
--  • generic updated_at trigger helpers
-- ═══════════════════════════════════════════════════════════════

-- ── A. Signup trigger that writes to a foreign table ──
-- handle_new_user inserts into public.users (dropped below); leaving it
-- would break every future signup.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- ── B. Foreign storage policy + helper ──
-- (The empty 'brand-assets' bucket itself must be deleted via the
-- dashboard/Storage API — Supabase blocks SQL deletes on storage tables.)
DROP POLICY IF EXISTS "Users can view their org brand assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload brand assets" ON storage.objects;
DROP FUNCTION IF EXISTS public.user_org_id();

-- ── C. Foreign tables ──
DROP TABLE IF EXISTS
  public.users,
  public.profiles,
  public.waitlist_signups,
  public.alternatives,
  public.attorneys,
  public.audit_events,
  public.challenge_daily_pnl,
  public.conversations,
  public.deadlines,
  public.document_hashes,
  public.economic_alerts,
  public.favorites,
  public.firms,
  public.fit_scores,
  public.goals,
  public.grocery_items,
  public.grocery_lists,
  public.grocery_price_comparisons,
  public.investment_accounts,
  public.investment_transfers,
  public.nearby_stores_cache,
  public.notification_preferences,
  public.notifications_log,
  public.plaid_items,
  public.postings,
  public.price_alerts,
  public.price_cache,
  public.price_history,
  public.price_notifications,
  public.purchase_patterns,
  public.purchases,
  public.quick_adds,
  public.receipt_scans,
  public.referrals,
  public.saved_alternatives,
  public.student_profiles,
  public.user_challenges,
  public.user_costs,
  public.user_documents,
  public.user_suggested_alternatives,
  public.user_trades,
  public.user_watchlist,
  public.workflow_instances,
  public.xp_events
CASCADE;

-- ── D. Foreign functions ──
-- (no CASCADE: if anything still depends on one of these, the drop
-- fails loudly instead of silently removing the dependent.)
DROP FUNCTION IF EXISTS public.award_xp(uuid, text, integer, jsonb);
DROP FUNCTION IF EXISTS public.create_user_deadline(uuid, uuid, text, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.delete_user_deadline(uuid, uuid);
DROP FUNCTION IF EXISTS public.list_user_deadlines(uuid, text);
DROP FUNCTION IF EXISTS public.update_user_deadline(uuid, uuid, text, text, text, text);
DROP FUNCTION IF EXISTS public.get_user_profile(uuid);
DROP FUNCTION IF EXISTS public.upsert_user_profile(jsonb);
DROP FUNCTION IF EXISTS public.generate_certificate_number();
DROP FUNCTION IF EXISTS public.get_course_assessment(uuid);
DROP FUNCTION IF EXISTS public.get_quiz_for_module(uuid);
DROP FUNCTION IF EXISTS public.submit_assessment_attempt(uuid, jsonb);
DROP FUNCTION IF EXISTS public.submit_quiz_attempt(uuid, jsonb);
DROP FUNCTION IF EXISTS public.verify_certificate(text);
DROP FUNCTION IF EXISTS public.handle_comment_insert();
DROP FUNCTION IF EXISTS public.handle_comment_delete();
DROP FUNCTION IF EXISTS public.handle_interaction_insert();
DROP FUNCTION IF EXISTS public.handle_interaction_delete();
DROP FUNCTION IF EXISTS public.notify_on_comment();
DROP FUNCTION IF EXISTS public.notify_on_follow();
DROP FUNCTION IF EXISTS public.notify_on_like();
DROP FUNCTION IF EXISTS public.recompute_engagement_score(uuid);
DROP FUNCTION IF EXISTS public.get_public_profiles();
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.is_classroom_student(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_classroom_teacher(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_org_admin(uuid, uuid);

-- ── E. Casemate columns on the shared user_profiles table ──
-- Verified unreferenced by any Fluenci code (client, hooks, edge fns).
ALTER TABLE public.user_profiles
  DROP COLUMN IF EXISTS state,
  DROP COLUMN IF EXISTS housing_situation,
  DROP COLUMN IF EXISTS employment_type,
  DROP COLUMN IF EXISTS family_status,
  DROP COLUMN IF EXISTS language_preference,
  DROP COLUMN IF EXISTS active_issues,
  DROP COLUMN IF EXISTS legal_facts,
  DROP COLUMN IF EXISTS documents,
  DROP COLUMN IF EXISTS member_since,
  DROP COLUMN IF EXISTS conversation_count,
  DROP COLUMN IF EXISTS free_messages_used;

-- The casemate app's duplicate permissive policy (FOR ALL) — Fluenci's
-- own select/insert/update policies remain.
DROP POLICY IF EXISTS "Users read/update own profile" ON public.user_profiles;
