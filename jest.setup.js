// Monitoring SDKs own background timers and native integrations. Unit tests
// assert our calls into Sentry, not Sentry's implementation, so keep the SDK
// behind a deterministic boundary for every Jest worker.
const { jest: jestRuntime } = require('@jest/globals');

jestRuntime.mock('@sentry/react-native', () => ({
  captureException: jestRuntime.fn(),
  captureMessage: jestRuntime.fn(),
  init: jestRuntime.fn(),
  nativeCrash: jestRuntime.fn(),
  setUser: jestRuntime.fn(),
  wrap: (component) => component,
}));

// Placeholder Supabase env.
//
// `lib/supabase.ts` throws at MODULE SCOPE when these are missing, so any
// suite that transitively imports it fails to load before a single test runs
// — and the import can arrive from a long way off: ExerciseCard renders a
// Listen button, which reaches lib/lesson-audio, which reaches lib/ai, which
// reaches lib/supabase. Tests never talk to a real project (the client is
// mocked where it matters), so what the module needs here is presence, not
// credentials. Deliberately obvious fakes, so a test that somehow did make a
// live call would fail loudly rather than reach anything real.
process.env.EXPO_PUBLIC_SUPABASE_URL ??= 'http://localhost:54321';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??= 'sb_publishable_test_key_not_a_real_credential';
