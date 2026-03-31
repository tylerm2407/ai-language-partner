# AIE — Align, Instruct, Execute — Language Learning App

Every non-trivial implementation gets an AIE entry **before** code is written (or retroactively when changes predate this system).

## Domain Tags

| Domain | Covers |
|--------|--------|
| `mobile` | Expo/RN screens, components, hooks, navigation, animations |
| `edge-functions` | Supabase Edge Functions (`supabase/functions/`) |
| `database` | Schema, migrations, RLS policies, indexes, seed data |
| `auth` | Authentication, authorization, sessions |
| `ai` | Claude/Gemini API calls, grading logic, system prompts |
| `deps` | Package installs/removals |
| `infrastructure` | CI/CD, Supabase config, env, deployment |

## Severity

| Level | When |
|-------|------|
| `critical` | Breaking schema change, auth/payment logic, data loss risk |
| `major` | New feature, large refactor, multi-file change |
| `moderate` | Single-feature addition, focused refactor |
| `minor` | Config tweak, copy change, single-file fix |

## Entry Format

Each entry lives in `aie/AIE-NNN-slug/` with three files:

| File | Purpose |
|------|---------|
| `align.md` | **Why** — business context, user problem, success criteria |
| `instruct.md` | **What** — technical directive, scope, constraints |
| `execute.md` | **How** — files touched, commands run, verification steps |

## Entries

| ID | Slug | Domain | Severity | Status | Summary |
|----|------|--------|----------|--------|---------|
| 001 | route-restructuring | mobile | major | complete | 5-tab → 4-tab nav; practice consolidated into Learn |
| 002 | new-exercise-types | mobile | major | complete | 4 new exercise components + LessonRunner update |
| 003 | reading-module | mobile | major | complete | Reading flow: passage viewer → tooltips → comprehension quiz |
| 004 | writing-module | mobile | moderate | complete | Unified WritingExercise replacing PromptCard + WritingEditor |
| 005 | feature-cleanup | mobile | major | complete | Removed driving mode, voice sessions, pronunciation, scenarios, tutor personalities |
| 006 | edge-function-overhaul | edge-functions | major | complete | Shared utils, grade-writing function, 6 functions deleted |
| 007 | schema-migrations | database | critical | complete | Reading/writing tables, RLS policies, performance indexes |
| 008 | grading-engine | ai | moderate | complete | Confusable-pairs library, enhanced fuzzy grading, multi-source review |
