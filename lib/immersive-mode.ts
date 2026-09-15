/**
 * Immersive mode: a screen is on that owns the whole display, so the floating
 * tab bar must not render over it.
 *
 * The tab bar already hides for the tutor call by ROUTE (`FULL_SCREEN_ROUTES`
 * in FloatingTabBar). The reader cannot use that: a book's pages are the
 * `isReading` state of the cover route, not a route of their own, and the
 * nested route names the bar would have to match were guessed once and were
 * wrong on the device. A flag the reading surface raises on mount does not
 * depend on how expo-router names anything.
 *
 * Reference-counted, not boolean, because a passage hands off to its
 * questions screen in one React commit — the old surface unmounts and the
 * new one mounts — and a boolean would flash the bar back between them.
 * The release is idempotent so a double cleanup cannot drive the count
 * negative.
 */
type Listener = (immersive: boolean) => void;

let holders = 0;
const listeners = new Set<Listener>();

/** Whether any immersive surface is currently mounted. */
export function isImmersive(): boolean {
  return holders > 0;
}

/**
 * Mark an immersive surface mounted. Returns the release to call on unmount.
 * Subscribers hear only the 0-to-1 and 1-to-0 transitions.
 */
export function enterImmersive(): () => void {
  holders += 1;
  if (holders === 1) emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders = Math.max(0, holders - 1);
    if (holders === 0) emit();
  };
}

/** Subscribe to transitions. Returns an unsubscribe function. */
export function subscribeImmersive(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  const value = holders > 0;
  listeners.forEach((l) => l(value));
}

/** Test-only: drop all holders and listeners. */
export function resetImmersiveForTests(): void {
  holders = 0;
  listeners.clear();
}
