import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter, useRootNavigationState } from 'expo-router';
import { supabase } from '../lib/supabase';
import { parseAuthLink } from '../lib/auth-links';

type PendingNav = {
  route: '/(public)/reset-password' | '/(public)/auth';
  alert?: { title: string; message: string };
};

/**
 * Handles Supabase auth deep links (password recovery + email confirmation),
 * for both warm links (app already running) and cold starts.
 *
 * - Recovery links: establish the session, route to the new-password screen.
 * - Signup / email-change confirmation links: establish the session and let
 *   the root route guard land the user in the app — no extra navigation.
 * - Expired/invalid links: route to sign-in with an explanatory alert.
 * - Non-auth URLs are ignored so expo-router's normal linking is untouched.
 *
 * Mount once, in app/_layout.tsx.
 */
export function useAuthDeepLinks() {
  const router = useRouter();
  // Navigation is only safe once the root navigator is mounted (it isn't
  // during the font/auth loading screen), so navigations queue in state.
  const navReady = !!useRootNavigationState()?.key;
  const [pending, setPending] = useState<PendingNav | null>(null);
  const handledUrls = useRef<Set<string>>(new Set());

  const handleUrl = useCallback(async (url: string | null) => {
    if (!url || handledUrls.current.has(url)) return;

    const link = parseAuthLink(url);
    if (link.kind === 'none') return; // normal route — expo-router handles it
    handledUrls.current.add(url);

    if (link.kind === 'error') {
      setPending({
        route: '/(public)/auth',
        alert: {
          title: 'Link expired',
          message: `${link.message}. Please request a new link.`,
        },
      });
      return;
    }

    try {
      if (link.kind === 'pkce_code') {
        const { error } = await supabase.auth.exchangeCodeForSession(link.code);
        if (error) throw error;
        return; // PKCE links carry no type; the recovery case is covered by
        //         the PASSWORD_RECOVERY listener below.
      }
      const { error } = await supabase.auth.setSession({
        access_token: link.accessToken,
        refresh_token: link.refreshToken,
      });
      if (error) throw error;
    } catch (err) {
      console.warn('[auth] failed to create session from deep link:', err);
      setPending({
        route: '/(public)/auth',
        alert: {
          title: 'Link expired',
          message: 'That link is invalid or has expired. Please request a new one.',
        },
      });
      return;
    }

    if (link.type === 'recovery') {
      setPending({ route: '/(public)/reset-password' });
    }
    // signup / email_change / magiclink / invite: session is now set — the
    // root route guard in app/_layout.tsx routes into the app automatically.
  }, []);

  // Cold start + warm links.
  useEffect(() => {
    Linking.getInitialURL()
      .then(handleUrl)
      .catch((err) => console.warn('[auth] getInitialURL failed:', err));
    const sub = Linking.addEventListener('url', ({ url }) => {
      handleUrl(url);
    });
    return () => sub.remove();
  }, [handleUrl]);

  // Belt and braces: supabase-js emits PASSWORD_RECOVERY whenever a recovery
  // session is established, however the link was processed.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPending((prev) => prev ?? { route: '/(public)/reset-password' });
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Flush queued navigation once the navigator is ready.
  useEffect(() => {
    if (!navReady || !pending) return;
    if (pending.alert) {
      Alert.alert(pending.alert.title, pending.alert.message);
    }
    router.replace(pending.route);
    setPending(null);
  }, [navReady, pending, router]);
}
