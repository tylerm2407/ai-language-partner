import { useCallback, useSyncExternalStore } from 'react';
import { supabase } from '../lib/supabase';
import { RESET_PASSWORD_REDIRECT } from '../lib/auth-links';
import { clearReadCache } from '../lib/read-cache';
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
    // Shared-device hygiene: drop all cached content (review queue and
    // progress tiles are user-scoped; wiping shared course content too is
    // harmless and simpler). Best-effort — never block sign-out.
    await clearReadCache().catch(() => {});
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
