# Align — Gutenberg content ingestion service

**AIE:** AIE-002
**Date:** 2026-03-31
**Severity:** moderate
**Domain:** backend

## Problem
Fluenci needs B1-C2 level reading content but has no way to source it. Manually writing hundreds of long-form texts is not feasible for a 2-person team. Project Gutenberg has 70,000+ free public domain books in multiple languages — a perfect source for intermediate-to-advanced reading material.

## Decision
Create `lib/gutenberg.ts` that integrates with the Gutendex API (free, no auth required) to:
1. **Search** books by language and topic via `searchGutenbergBooks()`
2. **Fetch** plain text content via `fetchGutenbergText()` with automatic boilerplate stripping (Gutenberg headers/footers)
3. **Ingest** books into the `reading_books` table via `ingestGutenbergBook()` with automatic chapter break detection and word count calculation

## Why This Approach
Gutendex is a free, well-maintained REST API over the Project Gutenberg catalog. No API key needed. Returns structured JSON with direct links to plain text files.

Alternative considered: Scraping gutenberg.org directly. Rejected because Gutendex already provides a clean API wrapper, and scraping would be fragile.

Alternative considered: Using only AI-generated content. Rejected because AI stories lack the literary quality and length needed for B1+ learners. Real literature provides authentic language exposure.

## Impact
- New file `lib/gutenberg.ts` with 3 exported functions
- Depends on `reading_books` table from AIE-001
- Boilerplate stripping uses regex to find `*** START OF` / `*** END OF` markers
- Chapter detection uses regex for common chapter patterns (CHAPTER, Chapitre, Kapitel, etc.)

## Success Criteria
- `searchGutenbergBooks('es')` returns Spanish books from Gutendex API
- `fetchGutenbergText(bookId)` returns clean text without Gutenberg legal boilerplate
- `ingestGutenbergBook(id, 'B1', 'es')` inserts a row into `reading_books` with correct metadata
