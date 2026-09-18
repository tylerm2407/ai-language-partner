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

/** Listen for re-read requests. Returns the unsubscribe. */
export function onLanguageAccessCheck(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
