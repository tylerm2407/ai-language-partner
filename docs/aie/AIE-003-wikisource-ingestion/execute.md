# Execute — Wikisource content ingestion service

**AIE:** AIE-003

## Files Changed

| File | Action | What Changed |
|------|--------|-------------|
| `lib/wikisource.ts` | created | 3 exported functions: `searchWikisourceTexts()`, `fetchWikisourceText()`, `ingestWikisourceText()`. Internal helper `stripWikiMarkup()`. WikiSearchResult interface. |

## Outcome
Implementation matches plan. Created via background agent. The markup stripper handles:
- Templates `{{...}}`
- Categories `[[Category:...]]` (multilingual: Categoría, Catégorie, Kategorie)
- Wiki links `[[text|display]]` → display text
- Bold/italic markers `'''/''`
- Section headers `== Header ==` → plain text
- HTML tags
- References `<ref>...</ref>`
- Extra whitespace cleanup

Uses `origin=*` parameter for CORS compatibility.

## Side Effects
None. New file only.

## Tests
No automated tests. Designed for use from seed script and admin tooling.

## Follow-Up Required
- [x] AIE-012: Content seed script
