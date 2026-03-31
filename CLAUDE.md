# CLAUDE.md — Language Learning App

## 0. Quick Start
```bash
cd C:\Users\tcm24\OneDrive\Desktop\Languageapp
```
Run this first — all build/test/expo commands must run from the project root.

---

## 1. Project Overview
This is an AI-powered language learning platform that delivers personalized lessons, adaptive practice, and conversational tutoring across multiple languages. It serves learners who want daily, bite-sized progress toward fluency without a human tutor. The most important constraint: every learning interaction must be level-appropriate, safe, and aligned with the learner’s target goals and proficiency.

---

## 2. Architecture Map
/app
├── agents/ # All AI agent logic (one agent per file, no agent logic in main.py)
├── tools/ # External API wrappers (LLM, TTS, STT, dictionary, translation) — pure functions only
├── models/ # Pydantic data models (UserProfile, LessonPlan, Exercise, SessionState) — no business logic
├── curriculum/ # Lesson templates, CEFR mapping, progression rules
├── exercises/ # Exercise generators (vocab, grammar, listening, speaking, conversation)
├── sessions/ # Session orchestration (state machine for lessons and reviews)
├── api/ # FastAPI / Next.js API routes — no agent instantiation in routes
├── frontend/ # Mobile/web UI (React/React Native/Next.js) — UI components and screens
└── analytics/ # Learning analytics, spaced repetition scheduling, progress reports

text

---

## 3. Build & Test Commands
```bash
# Backend
cd backend && uv run uvicorn main:app --reload --port 8000

# Frontend
cd frontend && pnpm dev

# Tests
cd backend && uv run pytest -v

# Type check
cd backend && uv run mypy .
cd frontend && pnpm typecheck

# Lint
cd backend && uv run ruff check .
cd frontend && pnpm lint
```

---

## 4. Code Style Rules
- Use `async/await` everywhere — never callbacks.
- Type-annotate every function — no `Any` types.
- Use Pydantic v2 models for all structured data (user profiles, lesson plans, exercises, attempts).
- Do not hardcode lesson text in code — store templates in `/curriculum` and `/exercises/templates`.
- All AI-generated content passes through a `ContentSafetyValidator` and `LevelChecker` before being shown to the learner.
- One agent per file — no multi-agent orchestration logic inside a single module.

---

## 5. Architecture Rules (What Must Never Happen)
- Agents never call each other directly — they communicate only through `SessionMemory` / `SessionState`.
- No business logic in API routes — routes call services, services call agents.
- Never generate exercises for a user without a loaded `UserProfile` and `ProficiencyLevel`.
- Never update spaced repetition schedules outside the `SpacedRepetitionService`.
- Never send unreviewed AI-generated content directly to minors if age < 18 — always run through the safety pipeline.

---

## 6. Error Handling Standard
- All agent errors use an `AgentError` class with `user_id`, `language`, and `session_id` context.
- Always log with `run_id`, `user_id`, and `exercise_id` where applicable.
- Never use bare `except` — catch specific exceptions (HTTPError, ValidationError, Timeout, etc.).
- On LLM failure, retry 2x with exponential backoff, then fall back to a generic, pre-authored exercise.
- On TTS/STT API failure, log and gracefully degrade to text-only mode for that interaction.

---

## 7. Testing Requirements
- Every new agent method requires an integration test with a mock LLM client.
- Every exercise generator requires unit tests for:
  - Correct difficulty selection based on CEFR level.
  - Proper handling of empty or malformed input.
  - Stable output schema (no shape changes).
- Add tests for the progression engine (promotions, demotions, review scheduling).
- Run `pytest -x` after every change — do not mark a task complete if any tests fail.
- Never consider a task done if `mypy`, `ruff`, or frontend `typecheck` returns errors.

---

## 8. Performance Rules
- No synchronous network calls inside async functions.
- Use `asyncio.gather` for parallel operations (e.g., generating multiple exercises or hints in one request).
- No blocking IO in the request path — move heavy preprocessing to background tasks where possible.
- Cache static curriculum data (lesson templates, CEFR mappings) in memory per process.
- Batch analytics writes and event logging instead of writing one record per keystroke.

---

## 9. What NOT To Do
- Do not hallucinate factual content about grammar rules — base explanations on the curriculum definitions.
- Do not generate exercises that mix multiple target languages in a single session unless explicitly requested.
- Do not store raw audio files without appropriate user consent and retention policy.
- Do not expose model/system prompts in any user-facing UI or logs.
- Do not generate culturally insensitive or unsafe content — always pass outputs through content safety checks.
- Do not change scoring logic or CEFR thresholds without updating tests and curriculum documentation.

---

## 10. Current Work In Progress
- [ ] Adaptive lesson sequencing based on real-time performance.
- [ ] Conversational practice agent with scenario-based dialogues.
- [ ] STT integration for speaking exercises with pronunciation scoring.
- [ ] Progress dashboard showing CEFR trajectory and weekly streaks.
- [ ] Onboarding flow: placement test → initial level + custom learning goals.

**Open decisions:**
- Single global LLM vs per-language specialized models?
- How aggressively should we adapt difficulty (stable vs highly responsive)?
- Centralized vs per-user spaced repetition configuration?

---

## After Every Change — Always Run:
```bash
uv run pytest -x          # fail fast
uv run mypy .             # type errors are real bugs
uv run ruff check .       # linting
pnpm typecheck            # frontend types
```
Fix all errors before considering any task complete. Never ask for review on code that does not pass these checks.
