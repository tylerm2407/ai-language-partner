# Instruct — AI story generation edge function

**AIE:** AIE-004

## Directive
> "Create a new Supabase Edge Function at supabase/functions/generate-story/index.ts. Follow the same patterns as grade-writing. Import corsResponse, corsHeaders from '../_shared/cors.ts', getAuthenticatedUser from '../_shared/auth.ts'. Use Claude Haiku (claude-haiku-4-5-20251001). Accept POST { language, cefrLevel, topic?, count? }. System prompt instructs Claude to write a CEFR-level story in the target language that feels culturally native. A1: 50-150 words, A2: 150-300, etc. Return JSON { title, content, annotations: [{word, translation, partOfSpeech}] }. Insert into reading_books (source='ai_generated') + book_annotations. Cap at 5 per request. Return { bookIds: string[] }."

## Context Provided
- `supabase/functions/grade-writing/index.ts` — existing edge function pattern (auth, CORS, Anthropic API call)
- `supabase/functions/_shared/cors.ts` — CORS headers helper
- `supabase/functions/_shared/auth.ts` — authentication helper
- `types/index.ts` — ReadingBook, BookAnnotation types
- CEFR word count targets from plan document

## Scope
IN scope: Edge function creation, Anthropic API integration, DB inserts, error handling
OUT of scope: Rate limiting (uses existing daily usage limits), batch seeding orchestration, UI for triggering generation
