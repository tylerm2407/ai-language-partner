# Align — Reading & Writing database schema expansion

**AIE:** AIE-001
**Date:** 2026-03-31
**Severity:** major
**Domain:** database

## Problem
Fluenci has basic reading passages and writing prompts, but no way to store long-form reading content (books, stories) from external sources, track a user's reading position within a book, or support scaffolded writing exercises with multiple attempts. The existing `reading_passages` table only handles short passages; there's no book-length content support. Writing prompts lack scaffold metadata (fill-blank, sentence frames) and submissions don't track attempt numbers for resubmission flows.

## Decision
Create 3 new tables and alter 2 existing ones in a single migration:
- **`reading_books`** — stores long-form content from Gutenberg, Wikisource, and AI-generated stories with source tracking, CEFR level, chapter breaks, and word count
- **`user_book_progress`** — tracks per-user reading position (character index), percent complete, time spent, and words looked up with a UNIQUE(user_id, book_id) constraint
- **`book_annotations`** — word/phrase definitions for books with UNIQUE(book_id, word_or_phrase) to prevent duplicates
- **ALTER `writing_prompts`** — add `scaffold_type` (fill_blank, sentence_frame, guided_paragraph, essay, academic, free), `scaffold_data` (JSONB), and `max_attempts` columns
- **ALTER `user_writing_submissions`** — add `attempt_number` column for resubmission tracking

Enable RLS on all new tables. Content tables are read-only for authenticated users; progress tables are user-owns-their-data.

Also update TypeScript types (`types/index.ts`) and add 7 new Supabase query functions + 3 new mappers to `lib/supabase-queries.ts`.

## Why This Approach
A single migration ensures all tables exist atomically — no partial state where the app references a table that doesn't exist yet. The `reading_books` table is source-agnostic (supports Gutenberg, Wikisource, and AI stories via a `source` CHECK constraint) rather than having separate tables per source. This simplifies querying and the UI only needs one book list.

Alternative considered: Extending the existing `reading_passages` table with new columns. Rejected because passages are course-linked (have `course_id`), while books are language-linked (have `language`). Different data models serving different purposes.

Alternative considered: Separate tables for each book source. Rejected because the reader UI needs a unified query and the data shape is identical across sources.

## Impact
- Enables Phases 2-6 of the reading/writing expansion plan
- New tables indexed on (language, cefr_level) for efficient library browsing
- Writing prompts gain scaffold flexibility without breaking existing prompts (defaults to 'free')
- Existing writing submissions unaffected (attempt_number defaults to 1)
- All new RLS policies follow the established pattern

## Success Criteria
- All 3 tables created with correct constraints and indexes
- RLS enabled and policies active on all new tables
- `scaffold_type`, `scaffold_data`, `max_attempts` columns exist on `writing_prompts`
- `attempt_number` column exists on `user_writing_submissions`
- TypeScript types compile without errors
- All 7 new query functions are callable
