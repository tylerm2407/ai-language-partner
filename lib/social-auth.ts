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
 *
 *   Apple, native flow: Supabase → Authentication → Providers → Apple, with the
 *   BUNDLE ID (`com.fluenci.app`) in Client IDs. That is all. The Services ID,
 *   Team ID, Key ID and .p8 belong to Apple's *web* OAuth flow, which this does
 *   not use — `signInWithIdToken` validates the token's audience against the
 *   Client IDs list, so the secret key stays empty for native-only sign-in.
 *   iOS also needs the `com.apple.developer.applesignin` entitlement (in
 *   ios/Fluenci/Fluenci.entitlements, generated from app.json's
 *   `usesAppleSignIn`) and therefore a native rebuild.
 *
 *   Google: an OAuth client of type **Web application** in Google Cloud — not
 *   iOS — because the round trip goes through Supabase's hosted callback at
 *   `https://<project-ref>.supabase.co/auth/v1/callback`, which must be listed
 *   as an authorized redirect URI there. Its id/secret go in Supabase →
 *   Providers → Google, and `OAUTH_REDIRECT` below must be added to Supabase →
 *   URL Configuration → Redirect URLs, alongside the existing reset-password
 *   entry rather than replacing it. Gated off by GOOGLE_SIGN_IN_ENABLED until
 *   all of that exists.
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
 * Whether to offer Google sign-in.
 *
 * OFF until a Google Cloud OAuth client exists and is pasted into Supabase →
 * Authentication → Providers → Google. The flow below is complete and works
 * the moment those are in place — this gates the *button*, because a provider
 * that is not configured server-side fails only after the learner has tapped
 * it and watched a browser open.
 *
 * To enable: create a **Web application** OAuth client in Google Cloud with
 * `https://<project-ref>.supabase.co/auth/v1/callback` as an authorized
 * redirect URI, add its id/secret to Supabase, add OAUTH_REDIRECT above to
 * Supabase → URL Configuration → Redirect URLs (alongside the existing
 * reset-password entry, not replacing it), then flip this to true.
 *
 * Note App Store Guideline 4.8: offering Google means Sign in with Apple must
 * be offered too. It already is, so turning this on is safe on that front.
 */
export const GOOGLE_SIGN_IN_ENABLED = false;

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
