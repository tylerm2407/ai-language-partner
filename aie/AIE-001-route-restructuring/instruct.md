# AIE-001 — Route Restructuring — Instruct

> *This is a retroactive AIE entry. The directive below is reconstructed from the implemented changes, not captured at the time of implementation.*

## Directive

Restructure the Expo Router file-based navigation from a 5-tab layout to a 4-tab layout (Home, Learn, Chat, Profile). Consolidate reading and writing routes under the Learn tab. Retain the Practice tab for focused review activities but remove standalone practice features (driving, pronunciation, scenarios, voice, voices).

## Scope

- Modify `app/(app)/_layout.tsx` to define 4 bottom tabs
- Update `app/(app)/learn/_layout.tsx` to include reading and writing sub-routes
- Move reading routes from practice context to `app/(app)/learn/reading/`
- Move writing routes from practice to `app/(app)/learn/writing/`
- Add `app/(app)/learn/review.tsx` for spaced repetition review
- Simplify `app/(app)/practice/` to remove deleted feature routes
- Add Chat tab route at `app/(app)/chat/`

## Constraints

- File-based routing only — no imperative navigation overrides
- Preserve deep-link patterns for lesson/reading/writing IDs
- No layout changes to public (auth) routes
