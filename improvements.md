# Improvements: Evidence-Based Upgrades to the Course Experience

This document cross-references `research.md` (the science of effective language learning) against the app's current learning implementation. For each research-backed principle, it identifies the gap, names the specific files to change, and lists concrete improvements.

**How to use this file:**
- Every entry cites (a) the research basis from `research.md`, (b) the current-state file paths, (c) the gap, (d) specific action items.
- Sections are tagged **P0 / P1 / P2** by impact × effort (P0 = biggest learning win for least work).
- Do not take these as final implementations — they are recommendations. Validate with A/B tests where possible.

**Last updated:** 2026-04-22

---

## Executive Summary — The Top 15, Ranked

These are the fifteen changes predicted to most improve learning outcomes, ordered by impact × feasibility:

| # | Improvement | Impact | Effort | Tag |
|---|---|---|---|---|
| 1 | Wire existing `grammar_rules` table into error-triggered rule cards | High | Low | P0 |
| 2 | Differentiate corrective feedback by error type (grammar → elicit; pronunciation → recast) | High | Low | P0 |
| 3 | Enforce the 20-new-cards/day SRS cap that already exists in config | Medium | Low | P0 |
| 4 | Add High-Variability Phonetic Training: ≥4 TTS voices per language for difficult phoneme drills | High | Medium | P0 |
| 5 | Build `ContentSafetyValidator` and `LevelChecker` (promised by CLAUDE.md, missing) | High | Medium | P0 |
| 6 | Surface the `correction_log` in-session — "you've made this mistake 3 times this week" | Medium | Low | P0 |
| 7 | Add warm-up SRS review at the start of every lesson (5-item spaced-retrieval prime) | High | Low | P0 |
| 8 | Elicit Ideal L2 Self during onboarding; surface during streak risk / low-motivation states | Medium | Low | P0 |
| 9 | Sequence new vocabulary by `frequency_rank` (schema exists, unused) | High | Medium | P1 |
| 10 | Block new items for first 3–5 encounters; interleave only after ≥80% item accuracy | High | Medium | P1 |
| 11 | Build a Four Strands dashboard tracking time in each strand | Medium | Medium | P1 |
| 12 | Add fluency-development exercises (4/3/2 speaking, shadowing, timed reading) | High | High | P1 |
| 13 | Treat collocations / formulaic chunks as first-class SRS items (schema exists) | High | Medium | P1 |
| 14 | Noticing: visually highlight target forms in input before/during exercises | Medium | Low | P1 |
| 15 | Adaptive per-item difficulty (serve next item based on weakness, not fixed order) | Very High | High | P2 |

---

## Part A — Principle-by-Principle Gap Analysis

### A.1 Comprehensible Input (`research.md` §1) — **Partial**

**Research basis.** Learners acquire language via input at i+1. Krashen's input hypothesis + Nakanishi's (2015) meta-analysis of extensive reading (d = 0.46–0.71). Accountability (comprehension checks) boosts gains.

**Current state.**
- `reading_passages` table with `cefrLevel`, `wordCount`, annotations, and pre-generated comprehension questions (`types/index.ts:434-472`).
- `daily-news-cron` edge function auto-generates daily news per language + tier (easy/hard).
- Reading annotations let learners add words to SRS (`types/index.ts:451-461`).

**Gap.**
- No enforcement that reading level is within `user.cefr_level + 1`. A B1 learner can open a C1 article.
- Daily news reads as "read / not read"; no comprehension check for daily news (only for structured passages).
- No extensive listening library — audio lives only inside reading passages and the voice-chat flow. No podcast/story listening mode.
- `user_profiles.level` is a 5-tier enum (beginner→advanced), not CEFR. Content carries CEFR tags; mapping is inferred, not explicit.

**Improvements.**
1. **P0** — In `lib/supabase-queries.ts` and wherever passages/news are fetched, filter by `cefr_level ∈ {user.cefr_level, user.cefr_level+1}`. Never surface content >1 level above user. Treat >2 levels as blocked.
2. **P0** — Migrate `user_profiles.level` to a proper CEFR enum (`A1 | A2 | B1 | B2 | C1 | C2`), or add a `cefr_level` column alongside the coarse `level`. Update all level-consuming code paths.
3. **P1** — Add a single comprehension prompt after every daily news read ("What was this about? Pick the best summary" — 3 options, AI-generated). Track completion in `daily_stats`.
4. **P1** — Create an extensive-listening surface: a library of short audio stories (AI-generated per user's level + interest). New edge function modeled after `generate-story`, but audio-first with TTS.
5. **P2** — Build a "reading streak" separate from the practice streak to incentivize input-only days.

---

### A.2 Comprehensible Output (`research.md` §2) — **Partial**

**Research basis.** Swain: production (1) forces noticing of gaps, (2) lets learners test hypotheses, (3) triggers metalinguistic reflection. French immersion learners proved input alone is insufficient.

**Current state.**
- Strong production coverage: `translate_to_target`, `fill_blank`, `cloze_deletion`, `sentence_construction`, `word_form`, `sentence_transformation`, `free_production`, `speaking`, `dictation`, `mini_dialogue`, `error_correction`.
- `grade-writing` edge function does AI grading of open-ended writing.
- Voice exercises use STT + pronunciation scoring (`score-pronunciation`).

**Gap.**
- Some lessons likely skew recognition-heavy (multiple choice, listening choice). There is no global constraint that **every lesson must end with a production exercise** — a Swain-motivated guarantee.
- `free_production` has no dedicated renderer in `components/lesson/` (audit notes it as "inferred"). If it isn't actually rendered, it silently falls back to nothing.
- Scaffolding before free production is weak: learners can be asked to "write freely" without a sentence frame or preceding cloze.

**Improvements.**
1. **P0** — Add a lesson-level invariant in `components/lesson/LessonRunner.tsx` or in the lesson-assembly service: **every lesson must contain ≥1 production exercise** (translate_to_target | free_production | speaking | sentence_construction). Log a warning if a seed lesson violates this.
2. **P0** — Confirm `free_production` has a dedicated component. If missing, add `components/lesson/FreeProductionExercise.tsx` with a sentence-frame scaffold ("Start with: ___") for A1/A2 learners.
3. **P1** — Implement a progression within a single lesson: early exercises = recognition, last exercises = production. Enforce in lesson assembly logic. Matches the "recognition → production" path in `.claude/rules/learning.md`.
4. **P1** — Scaffold free writing/speaking: present a cloze version first; if learner passes, promote to full free production in the next lesson.

---

### A.3 Interaction & Negotiation of Meaning (`research.md` §3) — **Partial**

**Research basis.** Long: real learning happens when communication breaks down and learners negotiate to repair it (clarification requests, confirmation checks, comprehension checks).

**Current state.**
- Voice conversation via `supabase/functions/voice-proxy/index.ts` (Gemini Live 2.0 Flash).
- Text conversation via `supabase/functions/ai-chat/index.ts` (Claude Haiku 4.5).
- System prompt mentions "naturally recast" (`voice-proxy/index.ts:59`) but no structured behavior.

**Gap.**
- AI currently does a best-effort interpretation of malformed learner output rather than **asking for clarification**. This skips the acquisition-relevant moment.
- No formal tracking of whether a conversation included a negotiation-of-meaning episode.
- No teaching of negotiation moves to the learner ("Sorry?", "What do you mean by X?") — a known weakness of L2 learners.

**Improvements.**
1. **P0** — Update the `voice-proxy` and `ai-chat` system prompts to explicitly require: when a learner's utterance is ambiguous or grammatically incorrect in a way that obscures meaning, the AI **must** ask for clarification before responding (`"I didn't quite catch that — did you mean X or Y?"`). Track these episodes.
2. **P1** — Teach negotiation moves in A1/A2 lessons as explicit formulaic chunks ("Sorry, could you repeat that?", "What does X mean?"). Promote them to SRS.
3. **P1** — Add a "conversation grade" post-session that surfaces: how many negotiation-of-meaning episodes occurred, how many corrections the learner incorporated.

---

### A.4 Noticing & Focus on Form (`research.md` §4) — **Missing**

**Research basis.** Schmidt: what is consciously noticed becomes intake. Long: embed brief attention-to-form inside meaning-focused tasks (FonF > FonFs for implicit knowledge).

**Current state.**
- `grammar_rules` table exists with `explanation`, `examples`, `common_errors` (`supabase/migrations/017:29-48`), but audit confirms **no UI ever renders a rule card**. The table is orphaned.
- Target forms are stored per exercise (`targetGrammar`, `targetWord` in `types/index.ts:141-143`) but never visually highlighted to the learner.

**Gap.**
- Critical disconnect: we have structured grammar data and per-exercise targets, but zero surfacing of them. Learners cannot notice what isn't shown.
- Error feedback is a generic "Correct!" / "Incorrect. The correct answer is…". No attention-drawing to the specific form that was wrong.

**Improvements.**
1. **P0** — Build a `<RuleCard>` component (≤60 words, bold target form, 1 example) that renders just-in-time when an exercise has a `targetGrammar` and the learner has not seen the rule recently, or just got a related exercise wrong.
2. **P0** — In exercise renderers (`components/lesson/*`), visually highlight `targetWord`/`targetGrammar` in the prompt — bold, accent color, or a subtle underline. Research calls this "input enhancement".
3. **P1** — After every wrong answer where `targetGrammar` exists, automatically surface the matching `grammar_rules` row (join on `language + rule_name`). If no exact match, show the closest rule in the same `cefr_level`.
4. **P1** — Log "rule shown" events; use spacing logic so the same rule card isn't shown twice in the same day (once is noticing, twice is annoying).

---

### A.5 Retrieval Practice / Testing Effect (`research.md` §5.1) — **Partial**

**Research basis.** Roediger & Karpicke: repeated testing produced ~50% better delayed retention vs. repeated study. Recall beats recognition.

**Current state.**
- Many exercise types require typed recall (`translate_to_target`, `dictation`, `fill_blank`, `word_form`, `error_correction`, `sentence_transformation`).
- But `multiple_choice`, `listening_choice`, and `collocation_match` are **recognition-only**.
- No explicit rule that forbids lessons from being majority-recognition.

**Gap.**
- A lesson could theoretically be 100% multiple-choice and graduate a learner without them ever typing a word in the target language.

**Improvements.**
1. **P0** — Add a lesson-assembly invariant: **≥50% of exercises in any non-introductory lesson must require recall** (typing or speaking, not tapping). Introductory lessons can be more recognition-heavy.
2. **P1** — For every new vocabulary item, the second encounter must be recall, not recognition. Currently an item could be introduced via multiple-choice and then reviewed via multiple-choice — pure recognition throughout.
3. **P2** — Experiment: a "recall-mode" toggle per user that removes all recognition exercises in favor of typed production. Measure retention gains.

---

### A.6 Spaced Repetition — SM-2 (`research.md` §5.2) — **Strong**

**Research basis.** Distributed practice beats massed. SM-2 is the validated baseline. New-card caps prevent overload.

**Current state.**
- SM-2 fully implemented in `lib/srs.ts:8-56`.
- `review_items` tracks `ease_factor`, `interval`, `repetitions`, `next_due`, `status` (`migrations/001:98-110`).
- Failed → reset to learning, interval 1, EF decremented (`lib/srs.ts:14-18`).
- Due-queue sorted by overdue-ness then by EF (hardest first) (`lib/srs.ts:84-92`).
- Leech detection at 8+ forgettings (`lib/srs.ts:105-107`).
- `newCardsPerDay: 20` defined in `config/app.ts:6`.

**Gap.**
- **The 20-card cap is configured but not enforced.** Audit could not find code that rate-limits new-card introduction to that number per day.
- Leech cards are flagged but **never suspended or promoted to a specialized drill**. A chronic-leech learner just keeps seeing the same failing card.
- No spacing on lesson content — only on SRS. So if the learner does two lessons back-to-back that share vocabulary, they get massed practice rather than spaced.

**Improvements.**
1. **P0** — Enforce `newCardsPerDay` in the new-card intake logic (wherever `status = 'new'` → `'learning'` transitions happen). Track `new_cards_introduced_today` in `daily_stats`, block new introductions at cap, tell the learner they've hit it for today.
2. **P0** — For leech cards (≥8 failures): auto-suspend from normal SRS, offer an opt-in "intensive drill" mini-session with explicit rule card, high-variability context, and a slower pace.
3. **P1** — In lesson assembly, check: if the learner reviewed item X <30 min ago, don't re-surface X in the same lesson unless the review failed.

---

### A.7 Desirable Difficulties & Interleaving (`research.md` §5.3–5.4) — **Missing**

**Research basis.** Bjork Lab — interleaving improves transfer & discrimination (63% vs. 20% on delayed tests). Hwang (2025, *Language Learning*): interleaving hurts pre-threshold learners. Block first, interleave after ~80% accuracy.

**Current state.**
- Exercises within a lesson are a fixed sequence; no adaptive interleaving.
- No tracking of "per-item accuracy" to decide when an item is ready for interleaved review.

**Gap.**
- A new vocabulary item might be interleaved with others from day one — counterproductive for beginners (Hwang's finding).
- Or, conversely, items might stay in blocked practice forever if lessons are authored linearly.

**Improvements.**
1. **P1** — Track per-item rolling accuracy (e.g., last 5 exposures) in `review_items` or a new `card_stats` view.
2. **P1** — Gate interleaving on ≥80% accuracy. Below threshold: card stays in blocked practice (consecutive exposures). At/above threshold: card enters the normal interleaved SRS pool.
3. **P2** — Vary conditions of practice: same card shown in different sentence contexts, different voices (ties to HVPT §A.9), different exercise types (cloze one day, translation the next).

---

### A.8 Vocabulary Frequency & Formulaic Chunking (`research.md` §6 & §8) — **Partial**

**Research basis.** Top 1k words = 70% coverage; top 2k = 80%; top 9k = 98%. Wray / Ellis: fluent speech is ~30-50% prefabricated chunks. L2 learners under-use chunks.

**Current state.**
- Schema supports it! `cards.frequency_rank`, `cards.word_family[]`, `cards.collocations` (JSONB) — all added in `migrations/017:54-66`.
- No audit evidence that seed content is sequenced by `frequency_rank`, or that collocations are ever surfaced as drillable cards.

**Gap.**
- Beautiful schema, no teaching logic on top of it. A learner could be drilled on "astronomer" before knowing "because" — pure accident.
- Collocations stored as a JSONB field on a card rather than as their own SRS-trackable item. So `make a decision` is never itself promoted to a review-tracked chunk.

**Improvements.**
1. **P1** — Build a `sequence-by-frequency` module: when composing a new-vocab lesson for a user at level X, pick the next N highest-frequency cards they have not yet seen, filtered by `cefr_level ≤ user.cefr_level + 1`.
2. **P1** — Create a `chunks` table (or a `skill_type = 'chunk'` value on `cards`) that treats multi-word expressions as first-class SRS items: "how are you", "it depends", "by the way", "make a decision". They get their own `review_items` rows.
3. **P1** — Add a `collocation_introduction` exercise type: learner sees "make a ___" and picks / types the verb's common object. Distinguish from current `collocation_match` (which is recognition).
4. **P2** — Import a BNC/COCA-derived frequency list per language in a migration; populate `frequency_rank` for all existing cards that lack it.

---

### A.9 Pronunciation: HVPT (`research.md` §9) — **Missing**

**Research basis.** High-Variability Phonetic Training: exposure to the same phoneme/contrast via ≥4 different voices produces medium-to-large effects on L2 perception and production that persist long-term.

**Current state.**
- `hooks/usePageNarrator.ts` maps each language to a **single** Expo TTS voice per language.
- `score-pronunciation` edge function returns a similarity score (0-100), not segmental analysis.
- No IPA cues; no phoneme-contrast drills (e.g., /r/ vs. /l/ for Japanese learners of English).

**Gap.**
- Learners hear one voice per language for their entire learning career. Even genuine HVPT exercises aren't possible.
- Pronunciation feedback is a single number; learners don't know *which phoneme* they botched.

**Improvements.**
1. **P0** — Expand `LANGUAGE_MAP` in `hooks/usePageNarrator.ts` and the TTS edge function to support a voice array per language (≥4 voices where available on Expo Speech / platform TTS). Track which voice was used for a given audio.
2. **P0** — For speaking/listening exercises whose `targetPhoneme` or `targetWord` involves a hard phonemic contrast, cycle through multiple voices across repetitions. Add `targetPhoneme` field to exercise types.
3. **P1** — Build a "Phoneme Trainer" mini-mode: present pairs (e.g., `rice` vs. `lice`) with 4+ voices; learner identifies which they heard. Classic HVPT paradigm.
4. **P2** — Upgrade `score-pronunciation` to use segmental scoring (Azure Pronunciation Assessment or equivalent) that returns phoneme-level scores, not just overall similarity. Show learners which specific sound failed.
5. **P2** — Add optional IPA transcriptions to vocabulary cards (schema column) and display in a toggle; crucial for Mandarin, Arabic, etc.

---

### A.10 Corrective Feedback (`research.md` §10) — **Basic**

**Research basis.** Lyster & Ranta: recast is the most-used but least-effective (~70% unnoticed) for grammar/lexis. Negotiation of form (elicitation, metalinguistic cues, clarification) wins for grammar. Recast wins for pronunciation.

**Current state.**
- `lib/grading.ts:gradeAnswer()` returns a generic `feedback` string — same structure whether the error is grammar, vocab, or spelling.
- `correction_log` table exists (`migrations/026:8-20`) with `error_type`: grammar, vocabulary, spelling, word_order, tense, gender, other — but is not integrated into the exercise feedback loop.
- AI chat returns a `corrections` array — present but not surfaced with a differentiated UX.

**Gap.**
- All errors are treated identically. Research says this is the most common and most-researched mistake in SLA systems.
- `correction_log` is write-only; nothing reads it back to the learner.

**Improvements.**
1. **P0** — In `lib/grading.ts`, classify errors into types (grammar / lexical / phonological / spelling) using the exercise's `targetGrammar` / `targetWord` metadata and the error pattern. Return `errorType` alongside `feedback`.
2. **P0** — In exercise renderers, branch the feedback UX by `errorType`:
   - **Grammar/lexical:** metalinguistic cue ("Check the tense") + elicitation ("Try again"). Offer a rule card (§A.4).
   - **Pronunciation:** recast — play the correct audio, ask for repetition.
   - **Spelling:** show the correction inline, move on.
3. **P0** — Write to `correction_log` on every error. Display a weekly "top mistakes" review in the Review tab: "You've struggled with past tense 4 times this week — here's a targeted drill."
4. **P1** — For grammar/lexical errors, give the learner a "retry" option before showing the answer. Research (Lyster) shows this "push for modified output" is where the acquisition happens.

---

### A.11 Motivation: L2MSS & Self-Determination (`research.md` §11) — **Partial**

**Research basis.** Dörnyei's Ideal L2 Self is the strongest predictor of effort (r ≈ 0.61). SDT: competence, autonomy, relatedness sustain motivation. Extrinsic rewards can undermine intrinsic motivation.

**Current state.**
- Onboarding has a placement test and daily-goal picker.
- `stores/useAppStore.ts:14` has a transient "motivation" field but no durable profile.
- Streak + XP + league mechanics present (migrations `008`, `010`).

**Gap.**
- No explicit Ideal L2 Self elicitation ("Why do you want to learn X? Who do you want to become?"). This is the single biggest motivation lever in the research.
- No mechanism to resurface the Ideal L2 Self during slumps, streak risk, or upgrade prompts.
- Autonomy is limited: linear lesson sequence, fixed exercise order within a lesson. Learners can't choose a topic or a scenario day-to-day.

**Improvements.**
1. **P0** — Add two onboarding screens: "What kind of speaker do you want to become?" (pick 1-3: traveler, professional, family-connector, reader, gamer, etc.) and "Describe a moment you'd love to have in this language" (free text, stored durably on the user profile).
2. **P0** — Use the stored Ideal L2 Self in:
   - Streak-risk notification copy (`hooks/useNotifications.ts`): "Your future self — the one ordering coffee in Paris — wants you to stay on track."
   - Onboarding-checklist FAB copy (`components/onboarding/OnboardingChecklistFab.tsx`).
   - Occasional mid-lesson reflections ("Remember: you said you want to read Spanish novels by December").
3. **P1** — Autonomy: offer a "lesson choice" screen — "Today you can: [Food at a Restaurant] / [Ordering Coffee] / [Surprise Me]". Let the learner choose within a guided skill tree.
4. **P1** — Audit XP and badge density. Research warns that heavy extrinsic rewards can erode intrinsic motivation. Consider capping XP notifications and pushing content-based rewards (unlock a story, a scenario) ahead of pure XP.

---

### A.12 Habit Formation & Streaks (`research.md` §12) — **Strong**

**Research basis.** Duolingo's ~600 internal experiments: 7-day streak users 3.6× more likely to stay engaged; streak freeze reduced churn by 21%. Habits take ~66 days to automate; 30-day streak is a meaningful milestone.

**Current state.**
- Streaks tracked (`migrations/001:16-17`).
- Streak freeze (3/month free tier, auto-shield for paid — `migrations/010`).
- Streak-save notifications bucketed by streak length (`hooks/useNotifications.ts:121-144`).
- Daily goal: 5-30 min configurable.

**Gap.**
- The streak mechanic works, but the notification copy does not leverage Ideal L2 Self (§A.11).
- No celebration at 30/66/100 day milestones that research calls out as special.

**Improvements.**
1. **P1** — At 30, 66, and 100 day streaks: non-standard celebration screen ("Your habit is officially automatic") + a reflection prompt ("How has your Ideal L2 Self gotten closer?"). 66 specifically: cite the habit-research milestone.
2. **P1** — Streak-recovery flow: if learner just broke a streak, offer a "recovery week" with lowered daily goal for 7 days. Reduces shame spiral.
3. **P2** — Experiment with a "protected day" per week (user-chosen rest day) that doesn't break the streak. Worth A/B testing against the current all-days model.

---

### A.13 Session Structure & Microlearning (`research.md` §13) — **Partial**

**Research basis.** Optimal session 5–15 min. Research-supported sequence: warm-up review → new content → production → interaction → SRS-updating summary.

**Current state.**
- `components/lesson/LessonRunner.tsx` is a linear exercise runner + end summary.
- No warm-up review phase; learner goes straight into lesson content.
- SRS review is a separate flow (Review tab), not integrated with lessons.

**Gap.**
- Lessons are one-shot content delivery, not cognitive-science-sequenced sessions.
- Review queue sits in a separate surface; many learners may complete lessons daily but not touch review.

**Improvements.**
1. **P0** — Prepend a "warm-up" to every lesson in `LessonRunner`: 3-5 due SRS items before new content. Call it "Quick Review" visually. Huge combined benefit: retrieval practice (§A.5) + habit to engage SRS + primes the new content.
2. **P1** — End every lesson with an "integrate" phase where failed items from the lesson are immediately shown once more before the summary. Matches SRS failed-card semantics.
3. **P1** — Enforce lesson length budget: if `estimatedMinutes` > 15, split the lesson or trim exercises. Microlearning data supports 10-12 min sweet spot.

---

### A.14 CEFR, ACTFL, Four Strands Coverage (`research.md` §14) — **Partial**

**Research basis.** CEFR is the global standard. Nation's Four Strands require ~25% time each in: meaning-focused input, meaning-focused output, language-focused learning, fluency development.

**Current state.**
- CEFR tags present on cards and courses.
- `daily_stats` tracks `minutes_practiced`, `speaking_minutes`, `listening_minutes`, `reading_minutes`, `writing_minutes` (migrations `001`, `003`, `018`).
- No aggregation into Four Strands.
- **Fluency development is the weakest strand** — no 4/3/2, no shadowing, no timed tasks.

**Gap.**
- We have the raw data but no coverage dashboard.
- Learners have no feedback loop telling them, "you're over-indexing on drills, under-indexing on real reading."
- Fluency exercises (repeating a task faster each time) don't exist as a type.

**Improvements.**
1. **P1** — Add a strand classification per exercise type (store in a constant or on the exercise definition):
   - Meaning-focused input: listening_choice, listening_type, reading passages, daily news.
   - Meaning-focused output: translate_to_target, free_production, speaking, mini_dialogue, AI chat.
   - Language-focused learning: cloze, word_form, sentence_transformation, error_correction, SRS vocab review, grammar drills.
   - Fluency development: (new exercise types — see #3 below).
2. **P1** — Build a "Balance" dashboard on the Profile/Progress screen showing weekly time in each strand as a stacked bar + target (~25% each). Use existing `daily_stats` columns.
3. **P1** — Add fluency-development exercise types:
   - **4/3/2**: Speak on a topic 4 min, then the same 3 min, then 2 min (research-backed classroom technique).
   - **Shadowing**: Audio plays, learner repeats in real time; score based on timing alignment.
   - **Timed reading**: known passage, target WPM improves over repeated attempts.
4. **P2** — Map CEFR can-do statements (ACTFL NCSSFL-ACTFL list) to learner milestones. At each level-up: "You can now: [three specific can-dos]".

---

### A.15 Adaptive Sequencing (`research.md` §17 open question) — **Missing**

**Research basis.** Adaptive difficulty is an open research question. Some responsiveness helps (aligns with i+1); over-responsiveness can feel unstable. Literature inconclusive on how aggressive to be.

**Current state.**
- Lessons are fully linear; exercises within lessons are a fixed sequence.
- SRS is the only adaptive component.

**Gap.**
- A learner who aces the first 5 exercises still does the remaining 10 at the same difficulty.
- A learner who fails 5 in a row still gets the rest without scaffolding.

**Improvements.**
1. **P2** — Experiment (not ship immediately): in-lesson adaptive routing. If the learner gets the first 3 exercises correct + fast, skip 2 easy exercises and jump to the production portion. If they fail 3, insert a rule card and an easier recall exercise.
2. **P2** — Before shipping, A/B test against the current fixed sequence. Research caveat: "Is difficulty aggressively adapted or stable?" is explicitly an open question in `research.md §17`.

---

### A.16 Content Safety & Level Check (CLAUDE.md) — **Missing**

**Research basis.** Not a research point per se, but CLAUDE.md mandates `ContentSafetyValidator` and `LevelChecker` pipelines, and Krashen's i+1 requires level validation.

**Current state.**
- Neither class/module exists in the codebase.
- Voice-proxy system prompt has a "stay on topic" clause but it's soft enforcement.
- AI-generated content (daily news, stories, exercises) passes through no programmatic safety or level gate.

**Gap.**
- Direct violation of CLAUDE.md §5: *"Always run through the safety pipeline"* and *"Never generate exercises for a user without a loaded ProficiencyLevel."*

**Improvements.**
1. **P0** — Implement a `ContentSafetyValidator` in `lib/content-safety.ts`. Inputs: generated text + user age. Outputs: `{ safe: boolean, reasons: string[] }`. Checks: profanity, adult content, politically charged topics, self-harm. Use a small, fast model (Haiku) or a deterministic filter for common cases.
2. **P0** — Implement a `LevelChecker` in `lib/level-check.ts`. Inputs: generated text + target CEFR. Outputs: `{ inRange: boolean, detectedLevel: CEFR, reason: string }`. Heuristic: vocabulary frequency distribution + sentence complexity; optionally confirm via LLM call.
3. **P0** — Run both validators before surfacing any AI-generated exercise, story, daily news article, or chat response to a user. Log failures; regenerate on failure; hard-fall-back to a pre-authored alternative after 2 retries (as CLAUDE.md prescribes).
4. **P1** — Add an admin view to inspect validator rejection rates per edge function. Useful signal for whether a given generator is mis-tuned.

---

## Part B — Prioritized Roadmap

### Phase 0 — Correctness / compliance (1–2 weeks)

These are items where the infrastructure exists or CLAUDE.md already mandates them. Lowest-effort + high-value.

- [ ] A.16.1 — Implement `ContentSafetyValidator`.
- [ ] A.16.2 — Implement `LevelChecker`.
- [ ] A.16.3 — Wire both into all AI edge functions (daily-news, generate-story, ai-chat, grade-writing).
- [ ] A.6.1 — Enforce the 20-new-cards/day cap.
- [ ] A.1.1 — Filter content fetches by learner CEFR ± 1 level.
- [ ] A.4.1 — Build `<RuleCard>` component (existing `grammar_rules` table, zero UI).
- [ ] A.4.2 — Highlight `targetWord`/`targetGrammar` in exercise prompts.
- [ ] A.10.1 — Classify errors by type in `lib/grading.ts`.
- [ ] A.10.3 — Write to `correction_log` on error + expose weekly top-mistakes drill.
- [ ] A.13.1 — Prepend SRS warm-up to every lesson.
- [ ] A.11.1 — Add Ideal L2 Self elicitation to onboarding.

### Phase 1 — New learning mechanisms (3–6 weeks)

High-impact additions that require new code, but have clear research support.

- [ ] A.9.1 — Expand TTS to multi-voice per language (HVPT foundation).
- [ ] A.9.3 — Build Phoneme Trainer mini-mode.
- [ ] A.8.1 — Sequence new vocab by `frequency_rank`.
- [ ] A.8.2 — Treat chunks/collocations as first-class SRS items.
- [ ] A.7.1–A.7.2 — Per-item accuracy tracking + interleaving gate at 80%.
- [ ] A.14.1–A.14.2 — Four Strands classification + Balance dashboard.
- [ ] A.14.3 — Add fluency-development exercises (4/3/2, shadowing, timed reading).
- [ ] A.2.3 — Lesson-internal recognition → production progression.
- [ ] A.11.3 — Lesson-choice screen for autonomy.
- [ ] A.3.1 — Negotiation-of-meaning requirement in AI system prompts.
- [ ] A.12.1 — 30/66/100 day streak milestone celebrations tied to Ideal L2 Self.

### Phase 2 — Research-open experiments (validate via A/B)

Items the literature supports but where implementation details are open or could harm if tuned wrong. Ship behind a flag; measure.

- [ ] A.15.1 — Adaptive per-lesson routing (easier / harder branches).
- [ ] A.9.4 — Segmental pronunciation scoring (Azure Pronunciation Assessment).
- [ ] A.5.3 — Recall-only mode (remove multiple-choice for a user segment).
- [ ] A.12.3 — Protected-day streak model.
- [ ] A.14.4 — Can-do milestone mapping per level-up.

---

## Part C — Cross-Cutting Rules (enforce in code review)

These are invariants derived from the research. Consider encoding them as lint rules, integration tests, or CI checks.

1. **Every lesson must contain ≥1 production exercise** (translate / speak / free-write / construction). Covered by CLAUDE.md partially; make it testable.
2. **No AI-generated content reaches the learner without passing through `ContentSafetyValidator` and `LevelChecker`**.
3. **No content with `cefr_level > user.cefr_level + 1` is ever surfaced** (hard block >+2).
4. **Every failed exercise writes to `correction_log`** with typed `error_type`.
5. **Every wrong grammar answer triggers a rule card** (no silent "Correct answer is X").
6. **Every lesson starts with SRS warm-up** (≥3 due items if available).
7. **New cards/day cap is enforced server-side**, not just configured.
8. **TTS voices per language ≥ 4** (or all available on platform).
9. **Grammar rule explanations ≤ 60 words** (FonF > FonFs for implicit knowledge; long explanations hurt).
10. **Every user has a durable `ideal_l2_self` field populated during onboarding**.

---

## Changelog
- **2026-04-22** — Initial document derived from `research.md` + full codebase audit.
