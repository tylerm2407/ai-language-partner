import { parseAuthLink, RESET_PASSWORD_REDIRECT } from './auth-links';

describe('parseAuthLink', () => {
  describe('recovery links (implicit flow, tokens in fragment)', () => {
    it('parses a password-recovery link', () => {
      const url = `${RESET_PASSWORD_REDIRECT}#access_token=aaa.bbb.ccc&expires_in=3600&refresh_token=rrr&token_type=bearer&type=recovery`;
      expect(parseAuthLink(url)).toEqual({
        kind: 'tokens',
        type: 'recovery',
        accessToken: 'aaa.bbb.ccc',
        refreshToken: 'rrr',
      });
    });

    it('parses tokens delivered in the query string instead of the fragment', () => {
      const url = 'fluenci://reset-password?access_token=at&refresh_token=rt&type=recovery';
      expect(parseAuthLink(url)).toEqual({
        kind: 'tokens',
        type: 'recovery',
        accessToken: 'at',
        refreshToken: 'rt',
      });
    });

    it('parses an Expo dev-client URL (exp:// with /--/ path)', () => {
      const url = 'exp://192.168.1.5:8081/--/reset-password#access_token=at&refresh_token=rt&type=recovery';
      expect(parseAuthLink(url)).toEqual({
        kind: 'tokens',
        type: 'recovery',
        accessToken: 'at',
        refreshToken: 'rt',
      });
    });

    it('prefers fragment values over query values on collision', () => {
      const url = 'fluenci://reset-password?type=signup#access_token=at&refresh_token=rt&type=recovery';
      expect(parseAuthLink(url)).toEqual({
        kind: 'tokens',
        type: 'recovery',
        accessToken: 'at',
        refreshToken: 'rt',
      });
    });
  });

  describe('email confirmation links', () => {
    it('parses a signup confirmation link', () => {
      const url = 'fluenci://reset-password#access_token=at&refresh_token=rt&type=signup';
      expect(parseAuthLink(url)).toMatchObject({ kind: 'tokens', type: 'signup' });
    });

    it('parses an email_change confirmation link', () => {
      const url = 'fluenci://home#access_token=at&refresh_token=rt&type=email_change';
      expect(parseAuthLink(url)).toMatchObject({ kind: 'tokens', type: 'email_change' });
    });

    it('falls back to type "unknown" for unrecognized types', () => {
      const url = 'fluenci://x#access_token=at&refresh_token=rt&type=something_new';
      expect(parseAuthLink(url)).toMatchObject({ kind: 'tokens', type: 'unknown' });
    });

    it('falls back to type "unknown" when type is missing', () => {
      const url = 'fluenci://x#access_token=at&refresh_token=rt';
      expect(parseAuthLink(url)).toMatchObject({ kind: 'tokens', type: 'unknown' });
    });
  });

  describe('PKCE links', () => {
    it('parses a ?code= link', () => {
      const url = 'fluenci://reset-password?code=abc-123';
      expect(parseAuthLink(url)).toEqual({ kind: 'pkce_code', code: 'abc-123' });
    });
  });

  describe('expired / invalid links', () => {
    it('surfaces the decoded error_description for an expired link', () => {
      const url =
        'fluenci://reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';
      expect(parseAuthLink(url)).toEqual({
        kind: 'error',
        message: 'Email link is invalid or has expired',
      });
    });

    it('falls back to the error code when no description is present', () => {
      const url = 'fluenci://reset-password#error_code=otp_expired';
      expect(parseAuthLink(url)).toEqual({ kind: 'error', message: 'otp_expired' });
    });

    it('treats an access_token without a refresh_token as a bad link', () => {
      const url = 'fluenci://reset-password#access_token=at&type=recovery';
      expect(parseAuthLink(url)).toEqual({
        kind: 'error',
        message: 'This link is invalid or has expired',
      });
    });

    it('treats a refresh_token without an access_token as a bad link', () => {
      const url = 'fluenci://reset-password#refresh_token=rt';
      expect(parseAuthLink(url)).toMatchObject({ kind: 'error' });
    });
  });

  describe('non-auth URLs pass through untouched', () => {
    it.each([
      'fluenci://learn',
      'fluenci://learn/lesson-42?source=push',
      'fluenci://reset-password', // redirect target with no tokens (fragment stripped by mail client)
      'https://fluenci.com/privacy',
      'exp://192.168.1.5:8081/--/review',
    ])('returns kind none for %s', (url) => {
      expect(parseAuthLink(url)).toEqual({ kind: 'none' });
    });

    it('returns none for null, undefined, and empty input', () => {
      expect(parseAuthLink(null)).toEqual({ kind: 'none' });
      expect(parseAuthLink(undefined)).toEqual({ kind: 'none' });
      expect(parseAuthLink('')).toEqual({ kind: 'none' });
    });

    it('returns none for garbage input', () => {
      expect(parseAuthLink('not a url at all ###???')).toEqual({ kind: 'none' });
      expect(parseAuthLink('#&&&=')).toEqual({ kind: 'none' });
    });
  });
});
