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

- Six strands. **Interaction** (live conversation) needs 12 qualifying sessions in a band, spread over 12 distinct days, averaging ≥ 0.7; a session qualifies at 5+ scored turns and contributes at most 12 turns to the mean. A vocabulary band is judged only with ≥ 20 items seen and ≥ 10 mature; retention over mature items ≥ 0.8 is `mastered`, ≥ 0.5 `developing`, else `weak`. Reading needs 3 passed pieces (comprehension ≥ 0.7; passages and daily-news comprehension checks both count), writing 3 graded pieces averaging ≥ 0.7, speaking 10 scored pronunciation attempts averaging ≥ 0.7, listening 10 graded items with first-try accuracy ≥ 0.7 — lesson listening exercises (`listening_choice`, `listening_type`, `dictation` in `exercise_results`, migration 128) plus answered post-session tutor listening checks (`tutor_listening_checks`, migration 132), which expand from their correct/total tally into one item per question.
- **A band is held when its WEIGHTED SCORE reaches `BAND_THRESHOLD` (0.70)**, and every rung beneath it is held too. Weights (`STRAND_WEIGHTS`, must sum to 1): interaction 0.55, vocabulary 0.12, listening 0.09, reading 0.08, writing 0.08, speaking 0.08. Each strand contributes a continuous 0–1 gate × its weight; a strand already assessed at or above the band contributes its full weight.
- **The threshold must stay above the largest single weight.** Interaction alone tops out at 0.55, so conversation can never publish a band by itself. That gap is the whole guarantee that no level rests on one source — do not close it by lowering `BAND_THRESHOLD`.
- This replaced a stricter rule (every strand had to hold the band; the level was the lowest). That rule was more faithful to CEFR, and the change cost real rigour: the score is now **compensatory**, so strength in conversation can offset thin reading. It was replaced because vocabulary — the one strand with a calendar in it, since SM-2 needs 22 days to graduate a card — was a veto over the whole report, so a learner who conversed daily for a month saw no movement at all. `MIN_INTERACTION_DAYS` puts the calendar back in the strand that now carries the weight.
- Home's ring (`lib/next-band-progress.ts`) draws the report's own `scoreBand` arithmetic, scaled by `BAND_THRESHOLD` — not a second opinion, and no longer an equal fifth per strand. Minutes of audio are exposure and never a level.
- **Conversation is its own strand and feeds no other.** Spoken turns no longer pool with `pronunciation_scores`, and typed turns no longer pool with graded writing (3 chat messages used to satisfy the same gate as 3 essays). Spoken interaction, spoken production and written production are different CEFR claims. `conversationCefrBand` pitches the conversation — and stamps its evidence — one rung ABOVE a measured band, because evidence tagged at a band the learner already holds can never promote them; placement and declared levels are not stretched.
- A level is withheld while confidence is `none` (fewer than 30 logged reviews or 3 active days). Lesson answers log reviews too (migration 128), and **scored conversation turns count as reviews** — without that a conversation-only learner sat at `confidence: 'none'` and got no level however high their band score climbed. `nextLevelSteps` lists one line per strand short of the target, conversation first because that is where the work pays, plus the confidence gate when that is the blocker.
- **The tutor listening check** is how a conversation evidences listening at all. After a session the analysis returns 3 multiple-choice questions about what the TUTOR said (`_shared/tutor-listening.ts`), all-or-nothing: exactly 3 or an empty array, and a short session correctly yields none. The debrief carries questions and options only; the answer key stays in `tutor_listening_checks` (RLS on, no policies) and `tutor-session`'s `listening-answer` action grades it, because `tutor_sessions` is client-readable and a client-held key makes the score self-assigned. Answering is once per session, guarded on `answered_at`, so guessing repeatedly cannot reach 3/3.
- Evidence is scoped to the profile's current target language; only `activeDays` is cross-language.
- The level is the highest band reached by walking A1 → C2 without skipping one (`highestContiguousBand`). Every skill shares that walk.
- **Placement.** A learner's lessons start at `user_profiles.placement_band` — the band of the course they started in (one below the declared level if they chose to warm up; B2 for an advanced learner while no C1 course exists; the declared band if they chose no lesson path). Bands strictly below it that have too little evidence to judge are `placed`: the walk steps over them and the report discloses it ("assumed from your placement"). Two limits hold: placement never overrides evidence — a judged band below placement is used on its verdict and a failing one breaks the walk — and the reported level is always an evidenced rung, never an assumed one. `nextLevelRequirement` targets the first band above the current level that is not placed, so a placed learner is never sent back to A1 words.
- `lib/course-placement.ts` owns which course a level opens and what the onboarding/Settings choosers offer. `current_course_id` is the navigation pointer (moved by pills); `placement_band` is the assessment input (never moved by pills).
- Changing any threshold, weight, or the placement rule requires updating `lib/cefr-proficiency.test.ts`, `lib/next-band-progress.test.ts`, `lib/course-placement.test.ts` and this section.

## Chat Missions
- A guided-chat scene has an authored ladder of four missions (A1→B2), each with 2-3 objectives (`supabase/functions/_shared/missions.ts`). One attempt = one `chat_sessions` row; the learner ends it by tapping Finish.
- **Pass rule** (`ai-chat/mission-result.ts`, `MISSION_PASS_ACCURACY`): an attempt passes when **every objective is met AND mean turn accuracy ≥ 0.7**. Turn accuracy is the same number the CEFR report uses — `accuracy` for a typed turn, `0.5 × accuracy + 0.5 × intelligibility` for a spoken one — averaged over the attempt's own `conversation_evidence` rows.
- **Zero-scored-turns exception:** if no turn was long enough to score (`MIN_WORDS_FOR_EVIDENCE`), accuracy is `null` and the attempt passes on objectives alone. A1 turns are often under the floor; no evidence is not bad evidence.
- Objectives are reported by the model per turn (`objectivesMet`), **whitelisted against the mission's own ids**, and **unioned across turns** on the server (`chat_mission_attempts.objectives_met`). The client's checklist trusts the server's union over its own state.
- Stage N+1 unlocks only when stage N has a `passed_at` in `chat_mission_progress`. Finish is idempotent: a second finish returns the stored result and writes no progress.
- Changing the 0.7 mark, the combination formula, or the exception means updating `mission-result.test.ts` and this section together.
