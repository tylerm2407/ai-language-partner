# Align — Reading & writing achievements

**AIE:** AIE-011
**Date:** 2026-03-31
**Severity:** moderate
**Domain:** mobile

## Problem
The existing achievement system only covers vocabulary and streak milestones. There are no achievements for reading or writing activities, which means learners get no recognition for completing books/stories or submitting writing exercises. This makes reading and writing feel less rewarding compared to vocabulary practice.

## Decision
Add 6 new achievement types to `lib/achievements.ts`:
1. `first_story` — Read your first story (1 completed book/story)
2. `bookworm_5` — Complete 5 books/stories
3. `bookworm_25` — Complete 25 books/stories
4. `first_essay` — Submit your first writing exercise
5. `writer_10` — Complete 10 writing exercises
6. `perfect_essay` — Score 90+ on a writing submission

Each achievement uses a DB-query-based condition in `checkAndAwardAchievements()` that counts from `user_book_progress` (where `completed_at IS NOT NULL`) and `user_writing_submissions`.

## Why This Approach
DB queries are the most reliable way to check achievement conditions — they reflect the actual state of the data regardless of how the user got there. Code-defined achievements (vs DB-driven) keep the system simple and avoid another migration just for achievement metadata.

Alternative considered: Event-based achievement triggers (fire achievement check on each completion event). Rejected because it's fragile — if the event is missed, the achievement is never awarded. Query-based is self-healing.

## Impact
- Modified: `lib/achievements.ts` (new types, definitions, and conditions)
- Uses: `user_book_progress` table (from AIE-001)
- Uses: `user_writing_submissions` table (existing)

## Success Criteria
- Completing first book triggers `first_story` achievement
- 5th book completion triggers `bookworm_5`
- First writing submission triggers `first_essay`
- Scoring 90+ triggers `perfect_essay`
- Achievement badges display correctly in the existing achievement grid
