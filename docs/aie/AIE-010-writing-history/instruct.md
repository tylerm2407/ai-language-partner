# Instruct — Writing history screen

**AIE:** AIE-010

## Directive
> "Create app/(app)/learn/writing/history.tsx: Fetch all user writing submissions via fetchAllUserWritingSubmissions(). Group by prompt_id. Display each prompt with best score, attempt count, most recent date. Color-coded score circle (green ≥80, yellow ≥60, red <60). Add 'View Writing History' link to the Writing tab in app/(app)/learn/index.tsx. Add fetchAllUserWritingSubmissions() to lib/supabase-queries.ts."

## Context Provided
- `lib/supabase-queries.ts` — existing query functions, mapWritingSubmission mapper
- `app/(app)/learn/index.tsx` — existing learn screen with Vocab/Reading/Writing tabs
- `types/index.ts` — WritingSubmission type with attemptNumber field (from AIE-001)
- `DESIGN.md` — color tokens, card styles, typography

## Scope
IN scope: Writing history screen, query function, link from Writing tab
OUT of scope: Detailed per-attempt view, filtering by CEFR level, writing analytics dashboard
