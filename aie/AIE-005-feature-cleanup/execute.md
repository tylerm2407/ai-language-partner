# AIE-005 — Feature Cleanup — Execute

## Files Deleted — Components (10)

- `components/practice/ConversationReview.tsx`
- `components/practice/DrivingModeUI.tsx`
- `components/practice/PronunciationReport.tsx`
- `components/practice/ScenarioSelector.tsx`
- `components/practice/VoiceSelector.tsx`
- `components/speaking/PronunciationRecorder.tsx`
- `components/speaking/PronunciationScoreView.tsx`
- `components/ui/AIUsageMeter.tsx`
- `components/ui/CEFRBadge.tsx`
- `components/ui/LevelUpCelebration.tsx`

## Files Deleted — Hooks (10)

- `hooks/useAIUsage.ts`
- `hooks/useAdaptiveDifficulty.ts`
- `hooks/useDrivingMode.ts`
- `hooks/usePersistentTutor.ts`
- `hooks/usePersonality.ts`
- `hooks/useReadingLibrary.ts`
- `hooks/useScenarios.ts`
- `hooks/useSpeakingPractice.ts`
- `hooks/useVoiceSession.ts`
- `hooks/useWritingPractice.ts`

## Files Deleted — Config & Scripts (5)

- `config/courseStructure.ts`
- `config/personalities.ts`
- `config/publicDomainReadings.ts`
- `scripts/seedCourseStructure.ts`
- `scripts/seedReadingMaterials.ts`
- `scripts/seedWritingPrompts.ts`

## Files Deleted — Routes (8)

- `app/(app)/practice/driving.tsx`
- `app/(app)/practice/pronunciation.tsx`
- `app/(app)/practice/pronunciation-history.tsx`
- `app/(app)/practice/review.tsx`
- `app/(app)/practice/scenarios.tsx`
- `app/(app)/practice/voice.tsx`
- `app/(app)/practice/voices.tsx`
- `app/(app)/practice/writing/` (entire directory)

## Files Deleted — Infrastructure (1)

- `lib/adaptive.ts`

## Directories Deleted (1)

- `fluenci-voice-agent/` (Python voice agent: agent.py, Dockerfile, requirements.txt, .env.example)

## Verification

- [x] All listed files removed from repository
- [x] No broken imports referencing deleted modules
- [x] App builds successfully after cleanup
