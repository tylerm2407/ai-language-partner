# AIE-006 — Edge Function Overhaul — Execute

## Files Created

- `supabase/functions/_shared/auth.ts` — JWT verification, user extraction, Supabase client init
- `supabase/functions/_shared/cors.ts` — Standard CORS headers and preflight handler
- `supabase/functions/_shared/plan-limits.ts` — Subscription tier checking and rate limiting
- `supabase/functions/_shared/validation.ts` — Request body parsing and validation helpers
- `supabase/functions/grade-writing/index.ts` — Writing grading via Claude Haiku

## Files Modified

- `supabase/functions/ai-chat/index.ts` — Refactored to use shared auth/CORS/plan-limits
- `supabase/functions/create-checkout/index.ts` — Refactored to use shared auth/CORS
- `supabase/functions/get-hint/index.ts` — Refactored to use shared auth/CORS/plan-limits
- `supabase/functions/score-pronunciation/index.ts` — Refactored to use shared auth/CORS/plan-limits
- `supabase/functions/stripe-webhook/index.ts` — Refactored to use shared CORS/validation

## Files Deleted

- `supabase/functions/ai-usage-check/index.ts` — Replaced by plan-limits shared utility
- `supabase/functions/news-sync/index.ts` — Feature removed
- `supabase/functions/reading-help/index.ts` — Replaced by reading module
- `supabase/functions/tutor-message/index.ts` — Feature removed
- `supabase/functions/voice-token/index.ts` — Feature removed
- `supabase/functions/writing-feedback/index.ts` — Replaced by grade-writing

## Verification

- [x] All surviving functions use `_shared/` utilities
- [x] `grade-writing` function created with Claude Haiku integration
- [x] 6 deprecated functions removed
- [x] CORS preflight handled consistently across all functions
- [x] Plan-based rate limiting active on AI endpoints
