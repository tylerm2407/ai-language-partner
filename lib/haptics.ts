/**
 * One place for every vibration the app produces.
 *
 * Before this module each call site imported `expo-haptics` directly and picked
 * its own `notificationAsync`/`impactAsync` call — thirty of them, no two quite
 * alike. That had three costs worth naming, because they are what this module
 * exists to fix rather than incidental tidiness:
 *
 * 1. **No off switch.** Haptics are an accessibility surface. Some learners
 *    find them painful, some study in lectures where a buzzing phone is not an
 *    option, and vestibular or tactile sensitivity is real. With the calls
 *    scattered there was nowhere to put the control. `lib/motion-preference.ts`
 *    already makes this argument for animation; this is the same argument for
 *    touch, and deliberately a *separate* switch — someone who turns motion off
 *    to stop the screen moving has said nothing about whether they want the
 *    phone to buzz.
 * 2. **Unhandled rejections.** `expo-haptics` returns a promise that rejects on
 *    hardware that cannot vibrate. Roughly twenty call sites floated it bare, so
 *    a device without a taptic engine produced an unhandled rejection for every
 *    correct answer. Going through one function makes the `.catch` structural
 *    instead of something each author has to remember.
 * 3. **Web.** The module is a no-op there. Thirteen files had no `Platform`
 *    guard, and the ones that did were guarding by hand.
 *
 * Call sites now name the *moment*, not the API call: `haptic('levelUp')`, not
 * `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)`. That indirection is
 * the point — it means the feel of "level up" can be retuned once, here, rather
 * than hunted through the tree, and it keeps the vocabulary of the codebase in
 * the language of the product.
 *
 * Fire-and-forget by design. Nothing waits on a vibration, and nothing should:
 * a haptic that lands a frame late is fine, a UI that stalls waiting for one is
 * not. `haptic()` returns void for that reason — there is no promise to await
 * and no failure a caller could sensibly handle.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export const HAPTICS_ENABLED_KEY = 'haptics-enabled';

/**
 * Every vibration the app can produce, named by the moment that causes it.
 *
 * Grouped by weight rather than alphabetically, because the thing worth seeing
 * at a glance is the hierarchy: a selection tick must not feel like a level-up,
 * or the level-up stops meaning anything. Adding an intent means deciding where
 * it sits in that hierarchy, not just picking a call.
 */
export type HapticIntent =
  // ── Light: acknowledgement. The app noticed you. ──
  /** A choice registered — a picker option, a chip, a card selection. */
  | 'select'
  /** A button went down. */
  | 'buttonPress'
  /** XP landed on the counter. */
  | 'xpAward'
  // ── Notification: a verdict. You did a thing and it was judged. ──
  /** Answer was right. */
  | 'correct'
  /** Answer was wrong. */
  | 'incorrect'
  /** A lesson, review session, reading passage or writing piece finished. */
  | 'complete'
  /** An achievement unlocked. */
  | 'achievement'
  /** A daily challenge finished. */
  | 'challengeComplete'
  /** Something needs attention but is not an error. */
  | 'warning'
  /**
   * An operation the learner asked for succeeded — a copy to the clipboard, a
   * word saved to review, an article marked read.
   *
   * Deliberately separate from `complete` despite feeling identical today.
   * `complete` is an accomplishment and is a candidate for being made more of
   * later; this is a receipt. Collapsing them would make it impossible to
   * retune one without the other.
   */
  | 'confirm'
  /**
   * An operation failed — audio would not play, a save did not go through.
   *
   * Separate from `incorrect` for the same reason: `incorrect` is a judgement
   * about the learner's answer, this is a judgement about the app. They should
   * never be tuned together even though both are an Error notification now.
   */
  | 'failure'
  // ── Medium: a consequence. Distinct from the verdict that caused it. ──
  /**
   * A heart went.
   *
   * Deliberately NOT another Error notification. A heart is only ever lost
   * immediately after a wrong answer, and the wrong answer has already fired
   * `incorrect` — two Error buzzes in a row read as one stuttering error, not
   * as two different facts. A Medium impact lands as weight instead: the
   * verdict, then the cost.
   */
  | 'heartLost'
  // ── Heavy: an event. Rare by construction. ──
  /** Level up. */
  | 'levelUp'
  /** A perfect run, or another once-in-a-while peak. */
  | 'milestone';

/**
 * The actual expo-haptics call behind each intent.
 *
 * Kept as thunks rather than a data map of enum values so that the whole table
 * reads as "what does this moment feel like" in one column, and so that adding
 * an intent backed by a *sequence* of pulses later does not require reshaping
 * the type.
 */
const EFFECTS: Record<HapticIntent, () => Promise<void>> = {
  select: () => Haptics.selectionAsync(),
  buttonPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  xpAward: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),

  correct: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  incorrect: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  complete: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  achievement: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  challengeComplete: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  confirm: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  failure: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),

  heartLost: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),

  levelUp: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  milestone: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
};

type Listener = (value: boolean) => void;

/**
 * Defaults to ON, which is the opposite of how `motion-preference` defaults and
 * is deliberate. Reduce-motion defaults off because the safe answer before the
 * stored value arrives is "don't animate yet". Here the safe answer is the
 * app's normal feel: a learner who never opens settings should get haptics, and
 * a one-frame window where a tap does not buzz is a worse bug than the reverse.
 */
let enabled = true;
let hydrated = false;
const listeners = new Set<Listener>();

/** The current preference. Reads are synchronous and cheap by design. */
export function getHapticsEnabled(): boolean {
  return enabled;
}

/** Whether the stored value has been read yet. Exposed for tests. */
export function isHydrated(): boolean {
  return hydrated;
}

/**
 * Read the stored preference into the module cache.
 *
 * Unlike `hydrateMotionPreference`, the root layout does **not** have to call
 * this — the module kicks it off itself at import time (see the bottom of the
 * file). It stays exported so tests can drive hydration deterministically, and
 * so a caller that genuinely needs to await the settled value can.
 *
 * A failed read leaves haptics on. Storage being unavailable is not a reason to
 * silence the app.
 */
export async function hydrateHapticsPreference(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(HAPTICS_ENABLED_KEY);
    // Only an explicit stored "false" turns them off. A missing key is a user
    // who has never touched the setting, and they get the default.
    if (raw !== null) enabled = raw !== 'false';
  } catch {
    // Storage unavailable — keep the default.
  }
  hydrated = true;
  emit();
  return enabled;
}

/** Persist and broadcast a new value. */
export async function setHapticsEnabled(value: boolean): Promise<void> {
  enabled = value;
  emit();
  try {
    await AsyncStorage.setItem(HAPTICS_ENABLED_KEY, value ? 'true' : 'false');
  } catch {
    // The in-memory value still applies for this session.
  }
}

/** Subscribe to changes. Returns an unsubscribe function. */
export function subscribeHapticsPreference(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Produce the vibration for a moment.
 *
 * Safe to call from anywhere — a render, an effect, an event handler, web,
 * a simulator, a device with no taptic engine. It never throws, never rejects
 * and never returns anything to check.
 */
export function haptic(intent: HapticIntent): void {
  if (Platform.OS === 'web') return;
  if (!enabled) return;
  // `EFFECTS[intent]` can also throw synchronously if the native module is
  // missing entirely (an unlinked build, a bare Jest environment), so the
  // try/catch wraps the call as well as the promise.
  try {
    EFFECTS[intent]().catch(() => {});
  } catch {
    // A device that cannot vibrate is not an error worth surfacing.
  }
}

/** Test-only: drop cached state so each case starts clean. */
export function resetHapticsPreferenceForTests(): void {
  enabled = true;
  hydrated = false;
  listeners.clear();
}

function emit(): void {
  listeners.forEach((l) => l(enabled));
}

// Self-hydrating on import. This is what lets call sites use `haptic()` without
// the root layout knowing this module exists, and it is safe precisely because
// the default is the same as the overwhelmingly common stored value (on) — the
// race only matters for the minority who turned haptics off, and it costs them
// at most one buzz on a cold start before the read lands.
void hydrateHapticsPreference();
