# AIE-004 — Writing Module — Align

## Problem

The writing feature was split across three components (`PromptCard`, `WritingEditor`, plus a separate feedback view) with separate routes for prompt selection, writing, and history. This created unnecessary navigation steps and made the writing flow feel disconnected from lessons.

## Business Context

Writing practice is high-value for language acquisition but had low engagement due to friction. A unified component that shows the prompt, accepts writing, validates word count, tracks time, and displays AI feedback in a single flow reduces drop-off and integrates cleanly into the Learn tab.

## Success Criteria

- Single `WritingExercise` component handles the full write-submit-feedback cycle
- Word count validation with minimum threshold
- Time tracking for writing duration
- Async AI grading via `grade-writing` Edge Function
- Feedback displayed inline without navigation
