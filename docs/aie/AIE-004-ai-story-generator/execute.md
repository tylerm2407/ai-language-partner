# Execute — AI story generation edge function

**AIE:** AIE-004

## Files Changed

| File | Action | What Changed |
|------|--------|-------------|
| `supabase/functions/generate-story/index.ts` | created | Full edge function: auth, CORS, Anthropic API call with CEFR-constrained system prompt, DB insert for books + annotations, 5-story cap, error handling |

## Outcome
Implementation matches plan. Created via background agent. The function:
- Authenticates users via `getAuthenticatedUser()`
- Validates `language` and `cefrLevel` inputs
- Constructs a system prompt with CEFR-specific word count ranges and cultural nativity instructions
- Calls Claude Haiku with `max_tokens: 2000` and `cache_control: ephemeral` on the system prompt
- Parses JSON response, calculates word count, inserts book + annotations
- Loops for `count` stories (capped at 5)
- Returns `{ bookIds: string[] }`

Language names mapped for 8 languages: es, fr, de, it, pt, ja, ko, zh.

## Side Effects
None. New file only. Does not affect existing edge functions.

## Tests
No automated tests. Edge function designed to be tested via Supabase function invocation or curl.

## Follow-Up Required
- [x] AIE-012: Seed script to bulk-generate initial story library
- [ ] Deploy via `npx supabase functions deploy generate-story`
