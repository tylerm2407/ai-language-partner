/**
 * Supabase auth error → user-facing copy.
 *
 * Auth screens used to surface `err.message` straight into an
 * `Alert.alert('Error', message)`. Those strings are written for developers:
 * "Invalid login credentials" does not tell someone whether they mistyped the
 * password or never had an account, and "AuthApiError" or a raw fetch failure
 * tells them nothing at all. Both read as an unfinished app at the exact moment
 * trust matters most — the sign-up screen.
 *
 * Every branch returns a title plus a body that says what to do next, following
 * the what-happened → why → what-now structure. The fallback never echoes the
 * raw message: an unrecognized error is precisely the case where the underlying
 * text is least likely to be safe or meaningful to show.
 */

export interface AuthErrorCopy {
  title: string;
  message: string;
}

const FALLBACK: AuthErrorCopy = {
  title: "Couldn't complete that",
  message: 'Something went wrong on our end. Please try again in a moment.',
};

/** Map an unknown thrown value to copy safe to show a learner. */
export function authErrorCopy(err: unknown): AuthErrorCopy {
  const raw = err instanceof Error ? err.message : '';
  const text = raw.toLowerCase();

  if (!text) return FALLBACK;

  // Network / offline. Checked first: any request can fail this way.
  if (
    text.includes('network') ||
    text.includes('fetch failed') ||
    text.includes('timeout') ||
    text.includes('connection')
  ) {
    return {
      title: "Couldn't reach Fluenci",
      message: 'Check your connection and try again.',
    };
  }

  if (text.includes('invalid login credentials')) {
    return {
      title: "That didn't match",
      message:
        'The email or password is incorrect. Check both, or reset your password if you have forgotten it.',
    };
  }

  if (text.includes('email not confirmed')) {
    return {
      title: 'Confirm your email first',
      message:
        'We sent a confirmation link when you signed up. Open it, then sign in again.',
    };
  }

  if (text.includes('already registered') || text.includes('already exists')) {
    return {
      title: 'You already have an account',
      message: 'That email is already registered. Sign in instead, or reset your password.',
    };
  }

  if (text.includes('password') && text.includes('at least')) {
    return {
      title: 'Password too short',
      message: 'Use at least 6 characters.',
    };
  }

  if (text.includes('unable to validate email') || text.includes('invalid email')) {
    return {
      title: 'Check that email address',
      message: "That doesn't look like a complete email address.",
    };
  }

  // Supabase phrases its throttle as "you can only request this after N seconds".
  if (text.includes('rate limit') || text.includes('you can only request')) {
    return {
      title: 'Too many attempts',
      message: 'Wait a minute before trying again.',
    };
  }

  if (text.includes('weak password')) {
    return {
      title: 'Choose a stronger password',
      message: 'Try a longer one, or add numbers and symbols.',
    };
  }

  return FALLBACK;
}
