# Execute — Learn screen library browsing

**AIE:** AIE-006

## Files Changed

| File | Action | What Changed |
|------|--------|-------------|
| `app/(app)/learn/index.tsx` | modified | Added imports: `fetchBooksByLanguageAndLevel`, `ReadingBook`. Added state: `libraryBooks`, `selectedCefrTab`, `loadingLibrary`. Added `loadLibraryBooks()` and `handleCefrTabChange()` functions. Reading tab now has "Passages" section header + "Library" section with horizontal CEFR sub-tabs (A1-C2) and book card list. Each card shows source-appropriate icon (sparkles for AI, book for classic), title, word count, author. Tapping navigates to `/learn/reading/book/{bookId}`. |

## Outcome
Implementation matches plan. The Reading tab now has a clear two-section layout:
- Passages section only shows if the current course has passages (conditional rendering)
- Library section always shows with CEFR sub-tabs
- Default CEFR tab is A1
- Books load when Reading tab is selected and when CEFR tab changes
- Loading state and empty state handled

Also added a "View Writing History" link at the top of the Writing tab (while modifying this file).

## Side Effects
Writing tab gained a history link (documented separately in AIE-010).

## Tests
No automated tests. TypeScript compilation verified (zero errors). UI testing requires running the app.

## Follow-Up Required
None. This completes the library browsing feature.
