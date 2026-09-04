/**
 * Source guard: no learner content reaches the analytics provider.
 *
 * This app holds a lot of free text — `ideal_l2_self`, chat turns, written
 * submissions, saved words, book passages. None of it may leave for a third
 * party, and unlike most bugs this one cannot be undone: once an event is
 * sent it is in someone else's system.
 *
 * `EventProperties` is a closed shape with no index signature, so the type
 * checker already refuses an unknown key. This guards the two ways that
 * protection gets removed by accident: someone adds an index signature back,
 * or someone adds a property whose name says it carries content.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setAnalyticsProvider, trackRefusal } from './analytics';

const ROOT = resolve(__dirname, '..');
const SOURCE = readFileSync(resolve(ROOT, 'lib/analytics.ts'), 'utf8');

/** The EventProperties interface body. */
function propertiesBlock(): string {
  const start = SOURCE.indexOf('export interface EventProperties');
  expect(start).toBeGreaterThan(-1);
  const end = SOURCE.indexOf('\n}', start);
  return SOURCE.slice(start, end);
}

describe('analytics cannot carry learner content', () => {
  it('EventProperties has no index signature', () => {
    // `[key: string]: unknown` would re-open the hole this whole design closes:
    // it accepts any key and any string, which is how a learner's written
    // answer ends up in a third-party system.
    expect(propertiesBlock()).not.toMatch(/\[\s*key\s*:\s*string\s*\]/);
    expect(propertiesBlock()).not.toMatch(/Record<\s*string\s*,/);
  });

  it('no property is named after learner-authored content', () => {
    const banned = [
      'text', 'content', 'message', 'answer', 'response', 'prompt',
      'email', 'name', 'word', 'sentence', 'transcript', 'goal',
      'idealL2Self', 'displayName', 'passage', 'translation',
    ];
    const block = propertiesBlock();
    // Property declarations only — comments legitimately discuss this stuff.
    const declared = [...block.matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1]);
    const offenders = declared.filter((prop) =>
      banned.some((b) => prop.toLowerCase() === b.toLowerCase()),
    );
    expect(offenders).toEqual([]);
  });

  it('declares only scalar property types', () => {
    // An object or array property is a container someone will eventually put
    // a whole server response into.
    const declared = [...propertiesBlock().matchAll(/^\s{2}\w+\??:\s*([^;]+);/gm)]
      .map((m) => m[1].trim());
    for (const type of declared) {
      expect(type).toMatch(/^(string|number|boolean)$/);
    }
  });

  it('the event name union is closed, not an open string', () => {
    // `type EventName = string` would let a caller invent an event, which is
    // how one funnel silently becomes two.
    expect(SOURCE).toMatch(/type EventName\s*=\s*\n?\s*\|/);
    expect(SOURCE).not.toMatch(/type EventName\s*=\s*string/);
  });
});

describe('the refusal helper', () => {
  it('maps every shipped limit code to a churn event', () => {
    // These codes are the most valuable churn signal in the app. If a new one
    // stops mapping to `quota_exhausted`, it lands in the generic bucket and
    // quietly disappears from the funnel.
    const seen: { event: string; code?: string }[] = [];
    setAnalyticsProvider({
      capture: (event, props) => seen.push({ event, code: props?.code as string }),
      identify: () => {},
      reset: () => {},
    });

    const quotaCodes = [
      'DAILY_WORD_LOOKUP_LIMIT_REACHED',
      'DAILY_MESSAGE_LIMIT_REACHED',
      'DAILY_TRANSLATION_LIMIT_REACHED',
      'DAILY_VOICE_LIMIT_REACHED',
      'NEW_CARDS_CAP_REACHED',
    ];
    for (const code of quotaCodes) trackRefusal(code);
    expect(seen.map((s) => s.event)).toEqual(quotaCodes.map(() => 'quota_exhausted'));
    expect(seen.map((s) => s.code)).toEqual(quotaCodes);

    seen.length = 0;
    trackRefusal('UPGRADE_REQUIRED');
    expect(seen[0].event).toBe('paywall_viewed');

    seen.length = 0;
    trackRefusal('EXPLANATION_UNAVAILABLE');
    expect(seen[0].event).toBe('feature_unavailable');

    setAnalyticsProvider(null);
  });
});

describe('the learning loop is instrumented as a funnel', () => {
  it('every loop event has a counterpart, so a drop-off is measurable', () => {
    // A started event with no finished event (or vice versa) cannot answer
    // "how many people who begin actually finish", which is the entire point.
    const source = readFileSync(resolve(ROOT, 'lib/analytics.ts'), 'utf8');
    for (const pair of [
      ['lesson_started', 'lesson_completed'],
      ['lesson_started', 'lesson_abandoned'],
      ['review_started', 'review_completed'],
      ['onboarding_step_viewed', 'onboarding_completed'],
    ]) {
      for (const event of pair) {
        expect(source).toContain(`'${event}'`);
      }
    }
  });

  it('review is measured per session, not per card', () => {
    // `review_logs` already stores every review with was_correct and a
    // timestamp. Emitting a per-card event would pay twice — in volume and
    // eventually in money — for data already in Postgres and queryable there.
    const screen = readFileSync(resolve(ROOT, 'app/(app)/learn/review.tsx'), 'utf8');
    expect(screen).toContain("trackEvent('review_started'");
    expect(screen).toContain("trackEvent('review_completed'");
    expect(screen).not.toContain("trackEvent('card_reviewed'");
  });

  it('a completed lesson is not also reported as abandoned', () => {
    // handleExit runs for BOTH finishing and quitting, so the completion flag
    // is what keeps "this lesson loses people" from being pure noise.
    const screen = readFileSync(resolve(ROOT, 'app/(app)/learn/[lessonId].tsx'), 'utf8');
    expect(screen).toMatch(/completedRef\.current = true/);
    expect(screen).toMatch(/if \(!completedRef\.current/);
  });
});

describe('screen views measure attention, not mounting', () => {
  it('fires on focus rather than on mount', () => {
    // The tab navigator mounts sibling tab screens alongside the one being
    // navigated to. A mount-based hook reported a view for every tab the
    // learner never looked at — `learn` and `chat` landed 1ms apart, three
    // times in one session, and chat came out as the most-used screen in the
    // app. Only focus means "the learner is looking at this".
    const hook = readFileSync(resolve(ROOT, 'hooks/useScreenView.ts'), 'utf8');
    // Subscribed to via the navigation context rather than useFocusEffect,
    // which throws outright when no navigator is above it — every screen
    // rendered in a test harness.
    expect(hook).toContain("navigation.addListener('focus'");
    expect(hook).toContain('navigation.isFocused()');
  });

  it('still reports once when rendered with no navigator at all', () => {
    // A screen rendered in isolation must not crash, and reporting once is the
    // honest answer when nothing can say whether it is focused.
    const hook = readFileSync(resolve(ROOT, 'hooks/useScreenView.ts'), 'utf8');
    expect(hook).toMatch(/if \(!navigation\)/);
  });

  it('does not depend on the props object, which would refire every render', () => {
    const hook = readFileSync(resolve(ROOT, 'hooks/useScreenView.ts'), 'utf8');
    expect(hook).not.toMatch(/\},\s*\[[^\]]*\bprops\b[^\]]*\]\)/);
  });
});

describe('development traffic is marked', () => {
  it('isDevBuild is stamped on the capture path, not only via register()', () => {
    // register() is async and persists to storage; fired and forgotten, a
    // rejection is silent — which is what left every event unmarked and the
    // project's test-account filter matching nothing. The filter that keeps
    // development traffic out of real numbers must not depend on a promise
    // nobody awaits.
    const provider = readFileSync(resolve(ROOT, 'lib/analytics-posthog.ts'), 'utf8');
    const captureBlock = provider.slice(
      provider.indexOf('capture: ('),
      provider.indexOf('identify: ('),
    );
    expect(captureBlock).toContain('isDevBuild');
    expect(provider).toMatch(/register\([^)]*\)[\s\S]{0,120}catch/);
  });
});
