/**
 * Tests for the initials fallback in Avatar.
 *
 * This is the only thing standing between a pre-077 account and a blank
 * circle: those rows still say avatar_kind 'procedural', the SVG renderer
 * that name refers to is gone, and they have no image. It must never render
 * empty, for any name a person can actually type.
 */
import { initialsFor } from './Avatar';

describe('initialsFor', () => {
  it('takes the first letter of the first two words', () => {
    expect(initialsFor('Ada Lovelace')).toBe('AL');
    expect(initialsFor('tyler moore')).toBe('TM');
  });

  it('handles a single name', () => {
    expect(initialsFor('Prince')).toBe('P');
  });

  it('ignores extra words and collapses whitespace', () => {
    expect(initialsFor('  Jean   Luc   Picard  ')).toBe('JL');
  });

  it('never returns empty for names with no letters', () => {
    // A blank circle reads as a broken image; a neutral glyph reads as "unset".
    for (const name of ['', '   ', '🙂', '🙂 🙃', null, undefined]) {
      expect(initialsFor(name).length).toBeGreaterThan(0);
    }
  });

  it('keeps non-Latin scripts rather than dropping them', () => {
    // \p{L} is unicode-aware on purpose — an [A-Za-z] test would blank these.
    expect(initialsFor('张 伟')).toBe('张伟');
    expect(initialsFor('Ольга Иванова')).toBe('ОИ');
  });

  it('accepts a leading digit rather than blanking the avatar', () => {
    expect(initialsFor('3lite Player')).toBe('3P');
  });
});
