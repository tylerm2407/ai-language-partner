/**
 * Unit tests for lib/auth-errors.ts.
 *
 * The property that matters most is the last one: an unrecognized error must
 * never leak its raw message into the UI. That is the whole reason this module
 * exists, and it is the case a future edit is most likely to regress.
 */
import { authErrorCopy } from './auth-errors';

describe('authErrorCopy', () => {
  it('explains invalid credentials without saying which field was wrong', () => {
    const copy = authErrorCopy(new Error('Invalid login credentials'));
    expect(copy.title).toBe("That didn't match");
    expect(copy.message).toContain('email or password');
  });

  it('points an existing user at sign-in instead of sign-up', () => {
    const copy = authErrorCopy(new Error('User already registered'));
    expect(copy.message).toContain('Sign in instead');
  });

  it('treats network failures as connectivity, not credentials', () => {
    for (const raw of ['Network request failed', 'fetch failed', 'connection reset']) {
      expect(authErrorCopy(new Error(raw)).title).toBe("Couldn't reach Fluenci");
    }
  });

  it('checks network before other matches so an offline error is never misread', () => {
    // Contains "invalid login credentials" AND a network phrase.
    const copy = authErrorCopy(new Error('Network error: invalid login credentials'));
    expect(copy.title).toBe("Couldn't reach Fluenci");
  });

  it('recognizes the unconfirmed-email state', () => {
    expect(authErrorCopy(new Error('Email not confirmed')).title).toBe(
      'Confirm your email first'
    );
  });

  it("matches Supabase's throttle phrasing", () => {
    const copy = authErrorCopy(
      new Error('For security purposes, you can only request this after 47 seconds')
    );
    expect(copy.title).toBe('Too many attempts');
  });

  it('is case-insensitive', () => {
    expect(authErrorCopy(new Error('INVALID LOGIN CREDENTIALS')).title).toBe(
      "That didn't match"
    );
  });

  it('never echoes an unrecognized raw message', () => {
    const secret = 'PGRST301 jwt expired at row 42 of auth.users';
    const copy = authErrorCopy(new Error(secret));
    expect(copy.message).not.toContain('PGRST301');
    expect(copy.message).not.toContain('auth.users');
    expect(copy.title).toBe("Couldn't complete that");
  });

  it('falls back safely for non-Error values', () => {
    for (const value of [undefined, null, 'a string', 42, {}]) {
      const copy = authErrorCopy(value);
      expect(copy.title).toBe("Couldn't complete that");
      expect(copy.message.length).toBeGreaterThan(0);
    }
  });
});
