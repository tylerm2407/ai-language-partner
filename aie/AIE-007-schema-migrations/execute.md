# AIE-007 — Schema Migrations — Execute

## Files Created

- `supabase/migrations/003_reading_writing_content.sql` — Tables: `reading_passages`, `reading_annotations`, `reading_questions`, `writing_prompts`, `user_writing_submissions`, `user_reading_progress`; expanded exercise types; daily stats columns; `increment_daily_stats()` function
- `supabase/migrations/004_security_and_scalability.sql` — RLS policies on all tables; `increment_xp()`, `increment_daily_usage()` functions; performance indexes

## Files Deleted

- `supabase/migrations/003_voice_sessions.sql` — Voice session tables no longer needed
- `supabase/migrations/004_scenarios_tutor_profiles.sql` — Scenario/tutor tables no longer needed
- `supabase/migrations/005_reading_writing_speaking.sql` — Superseded by new 003/004

## Verification

- [x] Migration 003 creates all 6 new tables with correct columns and foreign keys
- [x] Migration 003 expands exercise type enum
- [x] Migration 003 `increment_daily_stats()` function works
- [x] Migration 004 enables RLS on all user-data tables
- [x] Migration 004 creates atomic increment functions
- [x] Migration 004 adds performance indexes
- [x] Migrations apply cleanly in sequence (003 then 004)
