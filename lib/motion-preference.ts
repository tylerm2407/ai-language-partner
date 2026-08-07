/**
 * In-app "Reduce motion" preference.
 *
 * WCAG 2.2 SC 2.2.2 (Pause, Stop, Hide) is a **Level A** criterion: any motion
 * that starts automatically, runs longer than five seconds, and is presented
 * alongside other content must have a mechanism to pause, stop or hide it.
 * Honoring the OS `prefers-reduced-motion` flag alone does NOT satisfy it —
 * the criterion asks for a control the user can reach, and a system-wide
 * accessibility switch is neither discoverable from here nor scoped to us.
 *
 * So `useMotion()` ORs this preference with the OS setting: either one being on
 * means the same thing to every caller. Turning the OS switch on still works;
 * this just adds the mechanism the criterion requires.
 *
 * Device-local by design. This is a display preference like text size, not part
 * of the learner's identity — it should follow the device, not the account, and
 * it must be readable synchronously on first paint. That rules out the profile
 * row (a network round-trip would let one animated frame through first).
 *
 * The module-level cache plus subscriber set is what makes the synchronous read
 * possible: `hydrateMotionPreference()` runs once at app start, and every later
 * read is a plain variable access.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const REDUCE_MOTION_KEY = 'reduce-motion';

type Listener = (value: boolean) => void;

let current = false;
let hydrated = false;
const listeners = new Set<Listener>();

/** The current preference. Defaults to false until hydration completes. */
export function getReduceMotion(): boolean {
  return current;
}

/** Whether the stored value has been read yet. Exposed for tests. */
export function isHydrated(): boolean {
  return hydrated;
}

/**
 * Read the stored preference into the module cache.
 *
 * Call once from the root layout. Safe to call again; a failed read leaves the
 * default (motion enabled) rather than throwing, because a storage error must
 * not block app start.
 */
export async function hydrateMotionPreference(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(REDUCE_MOTION_KEY);
    current = raw === 'true';
  } catch {
    // Storage unavailable — keep the default.
  }
  hydrated = true;
  emit();
  return current;
}

/** Persist and broadcast a new value. */
export async function setReduceMotion(value: boolean): Promise<void> {
  current = value;
  emit();
  try {
    await AsyncStorage.setItem(REDUCE_MOTION_KEY, value ? 'true' : 'false');
  } catch {
    // The in-memory value still applies for this session.
  }
}

/** Subscribe to changes. Returns an unsubscribe function. */
export function subscribeMotionPreference(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  listeners.forEach((l) => l(current));
}

/** Test-only: drop cached state so each case starts clean. */
export function resetMotionPreferenceForTests(): void {
  current = false;
  hydrated = false;
  listeners.clear();
}
