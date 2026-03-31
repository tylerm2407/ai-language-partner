# AIE-007 — Schema Migrations — Instruct

> *This is a retroactive AIE entry. The directive below is reconstructed from the implemented changes, not captured at the time of implementation.*

## Directive

### Migration 003 — Reading & Writing Content

Create tables:
- `reading_passages` — Stores reading passages with language, CEFR level, title, content, audio URL
- `reading_annotations` — User word annotations (tapped words, translations)
- `reading_questions` — Comprehension questions linked to passages
- `writing_prompts` — Writing prompt definitions with topic, instructions, min word count
- `user_writing_submissions` — User writing submissions with text, word count, duration, AI feedback
- `user_reading_progress` — Tracks user completion of reading passages

Additional:
- Expand exercise type enum to include `cloze`, `dictation`, `error_correction`, `sentence_construction`
- Add columns to `daily_stats` for reading/writing activity tracking
- Create `increment_daily_stats()` database function

### Migration 004 — Security & Scalability

- RLS policies on all tables (users can only read/write their own data)
- `increment_xp()` function for atomic XP updates
- `increment_daily_usage()` function for atomic usage tracking
- Performance indexes on: `user_id`, `language`, `next_due`, `created_at` across relevant tables

## Constraints

- Migrations must be idempotent where possible (use `IF NOT EXISTS`)
- RLS must be enabled on every table that stores user data
- Foreign keys must cascade on user deletion
- No `SECURITY DEFINER` functions unless absolutely necessary
