/**
 * Data-load and mutation failure → user-facing copy.
 *
 * The sibling of `lib/auth-errors.ts`, for everything that is not sign-in.
 * Screens used to write `Alert.alert('Error', 'Failed to load reading
 * passages.')`, which tells a learner nothing they can act on: it does not say
 * whether they are offline, whether their session lapsed, or whether waiting a
 * moment would fix it. Worse, some paths did the opposite and pushed
 * `err.message` straight into the UI — that is how a Postgres error string
 * reaches a user.
 *
 * Same three rules as auth-errors:
 *   1. Network is checked FIRST, so an offline failure is never reported as
 *      something more alarming.
 *   2. The raw message is never echoed. An unrecognised error is exactly the
 *      case where the underlying text is least likely to be safe to show.
 *   3. Every branch says what happened and what to do next.
 *
 * `subject` is a short noun phrase written by the CALLER ("this book", "your
 * lessons") and is the only interpolated value. It must never be derived from
 * an error — that would reintroduce the leak this module exists to close.
 */

export interface ErrorCopy {
  title: string;
  message: string;
}

type Kind = 'offline' | 'session' | 'forbidden' | 'throttled' | 'unknown';

/**
 * Supabase throws two shapes: real `Error`s from the fetch layer and plain
 * `PostgrestError` objects (`{ message, code, details }`) that are not
 * `Error` instances. Reading only `instanceof Error` would classify every
 * query failure as unknown.
 */
function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const { message } = err as { message: unknown };
    if (typeof message === 'string') return message;
  }
  return '';
}

function classify(err: unknown): Kind {
  const text = messageOf(err).toLowerCase();
  if (!text) return 'unknown';

  // First, always. Any request can fail this way, and every other branch below
  // would be a more specific — and wrong — story about what went wrong.
  if (
    text.includes('network') ||
    text.includes('fetch failed') ||
    text.includes('timeout') ||
    text.includes('timed out') ||
    text.includes('connection') ||
    text.includes('offline')
  ) {
    return 'offline';
  }

  if (
    text.includes('jwt') ||
    text.includes('unauthorized') ||
    text.includes('not authenticated') ||
    text.includes('invalid refresh token') ||
    text.includes('pgrst301')
  ) {
    return 'session';
  }

  if (
    text.includes('permission denied') ||
    text.includes('row-level security') ||
    text.includes('row level security') ||
    text.includes('forbidden')
  ) {
    return 'forbidden';
  }

  if (text.includes('rate limit') || text.includes('too many requests')) {
    return 'throttled';
  }

  return 'unknown';
}

/** Copy for a read that failed. `subject` is a lowercase noun phrase. */
export function loadErrorCopy(err: unknown, subject: string): ErrorCopy {
  switch (classify(err)) {
    case 'offline':
      return {
        title: "Couldn't reach Fluenci",
        message: `We couldn't load ${subject}. Check your connection and try again.`,
      };
    case 'session':
      return {
        title: 'Your session expired',
        message: `Sign in again to load ${subject}.`,
      };
    case 'forbidden':
      return {
        title: "Couldn't open that",
        message: `${subject} isn't available on your account.`,
      };
    case 'throttled':
      return {
        title: 'Too many requests',
        message: `Wait a moment, then try loading ${subject} again.`,
      };
    default:
      return {
        title: "Couldn't load that",
        message: `Something went wrong loading ${subject}. Try again in a moment.`,
      };
  }
}

/** Copy for a write that failed. `subject` is a lowercase noun phrase. */
export function saveErrorCopy(err: unknown, subject: string): ErrorCopy {
  switch (classify(err)) {
    case 'offline':
      return {
        title: "Couldn't reach Fluenci",
        message: `We couldn't save ${subject}. Check your connection and try again.`,
      };
    case 'session':
      return {
        title: 'Your session expired',
        message: `Sign in again, then try saving ${subject}.`,
      };
    case 'forbidden':
      return {
        title: "Couldn't save that",
        message: `This account can't change ${subject}.`,
      };
    case 'throttled':
      return {
        title: 'Too many requests',
        message: 'Wait a moment, then try again.',
      };
    default:
      return {
        title: "Couldn't save that",
        message: `Something went wrong saving ${subject}. Try again in a moment.`,
      };
  }
}
