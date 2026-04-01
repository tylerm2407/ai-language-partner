# Execute — Reading & Writing database schema expansion

**AIE:** AIE-001

## Files Changed

| File | Action | What Changed |
|------|--------|-------------|
| `supabase/migrations/012_reading_writing_expansion.sql` | created | 3 new tables (reading_books, user_book_progress, book_annotations), 2 ALTER TABLEs, 4 indexes, RLS + 5 policies |
| `types/index.ts` | modified | Added `ScaffoldType`, `BookSource`, `ReadingBook`, `UserBookProgress`, `BookAnnotation` types. Updated `WritingPrompt` (+scaffoldType, scaffoldData, maxAttempts), `WritingFeedback` (+correctedVersion, strengths, improvements), `WritingSubmission` (+attemptNumber) |
| `lib/supabase-queries.ts` | modified | Added 7 new functions: `fetchBooksByLanguageAndLevel()`, `fetchBookById()`, `fetchBookAnnotations()`, `upsertBookProgress()`, `fetchUserBookProgress()`, `fetchWritingSubmissionsByPrompt()`, `fetchAllUserWritingSubmissions()`. Added 3 mappers: `mapReadingBook()`, `mapUserBookProgress()`, `mapBookAnnotation()`. Updated `mapWritingPrompt()` (+scaffold fields), `mapWritingSubmission()` (+attemptNumber), `submitWriting()` (+attemptNumber param). Updated imports. |

## Outcome
Migration applied successfully via Supabase MCP `apply_migration` tool. All tables created. TypeScript type check passes with zero new errors from modified files. All query functions follow established patterns (snake_case DB -> camelCase TS mappers).

One key discovery: the `cards` table has `course_id NOT NULL`, which meant the book reader's "add to review" feature couldn't pass null for course_id. This was deferred to AIE-005 where it was resolved by looking up the user's active course for the book's language.

## Side Effects
- Existing `writing_prompts` rows gain default values: `scaffold_type='free'`, `scaffold_data='{}'`, `max_attempts=3`
- Existing `user_writing_submissions` rows gain `attempt_number=1`
- No breaking changes to existing functionality

## Tests
No automated tests added. Migration verified via MCP tool success response. Type compilation verified via `npx tsc --noEmit` (zero new errors in modified files).

## Follow-Up Required
- [x] AIE-002: Gutenberg ingestion service
- [x] AIE-003: Wikisource ingestion service
- [x] AIE-004: AI story generation edge function
- [x] AIE-005: Book reader UI
- [x] AIE-007: Enhanced writing grading
- [x] AIE-008: Scaffolded writing prompts
