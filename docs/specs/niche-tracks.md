# Spec: Niche Tracks

> ## ⏸ PARKED — deferred to v2
>
> **Do not build from this spec.** Parked 2026-08-07 to keep the v1 scope on the
> App Store launch. Nothing here has been implemented: no schema, no RPC, no
> onboarding step, no content.
>
> The design is sound and was validated against production — carrier courses and
> restrictive row-level policies both hold up — so this is a pause, not a
> rewrite. Before it resumes, three decisions are still open (§8): healthcare
> pricing tier, one active track vs several, and the subject-matter review
> budget.
>
> One correction already folded in: the third launch track cannot be Interview
> English. English is not a selectable target language and there is no English
> course, so that track has no host language. §9.1 covers the options.

Status: **Parked — v2** (no code written)
Author: spec pass, 2026-08-05
Scope: product + technical design for vertical/purpose-specific language tracks in Fluenci

---

## 1. Problem & Goal

Fluenci today teaches one thing per language: generic, tourist-shaped conversational Spanish/French/Japanese. That content is a commodity — Duolingo gives it away, and it is the wrong content for the adults who actually pay. A US ICU nurse does not need "¿Dónde está la playa?"; she needs to take a pain history, explain NPO status before surgery, and de-escalate a frightened family member. A construction superintendent needs fall-protection and rebar vocabulary at 6 a.m., not restaurant ordering.

**Goal:** let a learner declare a real-world purpose ("healthcare Spanish", "jobsite Spanish", "job-interview English") and have the app's vocabulary, lessons, chat personas, reading, and writing prompts shift to that purpose — without rebuilding the app's learning engine, and without abandoning the general-language spine the learner still needs.

**Why it matters commercially (decided, not re-litigated here):** higher willingness to pay, employer/CEU reimbursable, and structurally un-servable by a mass-market app.

**Success criteria for v1:**
- A learner can pick a track in onboarding in under 15 seconds and immediately see track-specific content on the Learn screen.
- A track contains enough content that a learner doing 15 min/day does not exhaust it inside 6 weeks (see §4 numbers).
- Zero changes to `lib/srs.ts` — niche cards are ordinary cards in the ordinary SM-2 queue.
- Track access is enforced server-side, not by the client.

---

## 2. User-Facing Behavior

### 2.1 Recommendation: layered, not exclusive

**A niche track is an overlay on top of the learner's existing general course, not a replacement for it.**

Justification:

1. **Pedagogy.** A nurse still needs present/past tense, question formation, and object pronouns. An exclusive "healthcare Spanish course" would have to re-teach the entire A1–B2 grammar spine inside every vertical — 8× the content cost for content we already have.
2. **Engine fit.** `review_items`, `daily_stats`, XP, hearts, and streaks are all per-user and global. An exclusive track would fragment the streak and the review queue, or force a "which course am I in" selector on every screen. Layering keeps one queue, one streak, one XP ledger.
3. **Content economics.** Layered means one new content axis (`track_id`) on existing `units`/`cards`/`reading_passages`/`writing_prompts`. We ship 3 tracks at ~800 items each instead of 3 full courses at ~6,000 items each.
4. **Monetization shape.** An overlay is naturally an add-on/upgrade ("unlock Healthcare Spanish"), which maps cleanly onto the existing subscription tiers. An exclusive course is just a different SKU of the same thing and is harder to upsell.

Concretely: the learner still has "Spanish" as their course. The Learn screen gains a **Track** tab beside Vocab / Reading / Writing. Track units appear in the same `LearningPath`. Track cards enter the same SRS queue. Chat gains 5–6 track-specific personas above the generic nine.

### 2.2 Constraint: one active track per target language

A learner may enroll in many tracks over time but has **at most one `active` track per target language**. Reasons: content surfacing stays unambiguous (one Track tab, one persona set), the daily 20-new-card budget is not split three ways, and the entitlement check is a single comparison. Switching is free and instant; the previous track goes to `paused` with its progress intact (its cards stay in the SRS queue — you do not un-learn "la jeringa" because you switched to construction).

### 2.3 Picking a track — onboarding

`app/(public)/onboarding.tsx` currently runs: `language → motivation → idealSelf → level → placement → result → identity → goal`.

Insert one step, **`track`**, immediately after `motivation` (motivation is where the learner already declares *why*; the track step turns that answer into a product choice while the intent is hot).

- Step is **skippable and pre-filled**, consistent with the Smart Defaults principle in `DESIGN.md §UX Psychology Principles #1`. Default selection is "General <Language>" (i.e. no track).
- Track options shown are filtered by the chosen `targetLanguage`. If no track exists for that language, the step is skipped entirely (no dead-end screen).
- The `motivation` answer biases ordering: `work` surfaces professional tracks first; `travel`/`curious` surfaces "General" first with tracks below a "Learning for work?" divider.
- The whole step lives in the pre-auth draft (`lib/pending-onboarding.ts`) alongside every other answer, and is written by `writeProfile` in the same flush.
- **Locked tracks are visible but not selectable in onboarding.** Showing "Healthcare Spanish 🔒 Basic plan" pre-purchase is a conversion asset, not friction — but selecting it must not create a dead-end before the learner has an account. Tapping a locked track selects "General" and sets a flag that surfaces the paywall on first Learn-screen visit.
- New step count: 9. `ALL_STEPS` and the progress bar update automatically.

### 2.4 Switching later

Two entry points, both landing on the same `app/(app)/profile/track.tsx` screen:

- `app/(app)/profile/index.tsx` — a row under the language row: "Track — Healthcare Spanish".
- `app/(app)/learn/index.tsx` — the Track tab's empty state when no track is active: "Pick a focus →".

Switching calls the `set_active_track` RPC (§3.4). The screen states plainly what carries over ("Everything you've learned stays in your reviews") and what changes ("New lessons, chat partners, and readings switch to <track>").

Changing `targetLanguage` in `app/(app)/profile/settings.tsx` deactivates the current track if no track exists for the new language, and surfaces a one-line notice.

### 2.5 What actually changes for the learner

| Surface | Behavior with an active track |
|---|---|
| **Learn → Track tab** | Track units/lessons via the existing `LearningPath`. Vocab tab is unchanged (general spine). |
| **Vocabulary / SRS** | Track cards are ordinary `cards` rows, so they flow into `review_items` exactly like general cards. Same 20-new/day cap. Review screens are unchanged. |
| **Chat personas** | Track scenarios (e.g. *Triage Intake*, *Pre-op Consent*, *Discharge Instructions*) render **above** the nine generic scenarios in `app/(app)/chat/index.tsx`, with a "Your track" section header. Generic scenarios remain available. |
| **Reading** | `fetchReadingPassagesByCourse` gains a track filter. Track passages sort first with a track badge; general passages remain listed below. The Gutenberg library is unaffected. |
| **Writing** | Same pattern — track prompts first, general prompts below. |
| **Daily news** | **Unchanged for v1.** News is generated once per (language, tier) per day by `daily-news-cron`; per-track news would multiply generation cost by the track count for marginal benefit. Revisit when tracks > 6. |
| **Assessment** | Phase 2 (§6.4). |
| **Home / gamification** | Unchanged. |

### 2.6 Empty and error states

Every track surface must handle "content not loaded" as a real error with retry (per `CLAUDE.md §6` — never silently return `[]`). Follow the `libraryError` pattern already in `app/(app)/learn/index.tsx:399-416`.

---

## 3. Content Model

Convention notes, per `CLAUDE.md §5`: production is a **shared** Supabase project. Apply via the Supabase MCP `apply_migration` tool and mirror as `supabase/migrations/052_niche_tracks.sql`. RLS mandatory. `SECURITY DEFINER` helpers use `SET search_path = public` plus an `auth.uid()` caller guard (pattern from migrations 024/025/031) and revoke public EXECUTE (pattern from 051).

### 3.1 Relationship to existing content

```
courses (es)                    tracks (healthcare_es)
   │                                 │
   ├── units ────────────────────────┤   units.track_id NULL = general spine
   │     └── lessons                 │                  NOT NULL = track unit
   │           └── exercises         │
   ├── cards ───────────────────────┤   cards.track_id
   ├── reading_passages ────────────┤   reading_passages.track_id
   └── writing_prompts ─────────────┘   writing_prompts.track_id

user_tracks (user_id, track_id, status)     ← enrollment
track_scenarios (track_id, scenario_key)    ← PUBLIC metadata only
```

A track is scoped to a single `(slug, target_language)` pair — `healthcare` in Spanish and `healthcare` in French are two rows sharing a slug. This keeps every join a plain FK and lets us localize a track without schema change.

`exercises` needs **no** `track_id`: it hangs off `lessons` → `units`, which carries the track.

### 3.2 New tables

```sql
-- ═══════════════════════════════════════════════════════════════
-- 052: Niche tracks — vertical/purpose overlays on general courses
-- ═══════════════════════════════════════════════════════════════

-- ── 1. tracks — the catalog ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tracks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT NOT NULL,                    -- 'healthcare', 'jobsite', 'interview'
  target_language TEXT NOT NULL,                   -- matches courses.target_language
  course_id      UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  name           TEXT NOT NULL,                    -- 'Healthcare Spanish'
  tagline        TEXT NOT NULL DEFAULT '',         -- one line for the picker
  description    TEXT NOT NULL DEFAULT '',
  audience       TEXT NOT NULL DEFAULT '',         -- 'Nurses, medical assistants, EMTs'
  icon           TEXT NOT NULL DEFAULT 'briefcase',-- Ionicons glyph name
  cefr_min       TEXT NOT NULL DEFAULT 'A2' CHECK (cefr_min IN ('A1','A2','B1','B2','C1','C2')),
  cefr_max       TEXT NOT NULL DEFAULT 'B2' CHECK (cefr_max IN ('A1','A2','B1','B2','C1','C2')),
  -- Minimum subscription tier required to ACTIVATE this track.
  -- Enforced server-side in set_active_track(); the client uses it only for UI.
  min_tier       TEXT NOT NULL DEFAULT 'basic'
                   CHECK (min_tier IN ('starter','basic','premium','vip')),
  -- Number of lessons a non-entitled learner may complete as a preview.
  preview_lessons INT NOT NULL DEFAULT 1 CHECK (preview_lessons >= 0),
  order_index    INT NOT NULL DEFAULT 0,
  is_published   BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (slug, target_language)
);

ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read published tracks" ON public.tracks;
CREATE POLICY "Authenticated users can read published tracks"
  ON public.tracks FOR SELECT TO authenticated USING (is_published);
-- No client INSERT/UPDATE/DELETE. Catalog is written by migration or service role.

CREATE INDEX IF NOT EXISTS idx_tracks_language_published
  ON public.tracks(target_language, order_index) WHERE is_published;


-- ── 2. track_scenarios — PUBLIC persona metadata only ──────────
-- The hidden Claude system prompt for each scenario_key lives ONLY in
-- supabase/functions/_shared/track-scenarios.ts, mirroring the existing
-- split between types/scenarios.ts (public) and _shared/scenarios.ts
-- (hidden). Never store a system prompt in a client-readable table.
CREATE TABLE IF NOT EXISTS public.track_scenarios (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id     UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  scenario_key TEXT NOT NULL,      -- resolved server-side to a prompt builder
  label        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  icon         TEXT NOT NULL DEFAULT 'chatbubble',
  cefr_level   TEXT NOT NULL DEFAULT 'B1'
                 CHECK (cefr_level IN ('A1','A2','B1','B2','C1','C2')),
  order_index  INT NOT NULL DEFAULT 0,
  UNIQUE (track_id, scenario_key)
);

ALTER TABLE public.track_scenarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read track scenarios" ON public.track_scenarios;
CREATE POLICY "Authenticated users can read track scenarios"
  ON public.track_scenarios FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_track_scenarios_track
  ON public.track_scenarios(track_id, order_index);


-- ── 3. user_tracks — enrollment ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_tracks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id   UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  -- Denormalized so the "one active per language" partial unique index below
  -- can exist without a subquery. Written only by set_active_track().
  target_language TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'active'
               CHECK (status IN ('active', 'paused', 'completed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, track_id)
);

ALTER TABLE public.user_tracks ENABLE ROW LEVEL SECURITY;

-- Read own rows. Writes go through set_active_track() only — a direct client
-- UPDATE would let a starter-tier user activate a premium track.
DROP POLICY IF EXISTS "Users can read own track enrollments" ON public.user_tracks;
CREATE POLICY "Users can read own track enrollments"
  ON public.user_tracks FOR SELECT USING (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_tracks_one_active_per_language
  ON public.user_tracks(user_id, target_language) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_user_tracks_user
  ON public.user_tracks(user_id, status);
```

### 3.3 Columns added to existing content tables

```sql
-- ── 4. Attach track ownership to existing content ──────────────
ALTER TABLE public.units             ADD COLUMN IF NOT EXISTS track_id UUID REFERENCES public.tracks(id) ON DELETE CASCADE;
ALTER TABLE public.cards             ADD COLUMN IF NOT EXISTS track_id UUID REFERENCES public.tracks(id) ON DELETE SET NULL;
ALTER TABLE public.reading_passages  ADD COLUMN IF NOT EXISTS track_id UUID REFERENCES public.tracks(id) ON DELETE CASCADE;
ALTER TABLE public.writing_prompts   ADD COLUMN IF NOT EXISTS track_id UUID REFERENCES public.tracks(id) ON DELETE CASCADE;

-- NULL track_id == general-course content. Every existing row stays general.

-- Partial indexes: the general path (track_id IS NULL) is the hot query, and
-- track queries are always filtered by a single track_id.
CREATE INDEX IF NOT EXISTS idx_units_course_general
  ON public.units(course_id, order_index) WHERE track_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_units_track
  ON public.units(track_id, order_index) WHERE track_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cards_track
  ON public.cards(track_id, cefr_level) WHERE track_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reading_passages_track
  ON public.reading_passages(track_id, cefr_level) WHERE track_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_writing_prompts_track
  ON public.writing_prompts(track_id, cefr_level) WHERE track_id IS NOT NULL;
```

`cards.track_id` uses `ON DELETE SET NULL` deliberately: unpublishing a track must never orphan a learner's `review_items`. The card survives as an ordinary card.

`cards` also already carries `tags TEXT[]` (migration 001). Track cards get `tags = ARRAY['track','<slug>', ...domain subtags]` so cross-track reuse and content audits are possible without a join table.

### 3.4 Guarded RPC — `set_active_track`

The only write path into `user_tracks`. Follows the caller-guard + tier-check + pinned-search_path pattern of migrations 031/051.

```sql
-- ── 5. set_active_track — the only write path into user_tracks ──
CREATE OR REPLACE FUNCTION public.set_active_track(p_track_id UUID)
RETURNS TABLE (track_id UUID, status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  UUID := auth.uid();
  v_track    public.tracks%ROWTYPE;
  v_tier     TEXT;
  v_rank     INT;
  v_required INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Forbidden: no authenticated user';
  END IF;

  SELECT * INTO v_track FROM public.tracks
    WHERE id = p_track_id AND is_published;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Track not found or not published';
  END IF;

  -- Effective tier. Absent/inactive subscription == 'starter'.
  SELECT CASE WHEN s.is_active THEN s.tier ELSE 'starter' END INTO v_tier
    FROM public.subscriptions s WHERE s.user_id = v_user_id;
  v_tier := COALESCE(v_tier, 'starter');

  v_rank     := CASE v_tier         WHEN 'vip' THEN 4 WHEN 'premium' THEN 3 WHEN 'basic' THEN 2 ELSE 1 END;
  v_required := CASE v_track.min_tier WHEN 'vip' THEN 4 WHEN 'premium' THEN 3 WHEN 'basic' THEN 2 ELSE 1 END;

  IF v_rank < v_required THEN
    RAISE EXCEPTION 'UPGRADE_REQUIRED: % plan needed for this track', v_track.min_tier
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- One active track per (user, language): demote the incumbent.
  UPDATE public.user_tracks ut
     SET status = 'paused', updated_at = now()
   WHERE ut.user_id = v_user_id
     AND ut.target_language = v_track.target_language
     AND ut.status = 'active'
     AND ut.track_id <> p_track_id;

  INSERT INTO public.user_tracks (user_id, track_id, target_language, status)
  VALUES (v_user_id, p_track_id, v_track.target_language, 'active')
  ON CONFLICT (user_id, track_id)
  DO UPDATE SET status = 'active', updated_at = now();

  RETURN QUERY
    SELECT ut.track_id, ut.status FROM public.user_tracks ut
     WHERE ut.user_id = v_user_id AND ut.track_id = p_track_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_active_track(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_active_track(UUID) TO authenticated;


-- ── 6. clear_active_track — back to the general course ─────────
CREATE OR REPLACE FUNCTION public.clear_active_track(p_target_language TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Forbidden: no authenticated user';
  END IF;
  UPDATE public.user_tracks
     SET status = 'paused', updated_at = now()
   WHERE user_id = v_user_id
     AND target_language = p_target_language
     AND status = 'active';
END;
$$;

REVOKE ALL ON FUNCTION public.clear_active_track(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_active_track(TEXT) TO authenticated;
```

Edge functions that need the caller's active track (`ai-chat` for persona resolution) read `user_tracks` with the service-role client — no RPC needed, RLS is bypassed.

### 3.5 SRS participation — explicit

**Niche vocabulary participates in exactly the same SM-2 review queue as general vocabulary.** No second queue, no separate scheduler, no change to `lib/srs.ts`, `hooks/useReviewQueue.ts`, or the `review_items` / `review_logs` tables.

Mechanically: a track lesson's exercises reference `cards` rows the same way general lessons do; completing a lesson creates/updates `review_items` through the existing lesson runner; `fetchDueReviewItems` is untouched and returns a mixed queue sorted by overdue-ness.

Consequences accepted:
- The 20-new-cards/day cap (`SRS_DEFAULTS.newCardsPerDay`, enforced atomically by `tryConsumeNewCardSlot`) is **shared** between general and track cards. A learner grinding a track slows their general-course intake. This is correct — it is one learner with one memory.
- Switching tracks does not remove the old track's cards from the queue. Stated plainly in the switch UI (§2.4).
- Optional additive surface (not required for v1): `fetchCardsByTrack(trackId, level)` powering a "Track drill" mode, mirroring the existing `fetchCardsBySkillType` shape. Read-only; does not alter scheduling.

### 3.6 TypeScript types (`types/index.ts`)

```ts
export interface Track {
  id: string;
  slug: string;
  targetLanguage: LanguageCode;
  courseId: string | null;
  name: string;
  tagline: string;
  description: string;
  audience: string;
  icon: string;
  cefrMin: string;
  cefrMax: string;
  minTier: SubscriptionTier;   // reuse existing union
  previewLessons: number;
  orderIndex: number;
  isPublished: boolean;
}

export type UserTrackStatus = 'active' | 'paused' | 'completed';

export interface UserTrack {
  id: string;
  userId: string;
  trackId: string;
  targetLanguage: LanguageCode;
  status: UserTrackStatus;
  startedAt: string;
  updatedAt: string;
  track?: Track;
}

export interface TrackScenarioMeta {
  id: string;
  trackId: string;
  scenarioKey: string;
  label: string;
  description: string;
  icon: string;      // Ionicons glyph, validated at render
  cefrLevel: string;
  orderIndex: number;
}
```

Additive fields: `Card.trackId?`, `Unit.trackId?`, `ReadingPassage.trackId?`, `WritingPrompt.trackId?` — all `string | null`, all optional so existing mappers stay valid.

---

## 4. Content Sourcing

### 4.1 How much content a track needs to feel real

"Feels real" = a professional cannot exhaust it in a month and never hits a phrase they'd call wrong. Per-track launch bar:

| Asset | Count | Notes |
|---|---|---|
| Vocabulary cards (`cards`, `skill_type='vocabulary'`) | **300** | Domain nouns/verbs/adjectives, CEFR-tagged A2–B2 |
| Chunk cards (`skill_type='chunk'`) | **100** | Formulaic multi-word phrases — *"¿Le duele cuando presiono aquí?"*. This is what makes a track feel professional rather than a glossary. |
| Units (`units` with `track_id`) | **8** | Thematic: e.g. Intake, Pain & Symptoms, Medications, Procedures, Consent, Discharge, Emergencies, Family Communication |
| Lessons | **32** | 4 per unit |
| Exercises | **~384** | 12 per lesson, mixing the 16 existing `ExerciseType` values per `.claude/rules/learning.md` |
| Chat scenarios (`track_scenarios` + hidden prompts) | **6** | ~450 words of authored system prompt each, matching the depth of `_shared/scenarios.ts` |
| Reading passages | **12** | 4 each at A2 / B1 / B2, 150–500 words, with annotations |
| Writing prompts | **12** | Real artifacts: a shift-handoff note, an incident report, a follow-up email |

**≈ 830 authored items per track.** At 15 min/day and ~12 new items/day that is ~10 weeks of first-pass content before review-only mode — past the point where retention is decided.

Below ~250 vocabulary items a track reads as a themed word list and will get refunded. Do not ship one.

### 4.2 Sourcing method — hybrid, in three passes

**Pass 1 — Curated public-domain spine (~40% of vocabulary, 100% of the terminology backbone).**

Real, licensable sources, registered as rows in the existing `content_sources` table (`name`, `license`, `attribution`, `url`) with each card carrying `source_id` + `source_item_id` + `source_type='imported'`:

- *Healthcare Spanish:* NIH/MedlinePlus bilingual health topics, CDC Spanish-language patient materials, NCI Dictionary of Cancer Terms (Spanish) — US federal works, public domain.
- *Jobsite Spanish:* OSHA Spanish-language construction standards and its bilingual hazard vocabulary, NIOSH bilingual materials — public domain.
- *Interview English:* O*NET occupation task statements (public domain) plus originally authored content; no licensing dependency.

Implementation: a new script under `scripts/` following the existing Tatoeba/Gutenberg importer pattern — parse → dedupe against `cards(source_id, source_item_id)` (index `idx_cards_source_dedup` already exists) → insert with a service-role key. Never run from the client.

**Pass 2 — AI expansion via the existing validated pipeline (~60% of vocabulary, ~100% of exercises and distractors).**

Uses `supabase/functions/generate-content` and its `generateValidated` wrapper — which already runs `validateContentSafety` with up to 2 retries and logs a `level_warn` when CEFR drift ≥ 2 sublevels. Two changes are needed, both small:

1. Add `trackSlug?: string` and `trackContext?: string` to `GenerateContentRequest`, and append a domain block to `buildSystemPrompt` for every existing task type. Example appended block for `task: 'exercises'`:

   > `DOMAIN: You are writing content for {trackName} — {audience}. Every prompt, answer, and distractor must be something this professional would plausibly encounter on shift. Register: {register}. Never invent clinical/safety facts; use only the target vocabulary supplied. Do not produce dosages, drug names, or diagnostic claims.`

2. Add two task types: `'track_vocabulary'` (returns `{ target, native, partOfSpeech, cefrLevel, exampleSentence, exampleSentenceTranslation, collocations[] }[]`) and `'track_scenario_seed'` (returns candidate dialogue openers used as authoring input for the human-written system prompts — **not** shipped as prompts).

Generation runs **offline in a batch script**, not on a learner's device: `scripts/generate-track-content.ts` invokes the edge function with a service-role token, writes to `cards`/`exercises` with `source_type='ai_generated'` and `source_id` pointing at an `ai_generated_haiku` row in `content_sources`. This keeps the learner-facing daily quota (`consume_daily_quota`) out of the content pipeline entirely.

**Pass 3 — Human SME review.**

The safety pipeline validates *safety* and approximates *level*. It does not validate *domain correctness*, and that is the entire value proposition of a niche track. Migration 049 exists because a QA sweep found nonexistent Korean words and English-meaning questions with target-language distractors shipped in the general course. Assume the same defect rate here, with worse consequences.

### 4.3 Quality control gates

Content is not `is_published` until all four pass:

1. **Automated safety + level** — already enforced by `generateValidated`. Any item whose generation used the fallback path is discarded, never shipped.
2. **Structural lint** (`scripts/lint-track-content.ts`, new) — mechanical checks for the exact defect classes migration 049 fixed:
   - every `multiple_choice` row has exactly 4 options and contains `correct_answer`
   - "what does X mean in English" prompts have **English** distractors (non-ASCII / target-language-token detection)
   - no duplicate `target_text` within a track
   - every card has non-empty `native_text`, `target_text`, `cefr_level`, `example_sentence`
   - `cefr_level` within the track's `cefr_min`..`cefr_max`
3. **Back-translation check** — each card's `target_text` is round-tripped through the existing `translate` edge function; a mismatch against `native_text` flags it for human review. Catches flat-wrong translations cheaply at ~$0.002/item.
4. **SME sign-off** — a bilingual domain professional reviews **100% of the 400 core cards and all 6 scenario prompts**, plus a **20% random sample of exercises** (escalating to 100% if the sample defect rate exceeds 3%). SME initials and date recorded in `content_sources.attribution` for the track's human-review row.

Estimated SME effort: ~25 hours per track (400 cards at ~2 min, 6 prompts at ~30 min, 80 sampled exercises at ~3 min). At $50–75/hr for a bilingual RN or bilingual construction safety trainer: **$1,250–1,900 per track**. Budget ~$4,000–5,500 for three launch tracks. This is the single largest non-engineering cost of the feature and is not optional for the healthcare and jobsite tracks (§8).

### 4.4 Ongoing content

After launch, a track grows by ~40 cards + 4 lessons per month via the same batch script plus a lighter SME pass (sample-only). No runtime AI generation of track content — a learner never triggers track content generation, which keeps cost predictable and keeps unreviewed content out of the app.

---

## 5. Integration Points

File-by-file. Everything additive; nothing listed here changes existing behavior for a learner with no active track.

### Database / migrations
- **`supabase/migrations/052_niche_tracks.sql`** *(new)* — all DDL from §3. Mirror of what is applied via MCP `apply_migration`.

### Types
- **`types/index.ts`** — add `Track`, `UserTrack`, `UserTrackStatus`, `TrackScenarioMeta`; add optional `trackId` to `Card`, `Unit`, `ReadingPassage`, `WritingPrompt`.
- **`types/scenarios.ts`** — `ScenarioKey` becomes `BuiltInScenarioKey | string`; export a `resolveScenarioMeta(key, trackScenarios)` helper so the chat picker can render both built-in and track scenarios uniformly. Built-in keys and `SCENARIO_META` are unchanged.

### Data access
- **`lib/supabase-queries.ts`** — new `// ─── Niche Tracks ───` section holding:
  - `fetchTracks(targetLanguage)` — published tracks, ordered by `order_index`, `.limit(50)`.
  - `fetchActiveTrack(userId, targetLanguage)` — `user_tracks` joined to `tracks`, `status='active'`, `.maybeSingle()`.
  - `fetchUserTracks(userId)` — all enrollments, `.limit(50)`.
  - `setActiveTrack(trackId)` — `supabase.rpc('set_active_track', ...)`; maps the `UPGRADE_REQUIRED` Postgres error to a typed `TrackUpgradeRequiredError` (mirroring the existing `NewCardsCapReachedError` pattern) so the UI can route to the paywall instead of showing a raw SQL message.
  - `clearActiveTrack(targetLanguage)` — `supabase.rpc('clear_active_track', ...)`.
  - `fetchTrackScenarios(trackId)` — ordered, `.limit(20)`.
  - `fetchCardsByTrack(trackId, level?)` — mirrors `fetchCardsBySkillType`, `.limit(500)`.
  - mappers `mapTrack`, `mapUserTrack`, `mapTrackScenario` in the mappers section.
  - **Modified signatures** (all new params optional, default = existing behavior):
    - `fetchUnits(courseId, trackId?: string | null)` — `trackId === undefined` keeps today's behavior; `null` filters `track_id IS NULL`; a uuid filters to that track.
    - `fetchReadingPassagesByCourse(courseId, level?, trackId?)`
    - `fetchWritingPromptsByCourse(courseId, level?, trackId?)`

### State
- **`stores/useAppStore.ts`** — add `activeTrack: UserTrack | null`, `tracks: Track[]`, `loadTracks()`, `refreshActiveTrack(userId)`. `loadUserData(userId)` also loads the active track so every screen can read it without its own fetch.
- **`hooks/useActiveTrack.ts`** *(new)* — thin selector returning `{ track, trackId, loading, setTrack, clearTrack }` with the upgrade-required branch handled once.

### Onboarding
- **`lib/pending-onboarding.ts`** — add `trackId: string | null` (and `trackSlug` for logging) to `PendingOnboardingDraft`; keep it optional so drafts written by older builds still parse.
- **`app/(public)/onboarding.tsx`** — add `'track'` to `Step` and `ALL_STEPS` after `'motivation'`; render a track picker (reusing the existing `Pressable` card pattern from the motivation step, showing `name` / `tagline` / lock badge); skip the step when `fetchTracks(targetLanguage)` returns empty; in `writeProfile`, after `upsertProfile`, call `setActiveTrack(draft.trackId)` when set — wrapped so an `UPGRADE_REQUIRED` failure does not block onboarding completion.

### Learn
- **`app/(app)/learn/index.tsx`** — add `{ key: 'track', label: <track.name>, icon: 'briefcase' }` to `TAB_CONFIG`, rendered only when `activeTrack` exists; add a `trackUnits` state loaded via `fetchUnits(courseId, activeTrack.trackId)` and rendered through the existing `LearningPath`; pass `activeTrack?.trackId` into the reading and writing fetches and render track results in a "For your track" section above the general list. Existing `fetchUnits(courseId)` call in `loadCourseContent` becomes `fetchUnits(courseId, null)` so track units do not leak into the general path.
- **`components/learning-path/LearningPath.tsx`** — no logic change; accepts an optional `title`/`badge` prop for the track header.

### Chat
- **`app/(app)/chat/index.tsx`** — build `SCENARIOS` as `[...trackScenarios, ...SCENARIO_ORDER.map(...)]` with a section header when a track is active; pass the track scenario's `scenario_key` through unchanged as `scenarioKey`.
- **`lib/ai.ts`** — `AIChatRequest.scenarioKey` widens from `ScenarioKey` to `string` (server validates); no other change.
- **`supabase/functions/_shared/track-scenarios.ts`** *(new)* — the hidden system prompts, one builder per track scenario key, authored to the same structure as `_shared/scenarios.ts` (IDENTITY & SETTING / LEARNER CONTEXT & GOAL / CHARACTER TRAITS / CONVERSATION ARC / TARGET VOCABULARY / TARGET GRAMMAR / TONE & REGISTER / FAILURE MODES / EXAMPLE BEHAVIORS / BOUNDARY REMINDER). Domain safety clauses are mandatory in FAILURE MODES — e.g. the healthcare personas must never state a dosage, name a prescription drug, or give a diagnosis, exactly as the existing `doctorPrompt` already does.
- **`supabase/functions/_shared/scenarios.ts`** — extend `getScenario(key)` to fall back to the track registry, so `ai-chat` needs no structural change.
- **`supabase/functions/ai-chat/index.ts`** — before resolving the scenario, load the caller's active track (service-role read of `user_tracks`) and reject a track `scenarioKey` the caller is not entitled to, falling back to `free_chat`. Prevents a modified client from unlocking premium personas by sending a key it saw in the catalog.

### Writing / grading
- **`app/(app)/learn/writing/[promptId].tsx`** — no change; track prompts are ordinary `writing_prompts` rows.
- **`supabase/functions/grade-writing/index.ts`** — optional Phase 2: when the prompt has a `track_id`, append a domain-register line to the rubric prompt. Not required for v1.

### Profile / settings
- **`app/(app)/profile/track.tsx`** *(new)* — track picker + switcher; locked tracks route to `profile/subscription` with the required tier pre-highlighted.
- **`app/(app)/profile/index.tsx`** — a "Track" row under the language row linking to the above.
- **`app/(app)/profile/settings.tsx`** — after a `targetLanguage` change, call `clearActiveTrack(oldLanguage)` and show a one-line notice.

### Monetization plumbing
- **`lib/plans.ts`** — add a track line to `PLAN_FEATURES` for `basic`/`premium`/`vip` (§7). No limit-shape change.
- **`supabase/functions/_shared/plan-limits.ts`** — unchanged. Track access is a tier comparison in `set_active_track`, not a daily quota.

### Tests
- `lib/track-access.test.ts` — tier-rank comparison logic used by the client for lock badges (must agree with the RPC's ranking).
- `supabase/functions/_shared/track-scenarios.test.ts` — every `track_scenarios.scenario_key` in the seed data resolves to a prompt builder; every builder emits the boundary-reminder and domain-safety clauses.
- `lib/supabase-queries.test.ts` — `fetchUnits(courseId)` with no third argument still returns all units (no regression for existing callers).

### Docs
- `DESIGN.md` — if the track badge/section-header pattern needs a token or component not already documented, add it in the same change (per `.claude/rules/design.md`).

---

## 6. Launch Scope

Build **three tracks**, all in the same release, chosen on US market size × willingness to pay × employer reimbursement × content sourcing cost.

### 6.1 Healthcare Spanish for US clinical staff — `healthcare` × `es`

- **Market:** ~3.3M RNs, ~700k LPNs, ~750k medical assistants, plus EMTs and techs. Roughly 13% of US patients speak Spanish at home; Joint Commission and CLAS standards already push language access, so the need is institutional, not just personal.
- **WTP / reimbursement:** the strongest of the three. Hospitals run tuition-assistance and CEU budgets; "medical Spanish" courses already sell at $200–600. Individual professionals price-anchor against that, not against Duolingo.
- **Content sourcing:** best of the three — MedlinePlus, CDC, and NCI bilingual materials are federal public-domain works, so Pass 1 is cheap and legally clean.
- **Risk:** highest content-correctness liability. Requires the full 100% SME review and explicit in-app scoping ("Fluenci is a language-learning tool, not a substitute for a qualified medical interpreter") — see §8.

### 6.2 Jobsite Spanish for construction supervisors — `jobsite` × `es`

- **Market:** ~1.1M US construction supervisors/foremen over a workforce that is roughly a third Hispanic. The buyer here is a supervisor whose crew's safety depends on being understood.
- **WTP / reimbursement:** high and *company-paid*. Safety training is an existing line item; a $10–20/mo per-supervisor tool is inside signing authority for most GCs. Also the easiest of the three to sell as a small B2B bundle later.
- **Content sourcing:** OSHA/NIOSH bilingual safety vocabulary is public domain. Additionally, **30–40% of its core vocabulary overlaps with healthcare** (body parts, injuries, pain description, emergency phrases), so the second track costs meaningfully less than the first.
- **Risk:** low. Safety phrasing still needs SME review, but the failure mode is awkwardness rather than clinical harm.

### 6.3 Job-interview & workplace English — `interview` × `en`

- **Market:** the largest raw audience of the three — millions of foreign-born working-age adults in the US, with a clear, time-boxed, emotionally urgent goal ("I have an interview in three weeks").
- **WTP:** highest *individual* willingness to pay per outcome; people buy interview coaching at $100+/session. Also the best organic-acquisition surface — "practice job interview in English" is a high-intent search.
- **Content sourcing:** cheapest. No licensing dependency; O*NET task statements are public domain and the rest is originally authored. SME review is a bilingual career coach, not a clinician — lower rate, lower risk.
- **Strategic bonus:** it is the only track targeting `en`, which exercises the English-as-target direction that the app currently under-serves. Shipping it validates that direction before we invest more there.

### 6.4 Explicitly deferred

- **Business Japanese for expats** — small US market, hardest content (keigo register + kanji), highest cost per shipped item. Later.
- **Restaurant / service-industry Spanish** — real volume but low individual WTP and high churn; the employer will not reimburse it.
- **Customer-support English** — genuinely valuable but it is a B2B seat sale, not a self-serve motion. Revisit once the school/org contract machinery (`organizations`, `contract_config`) is live for public use.
- **Track assessment / "proof of proficiency"** — a scored 3-scenario roleplay producing a shareable track certificate. High strategic value (it is the employer-reimbursement receipt) but it depends on the conversation-grading path currently gated behind `SCHOOL_ENABLED`. Phase 2, immediately after launch.

---

## 7. Monetization

### 7.1 Recommendation: subscription-tier gating, not one-time unlocks

Tracks are gated by `tracks.min_tier` against the learner's existing subscription tier. No new SKUs, no new entitlement table, no purchase-restore logic beyond what `lib/purchases.ts` already does.

Why not one-time unlocks: every non-consumable IAP adds an App Store product, a RevenueCat entitlement, a restore path, and a refund path — for a feature whose value is ongoing content, not a one-time asset. Why not a separate "Professional" tier: the tier ladder is already four deep (`starter` $3.79 / `basic` $9.99 / `premium` $19.99 / `vip` $29.99); a fifth tier splits the paywall's attention rather than raising ARPU. (Whether the ladder itself is priced right for a healthcare buyer is a real open question — §8.1.)

### 7.2 Proposed mapping

| Tier | Track entitlement |
|---|---|
| `starter` ($3.79) | Sees the full track catalog. May complete `preview_lessons` (default 1) of any track, then hits the paywall. Cannot activate a track. |
| `basic` ($9.99) | One active track, switchable. All track lessons, cards, reading, writing, and text chat personas. |
| `premium` ($19.99) | Everything in basic, plus track personas in **voice** chat and unlimited switching without cooldown. |
| `vip` ($29.99) | Everything, plus (Phase 2) the track assessment + certificate. |

All launch tracks ship with `min_tier = 'basic'`. The column exists so a future high-cost track (e.g. one with licensed content) can be set to `premium` without a migration.

### 7.3 Enforcement

- **Server-authoritative.** `set_active_track` (§3.4) reads `subscriptions.tier`/`is_active` and raises `UPGRADE_REQUIRED` with `ERRCODE = insufficient_privilege`. There is no client-writable path into `user_tracks` — the table has a SELECT-only RLS policy.
- **`ai-chat`** independently re-checks entitlement before resolving a track `scenarioKey`, so a modified client cannot use a premium persona by sending its key.
- **`plan-limits.ts` is untouched.** Track access is a boolean entitlement, not a metered quota; the daily text/voice/writing counters apply identically inside and outside a track. Do not add a `dailyTrackX` counter — it would need a new column in `daily_usage` and a new branch in `consume_daily_quota` for no product benefit.
- **Client UI** reads `tracks.min_tier` purely to draw the lock badge and route to `app/(app)/profile/subscription.tsx`. It is never the enforcement point.

### 7.4 Paywall copy

`app/(app)/profile/subscription.tsx` renders `PLAN_FEATURES[tier]`. Add one bullet per tier:

- `basic`: `'1 career track (Healthcare, Jobsite, or Interview)'`
- `premium`: `'Career track + voice roleplay with track personas'`
- `vip`: `'Career track + assessment & certificate'`

When the paywall is reached *from* a track lock, prepend a contextual line naming the specific track — this is the ethical form of loss framing already established in `DESIGN.md §UX Psychology Principles #5`: a true statement about a real thing the learner just chose, with no countdown and no guilt.

### 7.5 Employer reimbursement

The lowest-effort, highest-leverage adjacent feature: an emailable itemized receipt naming the track ("Fluenci — Healthcare Spanish, annual"). Reimbursement forms need a line item, not a certificate. Cheap to build, materially raises annual-plan conversion for the healthcare and jobsite tracks. Recommend building it with the launch, ahead of the certificate.

---

## 8. Risks & Open Questions

Ordered by how much they need a human decision before build starts.

### 8.1 Is `basic` ($9.99) the right price for a healthcare track? — **needs Tyler's call**
Medical-Spanish courses sell at $200–600. Gating the healthcare track at $9.99/mo may leave real money on the table, and a low price can read as low credibility to a professional buyer. Options: (a) ship as specced at `basic` and raise later (raising a price on existing subscribers is painful); (b) set healthcare to `min_tier='premium'` ($19.99) at launch and keep jobsite/interview at `basic`, using the split as a live price test. The schema supports either with no code change. **Recommendation: (b).**

### 8.2 Content liability in healthcare and safety domains — **needs a written policy decision**
A wrong translation of a clinical or fall-protection phrase has real-world consequences. Decisions needed:
- Do we allow any AI-generated clinical phrase to ship without 100% human SME review? (Spec assumes **no** for healthcare and jobsite; interview English can ship at 20% sampling.)
- What in-app disclaimer, and where? Minimum: a one-time scoping notice on track activation stating Fluenci is a language-learning tool and not a substitute for a qualified medical interpreter, plus a line in Terms.
- Is legal review needed before the healthcare track goes live?

### 8.3 SME budget and timeline — **needs a go/no-go**
~$4,000–5,500 and ~3 weeks of calendar time for three tracks (§4.3), spent before any revenue. The alternative — ship on automated QC alone — is the path that produced migration 049, in a domain where the defects would be far more visible. **Recommendation: fund it, and cut the launch to two tracks (healthcare + interview) if the budget is tight**, since jobsite reuses healthcare's vocabulary and is the cheapest to add later.

### 8.4 One active track, or many? — **product call**
Spec assumes one active per language for queue clarity and entitlement simplicity. A learner who is both a nurse *and* interviewing will want two. Multi-track is a partial-index change plus a queue-composition decision, not a rewrite — but it should be decided now, because "unlimited tracks" is a natural `premium` differentiator we would otherwise give away at `basic`.

### 8.5 Track-level CEFR claims
A learner who completes Healthcare Spanish at B1 is *not* B1 in general Spanish, and vice versa. If Fluenci markets "proof of CEFR proficiency", the track certificate (Phase 2) must be scoped explicitly ("B1 — Healthcare domain") or it is a misleading credential. Needs a copy and positioning decision before the certificate ships, not after.

### 8.6 Card duplication across tracks
Healthcare and jobsite overlap ~30–40% on body parts, injury, and emergency vocabulary, and the schema gives each card a single `track_id`. With one active track this is invisible. If §8.4 goes multi-track, a learner in both will see duplicate cards in one SRS queue. Fix if needed: promote overlapping items to `track_id IS NULL` general cards tagged `['track','healthcare','jobsite']`. Cheap now, annoying later — worth deciding alongside §8.4.

### 8.7 Adding a track requires a deploy
Track catalog, units, cards, reading, and writing are all data. But the **hidden chat prompts are code** (`_shared/track-scenarios.ts`), because putting a system prompt in a client-readable table would violate `CLAUDE.md §7` ("don't expose model/system prompts"). So a new track's personas need an edge-function deploy. Acceptable at 3 tracks; if the roadmap is 20 tracks, the alternative is a service-role-only table with RLS denying all client reads — more moving parts, revocable secret surface. Flagging the tradeoff now.

### 8.8 Shared production database
`ngqpsuixmumdnqbqxjxv` is shared with other NovaWealth apps. Migration 052 adds only new `public.tracks*` / `public.user_tracks` objects and nullable columns on tables Fluenci owns. Names are generic enough to collide conceptually with another app someday — consider a `fluenci_` prefix on the new tables if any other NovaWealth product might ever want a "tracks" concept. **Needs a naming call before the migration is applied**, since renaming after data exists is expensive.

### 8.9 Onboarding length
Adding a step takes onboarding from 8 to 9 screens. That is a measurable completion-rate risk on a flow that is already the app's primary funnel. Mitigations already in the spec: the step auto-skips when no track exists for the language, and it is pre-filled with "General". Worth instrumenting `onboarding_step_completed` per step at launch so the cost is measurable rather than argued about.
