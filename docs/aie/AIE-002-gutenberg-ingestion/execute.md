# Execute — Gutenberg content ingestion service

**AIE:** AIE-002

## Files Changed

| File | Action | What Changed |
|------|--------|-------------|
| `lib/gutenberg.ts` | created | 3 exported functions: `searchGutenbergBooks()`, `fetchGutenbergText()`, `ingestGutenbergBook()`. Internal helper `stripGutenbergBoilerplate()`. Language map, GutenbergBook/GutenbergSearchResult interfaces. |

## Outcome
Implementation matches plan. Created via background agent to parallelize with other work. The file:
- Searches via `https://gutendex.com/books/?languages={lang}&topic={topic}&page={page}`
- Fetches text from the `text/plain; charset=utf-8` format URL with fallbacks
- Strips boilerplate using `*** START OF` / `*** END OF` regex markers
- Detects chapter breaks with multilingual patterns (CHAPTER, Chapitre, Kapitel, CAPITULO)
- Inserts into `reading_books` with `source='gutenberg'`, auto-calculated word count, tags=['classic', 'literature']

## Side Effects
None. New file only, no modifications to existing code.

## Tests
No automated tests. Functions are designed to be called from the seed script or admin tooling.

## Follow-Up Required
- [x] AIE-012: Content seed script to orchestrate batch ingestion
