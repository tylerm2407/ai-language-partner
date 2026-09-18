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
- **A Japanese kana reading IS the answer, on any typed row.** The orthography ruling of 2026-09-16 accepts the reading wherever the learner is asked to produce a word: typing かんごし for 看護師 is writing Japanese, and is correct at full accuracy. The grader accepts it when the kana exactly equals a reading the curriculum AUTHORED for that word (`metadata.reading` on the `script_choice` rows, surfaced by `lib/japanese-readings.ts` — the same table the in-app input method converts with). Four rules govern it:
  - **Authored, never composed.** A reading derived from per-character readings is wrong often enough to be dangerous — 明日 is あした, not めいにち — and would both refuse right answers and accept non-words. A word with no authored reading has no reading here; 90 fill-blank fragments (護師, 人公) land there and keep the old behaviour.
  - **Exact only.** かんごう for 看護師 stays wrong. A near-miss reading is a vocabulary error, and forgiving it teaches the wrong pronunciation and then spaces it out on an SM-2 schedule.
  - **It runs on grammar-shaped rows too**, unlike typo tolerance, because Japanese writes inflection in kana: 食べます reads たべます and 食べました reads たべました, so the wrong form has the wrong reading and is refused by the same exact match. No grammar contrast lives in the kanji. Tapped choices and an explicit `strict` request are still excluded.
  - **A homophone is refused, not accepted.** A reading that also spells another word the lesson teaches (雨/飴, 橋/箸) is ambiguous and the learner is told to write the kanji. No such pair is authored today; `japanese-readings.test.ts` asserts that, so the first one added fails a test rather than silently loosening grading.
  - Accepting the reading **must not stop teaching the kanji**: the feedback names the spelling ("in kanji this is written 魚"), and `script_choice` items still carry the orthography requirement described below.
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
- **Orthography strengthens writing; it can never carry it.** `script_choice` items ("Which is the kanji for さかな (Fish)?", migration 138) are recorded in `exercise_results` like any graded exercise and read into the writing strand, because knowing which characters write a word is part of writing a language with more than one script. They are capped at `ORTHOGRAPHY_TO_PROSE_RATIO` (0.5) of that BAND's graded submissions, most recent first, so a band with no prose counts none of them and a band with six counts at most three. Writing's mean is therefore prose plus a bounded orthography term, not prose alone. The cap is the whole safeguard: without it twenty correct taps would hold a band nobody had written a sentence in.
- **A band is held when its WEIGHTED SCORE reaches `BAND_THRESHOLD` (0.70)**, and every rung beneath it is held too. Weights (`STRAND_WEIGHTS`, must sum to 1): interaction 0.55, vocabulary 0.12, listening 0.09, reading 0.08, writing 0.08, speaking 0.08. Each strand contributes a continuous 0–1 gate × its weight; a strand already assessed at or above the band contributes its full weight.
- **The threshold must stay above the largest single weight.** Interaction alone tops out at 0.55, so conversation can never publish a band by itself. That gap is the whole guarantee that no level rests on one source — do not close it by lowering `BAND_THRESHOLD`.
- This replaced a stricter rule (every strand had to hold the band; the level was the lowest). That rule was more faithful to CEFR, and the change cost real rigour: the score is now **compensatory**, so strength in conversation can offset thin reading. It was replaced because vocabulary — the one strand with a calendar in it, since SM-2 needs 22 days to graduate a card — was a veto over the whole report, so a learner who conversed daily for a month saw no movement at all. `MIN_INTERACTION_DAYS` puts the calendar back in the strand that now carries the weight.
- Home's ring (`lib/next-band-progress.ts`) draws the report's own `scoreBand` arithmetic, scaled by `BAND_THRESHOLD` — not a second opinion, and no longer an equal fifth per strand. Minutes of audio are exposure and never a level.
- **Conversation is its own strand and feeds no other.** Spoken turns no longer pool with `pronunciation_scores`, and typed turns no longer pool with graded writing (3 chat messages used to satisfy the same gate as 3 essays). Spoken interaction, spoken production and written production are different CEFR claims. `conversationCefrBand` pitches the conversation — and stamps its evidence — one rung ABOVE a measured band, because evidence tagged at a band the learner already holds can never promote them; placement and declared levels are not stretched.
- **The level test may publish a level, but only when practice has not.** `buildProficiencyReport` takes `checkpointBand` (the band from the learner's most recent completed checkpoint) and uses it as `overallLevel` **only when the practice estimate is null**. The report exposes all three: `practiceLevel` (the weighted six-strand estimate, what `overallLevel` used to be unconditionally), `testedLevel`, and `levelSource` (`'practice' | 'test' | null`). Never the higher of the two and never the more recent — either would let a learner choose their band by testing on a good day. The asymmetry is the safeguard: the test does not measure live conversation at all, and conversation is 0.55 of the practice score. This replaced "a checkpoint never sets the level", which was right while the instrument was four questions at one band but left an unmeasured learner facing `MIN_INTERACTION_DAYS` plus the confidence gate — a fortnight of "Not yet assessed" no matter what they did.
- **`nextLevel` and `nextLevelSteps` are computed from `practiceLevel`, not from the published level.** A test-published B1 has proved no rung of the strand model, so targeting B2 would ask for work on a band with nothing beneath it. Home's ring and the report's bars both call `ringForReport` in `lib/next-band-progress.ts`, which owns the target choice: band-after-practice-level when measured, the tested band itself when a test published it ("Proving B1 · n%", never "B1 · 0% to B2"), else the first band to prove. `ringIsMeasured` means measured *from practice* — a tested level is a real level with an entirely unproved strand model.
- A level is withheld while confidence is `none` (fewer than 30 logged reviews or 3 active days). Lesson answers log reviews too (migration 128), and **scored conversation turns count as reviews** — without that a conversation-only learner sat at `confidence: 'none'` and got no level however high their band score climbed. `nextLevelSteps` lists one line per strand short of the target, conversation first because that is where the work pays, plus the confidence gate when that is the blocker.
- **The tutor listening check** is how a conversation evidences listening at all. After a session the analysis returns 3 multiple-choice questions about what the TUTOR said (`_shared/tutor-listening.ts`), all-or-nothing: exactly 3 or an empty array, and a short session correctly yields none. The debrief carries questions and options only; the answer key stays in `tutor_listening_checks` (RLS on, no policies) and `tutor-session`'s `listening-answer` action grades it, because `tutor_sessions` is client-readable and a client-held key makes the score self-assigned. Answering is once per session, guarded on `answered_at`, so guessing repeatedly cannot reach 3/3.
- Evidence is scoped to the profile's current target language; only `activeDays` is cross-language.
- The level is the highest band reached by walking A1 → C2 without skipping one (`highestContiguousBand`). Every skill shares that walk.
- **Placement.** A learner's lessons start at `user_profiles.placement_band` — the band of the course they started in (one below the declared level if they chose to warm up; B2 for an advanced learner while no C1 course exists; the declared band if they chose no lesson path). Bands strictly below it that have too little evidence to judge are `placed`: the walk steps over them and the report discloses it ("assumed from your placement"). Two limits hold: placement never overrides evidence — a judged band below placement is used on its verdict and a failing one breaks the walk — and the reported level is always an evidenced rung, never an assumed one. `nextLevelRequirement` targets the first band above the current level that is not placed, so a placed learner is never sent back to A1 words.
- `lib/course-placement.ts` owns which course a level opens and what the onboarding/Settings choosers offer. `current_course_id` is the navigation pointer (moved by pills); `placement_band` is the assessment input (never moved by pills).
- Changing any threshold, weight, the placement rule, or the test-publishes rule requires updating `lib/cefr-proficiency.test.ts`, `lib/next-band-progress.test.ts`, `lib/course-placement.test.ts`, `lib/checkpoint-flow.test.ts` and this section.

## The level test (`supabase/functions/checkpoint`)

- **Five strands, ~8 minutes.** Four item strands asked as a staircase, plus a spoken conversation (below). The "about five minutes" copy moved to eight when the conversation landed rather than quietly drifting.
- **It is a staircase, not a single-level quiz.** Each ITEM strand is asked at the band below, at the band, and at the band above (`STRAND_BAND_OFFSETS`), and the result is read off *where the learner stops passing*. Listening and reading get three rungs (machine-graded, free); writing and speaking get two (a model call / a recording each). Eleven items where there were four.
- It used to serve exactly four items — one per strand, all at the attempt's band — so a single listening question was the entire listening strand, 1 or 0. That could confirm a band it was pointed at; it could not locate one.
- **`RUNG_PASS` is 0.7**, the same pass mark as every scored strand in the report. A rung is passed when the mean of its *answered* items across strands reaches it; a rung nobody answered is not a pass.
- **`bandFromStaircase` walks up and stops at the first rung not passed** — the same contiguity rule as `highestContiguousBand`, so guessing the B2 multiple-choice after failing B1 does not yield B2. Failing the lowest rung served demotes to it (real evidence of being below placement); with no rung below, the band holds — an unproved band is not a disproved one. Answering nothing holds the band. A degenerate one-rung spread (an under-seeded language) falls back to `bandFromComposite`, so an unseeded segment is not silently inert.
- Movement stays capped at ±1 band per attempt, now structurally: the spread only reaches one rung either side.
- **Cadence is enforced server-side** (`checkCooldown`, `CHECKPOINT_COOLDOWN_DAYS = 7`). It was not before — the function header claimed monthly and nothing implemented it, so the only ceiling was `DAILY_CHECKPOINT_GRADES`. The *first* test in a language has no cooldown: an unassessed learner taking it is the path this exists to open.
- Writing is graded against **the item's** band, not the attempt's. Speaking rungs are attributed by `expected_text` (the item's own prompt) against `pronunciation_scores`, so two rungs are not both scored from the newest row.
- **The test measures CONVERSATION** (migration 146). Interaction is 0.55 of the practice model and was 0% of the test, which since migration 143 can publish a level. `start` opens a `chat_sessions` row on the server-only `level_test` scenario and binds it to the attempt (`checkpoints.interaction_session_id`); the learner holds `INTERACTION_TURNS` (4) **spoken** turns against `ai-chat`, which writes `conversation_evidence` through the same `_shared/conversation-evidence.ts` practice uses; `submit` reads those rows back and scores the strand. The session id is read off the ATTEMPT, never the request — a client-supplied one is a self-assigned interaction score.
- **Interaction is ONE rung at the set band.** A conversation is pitched at one level, so it cannot be asked at three; and it contributes one `GradedItem`, not one per turn, or the heaviest strand would be four fifths of its own rung.
- **Below `MIN_INTERACTION_TURNS_SCORED` (3) the strand is ABSENT, never zero.** This matters more than anywhere else in the test: it is spoken-only, so a denied mic or a noisy room can end it through no fault of the learner, and zeroing 0.55 would cost more band than every other strand can give back. It never blocks Finish, and the result screen says in words that it was left out rather than counted against them.
- **`level_test` is in `SERVER_ONLY_SCENARIOS`, not `SCENARIO_ORDER`.** `fetchOrCreateChatSession` resumes the newest session for a (scenario, language) pair, so a pickable key would let the practice screen resume an assessment session whose turns the checkpoint then reads back as its own evidence. `lib/scenario-keys.test.ts` subtracts the list rather than being weakened.
- **What a turn is worth is written three times** — `combinedScore` (edge write path), `combineConversationScore` (app report path), `combineTurn` (checkpoint read path) — because none can import the others. `lib/conversation-score-agreement.test.ts` pins them together; drift would mean a learner's test and their practice weighed the same spoken turn differently and called both a band.
- **`level_history` (migration 143)** records one row per band CHANGE, per language, service-role write only. `source` is `'test'` (written by the checkpoint function) or `'practice'` (allowed by the schema, **no writer yet** — the report engine has no Deno home, and letting the client assert its band is exactly what the service-role rule prevents).

## Chat Missions
- A guided-chat scene has an authored ladder of four missions (A1→B2), each with 2-3 objectives (`supabase/functions/_shared/missions.ts`). One attempt = one `chat_sessions` row; the learner ends it by tapping Finish.
- **Pass rule** (`ai-chat/mission-result.ts`, `MISSION_PASS_ACCURACY`): an attempt passes when **every objective is met AND mean turn accuracy ≥ 0.7**. Turn accuracy is the same number the CEFR report uses — `accuracy` for a typed turn, `0.5 × accuracy + 0.5 × intelligibility` for a spoken one — averaged over the attempt's own `conversation_evidence` rows.
- **Zero-scored-turns exception:** if no turn was long enough to score (`MIN_WORDS_FOR_EVIDENCE`), accuracy is `null` and the attempt passes on objectives alone. A1 turns are often under the floor; no evidence is not bad evidence.
- Objectives are reported by the model per turn (`objectivesMet`), **whitelisted against the mission's own ids**, and **unioned across turns** on the server (`chat_mission_attempts.objectives_met`). The client's checklist trusts the server's union over its own state.
- Stage N+1 unlocks only when stage N has a `passed_at` in `chat_mission_progress`. Finish is idempotent: a second finish returns the stored result and writes no progress.
- Changing the 0.7 mark, the combination formula, or the exception means updating `mission-result.test.ts` and this section together.
