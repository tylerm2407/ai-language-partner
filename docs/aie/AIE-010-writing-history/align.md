# Align — Writing history screen

**AIE:** AIE-010
**Date:** 2026-03-31
**Severity:** moderate
**Domain:** mobile

## Problem
After submitting writing exercises, learners have no way to review their past submissions, scores, or feedback. There's no writing history accessible from the Writing tab — once you leave the feedback screen, the results are gone unless you query the database directly.

## Decision
Create `app/(app)/learn/writing/history.tsx` — a new screen accessible from the Writing tab header that:
1. Fetches all user writing submissions via `fetchAllUserWritingSubmissions()`
2. Groups submissions by prompt (using `prompt_id`)
3. Displays each prompt with its best score, attempt count, and most recent date
4. Shows a color-coded score circle (green ≥80, yellow ≥60, red <60)
5. Tapping a prompt could expand to show all attempts (future enhancement)

Also add a "View Writing History" link to the Writing tab in `app/(app)/learn/index.tsx`.

## Why This Approach
Learners need visibility into their writing progress over time. Grouping by prompt (rather than a flat list of submissions) keeps the UI clean and highlights improvement across attempts — which ties directly into the resubmission flow (AIE-009).

Alternative considered: Inline history within each prompt's screen. Rejected because learners want a centralized view across all prompts, not just the current one.

## Impact
- New screen: `app/(app)/learn/writing/history.tsx`
- Modified: `app/(app)/learn/index.tsx` (add link to history)
- New query: `fetchAllUserWritingSubmissions()` in `lib/supabase-queries.ts`

## Success Criteria
- Writing tab shows "View Writing History" link
- History screen lists all submitted prompts with best score and attempt count
- Score circles use correct color coding
- Empty state shown if no submissions exist
