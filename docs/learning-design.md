# Learning Design Principles

These principles guide every feature decision in languageAI.

## 1. Spaced Repetition with Adaptive Scheduling

- Use SM-2 as the baseline algorithm, with per-card ease factors that adapt to individual performance.
- Never use fixed intervals. A card the user struggles with should appear sooner; a mastered card should fade into longer intervals.
- Track and surface "leeches" — cards that repeatedly fail despite review. Offer alternative explanations or exercises for leeches.
- New card introduction rate is configurable (default 20/day) and auto-adjusts based on review load.

## 2. Active Recall Over Passive Recognition

- Users must produce the target language, not just recognize it.
- Progression within a lesson: recognition → comprehension → production.
- Multiple-choice is a stepping stone, not an endpoint. Graduate users to typed and spoken responses.
- Free recall (typing from memory) is weighted higher in SRS than recognition (picking from options).

## 3. Four-Skill Integration

Every course should train all four language skills in proportion:

| Skill | Exercise Types | Priority |
|-------|---------------|----------|
| **Listening** | Audio playback → pick meaning, dictation | High |
| **Speaking** | Repeat after audio, respond to prompts, AI conversation | High |
| **Reading** | Translate sentences, fill in blanks, reading comprehension | Medium |
| **Writing** | Type translations, compose sentences, free writing | Medium |

- Listening and speaking are prioritized because they're underserved by most apps and most valuable for real-world communication.
- Every vocabulary item has associated audio. No silent flashcards.

## 4. Short Sessions, Strong Feedback

- **Session length:** 2-10 minutes. A single lesson should be completable in 5 minutes.
- **Immediate feedback:** Show correct/incorrect after every answer. Show the correct answer on mistakes.
- **Progress cues:** XP earned, streak count, progress bar within lesson, daily goal completion.
- **Celebration moments:** Haptic feedback + animation on correct answers. Lesson completion screen with stats.
- **No dead ends:** If a user gets stuck, provide hints (first letter, audio replay, simplified version).

## 5. AI-Powered Practice

- AI conversation practice simulates real-world dialogue.
- AI adapts to user's level: simpler vocabulary and shorter sentences for beginners.
- AI provides corrections inline, not just at the end.
- Topics are contextual: tied to the current unit's theme (e.g., ordering food after completing the "Restaurant" unit).
- AI never generates harmful, inappropriate, or off-topic content. System prompts enforce language-learning context.

## 6. Motivation & Retention

- **Streaks:** Daily practice streaks with streak freeze (purchasable or earned).
- **XP system:** Points for completing lessons, reviews, and practice sessions.
- **Leagues/leaderboards:** Optional competitive element (future feature).
- **Reminders:** Push notifications at user's preferred study time.
- **Offline mode:** Downloaded lessons work without internet. Sync when back online.
