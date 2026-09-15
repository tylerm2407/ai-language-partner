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

export type PendingAuthIntent = {
  type: 'recovery' | 'signup';
  email: string;
  createdAt: number;
};

export const AUTH_INTENT_TTL_MS = 24 * 60 * 60 * 1000;

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

/** Only the callback route configured for this app may mutate auth state. */
export function isExpectedAuthCallbackUrl(url: string, allowExpoDev = false): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'fluenci:') {
      return parsed.hostname === 'reset-password' && (parsed.pathname === '' || parsed.pathname === '/');
    }
    return allowExpoDev && parsed.protocol === 'exp:' && parsed.pathname.endsWith('/--/reset-password');
  } catch {
    return false;
  }
}

/**
 * Bind a verified token identity to the flow the learner initiated. Route
 * validation happens separately so this function stays pure and testable.
 */
export function authLinkMatchesIntent(
  link: ParsedAuthLink,
  intent: PendingAuthIntent | null,
  verifiedEmail: string | null | undefined,
  now = Date.now(),
): boolean {
  if (link.kind !== 'tokens' || !intent || !verifiedEmail) return false;
  if (link.type !== intent.type) return false;
  if (now - intent.createdAt < 0 || now - intent.createdAt > AUTH_INTENT_TTL_MS) return false;
  return verifiedEmail.trim().toLowerCase() === intent.email.trim().toLowerCase();
}

type BoundSessionAuth = {
  getUser: (accessToken: string) => Promise<{
    data: { user: { email?: string | null } | null };
    error: unknown;
  }>;
  setSession: (tokens: { access_token: string; refresh_token: string }) => Promise<{
    error: unknown;
  }>;
};

/** Verify identity and intent before performing the session-changing call. */
export async function establishBoundAuthSession(
  auth: BoundSessionAuth,
  url: string,
  link: ParsedAuthLink,
  intent: PendingAuthIntent | null,
  allowExpoDev = false,
  now = Date.now(),
): Promise<'recovery' | 'signup' | null> {
  if (!isExpectedAuthCallbackUrl(url, allowExpoDev) || link.kind !== 'tokens') return null;

  const { data, error } = await auth.getUser(link.accessToken);
  if (error || !authLinkMatchesIntent(link, intent, data.user?.email, now)) return null;

  const established = await auth.setSession({
    access_token: link.accessToken,
    refresh_token: link.refreshToken,
  });
  if (established.error) throw established.error;
  return link.type as 'recovery' | 'signup';
}

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
