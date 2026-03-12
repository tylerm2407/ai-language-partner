# Learning Domain Rules

## Spaced Repetition (SM-2 Algorithm)

- Use the SM-2 algorithm as the baseline. Each card tracks: `easeFactor` (EF), `interval`, `repetitions`, and `nextDue`.
- After a review, update based on user rating (0-5 scale, where 3+ = pass):
  - If rating < 3: reset repetitions to 0, interval to 1 day, keep EF.
  - If rating >= 3: increment repetitions, calculate new interval (1 -> 6 -> prev * EF), adjust EF.
- EF adjusts per review: `EF' = EF + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02))`. Minimum EF = 1.3.
- Cards due today (`nextDue <= now`) appear in the review queue, sorted by overdue-ness.
- New cards are introduced at a controlled rate (default: 20/day, configurable per user).

## Lesson & Exercise Structure

### Exercise Types (ordered by difficulty)
1. **Recognition** — Show target word, pick correct translation from 4 options.
2. **Listening** — Play audio, user picks or types what they heard.
3. **Translation (L1→L2)** — Show native language sentence, user types target language.
4. **Translation (L2→L1)** — Show target language sentence, user types native translation.
5. **Speaking** — Play audio prompt, user records spoken response, score pronunciation.
6. **Free production** — AI-powered open conversation on a topic.

### Lesson Flow
- Each lesson contains 10-15 exercises mixing the types above.
- Start with recognition, progress to production within a single lesson.
- End each lesson with a summary: items learned, accuracy, XP earned.
- Failed items get added to the review queue immediately.

### Grading
- **Exact match** for single-word answers (case-insensitive, accent-tolerant).
- **Fuzzy match** for sentences: allow minor typos (Levenshtein distance <= 2 for words under 8 chars).
- **AI grading** for free production: send to Edge Function for semantic evaluation.
- Always show the correct answer after a wrong attempt.

## Content Organization
- **Course** = a language pair (e.g., English → Spanish).
- **Unit** = thematic group (e.g., "Greetings", "Food & Drink").
- **Lesson** = a single learning session within a unit (10-15 exercises).
- **Card** = atomic learning item (word, phrase, or sentence) with translations and audio.
