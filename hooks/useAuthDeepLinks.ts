import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter, useRootNavigationState } from 'expo-router';
import { supabase } from '../lib/supabase';
import { establishBoundAuthSession, isExpectedAuthCallbackUrl, parseAuthLink } from '../lib/auth-links';
import { clearPendingAuthIntent, readPendingAuthIntent } from '../lib/pending-auth-intent';

type PendingNav = {
  route: '/(public)/reset-password' | '/(public)/auth';
  alert?: { title: string; message: string };
};

/**
 * Handles explicitly requested Supabase auth callbacks,
 * for both warm links (app already running) and cold starts.
 *
 * - Recovery links: establish the session, route to the new-password screen.
 * - Signup confirmation links: establish the verified expected session.
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

    const reject = (message = 'That link was not requested on this device or has expired.') => {
      setPending({
        route: '/(public)/auth',
        alert: { title: 'Link not accepted', message },
      });
    };

    if (!isExpectedAuthCallbackUrl(url, __DEV__)) {
      reject();
      return;
    }

    const intent = await readPendingAuthIntent().catch(() => null);
    if (!intent) {
      reject();
      return;
    }

    if (link.kind === 'error') {
      await clearPendingAuthIntent().catch(() => {});
      setPending({
        route: '/(public)/auth',
        alert: {
          title: 'Link expired',
          message: `${link.message}. Please request a new link.`,
        },
      });
      return;
    }

    let acceptedType: 'recovery' | 'signup';
    try {
      const result = await establishBoundAuthSession(
        supabase.auth,
        url,
        link,
        intent,
        __DEV__,
      );
      if (!result) {
        reject();
        return;
      }
      acceptedType = result;
      await clearPendingAuthIntent();
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

    if (acceptedType === 'recovery') {
      setPending({ route: '/(public)/reset-password' });
    }
    // Signup: session is now set and the root guard routes into the app.
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
