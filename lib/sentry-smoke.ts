/**
 * Pure decisions behind the Sentry smoke-test trigger (components/debug/
 * SentrySmokeTrigger.tsx). Kept free of React Native imports so they can be
 * asserted directly in jest.
 *
 * The trigger exists to answer one question before launch: does a crash in a
 * real release binary reach the Sentry project with a readable stack trace?
 * It must therefore fire in preview builds (release configuration, DSN set)
 * and must be inert in the production build, so forgetting to remove it can
 * never let a learner crash their own app.
 */

export function shouldArmSmokeTest(appEnv: string | undefined): boolean {
  return appEnv !== 'production';
}

export function smokeTestLabel(
  version: string | null | undefined,
  build: string | null | undefined
): string {
  const v = version && version.length > 0 ? version : 'unknown';
  return build && build.length > 0 ? `Fluenci v${v} (${build})` : `Fluenci v${v}`;
}
