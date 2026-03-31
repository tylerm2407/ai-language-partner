# AIE-007 — Schema Migrations — Align

## Problem

The database lacked tables for the new reading and writing modules. Existing tables didn't support the expanded exercise types. There were no RLS policies on new tables, no performance indexes, and no database-side functions for atomic stat/XP updates.

## Business Context

This is a **critical** change — schema migrations are irreversible in production and affect every user. The reading/writing content tables (`reading_passages`, `reading_questions`, `writing_prompts`) enable the new learning modules. RLS policies are mandatory before launch for data isolation. Performance indexes prevent slow queries at scale. Database functions (`increment_xp`, `increment_daily_stats`, `increment_daily_usage`) prevent race conditions on concurrent updates.

## Success Criteria

- Migration 003: All reading/writing content tables created with proper foreign keys
- Migration 003: Exercise type enum expanded, daily stats columns added
- Migration 004: RLS policies on all new and existing tables
- Migration 004: Database functions for atomic increments
- Migration 004: Performance indexes on frequently queried columns
- Both migrations apply cleanly in sequence
