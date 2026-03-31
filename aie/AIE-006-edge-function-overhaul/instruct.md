# AIE-006 — Edge Function Overhaul — Instruct

> *This is a retroactive AIE entry. The directive below is reconstructed from the implemented changes, not captured at the time of implementation.*

## Directive

### Create shared utilities (`supabase/functions/_shared/`)

1. **auth.ts** — JWT verification, user extraction, Supabase client initialization
2. **cors.ts** — Standard CORS headers and preflight handling
3. **plan-limits.ts** — Subscription tier checking and rate limit enforcement
4. **validation.ts** — Request body parsing and schema validation helpers

### Create new function

- **grade-writing** — Accepts writing submission, calls Claude Haiku for structured feedback (grammar, vocabulary, coherence, suggestions), returns graded result

### Modify existing functions

- `ai-chat` — Use shared auth/CORS/plan-limits
- `create-checkout` — Use shared auth/CORS
- `get-hint` — Use shared auth/CORS/plan-limits
- `score-pronunciation` — Use shared auth/CORS/plan-limits
- `stripe-webhook` — Use shared CORS/validation

### Delete deprecated functions

- `ai-usage-check` — Replaced by plan-limits
- `news-sync` — Feature removed
- `reading-help` — Replaced by reading module
- `tutor-message` — Feature removed
- `voice-token` — Feature removed
- `writing-feedback` — Replaced by grade-writing

## Constraints

- All functions must handle CORS preflight (OPTIONS) consistently
- Auth failures return 401, not 403
- Plan limit errors return 429 with upgrade messaging
- `grade-writing` uses Claude Haiku (cost-efficient) not Sonnet/Opus
