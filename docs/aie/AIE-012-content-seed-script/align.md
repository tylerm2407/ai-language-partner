# Align — Content seed script for scaffolded writing prompts

**AIE:** AIE-012
**Date:** 2026-03-31
**Severity:** moderate
**Domain:** database

## Problem
The scaffolded writing UI (AIE-008) supports multiple scaffold types (fill_blank, sentence_frame, guided_paragraph, essay, academic, free), but there are no writing prompts in the database that use these scaffold types. Without seeded content, learners only see free-form writing prompts regardless of their CEFR level.

## Decision
Create `scripts/seed-reading-content.ts` — a seed script that inserts scaffolded writing prompts across CEFR levels for each published course. The script:
1. Queries all published courses to get course IDs and target languages
2. Inserts 10 prompt templates per course, distributed across CEFR levels:
   - A1: fill_blank and sentence_frame prompts with scaffold_data
   - A2: guided_paragraph prompts with starter sentences
   - B1: guided_paragraph (with outline) and free prompts
   - B2: essay prompts (300-400 word target)
   - C1/C2: academic prompts (500+ word target)
3. Each prompt includes appropriate scaffold_data JSON for its type

## Why This Approach
Pre-seeded content ensures learners at every CEFR level see appropriately scaffolded writing exercises from day one. The scaffold progression (fill_blank → sentence_frame → guided_paragraph → essay → academic) mirrors established CEFR writing pedagogy.

Alternative considered: Generate prompts on-the-fly via AI. Rejected because scaffold_data structure needs to be precise (blank_index, starters arrays) and AI generation would need heavy validation.

## Impact
- New file: `scripts/seed-reading-content.ts`
- Inserts into: `writing_prompts` table (scaffold_type, scaffold_data columns from AIE-001)

## Success Criteria
- Running the script populates writing prompts for all published courses
- Each CEFR level has at least 1-2 prompts with the correct scaffold_type
- scaffold_data JSON matches the format expected by WritingExercise component (AIE-008)
- Prompts are culturally appropriate and language-specific
