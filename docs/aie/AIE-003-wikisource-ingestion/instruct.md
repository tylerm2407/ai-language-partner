# Instruct — Wikisource content ingestion service

**AIE:** AIE-003

## Directive
> "Create lib/wikisource.ts. Fetches texts from Wikisource MediaWiki API. searchWikisourceTexts(language, query) using GET https://{lang}.wikisource.org/w/api.php?action=query&list=search. fetchWikisourceText(language, pageTitle) that fetches wikitext and strips wiki markup to plain text. ingestWikisourceText(language, pageTitle, cefrLevel) that fetches, cleans, and inserts into reading_books with source='wikisource'. Import from './supabase'. Export all functions. Handle errors with throw."

## Context Provided
- `lib/supabase.ts` — existing Supabase client
- `types/index.ts` — ReadingBook type definition
- MediaWiki API documentation (action=query for search, action=parse for content retrieval)
- `lib/gutenberg.ts` — parallel implementation for pattern reference

## Scope
IN scope: Wikisource API integration, wiki markup stripping, DB insert
OUT of scope: Annotation generation, batch ingestion, caching
