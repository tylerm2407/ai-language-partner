# Instruct — Reading & writing achievements

**AIE:** AIE-011

## Directive
> "Add 6 new achievement types to lib/achievements.ts: first_story (1 completed book), bookworm_5 (5 books), bookworm_25 (25 books), first_essay (1 writing submission), writer_10 (10 submissions), perfect_essay (score 90+). Add definitions with icons and colors. Add DB-query-based conditions in checkAndAwardAchievements() that count from user_book_progress (completed_at IS NOT NULL) and user_writing_submissions tables."

## Context Provided
- `lib/achievements.ts` — existing achievement system with types, definitions, and checkAndAwardAchievements()
- `supabase/migrations/012_reading_writing_expansion.sql` — user_book_progress and book_annotations tables (AIE-001)
- Existing achievement types for vocabulary and streaks as pattern reference

## Scope
IN scope: 6 new achievement types, definitions, DB-query conditions
OUT of scope: Achievement UI changes, push notifications for achievements, achievement sharing
