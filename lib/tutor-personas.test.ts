/**
 * Unit tests for the tutor personas.
 *
 * The rule being pinned is rapport: the same learner must get the same tutor
 * on every launch, every device, and after storage is cleared. A tutor whose
 * name changes between sessions is worse than no persona at all.
 */

import {
  TUTOR_PERSONAS,
  isTutorPersonaId,
  personaById,
  personaForLearner,
} from './tutor-personas';

const USER = 'e7c1a2f4-0000-4000-8000-000000000001';

describe('the closed set', () => {
  it('has four personas with unique ids', () => {
    expect(TUTOR_PERSONAS).toHaveLength(4);
    expect(new Set(TUTOR_PERSONAS.map((p) => p.id)).size).toBe(4);
  });

  it('is balanced across voice genders so assignment cannot skew', () => {
    const female = TUTOR_PERSONAS.filter((p) => p.voiceGender === 'female').length;
    expect(female).toBe(2);
  });

  it('gives every persona a name, a bio and a portrait id', () => {
    for (const p of TUTOR_PERSONAS) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.bio.length).toBeGreaterThan(0);
      expect(p.portraitId.length).toBeGreaterThan(0);
    }
  });

  it('keeps portraitId a plain string, never a required asset', () => {
    // A `require()` of a PNG that does not exist yet is a Metro BUNDLER
    // failure — it takes down the whole app, not just the tutor screen.
    for (const p of TUTOR_PERSONAS) {
      expect(typeof p.portraitId).toBe('string');
    }
  });

  it('keeps the bios language-neutral', () => {
    // The same four tutors teach all nine languages. A bio that implies a
    // nationality is wrong the moment the learner switches language.
    const placeWords =
      /spanish|french|german|italian|japanese|korean|chinese|portuguese|english|madrid|paris|tokyo|native speaker/i;
    for (const p of TUTOR_PERSONAS) {
      expect(p.bio).not.toMatch(placeWords);
    }
  });
});

describe('personaForLearner', () => {
  it('returns the stored persona when it is one we know', () => {
    for (const p of TUTOR_PERSONAS) {
      expect(personaForLearner(USER, p.id).id).toBe(p.id);
    }
  });

  it('is deterministic for the same user id', () => {
    const first = personaForLearner(USER, null);
    for (let i = 0; i < 50; i++) {
      expect(personaForLearner(USER, null).id).toBe(first.id);
    }
  });

  it('assigns the same tutor before and after storage is cleared', () => {
    // Clearing app data must not hand the learner a different person.
    const assigned = personaForLearner(USER, null);
    const afterChoosing = personaForLearner(USER, assigned.id);
    const afterClearing = personaForLearner(USER, null);
    expect(afterChoosing.id).toBe(assigned.id);
    expect(afterClearing.id).toBe(assigned.id);
  });

  it('falls back to an assignment for an unrecognised stored id', () => {
    // A retired persona or a corrupt blob must not leave the call with nobody
    // on it.
    for (const stored of ['', 'retired-persona', 'MARA', ' mara ']) {
      expect(personaForLearner(USER, stored).id).toBe(personaForLearner(USER, null).id);
    }
  });

  it('always returns a persona from the closed set', () => {
    const ids = new Set(TUTOR_PERSONAS.map((p) => p.id));
    for (let i = 0; i < 500; i++) {
      expect(ids.has(personaForLearner(`user-${i}`, null).id)).toBe(true);
    }
  });

  it('handles an empty user id without throwing', () => {
    expect(ids()).toContain(personaForLearner('', null).id);
  });

  it('spreads learners across all four tutors', () => {
    // Not a distribution guarantee — just proof the hash is not collapsing
    // everyone onto one persona, which a broken hash would do silently.
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      seen.add(personaForLearner(`d4b1${i}-user`, null).id);
    }
    expect(seen.size).toBe(4);
  });
});

describe('lookup helpers', () => {
  it('recognises exactly the ids in the set', () => {
    expect(isTutorPersonaId('mara')).toBe(true);
    expect(isTutorPersonaId('nobody')).toBe(false);
    expect(isTutorPersonaId(null)).toBe(false);
    expect(isTutorPersonaId(42)).toBe(false);
  });

  it('returns null rather than throwing for an unknown id', () => {
    expect(personaById(null)).toBeNull();
    expect(personaById(undefined)).toBeNull();
    expect(personaById('nobody')).toBeNull();
    expect(personaById('theo')?.name).toBe('Theo');
  });
});

function ids(): string[] {
  return TUTOR_PERSONAS.map((p) => p.id);
}
