import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { RESET_PASSWORD_REDIRECT } from '../lib/auth-links';
import { clearReadCache } from '../lib/read-cache';
import type { Session } from '@supabase/supabase-js';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch the current session. If the stored refresh token is invalid
    // (stale AsyncStorage, revoked on server, or single-use-already-consumed),
    // supabase-js rejects instead of resolving with null. Catch it, clear the
    // bad session, and drop to sign-in rather than hanging on the loader.
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setLoading(false);
      })
      .catch(async (err) => {
        console.warn('[auth] getSession failed — clearing stale session:', err);
        await supabase.auth.signOut().catch(() => { /* already signed out */ });
        setSession(null);
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

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
