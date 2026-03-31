# AIE-002 — New Exercise Types — Align

## Problem

The app supported only 5 exercise types (multiple choice, fill-in-the-blank, translation, listening, speaking). This limited variety led to repetitive lessons and didn't cover important language acquisition patterns like cloze deletion, dictation, error correction, and sentence construction.

## Business Context

Exercise variety is a key retention driver. Competitors offer 10+ exercise types. Adding cloze, dictation, error correction, and sentence construction brings the total to 9 types, enabling more engaging and pedagogically diverse lessons. The LessonRunner also needed gamification hooks (hearts, XP, animations) to support the new progression system.

## Success Criteria

- 4 new exercise components render and grade correctly
- LessonRunner handles all 9 exercise types without errors
- Gamification integration: hearts deducted on wrong answers, XP awarded on completion
- Exercise animations provide visual feedback
- All exercise types follow the existing component pattern (props interface, grading callback)
