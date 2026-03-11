# Fluenci — Security Playbook

This document defines the security standards for this project. Every rule below maps directly
to the AI Vibe Coding Security Playbook. All contributors and AI assistants must follow these
guidelines before merging any code.

---

## Authentication & Sessions

### Rule 01 — Session Lifetime
- Supabase JWTs are configured to expire in **1 hour** (access token) with **7-day** refresh token rotation.
- Never manually extend session lifetime beyond 7 days.
- Refresh token rotation is enabled in the Supabase dashboard (Auth → Settings → JWT expiry).
- **Action**: Set in Supabase Dashboard → Authentication → JWT expiry to `3600` seconds.

### Rule 02 — Never use AI-built auth
- Auth is handled exclusively by **Supabase Auth** (email/password, session management, JWT).
- No custom auth logic, no hand-rolled session tokens, no AI-generated auth flows.
- `AuthContext.tsx` only wraps Supabase — it does not implement auth itself.

### Rule 03 — API keys strictly secured
- All API keys live in environment variables — never hardcoded in source.
- **Frontend**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (safe to expose — RLS enforces access)
- **Edge Functions**: `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_ORIGIN` set via `supabase secrets set`
- **Never commit** `.env` files. Only `.env.example` with placeholder values is committed.
- `.env` is in `.gitignore`.

---

## Secure API Development

### Rule 04 — Rotate secrets every 90 days
- Rotate `ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` every 90 days minimum.
- Track rotation dates here:

| Secret | Last Rotated | Next Due |
|--------|-------------|----------|
| ANTHROPIC_API_KEY | — | — |
| SUPABASE_SERVICE_ROLE_KEY | — | — |

- After rotating: run `supabase secrets set KEY=new_value` and redeploy edge functions.

### Rule 05 — Verify packages before installing
- Before `npm install <pkg>`, check:
  1. npm audit score at `https://socket.dev`
  2. Weekly downloads > 10k (popularity signal)
  3. Last publish < 12 months ago
  4. No known CVEs in `npm audit`

### Rule 06 — Always use newer, more secure package versions
- Never pin to old major versions without a documented reason.
- Run `npm outdated` monthly and update non-breaking packages.

### Rule 07 — Run `npm audit fix` after every build
```bash
npm audit fix
# If critical vulnerabilities remain:
npm audit fix --force  # review changes carefully
```

### Rule 08 — Sanitize all inputs
- All user input going to the database uses **Supabase parameterized queries** (the JS client handles this automatically — never use raw SQL string concatenation).
- Edge functions cap all text inputs:
  - Chat messages: 2,000 chars max
  - Writing submissions: 5,000 chars max
  - Null bytes stripped: `.replace(/\0/g, '')`
- Input validation happens **server-side in edge functions**, not just the UI.

---

## API & Access Control

### Rule 09 — Row-Level Security (RLS) enabled from day one
- **All tables** have RLS enabled. See `supabase/schema.sql` and `supabase/schema_v2.sql`.
- Policy pattern: users can only read/write their own rows (`auth.uid() = user_id`).
- Public data uses read-only policies (`FOR SELECT USING (true)`).
- Admin actions use `is_admin()` RPC (server-side — not a UI flag).
- Never disable RLS on any table, even temporarily in production.

### Rule 10 — No `console.log` in production
- Zero `console.log` statements in `src/`. Verified: `grep -rn "console.log" src/` returns 0 results.
- Edge functions must not log sensitive data (tokens, user content).
- Use structured error returns, not console output.
- Pre-deploy checklist: run `grep -rn "console\." src/` — must return 0 matches.

### Rule 11 — CORS restricted to allow-listed production domain
- All edge functions read `ALLOWED_ORIGIN` from environment:
  ```typescript
  const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") || "*"
  ```
- In production, set: `supabase secrets set ALLOWED_ORIGIN=https://yourdomain.com`
- `*` is only acceptable in local development. Never deploy to production with `ALLOWED_ORIGIN=*`.

### Rule 12 — Validate all redirect URLs
- Internal navigation uses React Router `navigate()` with hardcoded internal paths only.
- No redirect URLs are accepted from query parameters or user input.
- External links (Spotify, Apple Music, YouTube, Stripe) use `target="_blank" rel="noopener noreferrer"` — never constructed from unvalidated user input.
- `PopularSongsSection.tsx` links come from the static `popularSongs.ts` seed file — not from user input.

### Rule 13 — Auth and rate limiting on every endpoint
- All edge functions verify the Supabase JWT before processing:
  ```typescript
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return 401
  ```
- Rate limiting: Supabase dashboard → Edge Functions → Rate Limits.
  - Set per-function limits: `chat` = 60 req/min, `tutor-message` = 20 req/min, `writing-feedback` = 10 req/min.
- The `chat` endpoint (legacy free-tier) must also be JWT-gated — see fix in `supabase/functions/chat/index.ts`.

---

## Data & Infrastructure

### Rule 14 — Cap AI API costs
- `max_tokens` is set on every Claude API call:
  - `tutor-message`: 1,024 tokens
  - `writing-feedback`: 2,048 tokens
  - `reading-help`: 512 tokens
  - `chat`: 1,024 tokens
- Set monthly spend limits in the Anthropic Console → Billing → Spend limits.
- Set Supabase Edge Function invocation alerts in the Supabase Dashboard.

### Rule 15 — DDoS protection
- Deploy behind **Cloudflare** (free tier) or **Vercel** (built-in edge protection).
- Cloudflare: enable "Under Attack Mode" if an attack occurs.
- Never expose Supabase service role key to any CDN or public config.

### Rule 16 — Lock down storage access
- No file uploads are currently implemented. When added:
  - Use Supabase Storage with RLS: `auth.uid() = owner`
  - Users can only access their own storage bucket paths
  - Never allow listing other users' files

### Rule 17 — Validate upload limits by signature, not extension
- Not applicable yet. When file uploads are added:
  - Validate MIME type via magic bytes (file signature), not file extension
  - Set max file size server-side in the edge function, not just the UI

### Rule 18 — Verify webhook signatures before processing payment data
- Stripe webhooks are not yet implemented. When added:
  - **Always** verify `stripe-signature` header using `stripe.webhooks.constructEvent()`
  - Reject any webhook without a valid signature with `400`
  - Never process payment state changes without signature verification
  - Test webhooks must use Stripe test mode keys — never touch production data

---

## Other Rules

### Rule 19 — Server-side permission checks
- Plan checks (`pro`/`family`) happen in **edge functions** via DB lookup — not just in the UI `PlanGate` component.
- Admin checks use the `is_admin()` Postgres RPC — not a client-side flag.
- `PaidRoute` component in `App.tsx` is a UI convenience only — all actual enforcement is in edge functions.
- Never trust any value from the client request body for authorization decisions.

### Rule 20 — Log critical actions
- The following actions must be logged (implement audit log table when scaling):
  - Account deletion
  - Subscription changes
  - Admin role grants/revokes
  - Payment events
- Currently: Supabase dashboard logs all DB operations. Add `audit_logs` table before launch.

### Rule 21 — Real account deletion flows
- Account deletion is implemented via the `delete_user()` RPC (SECURITY DEFINER) which calls `DELETE FROM auth.users`.
- This cascades to all user data via `ON DELETE CASCADE` on all tables.
- **Required before launch**: add confirmation step, send deletion confirmation email, 30-day grace period for recovery.
- GDPR/CCPA compliance: deletion must remove all PII within 30 days.

### Rule 22 — Automate and test backups
- Enable Supabase Point-in-Time Recovery (PITR) in the dashboard (Pro plan+).
- Test restoration quarterly — an untested backup is useless.
- Before launch: document the restoration procedure and test it end-to-end.

### Rule 23 — Separate test and production environments
- **Production**: live Supabase project, real Stripe keys, real Anthropic API key
- **Development**: separate Supabase project (free tier), Stripe test mode, Anthropic test key
- Environment variable names are identical — only values differ
- Never run `supabase db push` against production without a backup

### Rule 24 — Webhooks never touch real systems in test environment
- Stripe webhooks in development use `stripe listen --forward-to localhost` with test mode keys only
- Test webhook events must use `sk_test_...` Stripe keys
- Production webhook endpoint must reject events from test mode signatures

---

## Pre-Deploy Checklist

Run before every production deployment:

```bash
# 1. No console.log leaks
grep -rn "console\." src/ && echo "FAIL — remove console statements" || echo "OK"

# 2. No hardcoded secrets
grep -rn "sk-ant\|sk_live\|service_role" src/ && echo "FAIL — secrets in source" || echo "OK"

# 3. Dependency audit
npm audit

# 4. Build succeeds
npm run build

# 5. ALLOWED_ORIGIN is set in Supabase secrets (not *)
# Check: supabase secrets list | grep ALLOWED_ORIGIN
```

---

## Reporting Vulnerabilities

If you discover a security vulnerability in this project, do **not** open a public GitHub issue.
Email: security@[yourdomain].com with details. We will respond within 48 hours.

---

*Last updated: 2026-03-10 | Follows AI Vibe Coding Security Playbook v1*
