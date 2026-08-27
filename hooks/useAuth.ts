import { useCallback, useSyncExternalStore } from 'react';
import { supabase } from '../lib/supabase';
import { RESET_PASSWORD_REDIRECT } from '../lib/auth-links';
import { clearReadCache } from '../lib/read-cache';
import { clearTtsCache } from '../lib/tts-cache';
import { clearPendingOnboarding } from '../lib/pending-onboarding';
import { clearAvatarImageCache } from './useAvatarImage';
import { cancelAllScheduledNotifications } from './useNotifications';
import { useAppStore } from '../stores/useAppStore';
import { useLessonProgressStore } from '../stores/useLessonProgressStore';
import { useSchoolStore } from '../stores/useSchoolStore';
import { useAnimationStore } from '../stores/useAnimationStore';
import type { Session } from '@supabase/supabase-js';

/**
 * Auth session state, held once for the whole app.
 *
 * `useAuth()` is called from 43 places. Each one used to own a `useState`, fire
 * its own `getSession()` on mount, and open its own `onAuthStateChange`
 * subscription — so a cold start opened dozens of subscriptions against the
 * same client and issued dozens of redundant session reads, and every token
 * refresh then fanned out through all of them. The session is one fact about
 * the app, so it is read once and shared.
 *
 * The public API of the hook is deliberately unchanged; no call site moved.
 */
interface AuthSnapshot {
  session: Session | null;
  loading: boolean;
}

// A single object identity per distinct state — `useSyncExternalStore` bails
// out of re-rendering when the snapshot is referentially equal, so this must
// only be replaced when something actually changed.
let snapshot: AuthSnapshot = { session: null, loading: true };
const listeners = new Set<() => void>();
let started = false;

function publish(next: AuthSnapshot): void {
  if (next.session === snapshot.session && next.loading === snapshot.loading) return;
  snapshot = next;
  for (const listener of listeners) listener();
}

/**
 * Open the one subscription, on first use rather than at import time — the
 * module is pulled in by screens that may render before a session is wanted,
 * and starting network work as a side effect of an import is how test runs and
 * cold starts end up doing it twice.
 */
function start(): void {
  if (started) return;
  started = true;

  // If the stored refresh token is invalid (stale AsyncStorage, revoked on
  // server, or single-use-already-consumed), supabase-js rejects instead of
  // resolving with null. Catch it, clear the bad session, and drop to sign-in
  // rather than hanging on the loader.
  supabase.auth
    .getSession()
    .then(({ data: { session } }) => {
      publish({ session, loading: false });
    })
    .catch(async (err) => {
      console.warn('[auth] getSession failed — clearing stale session:', err);
      await supabase.auth.signOut().catch(() => { /* already signed out */ });
      publish({ session: null, loading: false });
    });

  // Never unsubscribed: this is app-lifetime state, and tearing it down when
  // the last consumer unmounts would mean the next mount misses events that
  // fired in between.
  supabase.auth.onAuthStateChange((_event, session) => {
    publish({ session, loading: false });
  });
}

function subscribe(onStoreChange: () => void): () => void {
  start();
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

function getSnapshot(): AuthSnapshot {
  return snapshot;
}

export function useAuth() {
  const { session, loading } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: RESET_PASSWORD_REDIRECT,
    });
    if (error) throw error;
  }, []);

  /** Set a new password for the signed-in user (used after a recovery deep link). */
  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    await tearDownSession();
  }, []);

  return {
    session,
    user: session?.user ?? null,
    loading,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    updatePassword,
    signOut,
  };
}

/**
 * Everything that has to go when a session ends.
 *
 * Sign-out used to call `supabase.auth.signOut()` and clear the read cache, and
 * nothing else — so on a shared device the next account inherited a surprising
 * amount:
 *
 *   - the previous learner's DAILY practice reminder kept firing, and its body
 *     embeds their free-text `idealL2Self` goal, so someone else's personal
 *     statement about themselves appeared on the lock screen;
 *   - all four zustand stores survived, so user B saw A's completed-lesson
 *     ticks and A's queued celebration fired at B;
 *   - the TTS cache, the avatar signed-URL map, and the pending-onboarding
 *     draft (target language, display name, personal goal) all persisted.
 *
 * Every step is best-effort and independent: a failure in one must not leave
 * the rest of the previous session in place.
 */
export async function tearDownSession(): Promise<void> {
  // Notifications first — this is the one with someone else's words in it.
  await cancelAllScheduledNotifications().catch((err) =>
    console.warn('[auth] failed to cancel notifications on sign-out:', err),
  );

  try {
    useAppStore.getState().reset();
    useLessonProgressStore.getState().reset();
    useSchoolStore.getState().reset();
    useAnimationStore.getState().clear();
    clearTtsCache();
    clearAvatarImageCache();
  } catch (err) {
    console.warn('[auth] store teardown failed on sign-out:', err);
  }

  await Promise.allSettled([clearReadCache(), clearPendingOnboarding()]);
}

/**
 * Test seam: drop the shared subscription and state.
 *
 * Nothing in the app calls this — module-level state would otherwise leak
 * between test files that each expect a fresh, signed-out app.
 */
export function __resetAuthStoreForTests(): void {
  snapshot = { session: null, loading: true };
  listeners.clear();
  started = false;
}
