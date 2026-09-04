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

  const key = process.env.EXPO_PUBLIC_POSTHOG_KEY;
  const host = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';
  if (!key) {
    if (__DEV__) console.log('[analytics] no EXPO_PUBLIC_POSTHOG_KEY — staying a no-op');
    return false;
  }

  try {
    client = new PostHog(key, {
      host,
      // App open/close/update. Cheap, and it is what makes retention curves
      // work without instrumenting anything.
      // No autocapture: on React Native it is weak, it fights expo-router's
      // screen detection, and an event we did not name is an event that is not
      // in the closed union in lib/analytics.ts.
      captureAppLifecycleEvents: true,
    });

    // Stamp every event with whether it came from a development build.
    //
    // Dev events are NOT dropped: verifying that instrumentation actually
    // fires is most of the value of having analytics at all, and you cannot
    // verify what you refuse to send. Instead they are marked, and the
    // project's test-account filter excludes them from real numbers — so a
    // developer opening the app twenty times does not read as an engaged user
    // and quietly inflate every retention curve.
    //
    // `register` is ASYNC and persists to storage. Fired and forgotten, a
    // rejection here is silent — which is exactly what happened the first time
    // and left every event unmarked, so the filter matched nothing. It is
    // still used, because super properties are the only way to reach events
    // the SDK captures itself (app lifecycle, $identify) which never pass
    // through the wrapper below.
    void client.register({ isDevBuild: __DEV__ }).catch((err) => {
      console.warn('[analytics] register failed — dev events will not be filtered:', err);
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
          isDevBuild: __DEV__,
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
