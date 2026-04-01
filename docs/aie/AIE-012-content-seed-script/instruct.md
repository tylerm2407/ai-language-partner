# Instruct — Content seed script for scaffolded writing prompts

**AIE:** AIE-012

## Directive
> "Create scripts/seed-reading-content.ts: Query all published courses. For each course, insert 10 scaffolded writing prompts distributed across CEFR levels. A1: fill_blank (with scaffold_data containing sentence, blank_index, hint) and sentence_frame (with starters array). A2/B1: guided_paragraph (with starters array). B1: free. B2: essay. C1/C2: academic. Each prompt has appropriate title, instructions, min/max word counts, and max_attempts=3. Use Supabase client to insert into writing_prompts table."

## Context Provided
- `types/index.ts` — WritingPrompt type with scaffoldType, scaffoldData fields (from AIE-001)
- `components/writing/WritingExercise.tsx` — scaffold rendering logic showing expected scaffold_data format (AIE-008)
- `supabase/migrations/012_reading_writing_expansion.sql` — scaffold_type and scaffold_data columns on writing_prompts

## Scope
IN scope: Seed script for scaffolded writing prompts across CEFR levels
OUT of scope: AI-generated reading content seeding, Gutenberg/Wikisource ingestion, runtime prompt generation
