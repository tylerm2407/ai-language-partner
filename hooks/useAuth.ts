import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    // Try sign in first
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (!signInError) return;

    // If invalid credentials, try creating a new account
    if (signInError.message.includes('Invalid login credentials')) {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { email_confirm: true } },
      });
      if (signUpError) throw signUpError;
      return;
    }

    throw signInError;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  return {
    session,
    user: session?.user ?? null,
    loading,
    signInWithEmail,
    signOut,
  };
}
