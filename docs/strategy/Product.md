# Fluenci — Product Roadmap

*Living document. Last updated: 2026-04-23.*

This document outlines planned and in-progress features for Fluenci. Each item describes what the feature does, who it serves, and why it matters for both individual learners and institutional partners.

---

## Currently Shipping

The features below are live today and form the foundation that every roadmap item builds on.

- **Adaptive SRS Review** — SM-2 spaced repetition with per-card ease factor, interval tracking, and automatic review queue generation.
- **16 Exercise Types** — Multiple choice, listening, translation (both directions), speaking, fill-in-the-blank, dictation, error correction, cloze deletion, sentence construction, collocation match, word form, sentence transformation, and mini dialogue.
- **AI Conversational Practice** — Text chat (Claude Haiku) and voice chat (Gemini Live via WebRTC) with real-time error corrections classified by Lyster & Ranta feedback taxonomy.
- **Writing Lab** — Prompted writing exercises with AI grading across grammar, vocabulary, structure, and coherence. Scaffold levels from fill-in-the-blank up to free-form essay.
- **Reading Library** — Annotated passages and full-length books (Gutenberg, WikiSource, AI-generated) with tap-to-translate vocabulary, comprehension questions, and progress tracking.
- **Daily News** — CEFR-tiered articles generated each morning, with vocabulary highlights and read tracking.
- **Pronunciation Scoring** — Whisper-based transcription with phonetic comparison and accent feedback.
- **Classroom System** — Teachers create classes, publish assignments (text or voice), review transcripts, and grade with rubrics. Students join via invite code.
- **Gamification Suite** — Hearts, streaks (with freeze/shield mechanics), 100-level XP system with league tiers, daily challenges with streak multipliers, 20+ achievements, and a full avatar customization system.
- **Subscription Tiers** — Free, Basic, Premium, and VIP with graduated daily quotas for AI features.
- **School Contracts** — Per-organization configuration for daily limits, allowed email domains, and feature toggles.
- **9 Languages** — Spanish, French, German, Italian, Portuguese, Japanese, Korean, Chinese, Russian.

---

## Roadmap

### 1. Adaptive Learning Pathways

**What:** Replace the current fixed lesson sequence with a dynamic engine that selects the next lesson, exercise type, and difficulty based on the learner's real-time performance profile. The system will draw on correction logs, review item status, daily accuracy trends, and time-on-task to identify weak areas and automatically surface targeted practice before the learner falls behind.

**Who it serves:**
- *Students:* A student who consistently misconfuses ser/estar in Spanish won't just see those cards in review — the engine will route them through a focused mini-lesson on the distinction, then verify retention with a follow-up exercise two days later.
- *Public learners:* Self-directed learners get a tutor-quality sequencing experience without needing to know what to study next.

**Why it matters for institutions:** Adaptive pathways produce measurable learning outcomes. IT and curriculum committees want evidence that the software responds to individual needs rather than delivering a one-size-fits-all course. This feature turns Fluenci from a content library into a responsive teaching system.

---

### 2. LMS Integration (LTI 1.3)

**What:** Full Learning Tools Interoperability (LTI 1.3) support so Fluenci can be embedded directly inside Canvas, Blackboard, Moodle, and D2L Brightspace. Assignment grades, completion status, and time-on-task will flow back to the institution's gradebook automatically via LTI Advantage Grade Services.

**Who it serves:**
- *Students:* Launch Fluenci from inside Canvas the same way they open a textbook chapter. No separate login, no context switching. Grades appear in the gradebook alongside their other coursework.
- *Teachers:* Publish a Fluenci assignment from the LMS, then view scores without leaving their existing grading workflow.

**Why it matters for institutions:** LMS integration is the single most common requirement in university software procurement. IT departments need to see that Fluenci fits into their existing infrastructure rather than creating a parallel system that faculty and students have to manage separately.

---

### 3. SSO & Enterprise Identity (SAML / OIDC)

**What:** Support for SAML 2.0 and OpenID Connect so institutions can connect Fluenci to their existing identity provider — Azure AD, Okta, Google Workspace, Shibboleth, or any standards-compliant IdP. Users authenticate through their university credentials. Provisioning and de-provisioning will follow SCIM 2.0 for automated user lifecycle management.

**Who it serves:**
- *Students:* One fewer password to manage. Log in with the same credentials they use for email and the LMS.
- *IT administrators:* Centralized access control. When a student graduates or a faculty member leaves, their Fluenci access is revoked automatically through the IdP — no manual cleanup.

**Why it matters for institutions:** SSO is a non-negotiable for most university IT departments. It reduces help desk tickets, eliminates credential sprawl, and ensures the institution retains control over who has access.

---

### 4. Institutional Analytics Dashboard

**What:** A dedicated web dashboard for department chairs, program coordinators, and IT administrators that surfaces aggregated learning analytics without exposing individual student data inappropriately. Views include: cohort-level CEFR progression over time, engagement heatmaps (when and how often students practice), assignment completion funnels, error pattern analysis by language skill area, and ROI metrics (practice hours per student, improvement velocity).

**Who it serves:**
- *Teachers:* Quickly identify which students are falling behind, which grammar topics the class is struggling with, and how assignment scores trend across the semester.
- *Administrators:* Justify the software purchase with hard data. Show the provost that students using Fluenci 15+ minutes per day improved one CEFR sub-level in 8 weeks.

**Why it matters for institutions:** Data-driven decision-making is central to modern higher education. IT committees and academic leadership want dashboards they can reference in program reviews and accreditation reports.

---

### 5. Peer Collaboration & Language Exchange

**What:** Structured peer interaction features that go beyond solo practice. Includes:
- **Study Groups** — Students form or are assigned to small groups (3-5) that share a weekly vocabulary leaderboard, group streak, and collaborative daily challenge.
- **Peer Review** — After a writing exercise, students are optionally paired to review each other's submissions using a guided rubric before seeing AI feedback.
- **Language Exchange Matching** — Public learners are matched with native speakers of their target language who are learning their native language, enabling reciprocal practice sessions.

**Who it serves:**
- *Students:* Language acquisition research consistently shows that social interaction accelerates learning. Study groups create accountability; peer review builds metalinguistic awareness (noticing errors in others' writing strengthens your own).
- *Public learners:* Language exchange addresses a gap that no AI can fully fill — authentic human conversation with a native speaker who has a genuine communication need.

**Why it matters for institutions:** Faculty want tools that support communicative language teaching, not just drill-and-kill. Peer features turn Fluenci into a platform that complements classroom pedagogy rather than replacing it.

---

### 6. CEFR Assessment & Certification

**What:** Formal proficiency assessments mapped to the Common European Framework of Reference (A1-C2) that students can take at defined intervals. Assessments cover all four skills (reading, writing, listening, speaking) with standardized scoring. Upon completion, Fluenci issues a digital certificate with the student's assessed level, date, and a verification URL.

**Who it serves:**
- *Students:* A portable credential they can include on a resume or LinkedIn profile. Students in study-abroad programs can demonstrate proficiency before departure.
- *Public learners:* A concrete milestone that validates progress — more meaningful than an XP number.

**Why it matters for institutions:** Universities need to place students into the correct course level, verify prerequisites, and document learning outcomes for accreditation. A standardized assessment built into the platform reduces reliance on external placement tests.

---

### 7. Teacher Content Authoring Tools

**What:** A content creation interface that lets teachers build custom lessons, exercises, vocabulary sets, and reading passages directly within Fluenci. Teachers can:
- Create vocabulary decks tied to their syllabus and assign them to a class.
- Build custom exercises (fill-in-the-blank, translation, listening) from their own source material.
- Import word lists from CSV or existing textbook ancillaries.
- Define custom conversation scenarios for AI chat assignments with specific vocabulary and grammar targets.
- Share created content with other teachers in their organization.

**Who it serves:**
- *Students:* Practice material that aligns exactly with what they're covering in class this week, not generic content that may or may not match the textbook.
- *Teachers:* Freedom to supplement the built-in curriculum without leaving the platform. A Spanish literature professor can create exercises around a specific poem; a business French instructor can build scenarios around contract negotiation.

**Why it matters for institutions:** Faculty adoption depends on flexibility. Teachers will reject any tool that forces them into a rigid curriculum. Content authoring tools make Fluenci a platform that adapts to the teacher, not the other way around.

---

### 8. Advanced Pronunciation Coach

**What:** Expand the current pronunciation scoring into a full coaching system with:
- **Phoneme-level feedback** — Identify exactly which sounds the learner is mispronouncing, not just whether the word was correct.
- **Minimal pair drills** — Automatically generate exercises targeting the learner's specific problem sounds (e.g., Spanish r/rr, French u/ou, Mandarin tones).
- **Intonation visualization** — Display pitch contour graphs comparing the learner's speech to a native reference.
- **Progress tracking** — Track improvement on specific phonemes over time, surfacing persistent trouble spots in the review queue.

**Who it serves:**
- *Students:* Students in conversation-heavy courses get targeted practice on the sounds their instructor would normally correct in class — but with unlimited repetitions and zero social anxiety.
- *Public learners:* Self-study learners have no one to correct their pronunciation. This feature acts as a patient, always-available speech coach.

**Why it matters for institutions:** Speaking proficiency is the hardest skill to develop at scale. A class of 30 students gets minimal individual pronunciation feedback from one instructor. Fluenci can provide that feedback 24/7.

---

### 9. Cultural Competence Modules

**What:** Structured modules that teach cultural context alongside language — business etiquette, social norms, humor, regional variation, and pragmatics (how to be polite, how to disagree, how to make requests). Each module includes:
- Short readings with cultural notes.
- Scenario-based AI conversations that test pragmatic competence (e.g., "Decline an invitation politely in Japanese").
- Cultural comparison exercises (how does this norm differ from the learner's home culture?).

**Who it serves:**
- *Students:* Students preparing for study abroad, internships, or careers in international contexts need more than grammar — they need to know how to navigate real social situations without causing offense.
- *Public learners:* Travelers and professionals who want to go beyond textbook language to actually connect with people in the target culture.

**Why it matters for institutions:** Modern language programs emphasize intercultural communicative competence, not just linguistic accuracy. Accreditation standards (ACTFL, MLA) increasingly expect cultural proficiency outcomes. This feature aligns Fluenci with where the field is heading.

---

### 10. Accessibility & Universal Design

**What:** Systematic accessibility improvements to meet WCAG 2.1 AA compliance:
- **Screen reader optimization** — Full VoiceOver and TalkBack support with logical reading order, meaningful labels, and live region announcements for dynamic content (XP popups, timer changes, chat messages).
- **Dyslexia-friendly mode** — OpenDyslexic font option, increased letter spacing, pastel background tints, and reading ruler overlay.
- **Motor accessibility** — Switch control support, adjustable touch targets (beyond the current 44pt minimum), and voice-only navigation for hands-free practice.
- **Color contrast modes** — High-contrast theme option that exceeds WCAG AAA ratios.
- **Captioning** — Auto-generated captions for all audio content (listening exercises, TTS, pronunciation models).

**Who it serves:**
- *Students:* Students with documented disabilities receive accommodations natively within the app, without needing to request special arrangements from the disability services office.
- *Public learners:* Approximately 15-20% of the population has some form of learning difference. Accessibility features benefit everyone — captions help in noisy environments, larger text helps on small screens.

**Why it matters for institutions:** ADA and Section 508 compliance are legal requirements for federally funded institutions. IT procurement teams will ask for a VPAT (Voluntary Product Accessibility Template). This work produces that documentation and the substance behind it.

---

### 11. Offline-First Architecture

**What:** Expand the current Premium-tier offline support into a robust offline-first system:
- **Smart pre-download** — Before the learner leaves campus Wi-Fi, Fluenci pre-caches the next 3 lessons, their due review cards, and any assigned content.
- **Offline AI fallback** — Pre-generated hint banks and feedback templates for common exercise types so learners can practice without network access.
- **Conflict-free sync** — CRDT-based sync that merges offline progress cleanly when connectivity returns, even if the learner practiced on multiple devices.
- **Bandwidth-conscious mode** — Compressed audio, deferred image loading, and text-only fallbacks for low-bandwidth environments.

**Who it serves:**
- *Students:* Students commuting on subways, studying in dorms with unreliable Wi-Fi, or traveling abroad with limited data plans can keep their streak alive and continue learning.
- *Public learners:* Learners in regions with intermittent connectivity aren't locked out of their daily practice.

**Why it matters for institutions:** Not every campus building has strong Wi-Fi. International programs, field trips, and commuter students all benefit from offline capability. IT teams appreciate software that degrades gracefully rather than failing completely.

---

### 12. Gamified Class Competitions

**What:** Opt-in competitive features for classrooms:
- **Class Leaderboard** — Weekly XP ranking within a class, with the teacher controlling visibility (anonymous ranks, full names, or disabled).
- **Team Challenges** — Teacher splits the class into teams; teams compete on collective metrics (total cards reviewed, group accuracy, combined streak days).
- **Tournament Mode** — Time-limited events (e.g., "Vocabulary Sprint: most new words learned this week wins") with digital rewards (exclusive avatar accessories, bonus streak freezes).
- **Inter-Class Competitions** — Multiple sections of the same course compete against each other (aggregated, anonymized metrics).

**Who it serves:**
- *Students:* Healthy competition increases engagement measurably. Students who wouldn't open the app on a Tuesday evening will practice if their team needs 50 more XP to win.
- *Teachers:* A low-effort engagement tool. Set up a tournament in 2 clicks and let the game mechanics do the motivational work.

**Why it matters for institutions:** Engagement metrics directly affect retention and course outcomes. Gamified competition is one of the most cost-effective interventions for increasing voluntary practice time.

---

### 13. API & Webhook Platform

**What:** A documented REST API and webhook system that allows institutions to integrate Fluenci data into their own systems:
- **Read endpoints** — Query student progress, assignment scores, usage metrics, and CEFR assessments programmatically.
- **Webhooks** — Subscribe to events (assignment submitted, assessment completed, student enrolled/dropped) and receive real-time HTTP callbacks.
- **Bulk data export** — CSV and JSON exports for research, program review, or migration.

**Who it serves:**
- *IT administrators:* Pipe Fluenci data into the university's data warehouse, student success platforms (Starfish, EAB Navigate), or custom dashboards.
- *Researchers:* Faculty conducting SLA (second language acquisition) research can access anonymized, structured learning data with IRB-approved access.

**Why it matters for institutions:** Software that traps data inside itself is a liability. An API signals that Fluenci is an open platform that fits into the institution's broader technology ecosystem, not a walled garden.

---

### 14. AI Scenario Builder

**What:** An evolution of the current conversation practice system into branching, scenario-based simulations:
- **Branching dialogues** — Conversations that adapt based on the learner's choices. Ordering at a restaurant where the waiter says an item is unavailable and the learner must pivot. A job interview where the interviewer asks an unexpected follow-up.
- **Role-specific vocabulary injection** — The AI conversation partner uses vocabulary and register appropriate to the scenario (formal business language in an interview, casual slang at a party).
- **Scenario outcomes** — Each conversation ends with a scorecard: communication goals achieved, vocabulary used, grammar accuracy, and a "would-this-work-in-real-life" pragmatic rating.
- **Teacher-authored scenarios** — Teachers define the setting, communication goals, key vocabulary, and evaluation criteria. The AI handles everything else.

**Who it serves:**
- *Students:* Simulation-based practice prepares students for real-world interactions in ways that textbook dialogues cannot. A nursing student learning medical Spanish can practice a patient intake conversation.
- *Public learners:* Travelers can rehearse specific situations (checking into a hotel, asking for directions, handling an emergency) before their trip.

**Why it matters for institutions:** Scenario-based learning aligns with task-based language teaching (TBLT), the dominant methodology in modern SLA pedagogy. This feature speaks directly to faculty who teach communicative methods.

---

### 15. Multi-Language Support & L3+ Learning

**What:** Support for learners studying multiple languages simultaneously:
- **Parallel courses** — Maintain separate progress, review queues, and daily stats for each active language.
- **Cross-linguistic transfer detection** — When a learner studying both Spanish and Portuguese confuses a false cognate, surface a targeted explanation about the difference.
- **Shared cognate highlighting** — Automatically identify and surface cognates between the learner's known languages and their new target language to accelerate vocabulary acquisition.
- **Language switching UI** — Quick-switch between active languages without losing context or progress.

**Who it serves:**
- *Students:* Many language majors study two or more languages. A French/Italian double major shouldn't need two separate accounts or lose their streak when switching between languages.
- *Public learners:* Polyglot learners and heritage speakers studying a third language benefit from transfer-aware content.

**Why it matters for institutions:** Language departments serve students across multiple languages. A platform that handles multi-language learners natively reduces the number of tools the department needs to support.

---

### 16. Real-Time Collaboration Spaces

**What:** Synchronous digital spaces where students can practice together in real time:
- **Collaborative writing** — Two students co-author a short text in the target language, with real-time editing and AI suggestions available to both.
- **Conversation rooms** — Small-group voice or text chat rooms (2-4 students) with AI moderation that provides corrections and topic prompts when the conversation stalls.
- **Vocabulary games** — Real-time multiplayer word games (speed matching, definition races, sentence building) playable within a class or with matched public learners.

**Who it serves:**
- *Students:* Replicates the pair-work and small-group activities that are central to communicative language classrooms, but available outside of class hours.
- *Public learners:* Provides the human interaction component that solo app-based learning typically lacks.

**Why it matters for institutions:** Faculty frequently cite "lack of practice time" as the biggest constraint on student progress. Collaboration spaces extend the classroom into the hours between class meetings.

---

### 17. Progress Portfolios & ePortfolio Export

**What:** A learner-facing portfolio that compiles evidence of language growth over time:
- **Artifact collection** — Best writing submissions, conversation transcripts, pronunciation recordings, and reading comprehension scores, curated automatically or by the learner.
- **Growth visualization** — Timeline showing CEFR progression, vocabulary size growth, accuracy improvement curves, and milestone achievements.
- **ePortfolio export** — Export the portfolio as a PDF or structured data package compatible with institutional ePortfolio systems (Digication, Portfolium, Mahara).
- **Reflection prompts** — Periodic prompts asking the learner to reflect on their progress, goals, and strategies (aligned with the European Language Portfolio model).

**Who it serves:**
- *Students:* Students in capstone courses or applying for study abroad can present a curated body of evidence demonstrating their language proficiency.
- *Public learners:* A personal record of growth that makes intangible progress feel concrete.

**Why it matters for institutions:** Portfolio-based assessment is increasingly used in language programs for both formative and summative evaluation. An integrated portfolio reduces the burden on students and faculty to collect evidence manually.

---

### 18. Intelligent Notification & Engagement System

**What:** Move beyond simple daily reminders to a context-aware engagement system:
- **Optimal timing** — Machine learning on each learner's practice patterns to send reminders when they're most likely to engage (not a fixed 9 PM for everyone).
- **Content-aware nudges** — "You have 12 cards due — that's a 3-minute session" is more compelling than "Don't forget to practice."
- **Streak risk alerts** — Escalating reminders as midnight approaches on a day with no activity, calibrated to the learner's streak length (a 90-day streak gets more urgent reminders than a 3-day streak).
- **Weekly digest** — Summary email or push notification with the week's stats, upcoming goals, and a preview of tomorrow's news article.
- **Teacher alerts** — Notify teachers when a student's engagement drops below a threshold, enabling early intervention.

**Who it serves:**
- *Students:* Keeps students engaged between class meetings without being annoying. Smart timing means fewer ignored notifications.
- *Teachers:* Early warning system for at-risk students, powered by behavioral data rather than waiting for a failed midterm.

**Why it matters for institutions:** Student retention is a top institutional priority. An engagement system that flags disengagement early gives advisors and faculty a chance to intervene before the student drops the course.

---

## Versioning & Release Cadence

Fluenci follows a continuous delivery model. Features ship incrementally as they reach production quality. Major capability additions (LMS integration, SSO, analytics dashboard) are coordinated with institutional deployment timelines. All API changes follow semantic versioning with a minimum 6-month deprecation window.

---

## Feedback & Feature Requests

Institutional partners can submit feature requests and vote on roadmap priorities through their account manager. Public feature requests are tracked at [github.com/tylerm2407/ai-language-partner/issues](https://github.com/tylerm2407/ai-language-partner/issues).
