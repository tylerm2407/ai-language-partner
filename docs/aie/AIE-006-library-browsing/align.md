# Align — Learn screen library browsing

**AIE:** AIE-006
**Date:** 2026-03-31
**Severity:** moderate
**Domain:** mobile

## Problem
The Reading tab on the Learn screen only shows short passages from the current course. There's no way for users to discover or browse the reading library (books, AI stories, Gutenberg/Wikisource content). Users need a way to browse available books filtered by CEFR level.

## Decision
Modify the existing Reading tab in `app/(app)/learn/index.tsx` to show two sections:
1. **Passages** (existing) — short reading passages from the current course, unchanged
2. **Library** (new) — browsable book library with CEFR level sub-tabs (A1/A2/B1/B2/C1/C2)

Each book card shows: title, source icon (sparkles for AI, book for classic), word count, author (if available). Tapping navigates to `/learn/reading/book/{bookId}`.

CEFR sub-tabs load books via `fetchBooksByLanguageAndLevel()` using the user's `targetLanguage` from their profile.

## Why This Approach
Adding the library as a section within the existing Reading tab keeps navigation simple — no new tab needed. CEFR sub-tabs let users quickly find level-appropriate content without scrolling through everything.

Alternative considered: Separate "Library" tab in bottom navigation. Rejected because we're at the 5-tab limit (Home, Learn, Review, Practice, Profile) and adding a 6th violates iOS HIG.

Alternative considered: Single flat list sorted by CEFR. Rejected because mixing A1 stories with C2 literature is confusing and requires excessive scrolling.

## Impact
- Modified `app/(app)/learn/index.tsx` — new state variables, new imports, new Library section in Reading tab
- New import of `fetchBooksByLanguageAndLevel` from queries
- New import of `ReadingBook` type
- Depends on user's `profile.targetLanguage` for language filtering

## Success Criteria
- Reading tab shows "Passages" section (if any exist) followed by "Library" section
- CEFR level sub-tabs (A1-C2) filter library books by level
- Tapping a book card navigates to book detail screen
- Loading state shown while fetching books
- Empty state shown if no books available for selected level
