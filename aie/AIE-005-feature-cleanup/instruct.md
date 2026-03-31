# AIE-005 — Feature Cleanup — Instruct

> *This is a retroactive AIE entry. The directive below is reconstructed from the implemented changes, not captured at the time of implementation.*

## Directive

Remove all components, hooks, configs, and infrastructure related to the following deprecated features:

### Features Removed

1. **Driving Mode** — `DrivingModeUI` component, `useDrivingMode` hook, `driving.tsx` route
2. **Voice Sessions** — `VoiceSelector` component, `useVoiceSession` hook, `voice.tsx`/`voices.tsx` routes, `fluenci-voice-agent/` directory
3. **Pronunciation Practice** — `PronunciationRecorder`, `PronunciationScoreView`, `PronunciationReport`, `useSpeakingPractice` hook, pronunciation routes
4. **Scenarios** — `ScenarioSelector`, `useScenarios` hook, `scenarios.tsx` route
5. **Tutor Personalities** — `usePersonality`, `usePersistentTutor` hooks, `personalities.ts` config
6. **AI Usage Metering** — `AIUsageMeter` component, `useAIUsage` hook
7. **Conversation Review** — `ConversationReview` component
8. **UI Decorations** — `CEFRBadge`, `LevelUpCelebration` components
9. **Adaptive Difficulty** — `useAdaptiveDifficulty` hook, `lib/adaptive.ts`
10. **Seed Scripts** — `scripts/seedCourseStructure.ts`, `seedReadingMaterials.ts`, `seedWritingPrompts.ts`
11. **Configs** — `courseStructure.ts`, `publicDomainReadings.ts`

## Constraints

- Clean removal only — no refactoring of surviving code in this change
- Update imports in any file that referenced deleted modules
- Do not remove database tables or migrations (data cleanup is separate)
