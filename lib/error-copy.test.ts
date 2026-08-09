/**
 * Unit tests for lib/error-copy.ts — mirrors lib/auth-errors.test.ts.
 *
 * The property that matters most is the same one: an unrecognised error must
 * never leak its raw message into the UI. `book/[bookId].tsx` used to render
 * `err.message` directly, so this is a regression that has already happened
 * once in this codebase rather than a hypothetical.
 */
import { loadErrorCopy, saveErrorCopy } from './error-copy';

describe('loadErrorCopy', () => {
  it('treats network failures as connectivity, not as missing content', () => {
    for (const raw of ['Network request failed', 'fetch failed', 'connection reset']) {
      expect(loadErrorCopy(new Error(raw), 'this book').title).toBe("Couldn't reach Fluenci");
    }
  });

  it('checks network before other matches so an offline error is never misread', () => {
    // Contains a network phrase AND a permissions phrase.
    const copy = loadErrorCopy(new Error('Network error: permission denied for table cards'), 'the library');
    expect(copy.title).toBe("Couldn't reach Fluenci");
  });

  it('recognises an expired session', () => {
    expect(loadErrorCopy(new Error('JWT expired'), 'your lessons').title).toBe(
      'Your session expired'
    );
  });

  it('recognises an RLS rejection without naming the policy', () => {
    const copy = loadErrorCopy(new Error('new row violates row-level security policy'), 'this book');
    expect(copy.title).toBe("Couldn't open that");
    expect(copy.message).not.toContain('row-level');
  });

  it('names what failed to load so the message is actionable', () => {
    expect(loadErrorCopy(new Error('boom'), 'the reading library').message).toContain(
      'the reading library'
    );
  });

  it('reads a PostgrestError, which is not an Error instance', () => {
    // Supabase query failures arrive as plain objects; classifying them as
    // "unknown" would report every RLS or offline failure as a generic one.
    const copy = loadErrorCopy({ message: 'TypeError: Network request failed', code: '' }, 'this book');
    expect(copy.title).toBe("Couldn't reach Fluenci");
  });
});

describe('saveErrorCopy', () => {
  it('says the write did not happen, not that the read failed', () => {
    const copy = saveErrorCopy(new Error('Network request failed'), 'your progress');
    expect(copy.message).toContain("couldn't save");
    expect(copy.message).toContain('your progress');
  });

  it('recognises the throttle', () => {
    expect(saveErrorCopy(new Error('Too many requests'), 'your review').title).toBe(
      'Too many requests'
    );
  });
});

describe('raw errors never reach the user', () => {
  const secret = 'PGRST116 duplicate key value violates unique constraint "cards_pkey" on public.cards';

  it('never echoes an unrecognised raw message', () => {
    for (const copy of [loadErrorCopy(new Error(secret), 'this book'), saveErrorCopy(new Error(secret), 'this book')]) {
      expect(copy.message).not.toContain('PGRST116');
      expect(copy.message).not.toContain('cards_pkey');
      expect(copy.message).not.toContain('public.cards');
    }
  });

  it('falls back safely for non-Error values', () => {
    for (const value of [undefined, null, 'a string', 42, {}]) {
      for (const copy of [loadErrorCopy(value, 'this book'), saveErrorCopy(value, 'this book')]) {
        expect(copy.title.length).toBeGreaterThan(0);
        expect(copy.message.length).toBeGreaterThan(0);
      }
    }
  });

  it('is case-insensitive', () => {
    expect(loadErrorCopy(new Error('NETWORK REQUEST FAILED'), 'this book').title).toBe(
      "Couldn't reach Fluenci"
    );
  });
});
