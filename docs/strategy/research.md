# Research: Science of Effective Language Learning

This document is a living reference of empirically-supported findings from applied linguistics, cognitive science, and second language acquisition (SLA) research. It is intended to guide curriculum, exercise design, and UX decisions in this app. Every course/lesson change should cite or be consistent with the principles below.

**Scope:** peer-reviewed journals (Applied Linguistics, Studies in Second Language Acquisition, TESOL Quarterly, Language Learning, Foreign Language Annals), meta-analyses, research from Harvard, Yale, Stanford, Columbia, Cambridge, UCLA (Bjork Lab), Purdue (Karpicke), Victoria University of Wellington (Nation), and independent efficacy studies (Vesselinov & Grego).

**Last updated:** 2026-04-22

---

## 0. Executive Summary — The Nine Principles

If we do only nine things right, research predicts we will outperform typical apps:

1. **Input must be comprehensible and slightly beyond the learner's level** (i+1). Adapt difficulty in real time.
2. **Force retrieval, not recognition.** Testing produces ~50% better long-term retention than re-study.
3. **Space repetitions.** Early frequent, then expanding intervals. SM-2 is a proven baseline.
4. **Interleave skills and exercise types** once a learner has minimum baseline accuracy — not before.
5. **Push output.** Production (speaking/writing) drives acquisition in ways input cannot.
6. **Provide meaningful interaction with negotiation of meaning**, not just drills.
7. **Teach high-frequency vocabulary first** — the top 2–3k words cover 80–95% of speech.
8. **Balance Paul Nation's "Four Strands"**: meaning-focused input, meaning-focused output, language-focused learning, fluency development (~25% each).
9. **Build habit via streaks, short sessions, and variable rewards** — but protect intrinsic motivation.

---

## 1. Input: Comprehensible Input & Extensive Exposure

### 1.1 Krashen's Input Hypothesis (i+1)
- **Claim:** Learners acquire language when they receive input that is understandable but slightly above their current competence (`i+1`).
- **Evidence:** Multiple studies on free voluntary reading show gains in vocabulary, grammar, and spelling without explicit instruction.
- **Caveats (well-documented):** The hypothesis is underspecified and not falsifiable as stated. Input alone is insufficient — French immersion students in Canada reached near-native comprehension but plateaued in production. This motivated Swain's Output Hypothesis (§2).
- **Implication for app:** Every exercise/reading/listening should target the learner's current CEFR band + ~1 sub-level. Cache difficulty tags per item. Never show content that is >2 CEFR sub-levels above current.

### 1.2 Extensive Reading / Listening
- **Nakanishi (2015), TESOL Quarterly** meta-analysis of 34 pre/post comparisons: extensive reading improved L2 reading proficiency, reading speed, vocabulary, and grammar. Effect sizes: within-group d = 0.71, vs. control d = 0.46.
- Effects were **larger when learners had some accountability** (comprehension checks, reflections) and **smaller when text choice was unconstrained**.
- **Implication:** Offer self-selected reading/listening with light accountability (post-read comprehension prompt or a single recall question). Track time-on-input.

### 1.3 Vocabulary Size Thresholds (Nation)
| Goal | Word Families Needed | Coverage |
|---|---|---|
| Conversation comprehension | 6,000–7,000 | — |
| TV / movies | 3,000 + proper nouns | — |
| Novels / newspapers (unassisted) | 8,000–9,000 | 98% |
| Typical text (assisted) | 3,000 | 95% |

- The top 1,000 words cover ~70% of running text; top 2,000 cover ~80%.
- **Implication:** Sequence vocabulary by corpus frequency (BNC/COCA or equivalent per language). Don't teach niche vocabulary before the 2k high-frequency core is solid.

---

## 2. Output: Production Drives Acquisition

### 2.1 Swain's Output Hypothesis
Three functions of forced production:
1. **Noticing/triggering** — producing forces learners to realize the gap between what they mean and what they can say.
2. **Hypothesis testing** — output is a testable guess about how the language works.
3. **Metalinguistic reflection** — learners analyze their own language when producing it.

- **Origin:** Observation of Canadian French immersion students who had years of rich input but persistent production errors.
- **Implication:** Do not let learners progress on recognition-only exercises. Every unit must include L1→L2 translation, free-form writing, or speaking tasks. Production cannot be skipped.

### 2.2 Speaking Practice via AI Chatbots
- **Meta-analysis (Lyu et al., 2025, *Int. J. Applied Linguistics*):** Chatbots have medium effect sizes on L2 outcomes; generative AI chatbots significantly outperform rule-based ones.
- **Anxiety reduction:** Non-judgmental AI partners lower foreign-language speaking anxiety and raise willingness to communicate (Shafiee Rad & Roohani, 2025).
- **Implication:** AI conversation practice is evidence-backed. Prioritize: structured dialog tasks, role-play scenarios, open-ended prompts that require negotiation of meaning (§3).

---

## 3. Interaction & Negotiation of Meaning

### 3.1 Long's Interaction Hypothesis
- Comprehensible input becomes acquisition-relevant when **misunderstandings force learners to negotiate meaning** (clarification requests, confirmation checks, comprehension checks).
- Modified output during breakdown is where real learning happens.
- **Implication:** In AI dialogs, do not "pretend to understand" learner errors. When the learner produces ambiguous/malformed output, the AI should ask for clarification, recast, or request reformulation (see §5.3 on corrective feedback).

---

## 4. Attention & Awareness

### 4.1 Schmidt's Noticing Hypothesis
- **Strong version:** Nothing becomes intake unless consciously noticed.
- **Weak (revised) version:** "The more noticing, the more learning." Noticing is helpful but not strictly required for all linguistic features (esp. formulaic chunks, §8).
- **Implication:** Highlight target forms in input (bold, color, or audio emphasis). After exposure, prompt a quick "did you notice X?" metacognitive cue. Call out gaps when correcting errors.

### 4.2 Focus on Form vs. Focus on Forms (Long)
- **Focus on Forms (FonFs):** Traditional grammar instruction, isolated rules.
- **Focus on Form (FonF):** Meaning-focused interaction with brief, contextual attention to grammar as the need arises.
- **Finding:** Both work; FonF yields better **implicit** knowledge (usable in real time), FonFs yields better **explicit** knowledge (rule recall).
- **Implication:** Embed grammar explanations *inside* meaningful tasks ("You just used X — here's why it works"). Don't lead a lesson with a grammar monolog.

---

## 5. Memory: Retrieval, Spacing, and Difficulty

### 5.1 Testing Effect / Retrieval Practice (Roediger & Karpicke)
- **Finding:** On delayed tests, repeated *testing* produced large retention gains; repeated *studying* had no effect after the item was once learned. Karpicke & Blunt (2011) found retrieval practice improved retention ~50% over concept mapping.
- **Implication:** Do not let learners re-read a translation or replay audio as a primary study mode. Every new item must be *recalled* — type it, speak it, or select it from distractors — within the same session.

### 5.2 Spaced Repetition (SM-2 baseline)
- Hundreds of studies confirm that distributed practice beats massed practice for long-term retention (~25%+ higher retention over ≥4-week intervals).
- **SM-2 (Wozniak, 1987)** is the most-validated algorithm; Anki's variant is the de facto standard used by language learners and medical students.
- **Expanding intervals** (1 → 6 → prev × EF) outperform equal intervals long-term.
- Benefit plateaus after ~3 successful retrievals at long lag — continued testing yields diminishing returns.
- **Implication:** Use SM-2 (already in `/learning.md`). Do not hand-tune intervals. Limit new cards/day (default 20). Sort due queue by overdue-ness.

### 5.3 Desirable Difficulties (Bjork Lab, UCLA)
- Conditions that feel harder during practice but produce better long-term learning:
  - **Spacing** (§5.2)
  - **Retrieval practice** (§5.1)
  - **Interleaving** (§5.4)
  - **Varying conditions** of practice (different voices, settings, contexts)
  - **Generation effect** (produce the answer rather than recognize it)
- **Implication:** Resist making exercises feel easy. A slightly slower, more effortful recall = deeper learning.

### 5.4 Interleaving vs. Blocked Practice
- Interleaving (mixing topics) improves transfer and discrimination between similar items (e.g., 63% vs. 20% correct on delayed tests for math; comparable patterns in L2 vocabulary).
- **Critical caveat (Hwang, 2025, *Language Learning*):** Interleaving hurts low-achieving / pre-threshold learners. They need initial blocked practice to reach a baseline before interleaving helps.
- **Implication:** New vocabulary → block first (3–5 repetitions). Once learner hits ~80% accuracy on an item, it can be interleaved into mixed review.

---

## 6. Vocabulary Acquisition

### 6.1 Frequency-First Sequencing
- Top 10 words = ~25% of text; top 100 = ~50%; top 1,000 = ~70%; top 2,000 = ~80%.
- **Cambridge English Vocabulary Profile** maps A1–C2 CEFR levels to specific word lists based on the Cambridge Learner Corpus.
- **Implication:** Each course's word list should be sequenced by corpus frequency in that language, with CEFR tags. Never introduce a C1 word before A2 essentials are learned.

### 6.2 Spacing + Retrieval for Vocabulary
- Lotfolahi & Salehi (2016) and multiple Anki-based studies (including semester-long Spanish intervention, n=62) show spaced vs. massed vocabulary review produces better end-of-semester performance.
- **Implication:** All vocab exercises feed the SRS review queue. Failed items re-enter queue immediately (reset repetitions, 1-day interval).

---

## 7. Grammar: Explicit vs. Implicit Knowledge

### 7.1 Three Interface Positions
- **Strong interface (DeKeyser):** Explicit knowledge becomes implicit through practice (skill acquisition theory).
- **Weak interface (R. Ellis):** Explicit facilitates acquisition of implicit but doesn't directly convert.
- **Non-interface (Krashen, Paradis):** They are separate systems.
- **Empirical consensus:** Explicit instruction helps, especially for salient rules and adult learners. Practice + production is where declarative → procedural conversion happens.

### 7.2 Practical Design
- Teach a rule → have learner *apply* it in output multiple times → fade the explanation.
- Avoid long grammar lectures. Use brief, just-in-time rule cards (≤60 words) triggered by the exercise context.

---

## 8. Formulaic Language / Chunking

- **Wray (2002), Ellis (1996):** A large portion of fluent speech is composed of prefabricated multi-word chunks retrieved whole ("how are you doing", "what I mean is", "by the way"). Native speakers process formulaic sequences faster than novel strings.
- L2 learners chronically under-use chunks and over-generate from rules, producing grammatical but unnatural speech.
- **Implication:** Alongside single-word vocabulary, teach **collocations, phrases, and sentence frames** as atomic units. Tag them in the cards table. Include them in SRS.

---

## 9. Pronunciation: High Variability Phonetic Training (HVPT)

- **Meta-analysis of HVPT (Thomson, 2018 and follow-ups):** Medium-to-large effect sizes on L2 speech perception and production. Gains persist long-term and generalize to novel speakers/stimuli.
- **Mechanism:** Exposure to the same phoneme/contrast spoken by *multiple different voices* forces learners to attend to the invariant acoustic cues, not voice-specific features.
- **Key variables:** total training time, number of talkers (minimum ~4–6), variety of contexts, immediate feedback.
- **Implication for speaking exercises:** Use TTS with multiple voice profiles per language. When training a tricky phoneme contrast (e.g., /r/–/l/ for Japanese learners of English), cycle through ≥4 different TTS voices.

---

## 10. Corrective Feedback (Lyster, Ranta)

### 10.1 Feedback Types Studied
| Type | Description | Effectiveness |
|---|---|---|
| Recast | Teacher reformulates learner's error correctly, implicitly | Most common; least uptake (~70% unnoticed) for grammar. Best for pronunciation errors. |
| Explicit correction | "No — it should be X" | High uptake; can feel harsh |
| Elicitation | "Can you say that again?" / "It's not 'goed', it's…?" | High uptake for grammar |
| Metalinguistic cues | "Check your tense" | High uptake |
| Clarification request | "Sorry?" | High uptake; pushes modified output |
| Repetition | Learner's error repeated with rising intonation | Moderate |

- **Finding:** "Negotiation of form" (elicitation, metalinguistic cues, clarification, repetition) outperforms recasts for **grammar and lexis**. Recasts win for **phonological errors**.
- **Implication:** AI tutor should mix feedback strategies. For grammar errors → elicit/clarify. For pronunciation → recast with correct audio. Never silently accept an error; always flag it (even mildly).

---

## 11. Motivation

### 11.1 Dörnyei's L2 Motivational Self System (L2MSS)
Three components:
- **Ideal L2 Self** — vision of oneself as a competent L2 user. Strongest predictor of effort (r ≈ 0.61).
- **Ought-to L2 Self** — external obligations / fear of negative outcomes.
- **L2 Learning Experience** — moment-to-moment engagement with the learning environment.

### 11.2 Self-Determination Theory (Ryan & Deci)
Sustained motivation requires:
- **Competence** — feeling the task is doable (supports Krashen's i+1).
- **Autonomy** — learner has meaningful choices.
- **Relatedness** — connection to others and purpose.

### 11.3 Implications for App UX
- **Onboarding:** Elicit the learner's Ideal L2 Self ("Why do you want to learn? Who do you want to become?"). Reflect it back during slumps.
- **Autonomy:** Offer topic/scenario choice within a guided path.
- **Competence:** Adaptive difficulty. Show progress visibly (CEFR movement, word count mastered).
- **Risk:** Heavy extrinsic rewards (XP, badges) can **undermine intrinsic motivation** (Frontiers 2024 meta). Use them to bootstrap habit, but make the content itself rewarding.

---

## 12. Habit Formation & Streaks

- **Gamification meta-analysis (5,000+ participants, g = 0.82):** Large aggregate effect on learning, but effects on motivation are unstable — cognitive outcomes are most robust.
- **Duolingo internal data (600+ A/B experiments on streak alone):**
  - 7-day streak users: 3.6× more likely to stay engaged long-term.
  - "Streak Freeze" reduced churn by 21% among at-risk users.
  - Consecutive-day activity builds stronger habits than same-frequency spread over a week.
  - Habits typically take ~66 days to become automatic; 30-day streak is a meaningful milestone.
- **Mechanism:** Loss aversion (don't break the streak) is a stronger motivator than equivalent gain.
- **Implication for us:** Keep the streak mechanic but include a forgiveness mechanism (streak freeze, vacation mode). Don't use streak pressure to drive learners past fatigue — it correlates with eventual churn.

---

## 13. Lesson Structure & Duration

### 13.1 Microlearning
- **Optimal lesson length:** 5–15 min per research consensus. Concentration peaks ~20–25 min then declines.
- **Cognitive Load Theory (Sweller):** Working memory overload kills retention. Break content into small units.
- **Finding:** Microlearning interventions show 150% better retention than equivalent long sessions; >1-semester gamified interventions yield larger effects than short ones.
- **Implication:** Target 10–12 min lessons with 10–15 exercises (as current `/learning.md` specifies). Resist bloat. Prioritize daily 10 min over weekly 60 min.

### 13.2 Lesson Sequencing Within a Session (Research-Supported)
1. **Warm-up / recall** — prime prior knowledge (1–2 spaced review items).
2. **Presentation** — new material, meaning-focused input (§1).
3. **Recognition** — confirm comprehension (low-stakes).
4. **Retrieval drills** — type, match, reorder (testing effect, §5.1).
5. **Production** — L1→L2 translation, speaking, or writing (§2).
6. **Interaction** — mini-dialog or free response with AI (§3).
7. **Summary + SRS scheduling** — failed items enter review queue (§5.2).

---

## 14. Curriculum Design: CEFR, ACTFL, and the Four Strands

### 14.1 CEFR (Council of Europe, 2001)
- Six levels: A1, A2, B1, B2, C1, C2 (Basic / Independent / Proficient).
- Organized around **can-do descriptors** across four activities: reception, production, interaction, mediation.
- Global standard for course design and assessment.

### 14.2 ACTFL Proficiency Guidelines (2024 revision)
- Ranks: Novice (Low/Mid/High) → Intermediate → Advanced → Superior → Distinguished.
- Can-Do statements let learners self-evaluate and let curriculum designers write concrete objectives.

### 14.3 Nation's Four Strands (must balance ~equally)
| Strand | Activities | Target time |
|---|---|---|
| Meaning-focused input | Extensive reading/listening, comprehensible podcasts, graded readers | 25% |
| Meaning-focused output | Writing, speaking with purpose, role-play | 25% |
| Language-focused learning | SRS, grammar drills, pronunciation practice, explicit study | 25% |
| Fluency development | Repeated reading, shadowing, timed speaking, re-doing familiar tasks fast | 25% |

- **Implication:** Audit each course to ensure rough balance. Apps tend to over-weight language-focused learning (drills) and under-weight fluency development. **Fluency exercises are currently a gap** in many offerings; consider 4/3/2 speaking tasks, shadowing, timed reading.

---

## 15. Efficacy Evidence for App-Based Learning

### 15.1 Duolingo Efficacy Studies
- **Vesselinov & Grego (2012):** 8-week study on Duolingo Spanish users (n ≈ several hundred) using the WebCAPE (BYU). ~34 hours of Duolingo = one university semester of Spanish.
- **Jiang et al. (2021), *Foreign Language Annals*:** Beginning-level Duolingo courses in Spanish/French produced reading and listening gains comparable to several semesters of college instruction.
- **Intermediate efficacy whitepaper:** 7 units of Duolingo ≈ 5 semesters of college language.
- **Caveat:** Self-selected motivated learners; not RCTs in most cases. Still, the evidence base for well-designed digital courses is real.

### 15.2 AI-Chatbot-Enhanced Courses (2025 studies)
- Significant gains in oral proficiency, fluency, confidence, and willingness to communicate vs. traditional methods.
- Generative AI (LLM-based) chatbots substantially outperform legacy rule-based chatbots.

---

## 16. Concrete Design Rules Derived from Research

These are the design constraints we should enforce. Every course/lesson/exercise should be auditable against these:

### Content & Sequencing
- [ ] New vocabulary is selected from the top-N frequency list for the target language (with CEFR tagging).
- [ ] Every vocabulary item is tagged: single-word / collocation / formulaic chunk.
- [ ] Grammar is introduced just-in-time, inside meaning-focused tasks, in ≤60-word rule cards.
- [ ] Lesson difficulty is `learner CEFR + 1` sub-level (i+1), never more than +2.

### Exercise Design
- [ ] Every new item gets ≥3 retrieval-based encounters (not re-read) in the introduction session.
- [ ] Production (type / speak / write) occurs within every lesson — never a pure-recognition lesson.
- [ ] New items are blocked first, then interleaved once ≥80% accuracy is hit.
- [ ] Target forms are visibly highlighted in input (noticing).
- [ ] Pronunciation drills for hard contrasts use ≥4 distinct TTS voices (HVPT).
- [ ] Errors trigger a feedback strategy appropriate to error type (grammar → elicit; pronunciation → recast).

### Memory / Spacing
- [ ] Failed items immediately enter SRS with 1-day interval, reset repetitions.
- [ ] SRS uses SM-2 (or research-validated variant) with per-item `EF`, `interval`, `repetitions`, `nextDue`.
- [ ] Due-queue sorted by overdue-ness.
- [ ] New-card daily cap (default 20, user-configurable).

### Session Structure
- [ ] Target 10–12 min lessons with 10–15 exercises.
- [ ] Start with spaced review, end with production + SRS updates.
- [ ] Four Strands balance is tracked at the course level (dashboards showing % time in each).

### Motivation
- [ ] Onboarding elicits Ideal L2 Self and surfaces it during motivation dips.
- [ ] Streaks include a forgiveness mechanism (streak freeze ≥1/week).
- [ ] Autonomy: learner can choose among ≥2 topics/scenarios per unit.
- [ ] Extrinsic rewards (XP, badges) are secondary to content that is itself engaging.

### Interaction & Production
- [ ] Conversation practice uses an LLM, not rule-based dialog.
- [ ] AI negotiates meaning: asks for clarification when learner output is ambiguous.
- [ ] Low-stakes, non-judgmental framing to reduce anxiety.

---

## 17. Open Questions for This Project

Flag these when making decisions — no consensus in the literature yet:

1. **Adaptation aggressiveness:** Highly responsive difficulty (every item) vs. stable difficulty (per lesson)? Evidence mixed; lean responsive but test.
2. **Single global LLM vs. per-language specialized models** for conversation? No published comparison at time of writing.
3. **Centralized vs. per-user SRS parameters:** Personalizing EF/intervals may outperform SM-2 defaults, but requires data volume. Start with SM-2.
4. **How long before interleaving kicks in?** Hwang (2025) says "after baseline accuracy" — we use ≥80% per item as a first heuristic. Revisit.

---

## 18. Sources

### Core Theory
- [Krashen — Principles and Practice in SLA (PDF)](https://www.sdkrashen.com/content/books/principles_and_practice.pdf)
- [Krashen — The Case for Comprehensible Input (PDF)](https://www.sdkrashen.com/content/articles/case_for_comprehensible_input.pdf)
- [Input hypothesis — Wikipedia summary](https://en.wikipedia.org/wiki/Input_hypothesis)
- [Critique: Beyond comprehensible input — Frontiers in Psychology, 2025](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2025.1636777/full)
- [Swain — Comprehensible Output Hypothesis (Wikipedia)](https://en.wikipedia.org/wiki/Comprehensible_output)
- [Swain — Output Hypothesis: From Theory to Practice (PDF)](https://www.hpu.edu/research-publications/tesol-working-papers/2017/2017-new-with-metadata/06pannellpartschfuller_output.pdf)
- [Long — Interaction Hypothesis (Wikipedia)](https://en.wikipedia.org/wiki/Interaction_hypothesis)
- [Schmidt — Attention, Awareness, Individual Differences (PDF)](https://nflrc.hawaii.edu/PDFs/SCHMIDT%20Attention,%20awareness,%20and%20individual%20differences.pdf)
- [Noticing hypothesis — Wikipedia summary](https://en.wikipedia.org/wiki/Noticing_hypothesis)

### Memory, Retrieval, Spacing (Cognitive Science)
- [Roediger & Karpicke — Test-Enhanced Learning (PDF)](http://psychnet.wustl.edu/memory/wp-content/uploads/2018/04/Roediger-Karpicke-2006_PPS.pdf)
- [Karpicke & Roediger — Science 2008 (PDF)](http://psychnet.wustl.edu/memory/wp-content/uploads/2018/04/Karpicke-Roediger-2008_Sci.pdf)
- [Retrieval-Based Learning: A Decade of Progress (ERIC)](https://files.eric.ed.gov/fulltext/ED599273.pdf)
- [Kang — Spaced Repetition Promotes Efficient and Effective Learning](https://journals.sagepub.com/doi/abs/10.1177/2372732215624708)
- [Spacing Repetitions over Long Timescales — review (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC5476736/)
- [Bjork Lab — Creating Desirable Difficulties (PDF)](https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2016/04/EBjork_RBjork_2011.pdf)
- [Bjork Lab — Desirable Difficulties Perspective on Learning (PDF)](https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2016/07/RBjork_inpress.pdf)
- [Firth — Systematic review of interleaving (2021, Wiley)](https://bera-journals.onlinelibrary.wiley.com/doi/10.1002/rev3.3266)
- [Hwang — Undesirable Difficulty of Interleaved Practice (Language Learning, 2025)](https://onlinelibrary.wiley.com/doi/10.1111/lang.12659)
- [Lotfolahi & Salehi — Spaced Schedule in L2 Vocabulary](https://journals.sagepub.com/doi/10.1177/2158244016646148)

### Vocabulary & Chunking
- [Nation — How Large a Vocabulary Is Needed for Reading and Listening? (PDF)](https://www.lextutor.ca/cover/papers/nation_2006.pdf)
- [Hirsh & Nation — Vocabulary size for unsimplified texts (PDF)](https://www.wgtn.ac.nz/lals/resources/paul-nations-resources/paul-nations-publications/publications/documents/1992-Hirsh-Vocabulary-reading.pdf)
- [Nation — The Four Strands (PDF)](https://www.victoria.ac.nz/__data/assets/pdf_file/0019/1626121/2007-Four-strands.pdf)
- [Nation — Four Strands of a Language Course (1996 PDF)](https://www.wgtn.ac.nz/lals/resources/paul-nations-resources/paul-nations-publications/publications/documents/1996-Four-strands.pdf)
- [Wray — Formulaic Language (2013, Cardiff ORCA PDF)](https://orca.cardiff.ac.uk/id/eprint/44815/1/Wray%202013.pdf)
- [Nick Ellis — Formulaic Language and the Lexicon](https://www.researchgate.net/publication/27650884_Formulaic_Language_and_the_Lexicon)
- [English Profile Wordlists — Cambridge (A1–B2)](https://www.cambridge.org/core/journals/english-profile-journal/article/a1b2-vocabulary-insights-and-issues-arising-from-the-english-profile-wordlists-project/E57847F6C5574124B2354F9BEEC005FA)

### Instruction, Feedback, Grammar
- [Long — Focus on Form / Focus on Forms](https://en.wikipedia.org/wiki/Focus_on_form)
- [Focus on Form vs. Focus on Forms — Loewen review (Wiley)](https://onlinelibrary.wiley.com/doi/abs/10.1002/9781118784235.eelt0062)
- [Lyster & Ranta — Corrective Feedback, a decade of research (PDF)](https://l2aquisition.wordpress.com/wp-content/uploads/2017/06/corrective-feedback-over-a-decade-of-research-since-lyster-and-ranta-1997-where-do-we-stand-today.pdf)
- [Ellis — Implicit and Explicit SLA and Their Interface (PDF)](https://sites.lsa.umich.edu/nickellis-new/wp-content/uploads/sites/1284/2021/07/EllisinGURT-2010-book-SanzLeow.pdf)
- [Explicit and Implicit Learning in SLA — Cambridge Elements](https://www.cambridge.org/core/elements/abs/explicit-and-implicit-learning-in-second-language-acquisition/EBABCB9129343210EB91B9198F17C4EB)
- [Bryfonski & McKay — TBLT Meta-Analysis (2019)](https://journals.sagepub.com/doi/10.1177/1362168817744389)
- [Lightbown & Spada — How Languages Are Learned (Oxford)](https://global.oup.com/academic/product/how-languages-are-learned-9780194406291?lang=en&cc=be)

### Pronunciation
- [Thomson — HVPT: A proven technique (PDF)](https://languagelog.ldc.upenn.edu/myl/2018Thomson_HVPT.pdf)
- [Role of Talker Variability — meta-analysis (ASHA)](https://pubs.asha.org/doi/abs/10.1044/2021_JSLHR-21-00181)
- [HVPT — meta-analysis of L2 perceptual training](https://www.researchgate.net/publication/392414973_High_variability_phonetic_training_HVPT_A_meta-analysis_of_L2_perceptual_training_studies)

### Motivation
- [Dörnyei — The L2 Motivational Self System (PDF)](https://docs.wixstatic.com/ugd/ba734f_08e57fb081864ecd9b98274bf24e23c6.pdf?index=true)
- [Al-Hoorie — L2 Motivational Self System meta-analysis](https://www.researchgate.net/publication/326176155_The_L2_Motivational_Self_System_A_meta-analysis)
- [Self-Determination Theory vs. L2MSS comparison (ERIC)](https://files.eric.ed.gov/fulltext/EJ1288838.pdf)

### Gamification, Microlearning, Apps
- [Gamification of Learning — Meta-analysis (Springer, 2020)](https://link.springer.com/article/10.1007/s10648-019-09498-w)
- [Gamification in Online Language Learning (Frontiers, 2024)](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2024.1295709/full)
- [Gamified Tools for FLL — Systematic Review (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10135444/)
- [Duolingo — How the Streak Builds Habit](https://blog.duolingo.com/how-duolingo-streak-builds-habit/)
- [Microlearning — Systematic Review (ScienceDirect, 2024)](https://www.sciencedirect.com/science/article/pii/S2405844024174440)

### AI Chatbots for Language Practice (recent)
- [AI conversation bots & L2 speaking anxiety (Nature, 2025)](https://www.nature.com/articles/s41599-025-05550-z)
- [Lyu et al. — Chatbot effectiveness meta-analysis (Wiley, 2025)](https://onlinelibrary.wiley.com/doi/full/10.1111/ijal.12668)
- [Impact of AI chatbots on EFL oral proficiency (ScienceDirect, 2025)](https://www.sciencedirect.com/science/article/abs/pii/S0346251X2500329X)

### Efficacy Studies
- [Duolingo Efficacy Report — Vesselinov & Grego (PDF)](http://static.duolingo.com/s3/DuolingoReport_Final.pdf)
- [Jiang et al. — Evaluating beginning Duolingo courses (Wiley, 2021)](https://onlinelibrary.wiley.com/doi/10.1111/flan.12600)
- [Duolingo — How does Duolingo evaluate effectiveness?](https://blog.duolingo.com/duolingo-efficacy-research-framework/)

### Standards
- [CEFR — Council of Europe official](https://www.coe.int/en/web/common-european-framework-reference-languages)
- [CEFR Levels overview](https://www.coe.int/en/web/common-european-framework-reference-languages/level-descriptions)
- [ACTFL Proficiency Guidelines 2024 (PDF)](https://www.oregon.gov/ode/students-and-family/equity/EngLearners/Documents/ACTFL-Proficiency-Guidelines-2024.pdf)
- [ACTFL Can-Do Statements](https://www.actfl.org/educator-resources/ncssfl-actfl-can-do-statements)

### University Programs & Research Hubs
- [Harvard FAS — Second Language Acquisition](https://atg.fas.harvard.edu/themes-teaching-goal/second-language-acquisition)
- [Yale — Second Language Acquisition Certificate](https://catalog.yale.edu/gsas/non-degree-granting-programs-councils-research-institutes/second-language-acquisition/)
- [Stanford — Second Language Learning Journals](https://guides.library.stanford.edu/second_language_learning/journals)
- [UCLA Bjork Learning and Forgetting Lab](https://bjorklab.psych.ucla.edu/research/)
- [Purdue — Karpicke Learning Lab](https://learninglab.psych.purdue.edu/)

---

## Changelog
- **2026-04-22** — Initial document.
