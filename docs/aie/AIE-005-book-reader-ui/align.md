# Align — Book reader UI + book detail screen

**AIE:** AIE-005
**Date:** 2026-03-31
**Severity:** major
**Domain:** mobile

## Problem
The app has no way to display long-form reading content. The existing `ReadingPassageViewer` shows short passages on a single screen, but books with thousands of words need pagination, position saving, and a separate detail/landing screen before reading begins. Users need font size controls, page navigation, and the ability to tap words for translations — all while tracking their progress.

## Decision
Create two new components/screens:

1. **`components/reading/BookReader.tsx`** — Paginated reader that:
   - Splits content by character count (scaled to font size) into pages
   - Doesn't cut mid-word (finds last space before page break)
   - Shows page indicator ("Page 3 of 47") and progress bar
   - Supports tap-to-translate using `book_annotations` data
   - Auto-saves reading position via debounced callback (500ms)
   - Font size control (14/16/18/20/22px)
   - "Add to Review" from word tooltip to create SRS cards
   - Triggers completion callback on last page

2. **`app/(app)/learn/reading/book/[bookId].tsx`** — Book detail screen that:
   - Shows title, author, description, CEFR badge, source type badge
   - Displays stats: word count, estimated reading time (~200 wpm), XP reward
   - Shows progress bar if book is started but not completed
   - Shows completion badge if finished
   - "Start Reading" / "Continue Reading" / "Read Again" button
   - Awards XP on completion: `wordCount / 10` capped at 500

## Why This Approach
Character-based pagination (not chapter-based) gives smooth reading UX regardless of content structure. Debounced position saves prevent excessive DB writes during page-flipping. The detail screen follows the established app pattern where you see info before committing to an activity.

Alternative considered: Infinite scroll instead of pagination. Rejected because pagination gives a clearer sense of progress and makes position saving deterministic.

Alternative considered: Using the existing ReadingPassageViewer. Rejected because it's designed for short passages with index-based annotations and doesn't support pagination or position tracking.

## Impact
- 2 new files: BookReader component + book detail screen
- 1 new layout file: `app/(app)/learn/reading/book/_layout.tsx`
- Depends on `reading_books`, `book_annotations`, `user_book_progress` tables (AIE-001)
- Uses `upsertBookProgress`, `fetchBookById`, `fetchBookAnnotations` queries (AIE-001)
- Card creation requires looking up user's active course for the book's language (discovered during implementation — `cards.course_id` is NOT NULL)

## Success Criteria
- Navigating to `/learn/reading/book/{bookId}` shows book detail with metadata
- Tapping "Start Reading" opens paginated reader at position 0
- Page navigation works, progress bar updates
- Tapping an annotated word shows translation tooltip
- Returning later resumes from saved position
- Completing the last page awards XP and marks book complete
