# Fluenci — Educational Improvements Plan

*Generated: 2026-03-21 | Based on analysis of current codebase + research into Duolingo, Babbel, Pimsleur, Rosetta Stone, Speak, Lingvist, Anki/FSRS, and language acquisition research (Krashen, Swain, Karpicke & Roediger).*

---

## Table of Contents

1. [Spaced Repetition: Upgrade from SM-2 to FSRS](#1-spaced-repetition-upgrade-from-sm-2-to-fsrs)
2. [Exercise Design: Shift from Recognition to Production](#2-exercise-design-shift-from-recognition-to-production)
3. [Vocabulary: Context-First, Not Isolated Words](#3-vocabulary-context-first-not-isolated-words)
4. [Course Structure: Real-World Communicative Goals](#4-course-structure-real-world-communicative-goals)
5. [AI Conversation: Make It the Core Differentiator](#5-ai-conversation-make-it-the-core-differentiator)
6. [Pronunciation & Speaking: Graduated Interval Recall](#6-pronunciation--speaking-graduated-interval-recall)
7. [The Intermediate Plateau Problem](#7-the-intermediate-plateau-problem)
8. [Progressive L1 Reduction (Immersion Ladder)](#8-progressive-l1-reduction-immersion-ladder)
9. [Grading & Feedback Improvements](#9-grading--feedback-improvements)
10. [Gamification That Drives Learning (Not Just Engagement)](#10-gamification-that-drives-learning-not-just-engagement)
11. [Content Quality: No Nonsensical Sentences](#11-content-quality-no-nonsensical-sentences)
12. [Lesson Pacing & Session Design](#12-lesson-pacing--session-design)
13. [Adaptive Difficulty: Beyond CEFR Buckets](#13-adaptive-difficulty-beyond-cefr-buckets)
14. [Priority Roadmap](#14-priority-roadmap)

---

## 1. Spaced Repetition: Upgrade from SM-2 to FSRS

### Current State
- `lib/adaptive.ts` (113 lines) implements SM-2 with fixed formula intervals
- `lib/grading.ts` (159 lines) converts grades to 0-5 SRS ratings
- Cards track: easeFactor, interval, repetitions, nextDue

### Problem
SM-2 uses a fixed formula that doesn't learn from individual user behavior. Users review more cards than necessary to maintain the same retention level. After a study break, SM-2 has no mechanism to adjust — users return to a wall of overdue cards.

### Research
- **FSRS (Free Spaced Repetition Scheduler)** uses machine learning to find optimal intervals from a user's actual review history
- **20-30% fewer reviews** for the same retention level (empirically validated)
- Adopted by Anki 23.10+ as the default algorithm
- FSRS-6 (latest) adds same-day review parameters and forgetting curve shape control
- **LECTOR (2025)** uses LLMs for semantic analysis of card content, achieving 90.2% success rate vs 88.4% for previous best
- Open-source implementation available: [github.com/open-spaced-repetition/fsrs-rs](https://github.com/open-spaced-repetition/fsrs-rs)

### Recommendation
**Replace SM-2 with FSRS in `lib/adaptive.ts`.** Key changes:
1. Track per-card review history (not just current state) to enable personalized scheduling
2. Add a `desired_retention` parameter (default 0.9) that users can tune
3. Implement FSRS-6 stability/difficulty model instead of SM-2's easeFactor
4. Add graceful re-entry after study breaks (FSRS handles this natively)
5. Future: explore LECTOR-style content-aware scheduling for semantically related vocabulary

### Impact
- Users spend less time reviewing, more time learning new material
- Better retention with less effort = higher satisfaction and retention
- Differentiator vs. competitors still on SM-2

---

## 2. Exercise Design: Shift from Recognition to Production

### Current State
`components/lesson/LessonRunner.tsx` (257 lines) supports 6 exercise types:
1. `multiple_choice` — Recognition (tap correct answer)
2. `listening` — Semi-active (listen + pick/type)
3. `translate_l1_to_l2` — Active production
4. `translate_l2_to_l1` — Active production
5. `speaking` — Active production
6. `free_production` — Active production (AI-graded)

### Problem
Multiple choice creates an **illusion of knowledge** — users can recognize correct answers without being able to produce them in conversation. This is the #1 criticism of Duolingo (Karpicke & Roediger, 2008: retrieval practice enhances learning far more than rereading/recognition).

### Research
- Active recall (production) is dramatically more effective than passive recognition
- Output Hypothesis (Swain): production forces noticing gaps, hypothesis testing, and metalinguistic reflection — cognitive processes that comprehension alone doesn't trigger
- Recognition helps learners notice familiar material; only recall helps them produce it in conversation

### Recommendation
**Target: 70%+ of exercises should require active production.**

1. **Limit multiple choice to first exposure only** — when a word/phrase is brand new, use recognition to introduce it. After the first successful recognition, never show multiple choice for that item again.
2. **Add "type the answer" variants for all recognition exercises** — instead of tapping, user types the translation
3. **Add cloze deletion exercises** — show a sentence with a blank, user types the missing word in context
4. **Add sentence construction** — give user shuffled words, they arrange into correct sentence (more active than multiple choice, less demanding than free typing)
5. **Add dictation exercises** — play audio, user types what they heard (combines listening + production)
6. **Track production ratio per user** — ensure the 70% threshold is maintained across all sessions

### New Exercise Types to Implement
| Exercise | Type | Description | Difficulty |
|----------|------|-------------|------------|
| Cloze deletion | Production | Fill in the blank within a context sentence | Medium |
| Sentence construction | Semi-production | Arrange word tiles into correct order | Medium |
| Dictation | Production | Listen and type what you hear | Medium-Hard |
| Dialogue completion | Production | Complete your side of a conversation | Hard |
| Picture description | Production | Describe an image in target language | Hard |
| Error correction | Production | Find and fix the error in a sentence | Hard |

---

## 3. Vocabulary: Context-First, Not Isolated Words

### Current State
Cards are atomic learning items (word, phrase, or sentence) with translations and audio. The current structure supports context but doesn't enforce it.

### Problem
Research overwhelmingly shows isolated word lists create "dead ends" in memory — words learned without context lead to poor retrieval in real situations. Context forces deeper cognitive processing and builds retrieval pathways.

### Research
- Contextual learning produces better retention than isolated word lists (PMC, 2022)
- Words learned in context lead to more appropriate and nuanced usage
- For beginners, some scaffolding is needed — pure context-based learning is less effective at very low proficiency
- Clozemaster's success validates context-first vocabulary at scale

### Recommendation
**Every vocabulary item must appear in at least 3 context sentences.**

1. **Minimum 3 example sentences per card** — stored in the cards table, used in exercises
2. **Context sentences should be real-world applicable** — "Where is the train station?" not "The elephant reads a newspaper"
3. **Progressive context complexity:**
   - A1: Simple, high-frequency sentences (5-8 words)
   - A2: Compound sentences with common connectors
   - B1: Complex sentences with subordinate clauses
   - B2+: Authentic text excerpts, idiomatic usage
4. **Cloze exercises as default** — show the context sentence with the target word blanked out, rather than showing the word in isolation
5. **Collocations and chunks** — teach words with their most common partners ("make a decision" not just "decision")

### Database Change
Add to cards table:
```sql
ALTER TABLE cards ADD COLUMN context_sentences jsonb DEFAULT '[]';
-- Format: [{"text": "¿Dónde está la estación?", "translation": "Where is the station?", "audio_url": "..."}]
ALTER TABLE cards ADD COLUMN collocations text[] DEFAULT '{}';
```

---

## 4. Course Structure: Real-World Communicative Goals

### Current State
Courses organized as: Course → Unit → Lesson → Card. Units are thematic groups (e.g., "Greetings", "Food & Drink"). Each lesson has 10-15 exercises.

### Problem
Many language apps organize by grammar categories ("present tense verbs", "adjective agreement") rather than communicative goals. Research shows thematic, task-based organization produces 45% better outcomes (Duolingo internal study).

### Research
- Babbel: every unit maps to a real communicative goal (ordering food, asking directions)
- ACTFL Guiding Principles: oral interpersonal communication tasks for information exchange
- Backward design: start from what the learner needs to DO, work backward to exercises
- Top 10 research-backed techniques: explicit, systematic, differentiated instruction within meaningful communicative contexts

### Recommendation
**Restructure units around "Can-Do" statements aligned with CEFR descriptors.**

### Proposed Unit Structure (Spanish Example)

#### A1 — Survival (Units 1-10)
| Unit | Can-Do Goal | Key Vocabulary | Key Grammar |
|------|------------|----------------|-------------|
| 1 | Greet people and introduce yourself | hola, me llamo, mucho gusto | ser (yo/tú), llamarse |
| 2 | Order food and drinks at a café | café, agua, cuenta, quiero | querer + noun, por favor |
| 3 | Ask for and give directions | izquierda, derecha, recto | estar, imperative basics |
| 4 | Talk about your family | madre, hermano, tengo | tener, possessives |
| 5 | Shop for groceries and clothes | cuánto cuesta, talla, kilo | numbers 1-100, demonstratives |
| 6 | Make a phone call / send messages | llamar, mensaje, número | present -ar verbs |
| 7 | Describe your daily routine | levantarse, desayunar, ir | reflexive verbs, time |
| 8 | Talk about weather and plans | hace sol, llueve, vamos a | ir a + infinitive |
| 9 | Book a hotel room or Airbnb | reserva, noche, habitación | present -er/-ir verbs |
| 10 | Handle a basic emergency | ayuda, hospital, policía | necesitar, deber |

#### A2 — Expanding (Units 11-20)
| Unit | Can-Do Goal |
|------|------------|
| 11 | Describe past events (what you did yesterday) |
| 12 | Talk about your hobbies and interests |
| 13 | Navigate public transportation |
| 14 | Visit a doctor and describe symptoms |
| 15 | Have a job interview conversation |
| 16 | Tell a story about a childhood memory |
| 17 | Plan a trip with a friend |
| 18 | Discuss food preferences and cook a recipe |
| 19 | Handle a disagreement politely |
| 20 | Write a formal email |

#### B1 — Independent (Units 21-30)
| Unit | Can-Do Goal |
|------|------------|
| 21 | Discuss current events and news |
| 22 | Express opinions and debate politely |
| 23 | Negotiate a price or contract |
| 24 | Explain a technical problem (IT, car, appliance) |
| 25 | Discuss cultural differences |
| 26 | Tell jokes and use humor |
| 27 | Handle bureaucracy (bank, government office) |
| 28 | Describe a movie, book, or show you enjoyed |
| 29 | Give a short presentation on a topic |
| 30 | Have a deep conversation about life goals |

#### B2+ — Fluent (Units 31-40)
Focus shifts to AI conversation practice with authentic content (news articles, podcasts, literature). Structured courses give way to immersive practice.

---

## 5. AI Conversation: Make It the Core Differentiator

### Current State
- `supabase/functions/ai-chat/index.ts` — text conversation with Claude Haiku
- `supabase/functions/tutor-message/index.ts` — scenario-based tutoring
- `supabase/functions/voice-token/index.ts` — LiveKit real-time voice
- System prompts build level-specific instructions (beginner through advanced)

### Problem
Current AI conversation is functional but generic. The system prompt doesn't enforce pedagogical structure — conversations can meander without teaching goals.

### Research
- **Speak** (valued at $1B+): roleplay scenarios that feel like real conversations with real-time feedback
- Users will pay for speaking practice without a human tutor
- The key is making roleplay scenarios feel natural while providing actionable feedback

### Recommendation
**Structure AI conversations around the unit's Can-Do goals with progressive scaffolding.**

1. **Scenario-linked conversations** — each unit's AI conversation should practice that unit's communicative goal (e.g., Unit 2 = ordering at a café)
2. **Scaffolded difficulty within conversation:**
   - Turn 1-3: AI guides heavily, provides vocabulary hints
   - Turn 4-6: AI reduces hints, expects more production
   - Turn 7+: Free conversation within the scenario
3. **In-conversation corrections** — don't just flag errors at the end. Provide gentle, inline corrections: "Good try! The correct form is 'quiero' not 'quere'. Let's continue..."
4. **Conversation summary with SRS integration** — after conversation ends, extract new vocabulary and errors → add to SRS review queue automatically
5. **Pronunciation feedback during voice conversations** — real-time, not just end-of-session scoring
6. **AI personality consistency** — tutor profiles should have consistent personality across sessions (users build rapport)

### System Prompt Improvement (Example)
```
Current: "You are a language tutor for Spanish learners at CEFR A1."

Improved: "You are María, a friendly café owner in Madrid. The student is
practicing ordering food and drinks (Unit 2, CEFR A1).

RULES:
- Stay in character as María
- Only use vocabulary from: [quiero, café, agua, cuenta, por favor, gracias,
  con leche, sin azúcar, bocadillo, tapas]
- If the student makes an error, gently correct inline and continue
- After 3 successful exchanges, introduce ONE new vocabulary word with context
- Track: words used correctly, errors made, new words introduced
- End with a brief summary of what was practiced"
```

---

## 6. Pronunciation & Speaking: Graduated Interval Recall

### Current State
- `supabase/functions/score-pronunciation/index.ts` — Deepgram Nova-3 transcription + Claude feedback
- Scoring rubric: pronunciation 40%, fluency 30%, rhythm 30%
- `hooks/useSpeakingPractice.ts` — client-side speaking practice flow

### Problem
Pronunciation practice happens in isolation — users practice a phrase once and move on. Pimsleur's research shows that graduated interval recall within a single session dramatically improves spoken retention.

### Research
- **Pimsleur Graduated Interval Recall:** 5s → 25s → 2min → 10min → 1hr → 5hr → 1 day → 5 days → 25 days → 4 months → 2 years
- Columbia University: "major strengths in promoting noticing, awareness and longer memory retention"
- Critical requirement: users must actively produce speech, not just listen passively

### Recommendation
**Implement within-session graduated interval recall for pronunciation.**

1. **New exercise type: "Echo Practice"**
   - Hear a phrase → repeat it immediately (5s recall)
   - Continue with other exercises
   - Hear the same phrase again after 2 minutes → repeat
   - Hear it again after 10 minutes → repeat
   - Score improves each time → positive reinforcement
2. **Shadow reading** — play audio of a passage, user reads along simultaneously, then reads alone
3. **Minimal pair drills** — practice sounds that are commonly confused (pero/perro, caro/carro)
4. **Speed ladder** — same phrase at 0.75x → 1.0x → 1.25x speed
5. **Audio speed control** — let users slow down any audio to 0.5x-0.75x for difficult pronunciations (currently missing)

---

## 7. The Intermediate Plateau Problem

### Current State
Course structure goes A1 → A2 → B1 → B2 → C1 → C2, but content depth and exercise variety likely thin out significantly past A2.

### Problem
This is the #1 failure point for language apps. Users reach A2-B1 and hit a plateau where:
- Multiple choice becomes too easy but free production is too hard
- Vocabulary acquisition slows (diminishing returns on high-frequency words)
- Grammar becomes more nuanced and harder to teach through exercises alone
- Users lose motivation because progress feels invisible

### Research
- Most apps lose users at the intermediate level
- Duolingo's own data shows sharp drop-off after beginner content
- The solution requires different exercise types, not more of the same
- AI conversation practice and authentic content are key to breaking through

### Recommendation
**Design explicit "plateau-breaking" content for B1+.**

1. **Authentic content integration** (B1+):
   - News articles via `supabase/functions/news-sync/index.ts` (already exists!) — expand usage
   - Podcast transcripts with comprehension questions
   - Short story excerpts with vocabulary annotation
   - Song lyrics with fill-in-the-blank
2. **Debate and opinion exercises** (B1+):
   - AI presents a topic, user must argue a position in target language
   - Structured: "Give 3 reasons why..." with AI feedback on argumentation quality
3. **Register switching** (B2+):
   - Same scenario at formal vs. informal register
   - Email vs. text message for same content
   - Professional vs. casual conversation
4. **Error journal** — track user's persistent errors across all sessions, create personalized drill sessions targeting weak points
5. **Fluency metrics** — show users their words-per-minute in conversation, vocabulary diversity score, and grammar accuracy trend over time (not just XP)

---

## 8. Progressive L1 Reduction (Immersion Ladder)

### Current State
Exercises show translations (L1 ↔ L2) at all levels. No progression toward immersion.

### Research
- Rosetta Stone's pure immersion approach: no translations, deduce meaning from context
- Too extreme for beginners, but the principle is sound
- Adults benefit from some explicit instruction but should progressively reduce L1 dependence

### Recommendation
**Implement a 5-stage immersion ladder tied to CEFR level.**

| Stage | CEFR | L1 Support | Exercise Changes |
|-------|------|-----------|-----------------|
| 1 | A1 | Full translations, L1 instructions | Multiple choice with L1 options |
| 2 | A2 | Translations available but hidden (tap to reveal) | Instructions shift to simple L2 |
| 3 | B1 | L2 definitions instead of translations | Monolingual dictionary lookups |
| 4 | B2 | L2 definitions + context only | AI conversations in L2 only |
| 5 | C1+ | No L1 support | All content, instructions, feedback in L2 |

Implementation: Add `immersion_level` (1-5) to user profile, tied to CEFR but user-adjustable. Components check this to determine whether to show translations.

---

## 9. Grading & Feedback Improvements

### Current State
- `lib/grading.ts`: 3-tier grading (exact → fuzzy Levenshtein ≤2 → similarity 0.6 threshold)
- `gradeToRating()` converts to 0-5 SRS rating with response time bonus (<5s)
- AI grading for free production via Edge Functions

### Problems
1. Levenshtein distance of ≤2 for words under 8 chars is too generous — "gato" (cat) and "rato" (mouse) are distance 1 but completely different words
2. No accent sensitivity at intermediate+ levels — "el" (the) vs "él" (he) changes meaning
3. No partial credit — answer is either correct or incorrect
4. Response time bonus (<5s) may reward guessing over careful thought

### Recommendation

1. **Semantic-aware fuzzy matching** — before accepting a fuzzy match, check that the matched word has the same meaning. Use a small lookup table of confusable pairs per language.
2. **Progressive accent enforcement:**
   - A1-A2: Accept missing accents (current behavior)
   - B1: Warn about missing accents but accept
   - B2+: Require correct accents
3. **Partial credit scoring** — for sentence translation, score each word/phrase independently:
   - 100%: perfect translation
   - 75%: correct meaning, minor grammar error
   - 50%: partially correct, key error
   - 25%: attempted, mostly wrong
   - 0%: no attempt or completely wrong
4. **Response time: remove bonus, add insight** — don't reward speed. Instead, show response time as a personal metric ("You're getting faster at food vocabulary!") without affecting the SRS rating.
5. **"Show me why" feedback** — when marking incorrect, show not just the correct answer but a brief explanation of WHY (grammar rule, usage note). Can be AI-generated and cached.

---

## 10. Gamification That Drives Learning (Not Just Engagement)

### Current State
- XP earned per lesson (base reward + 5 per correct answer)
- No streak system visible
- No leaderboards
- No achievements/badges
- Daily goal set during onboarding but not tracked visibly

### Research
- Users who maintain a 7-day streak are **3.6x more likely** to stay engaged long-term (Duolingo)
- "Streak Freeze" reduced churn by 21% for at-risk users
- Leaderboard users complete **40% more lessons** per week
- Leagues (7-day XP competitions) increased lesson completion by 25%
- Meta-analysis (41 studies, 5,071 participants): **large effect size (g = 0.822)** on learning outcomes
- Caution: motivation gains don't always translate to learning outcomes — gamification should reinforce learning behaviors, not replace them

### Recommendation

**Tier 1 — Launch Priority (high impact, low effort):**
1. **Streak counter** — consecutive days with at least 1 completed lesson/review session. Show prominently on home screen.
2. **Streak freeze** — purchasable with in-app currency (earned XP). Preserves streak for 1 missed day.
3. **Daily goal progress bar** — "8 / 15 minutes today" visible on every tab.
4. **Session summary with stats** — "You learned 12 new words this week. That's 40% more than last week!"

**Tier 2 — Post-Launch (medium effort):**
5. **Weekly leagues** — 30 users compete on weekly XP. 10 tiers. Top 10 promote, bottom 5 demote.
6. **Achievement badges** — milestone-based (first lesson, 7-day streak, 100 words learned, first AI conversation, first perfect lesson)
7. **Mastery indicators** — words/phrases show strength bars (weak → strong) based on SRS performance. Visual progress.

**Tier 3 — Differentiation (higher effort):**
8. **"Words Known" counter** — total vocabulary size prominently displayed. Grows daily. Incredibly motivating.
9. **Accuracy trends** — show weekly accuracy graph. Users see improvement over time.
10. **Learning insights** — "Your strongest topic: Food & Drink (94% accuracy). Weakest: Past tense (67%). Practice recommended."

---

## 11. Content Quality: No Nonsensical Sentences

### Problem
The #1 user complaint about Duolingo is nonsensical sentences ("The bed is food", "My horse speaks French"). These entertain but don't build real communicative ability.

### Recommendation
**Every sentence in the app must pass the "Would someone actually say this?" test.**

Content guidelines for sentence creation:
1. **Real-world applicable** — every sentence should model something a learner would actually say or hear
2. **Culturally relevant** — include cultural context (tipping customs, formal/informal address rules, gestures)
3. **Progressively complex** — A1 sentences are simple and formulaic; B2 sentences are nuanced and idiomatic
4. **No grammar-only sentences** — don't construct sentences just to practice a grammar point. Find real sentences that naturally contain the target structure.
5. **Varied registers** — include both formal and informal variants where applicable
6. **Regional variants** — flag Latin American vs. Castilian Spanish, Brazilian vs. European Portuguese, etc.

### Quality Checklist for Content Creators
- [ ] Would a native speaker actually say this sentence?
- [ ] Does this sentence teach something useful for real communication?
- [ ] Is the vocabulary high-frequency for this CEFR level?
- [ ] Does the sentence include cultural context where relevant?
- [ ] Are there at least 3 context sentences per vocabulary item?

---

## 12. Lesson Pacing & Session Design

### Current State
- Lessons contain 10-15 exercises
- Start with recognition, progress to production within a single lesson
- End with summary: items learned, accuracy, XP earned

### Research
- Babbel: 10-15 minute lessons designed for daily habit fit
- Optimal session: introduce 5-7 new items, review 10-15 due items, mix exercise types
- Attention spans drop after 15 minutes — sessions should end before fatigue

### Recommendation

1. **Dynamic lesson length** — instead of fixed 10-15 exercises, adjust based on:
   - User's daily goal setting (5 min / 10 min / 15 min / 20 min)
   - Current accuracy (struggling → fewer new items, more review)
   - Time of day (morning sessions can be longer; late-night shorter)
2. **Interleaving** — mix new material with review of older material within each lesson. Don't front-load all new items.
3. **Micro-review breaks** — every 5 exercises, do a quick 2-question review of items from the current session
4. **End on a win** — if the last exercise was incorrect, add one more easy exercise so the session ends positively
5. **Post-lesson reflection prompt** — "Which word was hardest? Tap to add extra practice." Metacognition improves retention.

---

## 13. Adaptive Difficulty: Beyond CEFR Buckets

### Current State
- `lib/adaptive.ts`: CEFR-based adaptation using error_rate + vocabulary count + session count
- `shouldLevelUp`: error_rate < 0.15
- `shouldLevelDown`: error_rate > 0.40
- Exponential moving average (alpha=0.3) for error_rate tracking

### Problem
CEFR levels are coarse (6 levels for the entire journey). A user at "B1" may be great at reading but terrible at speaking. Single error_rate doesn't capture skill-specific proficiency.

### Recommendation

1. **Skill-specific proficiency tracking:**
   ```
   user_proficiency: {
     reading: { cefr: "B1", error_rate: 0.12 },
     writing: { cefr: "A2", error_rate: 0.28 },
     listening: { cefr: "B1", error_rate: 0.15 },
     speaking: { cefr: "A2", error_rate: 0.35 },
     vocabulary: { cefr: "B1", words_known: 2400 },
     grammar: { cefr: "A2", error_rate: 0.22 }
   }
   ```
2. **Recommend exercises targeting weakest skill** — "Your speaking is behind your reading. Try a conversation practice today."
3. **Topic-specific difficulty** — track accuracy per unit theme, not just overall. User may ace "Food" but struggle with "Healthcare."
4. **Confidence intervals** — don't level up/down based on single sessions. Require consistent performance over 3+ sessions.
5. **User-visible skill radar chart** — show the 4-skill breakdown visually so users understand their strengths/weaknesses.

---

## 14. Priority Roadmap

### Phase 1 — Launch Critical (Before App Store Submission)
| # | Improvement | Effort | Impact | File(s) Affected |
|---|-----------|--------|--------|-------------------|
| 1 | Streak system + daily goal tracking | Medium | Very High | New: `lib/streaks.ts`, `components/ui/StreakBadge.tsx` |
| 2 | Ensure 70%+ production exercises | Low | Very High | `components/lesson/LessonRunner.tsx`, exercise config |
| 3 | Context sentences for all vocabulary | Medium | High | Database migration, card data |
| 4 | Session summary with progress stats | Low | High | `components/lesson/LessonRunner.tsx` summary phase |
| 5 | Audio speed control (0.5x - 1.5x) | Low | Medium | `components/audio/AudioPlayButton.tsx` |

### Phase 2 — Post-Launch Month 1
| # | Improvement | Effort | Impact |
|---|-----------|--------|--------|
| 6 | Upgrade SM-2 to FSRS | High | Very High |
| 7 | Cloze deletion + dictation exercises | Medium | High |
| 8 | Progressive accent enforcement | Low | Medium |
| 9 | Achievement badges (10 initial) | Medium | High |
| 10 | Words Known counter | Low | High |

### Phase 3 — Post-Launch Month 2-3
| # | Improvement | Effort | Impact |
|---|-----------|--------|--------|
| 11 | Skill-specific proficiency tracking | High | Very High |
| 12 | Weekly leagues / leaderboards | High | High |
| 13 | Immersion ladder (progressive L1 reduction) | Medium | High |
| 14 | Scenario-linked AI conversations | Medium | Very High |
| 15 | Graduated interval recall for pronunciation | Medium | High |

### Phase 4 — Scaling (Month 3+)
| # | Improvement | Effort | Impact |
|---|-----------|--------|--------|
| 16 | Authentic content integration (news, podcasts) | High | Very High |
| 17 | Debate/opinion exercises for B1+ | Medium | High |
| 18 | Partial credit scoring | Medium | Medium |
| 19 | Error journal with personalized drills | High | High |
| 20 | Register switching exercises (B2+) | Medium | Medium |

---

## Sources

- Duolingo Gamification Studies — StriveCloud, Orizon, Trophy, Young Urban Project
- Babbel Pedagogical Approaches — Official whitepaper (Yale, CUNY, Michigan State validation)
- Pimsleur Graduated Interval Recall — Columbia University study
- Rosetta Stone Dynamic Immersion — Official methodology docs
- FSRS Algorithm — QuizCat, Brainscape, Domenic Denicola analysis, open-spaced-repetition GitHub
- LECTOR (2025) — arXiv paper on LLM-enhanced SRS
- Krashen Input Hypothesis & 2025 Critique — PMC, Frontiers in Education
- Active Recall Research — Karpicke & Roediger (2008), Aprelendo, WordTap
- Contextual Vocabulary Learning — Clozemaster blog, PMC (2022)
- Gamification Meta-Analyses — Frontiers in Psychology (2023, 2024), Springer (2019)
- Output Hypothesis — Swain via Vaia, UChicago
- Speak App — Official site, OpenAI partnership announcement
- ACTFL Guiding Principles — Official guidelines
- Language Gym — Gianfranco Conti research compilations
