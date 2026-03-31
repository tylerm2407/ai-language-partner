# AIE-003 — Reading Module — Align

## Problem

The previous reading implementation (`ReadingCard`, `ReadingTextView`, `ReadingChatSheet`) was chat-based — users read a passage then asked an AI tutor questions. This was expensive (every interaction = LLM call), hard to grade, and didn't reinforce vocabulary retention.

## Business Context

Reading comprehension is a core skill for language learners. A structured reading flow (read → tap words for translation → answer comprehension questions) is cheaper to serve, measurably gradable, and feeds vocabulary into the spaced repetition system. This aligns with reducing AI costs while increasing learning outcomes.

## Success Criteria

- Passage viewer renders formatted text with tap-to-translate on individual words
- Word tooltips show translation and "Add to Review" action
- Comprehension questions presented after reading, with scoring
- `useReadingPassage` hook manages passage loading, annotations, and progress tracking
- Reading progress saved to database
