# AIE-008 — Grading Engine — Align

## Problem

The grading system used simple exact/fuzzy matching without awareness of commonly confused word pairs (e.g., Spanish "ser" vs "estar", French "savoir" vs "connaître"). This led to false positives where typos that changed meaning were accepted. The review queue only sourced cards from lessons, missing vocabulary from the new reading module. Types didn't reflect the new exercise types or reading/writing data structures.

## Business Context

Accurate grading is core to learning quality. Accepting "ser" when the answer is "estar" teaches the wrong thing. A confusable-pairs library prevents this for the top language pairs (Spanish, French, German, Italian, Portuguese). Multi-source review integration means words learned through reading naturally flow into spaced repetition, increasing retention without extra user effort.

## Success Criteria

- Confusable-pairs library covers 5 languages with common confusion pairs
- Grading rejects answers that match a confusable pair (even if Levenshtein distance is low)
- Review queue sources cards from both lessons and reading annotations
- TypeScript types updated for all new data structures
- App config updated for new feature flags and plan limits
