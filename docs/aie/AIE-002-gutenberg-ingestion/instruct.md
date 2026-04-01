# Instruct — Gutenberg content ingestion service

**AIE:** AIE-002

## Directive
> "Create lib/gutenberg.ts. Fetches books from Gutendex API and stores in reading_books. Key functions: searchGutenbergBooks(language, topic?, page?) using GET https://gutendex.com/books/?languages={lang}. fetchGutenbergText(bookId) that fetches plain text format and strips Gutenberg header/footer boilerplate. ingestGutenbergBook(gutenbergId, cefrLevel, language) that fetches metadata + text and inserts into reading_books with source='gutenberg'. Import from './supabase'. Handle errors with throw. Use proper TypeScript types."

## Context Provided
- `lib/supabase.ts` — existing Supabase client import
- `types/index.ts` — ReadingBook type definition
- `lib/supabase-queries.ts` — existing pattern for Supabase inserts
- Gutendex API documentation (free, no auth, returns JSON with `formats` map containing text URLs)

## Scope
IN scope: Gutendex API integration, text fetching, boilerplate stripping, chapter detection, DB insert
OUT of scope: Annotation generation for Gutenberg books, batch ingestion orchestration, UI
