---
paths: ["lib/srs.ts", "lib/grading.ts", "lib/lesson-scoring.ts", "lib/cefr-proficiency.ts", "lib/next-band-progress.ts", "lib/course-placement.ts", "components/lesson/**", "app/(app)/learn/**", "app/(app)/review/**", "app/(app)/practice/**"]
---

# Learning Domain Rules

## Spaced Repetition (SM-2 Algorithm)

- Use the SM-2 algorithm as the baseline. Each card tracks: `easeFactor` (EF), `interval`, `repetitions`, and `nextDue`.
- After a review, update based on user rating (0-5 scale, where 3+ = pass):
  - If rating < 3: reset repetitions to 0, interval to 1 day, keep EF.
  - If rating >= 3: increment repetitions, calculate new interval (1 -> 6 -> prev * EF), adjust EF.
- EF adjusts per review: `EF' = EF + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02))`. Minimum EF = 1.3.
- Cards due today (`nextDue <= now`) appear in the review queue, sorted by overdue-ness.
- New cards are introduced at a controlled rate (default: 20/day, configurable per user).

### Review session format (`lib/review-choices.ts`)
- A review card is a four-option question: the target word, pick its meaning. No self-rating. Distractors are translations of other cards from the learner's own deck (same language first), topped up from the course when the deck is small.
- The pick sets the rating: wrong = 1 (Again), correct in under 4s = 5 (Easy), correct otherwise = 4 (Good). Hard (3) is unreachable by design.
- A missed card is re-asked later in the same session, up to 3 times, but only the FIRST showing is written to SM-2 and `review_logs`. The miss already reset it to tomorrow; it stays in the queue until a fresh-day pass.

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
- End each lesson with a summary: items learned, accuracy, best score kept on a retake.
- Failed items get added to the review queue immediately.

### Grading
- **Exact match** for single-word answers (case-insensitive, accent-tolerant).
- **Fuzzy match** for sentences: allow minor typos (Levenshtein distance <= 1 for answers of 4 chars or fewer, <= 2 otherwise).
- **Tapped choices** (multiple-choice and listening-choice) require a normalized exact match to the key or an explicitly accepted alternative; never apply typing-error tolerance to a button selection.
- Normalize equivalent Unicode composition, typographic apostrophes/quotes and final sentence punctuation (including Japanese/Chinese marks). Grammar-focused typed tasks retain strict spelling/accents; normalization must not merge distinct grammatical forms.
- **AI grading** for free production: send to Edge Function for semantic evaluation.
- **Writing feedback** uses the assigned task’s four-part rubric (grammar, vocabulary, coherence, task completion; each 0–25) for the saved/displayed overall score. Preserve real zeros. Legacy feedback without that rubric uses the mean of its available valid diagnostic scores. An unavailable/invalid grade is `null`, not zero, and must not be recorded as scored work or awarded scored-writing XP.
- Always show the correct answer after a wrong attempt.

## Content Organization
- **Course** = a language pair (e.g., English → Spanish).
- **Unit** = thematic group (e.g., "Greetings", "Food & Drink").
- **Lesson** = a single learning session within a unit (10-15 exercises).
- **Card** = atomic learning item (word, phrase, or sentence) with translations and audio.

## Measured CEFR level (`lib/cefr-proficiency.ts`)

- A vocabulary band is judged only with ≥ 20 items seen and ≥ 10 mature; retention over mature items ≥ 0.8 is `mastered`, ≥ 0.5 `developing`, else `weak`. Reading needs 3 passed pieces (comprehension ≥ 0.7; passages and daily-news comprehension checks both count), writing 3 graded pieces averaging ≥ 0.7, speaking 10 scored attempts averaging ≥ 0.7, listening 10 graded lesson listening exercises (`listening_choice`, `listening_type`, `dictation` in `exercise_results`, migration 128) with first-try accuracy ≥ 0.7.
- **All five scored strands must hold a band for the overall level to hold it**; the overall level is then the lowest of them. A strand with no level leaves the report `null` and named in `missingSkills`. This is what lets Home's ring (`lib/next-band-progress.ts`, an equal fifth per strand toward `nextLevel`) predict promotion honestly: 99% means one piece of work away. Minutes of audio are exposure and never a level.
- A level is withheld while confidence is `none` (fewer than 30 logged reviews or 3 active days). Lesson answers log reviews too (migration 128), so lessons alone can clear it. `nextLevelSteps` lists one line per strand short of the target plus the confidence gate when that is the blocker.
- Evidence is scoped to the profile's current target language; only `activeDays` is cross-language.
- The level is the highest band reached by walking A1 → C2 without skipping one (`highestContiguousBand`). Every skill shares that walk.
- **Placement.** A learner's lessons start at `user_profiles.placement_band` — the band of the course they started in (one below the declared level if they chose to warm up; B2 for an advanced learner while no C1 course exists; the declared band if they chose no lesson path). Bands strictly below it that have too little evidence to judge are `placed`: the walk steps over them and the report discloses it ("assumed from your placement"). Two limits hold: placement never overrides evidence — a judged band below placement is used on its verdict and a failing one breaks the walk — and the reported level is always an evidenced rung, never an assumed one. `nextLevelRequirement` targets the first band above the current level that is not placed, so a placed learner is never sent back to A1 words.
- `lib/course-placement.ts` owns which course a level opens and what the onboarding/Settings choosers offer. `current_course_id` is the navigation pointer (moved by pills); `placement_band` is the assessment input (never moved by pills).
- Changing any threshold or the placement rule requires updating `lib/cefr-proficiency.test.ts`, `lib/course-placement.test.ts` and this section.

## Chat Missions
- A guided-chat scene has an authored ladder of four missions (A1→B2), each with 2-3 objectives (`supabase/functions/_shared/missions.ts`). One attempt = one `chat_sessions` row; the learner ends it by tapping Finish.
- **Pass rule** (`ai-chat/mission-result.ts`, `MISSION_PASS_ACCURACY`): an attempt passes when **every objective is met AND mean turn accuracy ≥ 0.7**. Turn accuracy is the same number the CEFR report uses — `accuracy` for a typed turn, `0.5 × accuracy + 0.5 × intelligibility` for a spoken one — averaged over the attempt's own `conversation_evidence` rows.
- **Zero-scored-turns exception:** if no turn was long enough to score (`MIN_WORDS_FOR_EVIDENCE`), accuracy is `null` and the attempt passes on objectives alone. A1 turns are often under the floor; no evidence is not bad evidence.
- Objectives are reported by the model per turn (`objectivesMet`), **whitelisted against the mission's own ids**, and **unioned across turns** on the server (`chat_mission_attempts.objectives_met`). The client's checklist trusts the server's union over its own state.
- Stage N+1 unlocks only when stage N has a `passed_at` in `chat_mission_progress`. Finish is idempotent: a second finish returns the stored result and writes no progress.
- Changing the 0.7 mark, the combination formula, or the exception means updating `mission-result.test.ts` and this section together.
