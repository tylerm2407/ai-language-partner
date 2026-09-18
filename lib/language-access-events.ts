/**
 * "Re-read the language allowance" — a signal between mounts of
 * `useLanguageEnrollments`.
 *
 * Each mount (the Home chip's switcher, Settings, the app-wide keep sheet)
 * holds its own copy of `LanguageAccess`. When one of them learns something
 * the others must act on — the server refused a switch with FLL03 because a
 * paid plan lapsed — reloading only its own copy leaves the keep sheet, which
 * is the one that resolves it, still believing nothing is wrong. This is the
 * nudge that tells it to look.
 *
 * Deliberately just a signal, not shared state: each listener re-reads from
 * the server, which is the only source of the answer.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

/** Ask every listening mount to re-read access from the server. */
export function requestLanguageAccessCheck(): void {
  for (const listener of [...listeners]) listener();
}

// ─── Which language sheets are on screen ────────────────────────────────────
// The keep sheet is app-wide and the switcher is per screen, and each is its
// own RN Modal. iOS drops a Modal presented while another is on screen or
// still dismissing (Ui2Sheet unmounts its Modal the frame it hides), so the
// keep sheet waits until no switcher is open. A count, not a flag: Home and
// Settings each mount a switcher.

let openSwitchers = 0;
const openListeners = new Set<(open: number) => void>();

/** A switcher's Modal is on screen. Returns the matching release. */
export function markSwitcherOpen(): () => void {
  openSwitchers += 1;
  for (const l of [...openListeners]) l(openSwitchers);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    openSwitchers -= 1;
    for (const l of [...openListeners]) l(openSwitchers);
  };
}

export function openSwitcherCount(): number {
  return openSwitchers;
}

/** Listen for the open-switcher count changing. Returns the unsubscribe. */
export function onSwitcherOpenChange(listener: (open: number) => void): () => void {
  openListeners.add(listener);
  return () => {
    openListeners.delete(listener);
  };
}

/** Listen for re-read requests. Returns the unsubscribe. */
export function onLanguageAccessCheck(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
