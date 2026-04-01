# Instruct — Reading & Writing database schema expansion

**AIE:** AIE-001

## Directive
> "Implement the following plan: Phase 1 — Data Layer (New DB tables + types). Create migration 012_reading_writing_expansion.sql with new tables reading_books, user_book_progress, book_annotations. ALTER writing_prompts to add scaffold_type, scaffold_data, max_attempts. ALTER user_writing_submissions to add attempt_number. Add RLS policies. Update types/index.ts with ReadingBook, UserBookProgress, BookAnnotation interfaces. Update WritingPrompt with scaffoldType, scaffoldData, maxAttempts. Update WritingFeedback with correctedVersion, strengths, improvements. Update WritingSubmission with attemptNumber. Add query functions to lib/supabase-queries.ts."

## Context Provided
- Full plan document with exact SQL DDL for all tables
- `types/index.ts` — existing type definitions (ReadingPassage, WritingPrompt, WritingSubmission, WritingFeedback)
- `lib/supabase-queries.ts` — existing query functions and mapper patterns
- `supabase/migrations/001_initial_schema.sql` — original schema showing cards table has NOT NULL course_id
- `DESIGN.md` — design system reference
- Existing migration files 001-011

## Scope
IN scope: Migration SQL, TypeScript types, Supabase query functions, mapper functions, migration application via MCP
OUT of scope: UI components, edge functions, seed data (handled in later AIEs)
