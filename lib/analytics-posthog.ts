/**
 * Registers PostHog as the analytics provider.
 *
 * Kept apart from lib/analytics.ts on purpose: that module is deliberately
 * provider-agnostic, so the SDK import lives here and a provider swap touches
 * one file rather than every call site. Call `startAnalytics()` once, at app
 * startup.
 *
 * Configuration absent is a NORMAL state, not an error — a developer without a
 * key, or a build that deliberately ships without analytics, must behave
 * exactly like one with them minus the reporting.
 */

import Constants from 'expo-constants';
import PostHog from 'posthog-react-native';
import { setAnalyticsProvider, type AnalyticsProvider } from './analytics';
import { resolvePostHogEnvironment } from './analytics-environment';

let client: PostHog | null = null;

/** App version, stamped on every event so churn can be attributed to a release. */
function appVersion(): string {
  return Constants.expoConfig?.version ?? 'unknown';
}

/**
 * Start PostHog if it is configured. Safe to call more than once.
 *
 * Returns whether analytics is live, which the caller may log — a silently
 * unconfigured analytics stack is the failure mode that costs you a quarter of
 * data before anyone notices.
 */
export function startAnalytics(): boolean {
  if (client) return true;

  const environment = resolvePostHogEnvironment({
    appEnvironment: process.env.EXPO_PUBLIC_APP_ENV,
    productionKey: process.env.EXPO_PUBLIC_POSTHOG_KEY,
    nonProductionKey: process.env.EXPO_PUBLIC_POSTHOG_NON_PRODUCTION_KEY,
    productionHost: process.env.EXPO_PUBLIC_POSTHOG_HOST,
    nonProductionHost: process.env.EXPO_PUBLIC_POSTHOG_NON_PRODUCTION_HOST,
  });
  if (!environment) {
    if (__DEV__) {
      console.log('[analytics] no key for this app environment — staying a no-op');
    }
    return false;
  }

  try {
    client = new PostHog(environment.key, {
      host: environment.host,
      // App open/close/update. Cheap, and it is what makes retention curves
      // work without instrumenting anything.
      // No autocapture: on React Native it is weak, it fights expo-router's
      // screen detection, and an event we did not name is an event that is not
      // in the closed union in lib/analytics.ts.
      captureAppLifecycleEvents: true,
    });

    // Stamp every event with its explicitly selected environment. Production
    // and non-production keys never fall back to each other above, so this is
    // diagnostic context rather than the only barrier protecting live data.
    //
    // `register` is ASYNC and persists to storage. Fired and forgotten, a
    // rejection here is silent — which is exactly what happened the first time
    // and left every event unmarked, so the filter matched nothing. It is
    // still used, because super properties are the only way to reach events
    // the SDK captures itself (app lifecycle, $identify) which never pass
    // through the wrapper below.
    void client.register({
      appEnvironment: environment.appEnvironment,
      isDevBuild: environment.appEnvironment !== 'production',
    }).catch((err) => {
      console.warn('[analytics] environment registration failed:', err);
    });

    const provider: AnalyticsProvider = {
      capture: (event, properties) => {
        // Spread into a fresh object: the SDK wants an index-signature type,
        // and EventProperties deliberately has none — that closed shape is
        // what keeps learner free text out of PostHog, so it is widened HERE,
        // at the boundary, rather than loosened at the call sites.
        // isDevBuild is set here as well as via register(): this path is the
        // one proven to land, and the filter that keeps development traffic
        // out of real numbers must not depend on a promise nobody awaits.
        client?.capture(event, {
          ...properties,
          appVersion: appVersion(),
          appEnvironment: environment.appEnvironment,
          isDevBuild: environment.appEnvironment !== 'production',
        } as Record<string, string | number | boolean>);
      },
      identify: (userId, traits) => {
        client?.identify(userId, traits as Record<string, string | number | boolean> | undefined);
      },
      reset: () => {
        client?.reset();
      },
    };

    setAnalyticsProvider(provider);
    return true;
  } catch (err) {
    // Never let an analytics failure take the app down with it.
    console.warn('[analytics] PostHog init failed:', err);
    client = null;
    return false;
  }
}

/** Flush pending events — call when the app backgrounds, before it may be killed. */
export async function flushAnalytics(): Promise<void> {
  try {
    await client?.flush();
  } catch {
    // Best effort. A dropped batch is not worth a crash.
  }
}
