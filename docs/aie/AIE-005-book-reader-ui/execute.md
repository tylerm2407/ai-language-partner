# Execute — Book reader UI + book detail screen

**AIE:** AIE-005

## Files Changed

| File | Action | What Changed |
|------|--------|-------------|
| `components/reading/BookReader.tsx` | created | Paginated reader: content split by character count (~1200 chars at 16px, scaled inversely with font size), word-boundary-aware pagination, annotation map (Map<lowercase_word, BookAnnotation>), tap-to-translate with inline BookWordTooltip, debounced position save (500ms), font size controls (5 sizes: 14-22px), page navigation buttons, progress bar, completion detection on last page |
| `app/(app)/learn/reading/book/[bookId].tsx` | created | Book detail screen: parallel data loading (book + annotations + progress via Promise.all), CEFR badge + source type badge, stats row (words, reading time, XP reward), progress bar for in-progress books, completion badge, "Add to Review" creates SRS card by looking up active course for book's language, XP award on completion (wordCount/10, capped at 500), isReading toggle between detail/reader view |
| `app/(app)/learn/reading/book/_layout.tsx` | created | Stack navigator layout with slide_from_right animation |

## Outcome
Implementation matches plan with one key discovery: the `cards` table has `course_id NOT NULL`, so the "Add to Review" function couldn't pass null. Resolved by querying for the user's published course matching the book's language: `supabase.from('courses').select('id').eq('target_language', book.language).eq('is_published', true).limit(1).single()`.

Also fixed a TypeScript JSX namespace issue — BookReader needed `import React` for `React.JSX.Element[]` type annotation (the codebase doesn't have a global JSX namespace configured).

## Side Effects
None beyond the new files. Existing reading flow (passages) unaffected.

## Tests
No automated tests. TypeScript compilation verified (zero errors in new files). UI testing requires running the app.

## Follow-Up Required
- [x] AIE-006: Learn screen library browsing (to navigate to book detail)
