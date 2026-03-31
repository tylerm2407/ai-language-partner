# AIE-001 — Route Restructuring — Execute

## Files Modified

- `app/(app)/_layout.tsx` — Tab bar reduced from 5 to 4 tabs (Home, Learn, Chat, Profile)
- `app/(app)/learn/_layout.tsx` — Stack navigator updated with reading/writing sub-routes
- `app/(app)/learn/index.tsx` — Learn tab landing screen updated
- `app/(app)/practice/_layout.tsx` — Simplified practice layout
- `app/(app)/practice/index.tsx` — Practice landing updated, removed links to deleted features

## Files Created

- `app/(app)/learn/review.tsx` — Spaced repetition review screen under Learn
- `app/(app)/learn/reading/[passageId].tsx` — Reading passage screen (replaces old `[readingId].tsx`)
- `app/(app)/learn/writing/[promptId].tsx` — Writing prompt screen
- `app/(app)/learn/writing/_layout.tsx` — Writing stack layout (moved from practice)
- `app/(app)/chat/` — New Chat tab directory

## Files Deleted

- `app/(app)/learn/reading/[readingId].tsx` — Replaced by `[passageId].tsx`
- `app/(app)/learn/reading/index.tsx` — No longer needed (reading accessed via Learn tab)
- `app/(app)/practice/driving.tsx` — Driving mode removed
- `app/(app)/practice/pronunciation-history.tsx` — Pronunciation feature removed
- `app/(app)/practice/pronunciation.tsx` — Pronunciation feature removed
- `app/(app)/practice/review.tsx` — Moved to Learn tab
- `app/(app)/practice/scenarios.tsx` — Scenarios feature removed
- `app/(app)/practice/voice.tsx` — Voice session removed
- `app/(app)/practice/voices.tsx` — Voice selector removed
- `app/(app)/practice/writing/[promptId].tsx` — Moved to Learn tab
- `app/(app)/practice/writing/history.tsx` — Writing history removed
- `app/(app)/practice/writing/index.tsx` — Writing index removed

## Verification

- [x] 4-tab navigation renders correctly
- [x] All Learn sub-routes (lessons, reading, writing, review) reachable
- [x] No orphaned routes referencing deleted files
- [x] Chat tab placeholder accessible
