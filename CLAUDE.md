# languageAI

**languageAI** is a mobile-first language learning app with structured courses, AI-powered conversation practice, and spaced repetition. It targets iOS as the primary platform, with Android support via Expo's cross-platform tooling.

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo (React Native) + TypeScript |
| Navigation | Expo Router (file-based) |
| Auth | Supabase Auth (magic links, OAuth) |
| Database | Supabase Postgres + Edge Functions |
| Payments | Stripe (subscriptions), RevenueCat (IAP later) |
| Styling | NativeWind / Tailwind CSS |
| Audio | Expo AV (playback + recording), Expo Speech |
| AI | LLM API via Edge Functions (no secrets on client) |
| State | Zustand (local), Supabase Realtime (sync) |
| Animations | React Native Reanimated |

## Project Structure

```
app/(public)/          # Onboarding, auth, landing
app/(app)/             # Authenticated experience (tabs)
app/(app)/learn/       # Course & lesson screens
app/(app)/review/      # Spaced repetition review
app/(app)/practice/    # AI conversation & speaking
app/(app)/profile/     # User settings & goals
lib/                   # Supabase client, AI client, SRS engine, analytics
hooks/                 # Reusable React hooks (audio, auth, etc.)
components/ui/         # Shared UI primitives
components/lesson/     # Lesson & SRS widgets
components/audio/      # Recording & playback UI
types/                 # Shared TypeScript types
config/                # App config, languages, feature flags
supabase/migrations/   # SQL migration files
supabase/functions/    # Edge Functions
docs/                  # Design docs & checklists
```

## Mobile Coding Standards

- **Screens are thin.** Business logic lives in hooks (`hooks/`) and feature modules (`lib/`). Screen files handle layout and composition only.
- **No heavy work on the UI thread.** Use `InteractionManager.runAfterInteractions`, async workers, or background tasks for data processing, SRS calculations, and network calls.
- **Mobile-first and accessible.** Every screen must support Dynamic Type / font scaling, minimum 44pt touch targets, VoiceOver labels, and proper contrast ratios.
- **Offline-resilient.** All network operations must handle offline/poor-network gracefully: loading states, retry with exponential backoff, and local caching via AsyncStorage or SQLite.
- **Localizable.** All user-visible strings must go through a localization layer. Never hardcode display text directly in JSX.
- **Safe areas everywhere.** Use `SafeAreaView` or `useSafeAreaInsets` — never assume screen dimensions.

## Language-Learning Domain Rules

- **Spaced repetition is a first-class concern.** Use SM-2 algorithm with adaptive scheduling. Never use fixed intervals.
- **Active recall over passive recognition.** Users must produce language (typing, speaking), not just tap multiple choice.
- **Audio is essential.** Every vocabulary item and sentence should have audio. Recording/playback must work seamlessly on iOS.
- **Correctness checking matters.** Answers must be validated with tolerance for minor typos but not meaning errors. Use fuzzy matching for text, AI for open-ended responses.

## Commands

```bash
# Development
npx expo start --ios              # Run on iOS simulator
npx expo start                    # Run with QR code (Expo Go)

# Quality
npx tsc --noEmit                  # Type check
npm run lint                      # ESLint
npm test                          # Jest tests

# Build & Deploy (requires EAS setup)
eas build --profile development --platform ios
eas build --profile preview --platform ios
eas submit --platform ios

# Database
npx supabase db push              # Run migrations
npx supabase functions serve      # Local Edge Functions
```

## Workflows

### New Feature
1. Create a branch: `feat/<feature-name>`
2. Design types in `types/index.ts`
3. Add migration if schema changes (`supabase/migrations/`)
4. Build hook in `hooks/` or logic in `lib/`
5. Build UI components in `components/`
6. Wire into screen in `app/`
7. Run `npx tsc --noEmit && npm test && npm run lint`
8. PR with summary of changes

### New Screen
1. Create file in appropriate `app/` route group
2. Add to `_layout.tsx` if it needs tab/stack config
3. Keep screen thin — extract logic to hooks
4. Verify safe areas, accessibility, and offline behavior
5. Test on iOS simulator at minimum

### New Learning Mode
1. Define the exercise type in `types/index.ts`
2. Add SRS integration in `lib/srs.ts`
3. Create exercise component in `components/lesson/`
4. Wire into review flow in `app/(app)/review/`
5. Add audio support if applicable
6. Write unit tests for scoring/grading logic

### Ship to iOS via EAS
1. Bump version in `app.json`
2. Run full quality check suite
3. `eas build --profile production --platform ios`
4. `eas submit --platform ios`
5. Monitor TestFlight for crashes via Sentry

## Self-Imposed Rules

- For tasks touching >2 screens/modules: enter Plan Mode, propose plan, wait for confirmation.
- For every non-trivial change: run type checks and tests, propose unit/integration tests.
- Never invent real API keys, Supabase project IDs, or Stripe secrets. Use `process.env.EXPO_PUBLIC_*` placeholders.
- Never refactor navigation or global state without presenting a plan first.
- Never change the core stack without proposing pros/cons and getting approval.
