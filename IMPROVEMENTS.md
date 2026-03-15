# Fluenci v2 — Improvements Over v1

This document catalogs every change made in the v2 rebuild of ai-language-partner, organized by category.

---

## 1. Security Hardening

### Secrets & Environment Variables
- Moved hardcoded Supabase URL and anon key from `src/lib/supabase.ts` to `import.meta.env.VITE_SUPABASE_*` environment variables
- Created `.env.example` documenting all required vars
- Created `.gitignore` with `.env`, `.env.local`, `node_modules`, `dist`, `supabase/.temp/`

### CORS
- Replaced wildcard `"*"` CORS origin across all edge functions with `Deno.env.get("ALLOWED_ORIGIN")`
- Fallback changed from `"*"` to `"http://localhost:5173"` (fail closed, not open)
- Centralized CORS handling in `_shared/middleware.ts` via `handleCORS()`

### Authentication
- **Fixed critical auth flaw**: `claude.ts`, `TutorPage.tsx`, `DrivingModePage.tsx` were sending the Supabase anon key as the Authorization header instead of the user's session token
- All fetch calls to edge functions now use `session.access_token` from `supabase.auth.getSession()`

### Row Level Security (RLS)
- **Migration 005**: Split all `FOR ALL` policies into granular `SELECT`, `INSERT`, `UPDATE`, `DELETE` policies
- **Migration 008**: Enabled RLS on `ai_response_cache`, `ai_usage_log`, `achievements`, `srs_cards`, `srs_reviews`
- INSERT policies use `WITH CHECK` instead of `USING`
- `ai_response_cache` is service-role-only (no public policies)
- `ai_usage_log` scoped to user's own records
- `achievements` table is public read-only

### Input Validation
- **New file: `src/lib/validation.ts`** — Zod schemas for login, signup, profile update, chat message, writing submission, onboarding
- Edge functions validate all inputs: string lengths, UUID format, numeric clamping
- Null bytes stripped from text inputs (`.replace(/\0/g, "")`)
- Stripe price IDs validated against whitelist in `create-checkout`

### Open Redirect Fix
- `create-checkout` and `customer-portal` no longer use `req.headers.get("origin")` as redirect URL
- New `getSafeOrigin()` function requires `ALLOWED_ORIGIN` env var, throws 503 if not set

### Content Security Policy
- Added CSP meta tag to `index.html` restricting `script-src`, `style-src`, `connect-src`, `frame-src`

### Stripe Webhook Security
- Webhook endpoint now rejects non-POST methods (returns 405)
- Removed unnecessary OPTIONS/CORS handler (webhooks are server-to-server)

### Cron Authentication
- Replaced weak `authHeader.includes(cronSecret)` substring check with strict equality via `verifyCronAuth()`
- Fails if `CRON_SECRET` env var is not set

### Error Sanitization
- Edge functions never return raw `error.message` to client
- Structured error responses via `errorResponse()` with generic user-facing messages
- Internal errors logged server-side only

### index.html Cleanup
- Removed duplicate `<title>` tags and Lovable branding
- Added proper OG and Twitter meta tags

---

## 2. AI Cost Reduction

### Model Downgrade
- **Chat, Tutor, Writing Feedback**: `claude-opus-4-6` → `claude-sonnet-4-6` (~80% cost reduction, $15/M → $3/M input tokens)
- **Translations, Reading Help**: Already using Haiku ($0.25/M input tokens)
- **New file: `_shared/ai-config.ts`** — Centralized model config per request type

### Dynamic max_tokens
- Chat: 512 tokens (was unlimited/default)
- Tutor: 768 tokens
- Writing feedback: 1024 tokens
- Translation: 200 tokens
- Reading help: 300 tokens
- Pronunciation scoring: 200 tokens

### Conversation Summarization
- When conversation history exceeds 10 messages, older messages are summarized into a single context message using Haiku
- Last 6 messages kept in full for context continuity
- Applies to `chat` and `tutor-message` functions

### Response Caching
- **New table: `ai_response_cache`** — Caches deterministic AI responses (translations)
- Cache key: hash of (input, model, language)
- TTL: 7 days with automatic expiry index
- `reading-help` function checks cache before making API call

### Usage Tracking
- **New table: `ai_usage_log`** — Logs every AI API call (user_id, function, model, tokens, cached flag)
- All AI edge functions log usage after each call
- Enables cost monitoring and per-user usage analysis

---

## 3. Scalability

### Subscription Caching via Webhook
- **New edge function: `stripe-webhook`** — Handles `customer.subscription.created/updated/deleted` events
- Caches `subscription_plan`, `subscription_tier`, `subscription_expires_at` on the profiles table
- `useUserPlan` hook reads from profile cache first, only falls back to Stripe API on cache miss
- Polling interval reduced from 60s to 300s (5 min) since webhook handles real-time updates

### Leaderboard Optimization
- **New materialized view: `leaderboard_xp`** with pre-computed rank column
- Leaderboard page tries materialized view first (fast), falls back to direct query
- Database indexes on `profiles(total_xp DESC)` and `profiles(streak_days DESC)`

### Database Indexes (Migration 006)
- `profiles(total_xp DESC)` — Leaderboard sorting
- `profiles(streak_days DESC)` — Streak leaderboard
- `profiles(league, league_xp DESC)` — League rankings
- `srs_cards(user_id, next_due)` — SRS review queue
- `srs_reviews(user_id, created_at DESC)` — Review history
- `conversations(user_id, updated_at DESC)` — Conversation list
- `user_achievements(user_id)` — Achievement lookup

### React Query Caching
- QueryClient configured with `staleTime: 5min`, `gcTime: 30min`
- `retry: 2` with `refetchOnWindowFocus: false`
- Reduces redundant API calls across page navigations

### Code Splitting
- 17 routes lazy-loaded with `React.lazy()` (Login, Index, Dashboard kept eager)
- `Suspense` wrapper with spinner fallback
- Vite `manualChunks` splits vendor (163KB), supabase (176KB), ui (206KB), app (200KB)
- No chunk exceeds the 500KB warning threshold

---

## 4. Duolingo-Inspired Gamification

### Database Schema (Migration 007)

**New columns on profiles:**
- `gems` (int, default 50) — In-app currency
- `streak_freeze_count` (int, default 0) — Purchased streak protection
- `league` (text, default 'bronze') — Current league tier
- `league_xp` (int, default 0) — Weekly XP for league ranking
- `hearts_last_regen_at` (timestamptz) — Heart regeneration tracker
- `max_hearts` (int, default 5) — Maximum heart capacity

**New tables:**
- `gem_transactions` — Tracks all gem earn/spend events with reason and metadata
- `daily_quests` — 3 daily quests per user with type, target, progress, rewards
- `league_history` — Weekly league snapshots with rank, promotion/demotion status
- `practice_calendar` — Daily practice records (XP, minutes, lessons, reviews)

### SQL Functions
- `add_xp()` — Awards XP with streak multiplier, updates practice calendar, progresses XP quests, awards gems (1 per 10 XP)
- `generate_daily_quests()` — Creates 3 varied quests per day (earn_xp, complete_lessons, review_cards)
- `purchase_streak_freeze()` — Deducts 200 gems, increments freeze count (max 2)
- `regenerate_hearts()` — Calculates and applies heart regen (1 per 4 hours)
- `add_gems()` — Safe gem increment for quest rewards

### Streak System
- Streak multiplier: 1x (0-2 days), 1.2x (3-6 days), 1.5x (7-13 days), 2x (14+ days)
- Streak freeze auto-activates when a day is missed (if freeze available)
- Streak resets to 1 if no freeze and day missed

### Hearts System
- 5 hearts maximum, lose 1 per wrong answer
- Regenerate 1 heart every 4 hours
- Refill all hearts for 100 gems
- Pro subscribers get unlimited hearts

### Gems Economy
- Earn gems: 1 per 10 XP, quest completion rewards (10 gems each)
- Spend gems: Streak freeze (200), heart refill (100), double XP (150)
- Full transaction history tracked

### Daily Quests
- 3 quests generated daily with randomized targets
- Types: earn_xp, complete_lessons, review_cards
- Progress tracked in real-time, gems + XP awarded on completion

### Weekly Leagues
- 5 tiers: Bronze → Silver → Gold → Diamond → Legendary
- Top 20% promoted, bottom 20% (with 0 XP) demoted
- Weekly XP reset, history preserved in league_history table
- Processed by `league-update` cron function

### New Edge Functions
- **`daily-quests`** — Get/update daily quests with input validation (UUID, clamped delta)
- **`league-update`** — Weekly cron job for league promotion/demotion
- **`gems-transaction`** — Balance check, purchases (streak freeze, heart refill, double XP), transaction history

### Gamification Logic (`src/lib/gamification.ts`)
- League config with names, colors, icons, min XP thresholds
- `getStreakMultiplier()` — Returns multiplier based on streak length
- `getHeartsInfo()` — Calculates current hearts with time-based regeneration
- Quest type config, gem shop items, practice streak calculations

### Gamification Hook (`src/hooks/useGamification.ts`)
- Fetches daily quests and practice calendar from Supabase
- Exposes: gems, hearts, heartsInfo, streakMultiplier, league, leagueXp, quests, practiceCalendar
- Methods: fetchQuests, fetchCalendar, updateQuestProgress, purchaseItem

---

## 5. Frontend Design Improvements

### Design System Updates (`tailwind.config.ts`)
- New keyframe animations: `confetti-fall`, `streak-fire`, `gem-sparkle`, `slide-up`, `number-pop`
- Mapped animation utilities for each keyframe
- Added `backdropBlur.xs` for subtle glass effects

### CSS Utilities (`src/index.css`)
- Glass card utilities: `.glass` (60% opacity, 20px blur) and `.glass-strong` (80% opacity, 30px blur)
- CSS custom properties for gradients, shadows, and glass effects
- 3D card hover effect (desktop only, disabled on mobile for performance)
- iOS safe area support, momentum scrolling, keyboard fixes

### Skeleton Loading States (`src/components/ui/SkeletonCard.tsx`)
- `SkeletonCard` — Configurable lines count, optional avatar placeholder
- `SkeletonStat` — Stat card skeleton for dashboard
- `SkeletonList` — Repeated list item skeletons for leaderboard/lists
- Replaces all "Loading..." text with proper animated skeletons

### Page Transitions (`src/App.tsx`)
- `AnimatePresence` wrapper with `mode="wait"` for route transitions
- Fade + slide animation (opacity 0→1, y 8→0) on route change
- 150ms duration with easeOut easing

### Gamification UI Components (8 new files in `src/components/gamification/`)
- **`DailyQuests.tsx`** — 3 quest cards with progress bars, gem reward badges, completion checkmarks
- **`LeagueWidget.tsx`** — Current league badge with color accent, weekly XP display
- **`GemsDisplay.tsx`** — Gem count with sparkle animation on hover
- **`HeartsDisplay.tsx`** — Heart icons with live regeneration timer countdown
- **`StreakCalendar.tsx`** — 30-day heat map grid showing practice intensity
- **`XPMultiplierBanner.tsx`** — Active streak multiplier display with fire animation
- **`CelebrationOverlay.tsx`** — Full-screen confetti overlay with emoji, title, and subtitle
- **`StreakFreezeDialog.tsx`** — Purchase dialog showing gem balance and confirmation

### Dashboard Redesign (`src/pages/Dashboard.tsx`)
- Gems and hearts display in compact header pills
- XP multiplier banner when streak bonus is active
- League widget showing current tier and weekly XP
- Daily quests section with 3 interactive quest cards
- Streak calendar heat map at bottom
- Existing quick actions grid preserved

### AppShell Header (`src/components/AppShell.tsx`)
- Amber pill showing gem count with diamond emoji
- Red pill showing heart count with filled heart icon
- Pro crown badge
- Settings gear link

### Profile Page Enhancement (`src/pages/Profile.tsx`)
- League badge and XP multiplier tags in profile header
- Stats grid expanded: Total XP, Day Streak, Daily Goal, Hearts, Gems, Streak Freezes
- Subscription display shows actual tier name (Basic/Pro/VIP) instead of just Pro/Free
- isPro check updated to `subscription_tier !== 'free'` (includes basic, pro, vip)

### Leaderboard Improvements (`src/pages/Leaderboard.tsx`)
- Tries materialized view first for faster load
- League icons displayed next to usernames
- Skeleton loading states instead of blank screen
- Top 3 podium with league badges

---

## 6. Edge Function Rebuild

### Shared Middleware (`supabase/functions/_shared/middleware.ts`)
- `handleCORS(req)` — CORS from env var, returns preflight response or null
- `verifyAuth(req)` — JWT verification via Supabase, returns user object
- `verifyCronAuth(req)` — Strict Bearer token match for cron jobs
- `checkRateLimit(userId, max, windowMs)` — Per-user in-memory rate limiting
- `getSafeOrigin()` — Safe redirect URL from env var
- `getAdminClient()` — Supabase service-role client
- `jsonResponse()`, `errorResponse()` — Standardized response helpers
- `log()` — Structured logging with function name and context
- `requireString()`, `requireArray()` — Input validation helpers
- `HttpError` class for typed error handling

### AI Config (`supabase/functions/_shared/ai-config.ts`)
- `AI_MODELS` — fast (Haiku), standard (Sonnet) model IDs
- `MODEL_CONFIG` — Per-function settings (model, max_tokens, system prompt hints)
- `SUMMARIZATION_THRESHOLD` (10 messages), `MESSAGES_TO_KEEP_FULL` (6 messages)
- Helper functions for conversation summarization

### Rebuilt Functions (8)
| Function | Key Changes |
|----------|-------------|
| `chat` | Sonnet model, dynamic tokens (512), conversation summarization, usage logging |
| `tutor-message` | Sonnet model, summarization, subscription check includes VIP |
| `writing-feedback` | Sonnet model, dynamic tokens (1024), usage logging |
| `reading-help` | Response caching, usage logging, auth required |
| `check-subscription` | Profile cache fast path, Stripe fallback, cache update |
| `create-checkout` | Price ID whitelist, safe origin redirect |
| `customer-portal` | Safe origin redirect, sanitized errors |
| `news-sync` | Strict cron auth via `verifyCronAuth()` |

### New Functions (4)
| Function | Purpose |
|----------|---------|
| `stripe-webhook` | Caches subscription state on profile, handles create/update/delete events |
| `daily-quests` | Generate 3 daily quests, update progress, award gems/XP on completion |
| `league-update` | Weekly cron: promote top 20%, demote bottom 20%, reset league XP |
| `gems-transaction` | Balance check, gem purchases (streak freeze, hearts, double XP), history |

---

## 7. Database Migrations Summary

| Migration | Purpose |
|-----------|---------|
| `005_security_rls.sql` | Granular RLS policies replacing FOR ALL |
| `006_indexes_scalability.sql` | Performance indexes + leaderboard materialized view |
| `007_gamification.sql` | Gamification tables, columns, and SQL functions |
| `008_rls_fixes.sql` | RLS on ai_response_cache, ai_usage_log, achievements, srs_cards, srs_reviews |
| `009_add_gems_function.sql` | `add_gems()` SQL function for safe gem incrementing |

---

## 8. Bundle Optimization

### Before (v1)
- Single monolithic bundle: ~705 KB

### After (v2)
| Chunk | Size | Contents |
|-------|------|----------|
| `vendor` | 163 KB | React, React DOM, React Router |
| `supabase` | 176 KB | Supabase JS client |
| `ui` | 206 KB | Framer Motion, Radix UI primitives |
| `index` | 200 KB | Application code |
| 17 lazy chunks | 2-53 KB each | Individual page routes |

No chunk exceeds the 500 KB warning threshold.

---

## Files Changed / Created

### New Files (30+)
- `src/lib/validation.ts`
- `src/lib/gamification.ts`
- `src/hooks/useGamification.ts`
- `src/components/ui/SkeletonCard.tsx`
- `src/components/gamification/DailyQuests.tsx`
- `src/components/gamification/LeagueWidget.tsx`
- `src/components/gamification/GemsDisplay.tsx`
- `src/components/gamification/HeartsDisplay.tsx`
- `src/components/gamification/StreakCalendar.tsx`
- `src/components/gamification/XPMultiplierBanner.tsx`
- `src/components/gamification/CelebrationOverlay.tsx`
- `src/components/gamification/StreakFreezeDialog.tsx`
- `supabase/functions/_shared/middleware.ts`
- `supabase/functions/_shared/ai-config.ts`
- `supabase/functions/stripe-webhook/index.ts`
- `supabase/functions/daily-quests/index.ts`
- `supabase/functions/league-update/index.ts`
- `supabase/functions/gems-transaction/index.ts`
- `supabase/migrations/005_security_rls.sql`
- `supabase/migrations/006_indexes_scalability.sql`
- `supabase/migrations/007_gamification.sql`
- `supabase/migrations/008_rls_fixes.sql`
- `supabase/migrations/009_add_gems_function.sql`
- `.env.example`
- `.gitignore`

### Modified Files (15+)
- `src/lib/supabase.ts` — Env vars
- `src/lib/claude.ts` — Session token auth
- `src/App.tsx` — Code splitting, page transitions, React Query config
- `src/pages/Dashboard.tsx` — Gamification widgets
- `src/pages/Profile.tsx` — League, gems, streak freezes
- `src/pages/Leaderboard.tsx` — Materialized view, skeletons, league icons
- `src/pages/TutorPage.tsx` — Session token auth
- `src/pages/DrivingModePage.tsx` — Session token auth
- `src/components/AppShell.tsx` — Gems/hearts header
- `src/hooks/useUserPlan.ts` — Profile cache fast path
- `src/index.css` — Glass utilities, safe areas
- `tailwind.config.ts` — Animations, blur
- `vite.config.ts` — Manual chunks
- `index.html` — CSP, meta cleanup
- All 8 existing edge functions — Shared middleware, model changes
