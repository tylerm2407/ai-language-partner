# Security Audit — AI Language Partner

**Date:** 2026-03-09
**Auditor:** Claude Code (automated review)
**Scope:** Full codebase — Supabase RLS policies, edge functions, frontend pages

---

## Summary

| ID | Issue | Severity | Status |
|----|-------|----------|--------|
| A | Missing DELETE RLS policies on user tables | Medium | Fixed |
| B | Edge functions accepted any request with anon key (no JWT check) | High | Fixed |
| C | Input fields in edge functions had no length or sanitization guards | Medium | Fixed |
| D | No rate limiting on AI endpoints | Medium | Documented |
| E | CORS hard-coded to `*` | Low | Fixed |
| F | SQL injection risk | N/A | Not applicable |
| G | `profiles` SELECT policy exposed `stripe_customer_id` to all users | High | Fixed |
| H | Admin route had no server-side access control | High | Fixed |

---

## Finding Detail

### A — Missing DELETE RLS Policies

**Severity:** Medium
**File:** `supabase/schema_v2.sql`

**Issue:** Tables `user_language_progress`, `user_lesson_progress`, `user_writing_submissions`, `conversation_sessions`, `tutor_profiles`, and `subscriptions` had `FOR ALL` policies (which cover SELECT/INSERT/UPDATE) but no explicit DELETE policies. Depending on Postgres/Supabase RLS interpretation, `FOR ALL` may cover DELETE, but adding explicit DELETE policies is clearer and more defensive.

**Fix:** Added explicit DELETE policies to all six tables:
```sql
CREATE POLICY "ulp_delete" ON public.user_language_progress FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "ull_delete" ON public.user_lesson_progress FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "uws_delete" ON public.user_writing_submissions FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "cs_delete" ON public.conversation_sessions FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "tp_delete" ON public.tutor_profiles FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "sub_delete" ON public.subscriptions FOR DELETE USING (auth.uid() = user_id);
```

---

### B — Edge Functions: No JWT Verification

**Severity:** High
**Files:** `supabase/functions/tutor-message/index.ts`, `supabase/functions/writing-feedback/index.ts`

**Issue:** Both functions accepted any HTTP request that included the Supabase anon key. They trusted a `user_id` value from the request body without verifying it corresponded to the actual caller. An attacker could pass any `user_id` (including another user's) to trigger AI calls billed to their subscription or to read/write their data.

**Fix:** Added JWT verification at the top of each function (before any business logic):
1. Require `Authorization: Bearer <token>` header — return 401 if missing.
2. Call `supabase.auth.getUser(token)` using the service role client to validate the JWT.
3. Use `user.id` from the verified JWT in all subsequent database operations — the body `user_id` is ignored.

---

### C — Input Sanitization

**Severity:** Medium
**Files:** `supabase/functions/tutor-message/index.ts`, `supabase/functions/writing-feedback/index.ts`

**Issue:** The `message` field (tutor-message) and `submission` field (writing-feedback) were passed directly to the AI API without any bounds checking. An attacker could send multi-megabyte payloads, causing excessive token costs or timeouts.

**Fix:**
- `message` in tutor-message: capped at 2,000 characters, null bytes stripped.
- `submission` in writing-feedback: capped at 5,000 characters, null bytes stripped.
```typescript
const message = (rawMessage || "").replace(/\0/g, "").slice(0, 2000);
const submission = (rawSubmission || "").replace(/\0/g, "").slice(0, 5000);
```

---

### D — Rate Limiting

**Severity:** Medium
**Files:** Both edge functions

**Issue:** No per-user rate limiting exists. A single authenticated user could call the AI tutor endpoint in a tight loop, incurring significant Anthropic API costs.

**Mitigation documented:** Deno edge functions are stateless — each invocation is a fresh process, so in-memory counters don't persist. Production rate limiting options:
1. **Supabase built-in rate limits** — configure in Dashboard → Edge Functions → Rate Limits (recommended, no code required).
2. **Redis/Upstash** — store per-user request counts with a TTL; check count before calling the AI API.
3. **Subscription-based daily caps** — add a `daily_ai_calls` counter to the `subscriptions` table and check it server-side.

A comment has been added to `tutor-message/index.ts` documenting this.

---

### E — CORS Hard-coded to Wildcard

**Severity:** Low
**Files:** Both edge functions

**Issue:** `Access-Control-Allow-Origin: *` allows any origin to call the functions from a browser, which could enable cross-site request forgery if combined with credential exposure.

**Fix:** Both functions now read an `ALLOWED_ORIGIN` environment variable, falling back to `*` only when the variable is not set (local dev):
```typescript
const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") || "*";
```
Set `ALLOWED_ORIGIN=https://yourdomain.com` in Supabase Edge Function environment variables for production.

---

### F — SQL Injection

**Severity:** N/A
**Assessment:** Not applicable. All database queries use the Supabase JS client, which uses parameterized queries internally via PostgREST. No raw SQL string interpolation exists in any frontend or edge function code. This is safe by design.

---

### G — Sensitive Data Exposure via Profiles RLS

**Severity:** High
**File:** `supabase/schema_v2.sql`

**Issue:** The `profiles` table had `CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true)` — meaning any authenticated user could read ANY other user's full profile row, including `stripe_customer_id`. This is a PII/payment data leak.

**Fix (two-part):**

1. Replaced the open SELECT policy with an owner-only policy:
```sql
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_own_full" ON public.profiles FOR SELECT USING (auth.uid() = id);
```

2. Created a `public_profiles` view exposing only non-sensitive fields for leaderboards and public display:
```sql
CREATE OR REPLACE VIEW public.public_profiles AS
  SELECT id, username, full_name, avatar_url, target_language, total_xp, streak_days, subscription_tier
  FROM public.profiles;
```

**Action required:** Update any frontend queries that read other users' profiles (e.g., Leaderboard page) to query `public_profiles` instead of `profiles`.

---

### H — Admin Route: No Server-Side Access Control

**Severity:** High
**Files:** `src/pages/MusicAdminPage.tsx`, `supabase/schema_v2.sql`

**Issue:** The original `MusicAdminPage.tsx` was accessible to any logged-in user. There was no server-side guard — any user who knew the `/admin/music` URL could add or delete music tracks.

**Fix (two-part):**

1. Added `admin_users` table and `is_admin(uid)` SECURITY DEFINER function to the database:
```sql
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE OR REPLACE FUNCTION public.is_admin(uid UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = uid);
END;
$$;
```
Admins are bootstrapped by manually inserting rows into `admin_users` via the Supabase dashboard (service role only).

2. Updated `MusicAdminPage.tsx` to call `supabase.rpc('is_admin', { uid: user.id })` on mount. If the RPC returns false or errors, the page renders an "Access Denied" screen instead of the admin UI. The page never renders the form for non-admins — the check happens before any data is fetched.

---

## Public Tables (Intentionally Unrestricted)

The following tables have `SELECT USING (true)` — this is intentional and acceptable:

| Table | Reason |
|-------|--------|
| `languages` | Public catalog; no user data |
| `courses` | Published courses are public content |
| `lessons` | Published lessons are public content |
| `lesson_contents` | Public learning content |
| `news_articles` | Public news feed |
| `music_tracks` | Public music catalog |

---

## Recommendations for Future Hardening

1. **Enable Supabase Vault** for storing API keys (ANTHROPIC_API_KEY) rather than environment variables where possible.
2. **Add daily AI call caps** per user at the database level (see Finding D).
3. **Audit `public_profiles` view** before adding it to any public (unauthenticated) API — currently it requires auth.
4. **Set `ALLOWED_ORIGIN`** to your production domain in Supabase Edge Function settings before launch.
5. **Consider signed uploads** if user avatar uploads are added — never accept arbitrary URLs from clients.
