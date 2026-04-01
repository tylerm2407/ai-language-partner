# Instruct — Learn screen library browsing

**AIE:** AIE-006

## Directive
> "Modify the existing Reading tab in app/(app)/learn/index.tsx to show two sections: 1) Passages (existing short passages) 2) Library — browsable book library organized by CEFR level sub-tabs (A1/A2/B1/B2/C1/C2). Each book card shows title, author, word count, CEFR badge, source icon. Load books via fetchBooksByLanguageAndLevel using profile.targetLanguage. Add Library section after passages. Add CEFR sub-tab selector. Add import for fetchBooksByLanguageAndLevel and ReadingBook type."

## Context Provided
- `app/(app)/learn/index.tsx` — existing Learn screen with Vocab/Reading/Writing tabs
- `lib/supabase-queries.ts` — `fetchBooksByLanguageAndLevel()` function
- `types/index.ts` — ReadingBook type
- `DESIGN.md` — tab styles, card patterns, color tokens

## Scope
IN scope: Reading tab modification, CEFR sub-tabs, book card list, navigation to book detail
OUT of scope: Search/filter within library, pagination/infinite scroll, favorites/bookmarks
