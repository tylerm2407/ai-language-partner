# Align — Wikisource content ingestion service

**AIE:** AIE-003
**Date:** 2026-03-31
**Severity:** moderate
**Domain:** backend

## Problem
Gutenberg covers classic literature well but lacks essays, academic texts, and non-fiction needed for C1/C2 learners. Wikisource is a Wikimedia project hosting free source texts in 70+ languages — ideal for advanced reading content like essays, legal texts, historical documents, and academic writing.

## Decision
Create `lib/wikisource.ts` that integrates with the Wikisource MediaWiki API (free, no auth) to:
1. **Search** texts by language and query via `searchWikisourceTexts()`
2. **Fetch** wikitext content and convert to plain text via `fetchWikisourceText()`
3. **Ingest** texts into `reading_books` via `ingestWikisourceText()` with automatic wiki markup stripping

## Why This Approach
Wikisource uses the standard MediaWiki API that's well-documented and free. Each language has its own subdomain (e.g., `es.wikisource.org`), which naturally maps to our language codes.

Alternative considered: Scraping Wikipedia articles. Rejected because Wikipedia content is encyclopedic, not literary — Wikisource has actual source texts better suited for reading practice.

Alternative considered: OpenLibrary API. Rejected because OpenLibrary focuses on metadata, not full text content.

## Impact
- New file `lib/wikisource.ts` with 3 exported functions + internal markup stripper
- Depends on `reading_books` table from AIE-001
- Wiki markup stripping removes templates, categories, wiki links, bold/italic markers, section headers, HTML tags, and references

## Success Criteria
- `searchWikisourceTexts('es', 'Cervantes')` returns Wikisource search results
- `fetchWikisourceText('es', 'Don_Quijote')` returns clean plain text without wiki markup
- `ingestWikisourceText('es', 'Page_Title', 'C1')` inserts into `reading_books` with `source='wikisource'`
