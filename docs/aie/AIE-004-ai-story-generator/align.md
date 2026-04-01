# Align — AI story generation edge function

**AIE:** AIE-004
**Date:** 2026-03-31
**Severity:** major
**Domain:** ai

## Problem
A1/A2 learners need short, vocabulary-controlled stories that don't exist in Gutenberg or Wikisource. Public domain literature is too complex for beginners. We need the ability to generate graded stories on demand that use only CEFR-appropriate vocabulary and feel culturally native to the target language.

## Decision
Create a new Supabase edge function `generate-story` that:
1. Accepts POST with `{ language, cefrLevel, topic?, count? }`
2. Uses Claude Haiku (`claude-haiku-4-5-20251001`) to generate stories constrained to CEFR vocabulary levels
3. System prompt instructs Claude to write culturally native stories (not translated English) with word counts scaled to level (A1: 50-150, A2: 150-300, B1: 300-500, B2: 500-800, C1: 800-1200, C2: 1000-1500)
4. Claude returns JSON with title, content, and 8-15 vocabulary annotations with English translations
5. Inserts stories into `reading_books` (source='ai_generated') and annotations into `book_annotations`
6. Caps at 5 stories per request to prevent abuse

## Why This Approach
Claude Haiku is cost-efficient (~$0.001 per story) and already deployed as the grading model. Pre-generating and caching stories in the DB (rather than generating on-the-fly) means:
- No latency at read time
- Stories can be reviewed/curated before publishing
- Vocabulary annotations are stored once, not regenerated per reader

Alternative considered: Using GPT-4o-mini. Rejected because Anthropic API is already configured and Haiku produces excellent multilingual output.

Alternative considered: On-the-fly generation per user request. Rejected because it adds latency, costs more (redundant generation), and prevents curation.

## Impact
- New edge function `supabase/functions/generate-story/index.ts`
- Requires `ANTHROPIC_API_KEY` (already configured)
- Uses ~2000 max_tokens per story generation
- Inserts into `reading_books` + `book_annotations` tables from AIE-001

## Success Criteria
- POST to generate-story with `{ language: "es", cefrLevel: "A1" }` returns a book ID
- Generated story is in `reading_books` with correct source, language, level, word count
- Annotations are in `book_annotations` linked to the book
- Story content is in the target language with CEFR-appropriate vocabulary
