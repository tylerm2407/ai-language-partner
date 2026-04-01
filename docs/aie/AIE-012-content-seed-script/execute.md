# Execute — Content seed script for scaffolded writing prompts

**AIE:** AIE-012

## Files Changed

| File | Action | What Changed |
|------|--------|-------------|
| `scripts/seed-reading-content.ts` | created | Seed script that queries published courses and inserts 10 scaffolded writing prompts per course. Prompt templates cover all 6 scaffold types distributed by CEFR level: fill_blank (A1) with sentence/blank_index/hint in scaffold_data, sentence_frame (A1) with starters array, guided_paragraph (A2/B1) with starters array, free (B1) with empty scaffold_data, essay (B2) with empty scaffold_data, academic (C1/C2) with empty scaffold_data. Each prompt has appropriate title, instructions, cefr_level, min/max word counts, and max_attempts=3. Uses Supabase client for inserts. |

## Outcome
Implementation matches plan. The script creates Spanish-language prompt templates (matching the current hardcoded target language). The scaffold_data JSON structures match exactly what WritingExercise (AIE-008) expects:

- fill_blank: `{ sentence: "...", blank_index: N, hint: "..." }`
- sentence_frame: `{ starters: ["My name is", "I live in", ...] }`
- guided_paragraph: `{ starters: ["First,", "Then,", "Finally,"] }`
- essay/academic/free: `{}`

Note: The TODO `targetLanguage: 'es'` hardcoding in the grading call (noted in AIE-009) means these Spanish prompts work end-to-end, but prompts for other languages would need that TODO resolved first.

## Side Effects
None. Script is run manually, not part of the build process.

## Tests
No automated tests. TypeScript compilation verified.

## Follow-Up Required
- [ ] TODO: Generate language-specific prompt content for non-Spanish courses
- [ ] TODO: Resolve targetLanguage hardcoding (pre-existing, noted in AIE-009)
