# Instruct — Book reader UI + book detail screen

**AIE:** AIE-005

## Directive
> "Create components/reading/BookReader.tsx — paginated reader for long-form content. Features: paginate by screen height, page indicator, tap word to look up in book_annotations with WordTooltip reuse, auto-save position on page change (debounced), 'Add to review' from tooltip, progress bar, font size control. Create app/(app)/learn/reading/book/[bookId].tsx — book detail screen with title, author, description, word count, CEFR badge, progress, 'Continue Reading' / 'Start Reading' button. Award XP on completion: wordCount/10 capped at 500. Create _layout.tsx for the book route."

## Context Provided
- `components/reading/ReadingPassageViewer.tsx` — existing short passage viewer (pattern reference)
- `components/reading/WordTooltip.tsx` — existing tooltip component
- `types/index.ts` — ReadingBook, BookAnnotation, UserBookProgress types
- `lib/supabase-queries.ts` — fetchBookById, fetchBookAnnotations, upsertBookProgress, addXp
- `DESIGN.md` — color palette, spacing, component patterns
- `supabase/migrations/001_initial_schema.sql` — cards table has NOT NULL course_id constraint

## Scope
IN scope: BookReader component, book detail screen, _layout.tsx, XP awards, position tracking, word tooltips
OUT of scope: Audio playback for books, offline reading, bookmark system
