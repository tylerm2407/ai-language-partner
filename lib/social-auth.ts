/**
 * Sign in with Apple and Google.
 *
 * Two different mechanisms, for two different reasons:
 *
 * **Apple** goes through the native `expo-apple-authentication` sheet and
 * exchanges the returned identity token with Supabase directly. Apple requires
 * the native sheet on iOS — a web OAuth round trip for Apple on an iOS app is
 * a review risk under Guideline 4.8, and it looks wrong next to the system UI
 * users expect.
 *
 * **Google** goes through Supabase's hosted OAuth in an in-app browser session,
 * because a native Google SDK would mean another native dependency and a set of
 * per-platform client ids to keep in sync. The tokens come back on our own
 * scheme and are parsed by `lib/auth-links.ts` — the same parser the password
 * recovery deep link already uses, so there is one implementation of "read
 * tokens out of a URL" rather than two.
 *
 * Both surface failure the same way the email path does: they throw, and the
 * caller runs the error through `authErrorCopy`.
 *
 * SERVER-SIDE PREREQUISITES — the client cannot detect these, and without them
 * the provider returns an error the moment it is used:
 *   - Supabase → Authentication → Providers → Apple: enabled, with the Services
 *     ID, Team ID, Key ID and .p8 from the Apple Developer account.
 *   - Supabase → Authentication → Providers → Google: enabled, with the OAuth
 *     client id/secret from Google Cloud.
 *   - Supabase → Authentication → URL Configuration → Redirect URLs must list
 *     `OAUTH_REDIRECT` below.
 * iOS additionally needs the `com.apple.developer.applesignin` entitlement,
 * which `app.json`'s `usesAppleSignIn` generates at prebuild.
 */

import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from './supabase';
import { parseAuthLink } from './auth-links';

/** Where the hosted OAuth flow returns to. Must be registered in Supabase. */
export const OAUTH_REDIRECT = Linking.createURL('auth-callback');

/**
 * Whether the Apple button should render at all.
 *
 * Apple sign-in exists only on iOS, and only from iOS 13. Rendering a button
 * that cannot work is the failure mode the handoff explicitly warns against,
 * so the caller hides it rather than letting it throw on tap.
 */
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/** Raised when the user backs out of a provider sheet. Callers stay silent. */
export class SocialAuthCancelled extends Error {
  constructor() {
    super('Sign-in cancelled');
    this.name = 'SocialAuthCancelled';
  }
}

export async function signInWithApple(): Promise<void> {
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (err) {
    // The sheet reports a user dismissal as ERR_REQUEST_CANCELED. That is not
    // an error worth showing anyone.
    if (isCancellation(err)) throw new SocialAuthCancelled();
    throw err;
  }

  if (!credential.identityToken) {
    throw new Error('Apple did not return an identity token.');
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error) throw error;
}

export async function signInWithGoogle(): Promise<void> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: OAUTH_REDIRECT,
      // We open the browser ourselves so the session closes on our redirect
      // instead of leaving the user on a dead tab.
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('Google sign-in could not be started.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, OAUTH_REDIRECT);
  if (result.type !== 'success') throw new SocialAuthCancelled();

  const parsed = parseAuthLink(result.url);

  if (parsed.kind === 'tokens') {
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: parsed.accessToken,
      refresh_token: parsed.refreshToken,
    });
    if (sessionError) throw sessionError;
    return;
  }

  if (parsed.kind === 'pkce_code') {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(parsed.code);
    if (exchangeError) throw exchangeError;
    return;
  }

  if (parsed.kind === 'error') throw new Error(parsed.message);

  throw new Error('Google sign-in did not return a session.');
}

function isCancellation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const code = (err as { code?: unknown }).code;
  return code === 'ERR_REQUEST_CANCELED' || code === 'ERR_CANCELED';
}
