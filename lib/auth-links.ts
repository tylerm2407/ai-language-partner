/**
 * Auth deep-link parsing (password recovery, email confirmation).
 *
 * Supabase implicit-flow email links redirect to our app scheme with tokens
 * in the URL fragment:
 *   fluenci://reset-password#access_token=...&refresh_token=...&type=recovery
 * Expired/invalid links arrive as:
 *   fluenci://reset-password#error=access_denied&error_code=otp_expired&error_description=...
 * PKCE-style links (not our current flow, parsed defensively) use ?code=...
 *
 * Pure functions — no supabase/react imports — so the parser is unit-testable.
 */

/** Where password-recovery emails deep-link back into the app.
 *  Must be listed in Supabase Dashboard → Auth → URL Configuration → Redirect URLs. */
export const RESET_PASSWORD_REDIRECT = 'fluenci://reset-password';

export type AuthLinkTokenType =
  | 'recovery'
  | 'signup'
  | 'magiclink'
  | 'invite'
  | 'email_change'
  | 'unknown';

export type ParsedAuthLink =
  | { kind: 'none' } // not an auth link — let the router handle it normally
  | { kind: 'error'; message: string } // expired/invalid/incomplete auth link
  | { kind: 'pkce_code'; code: string }
  | { kind: 'tokens'; type: AuthLinkTokenType; accessToken: string; refreshToken: string };

const TOKEN_TYPES: readonly string[] = ['recovery', 'signup', 'magiclink', 'invite', 'email_change'];

/** Collect params from both the query string and the fragment.
 *  Fragment values win — Supabase implicit flow puts tokens there. */
function collectParams(url: string): Map<string, string> {
  const params = new Map<string, string>();
  const hashIndex = url.indexOf('#');
  const fragment = hashIndex >= 0 ? url.slice(hashIndex + 1) : '';
  const beforeHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const queryIndex = beforeHash.indexOf('?');
  const query = queryIndex >= 0 ? beforeHash.slice(queryIndex + 1) : '';

  for (const part of [query, fragment]) {
    if (!part) continue;
    for (const [key, value] of new URLSearchParams(part).entries()) {
      if (value) params.set(key, value);
    }
  }
  return params;
}

export function parseAuthLink(url: string | null | undefined): ParsedAuthLink {
  if (!url) return { kind: 'none' };

  let params: Map<string, string>;
  try {
    params = collectParams(url);
  } catch {
    return { kind: 'none' }; // unparseable — treat as a normal (non-auth) URL
  }

  const error = params.get('error') ?? params.get('error_code');
  if (error) {
    return { kind: 'error', message: params.get('error_description') ?? error };
  }

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) {
    const rawType = params.get('type');
    const type: AuthLinkTokenType =
      rawType && TOKEN_TYPES.includes(rawType) ? (rawType as AuthLinkTokenType) : 'unknown';
    return { kind: 'tokens', type, accessToken, refreshToken };
  }

  const code = params.get('code');
  if (code) return { kind: 'pkce_code', code };

  if (accessToken || refreshToken) {
    // Auth-shaped but missing its counterpart token — a truncated/mangled link.
    return { kind: 'error', message: 'This link is invalid or has expired' };
  }

  return { kind: 'none' };
}
