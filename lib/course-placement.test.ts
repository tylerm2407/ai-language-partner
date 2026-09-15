/**
 * Which course a learner's lessons open on, and what the choosers offer.
 *
 * The contract: the declared level picks the course; the learner can hedge one
 * band down; nothing here ever invents a course that does not exist; and the
 * placement band is the band of the course actually opened, not the band the
 * learner named.
 */

import {
  bandBelow,
  courseForBand,
  defaultCourseFor,
  highestCourseAtOrBelow,
  initialCourseSelection,
  normalizePlacementChoice,
  placementAfterSettingsChange,
  placementOptionsFor,
  placementState,
  resolvePlacement,
  settingsNeedsPlacementConfirm,
} from './course-placement';
import type { Course } from '../types';

const course = (id: string, cefrLevel: string): Course => ({
  id,
  sourceLanguage: 'en',
  targetLanguage: 'es',
  title: `Spanish ${cefrLevel}`,
  description: '',
  imageUrl: null,
  totalUnits: 8,
  cefrLevel,
  isPublished: true,
  createdAt: '2026-01-01',
});

/** Production shape: one course per band, A1 to B2, no C1/C2. */
const COURSES = [course('a1', 'A1'), course('a2', 'A2'), course('b1', 'B1'), course('b2', 'B2')];

describe('bandBelow', () => {
  it('steps down the ladder and stops at A1', () => {
    expect(bandBelow('B1')).toBe('A2');
    expect(bandBelow('A1')).toBeNull();
  });
});

describe('courseForBand / highestCourseAtOrBelow', () => {
  it('finds the course at exactly the band, tolerating messy tags', () => {
    expect(courseForBand(COURSES, 'B1')?.id).toBe('b1');
    expect(courseForBand([course('x', ' b1 ')], 'B1')?.id).toBe('x');
    expect(courseForBand(COURSES, 'C1')).toBeNull();
  });

  it('falls to the highest published course under a band with no course', () => {
    expect(highestCourseAtOrBelow(COURSES, 'C1')?.id).toBe('b2');
    expect(highestCourseAtOrBelow(COURSES, 'A1')?.id).toBe('a1');
    expect(highestCourseAtOrBelow([], 'B2')).toBeNull();
  });
});

describe('placementOptionsFor', () => {
  it('offers a beginner nothing — the step is skipped', () => {
    expect(placementOptionsFor('beginner')).toEqual([]);
  });

  it('offers the declared band and the one below it', () => {
    const options = placementOptionsFor('elementary');
    expect(options.map((o) => [o.choice, o.band])).toEqual([
      ['start', 'A2'],
      ['warm_up', 'A1'],
    ]);
    expect(placementOptionsFor('intermediate').map((o) => o.band)).toEqual(['B1', 'A2']);
    expect(placementOptionsFor('upper_intermediate').map((o) => o.band)).toEqual(['B2', 'B1']);
  });

  it('tells an advanced learner the truth: the highest path that exists, or none', () => {
    const options = placementOptionsFor('advanced');
    expect(options.map((o) => [o.choice, o.band])).toEqual([
      ['start', 'B2'],
      ['none', null],
    ]);
    expect(options[0].title).toContain('highest lesson path today');
  });

  it('reflects the real course list when one is supplied', () => {
    // A language with no B2 course yet: upper-intermediate has no "start at B2".
    const withoutB2 = COURSES.filter((c) => c.cefrLevel !== 'B2');
    expect(placementOptionsFor('upper_intermediate', withoutB2).map((o) => [o.choice, o.band])).toEqual([
      ['start', 'B1'],
      ['none', null],
    ]);
    expect(placementOptionsFor('advanced', []).map((o) => o.choice)).toEqual(['none']);
  });

  it('never shows a band without its can-do line', () => {
    for (const level of ['elementary', 'intermediate', 'upper_intermediate', 'advanced'] as const) {
      for (const option of placementOptionsFor(level)) {
        expect(option.subtitle.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('normalizePlacementChoice', () => {
  it('keeps a choice the level offers and resets one it does not', () => {
    expect(normalizePlacementChoice('intermediate', 'warm_up')).toBe('warm_up');
    // A warm-up left in the draft from an earlier level pick.
    expect(normalizePlacementChoice('beginner', 'warm_up')).toBe('start');
    expect(normalizePlacementChoice('advanced', 'warm_up')).toBe('start');
    expect(normalizePlacementChoice('advanced', 'none')).toBe('none');
    expect(normalizePlacementChoice('intermediate', 'none')).toBe('start');
    expect(normalizePlacementChoice('intermediate', null)).toBe('start');
    expect(normalizePlacementChoice('intermediate', undefined)).toBe('start');
  });
});

describe('defaultCourseFor / resolvePlacement', () => {
  it('opens the declared band on start and the band below on warm-up', () => {
    expect(defaultCourseFor(COURSES, 'intermediate', 'start')?.id).toBe('b1');
    expect(defaultCourseFor(COURSES, 'intermediate', 'warm_up')?.id).toBe('a2');
    expect(defaultCourseFor(COURSES, 'beginner', 'warm_up')?.id).toBe('a1');
  });

  it('gives an advanced learner B2 on start and nothing on none', () => {
    expect(defaultCourseFor(COURSES, 'advanced', 'start')?.id).toBe('b2');
    expect(defaultCourseFor(COURSES, 'advanced', 'none')).toBeNull();
  });

  it('places at the band of the course actually opened', () => {
    expect(resolvePlacement(COURSES, 'intermediate', 'warm_up')).toEqual({
      currentCourseId: 'a2',
      placementBand: 'A2',
    });
    expect(resolvePlacement(COURSES, 'advanced', 'start')).toEqual({
      currentCourseId: 'b2',
      placementBand: 'B2',
    });
  });

  it('keeps the declared band when no course is opened', () => {
    expect(resolvePlacement(COURSES, 'advanced', 'none')).toEqual({
      currentCourseId: null,
      placementBand: 'C1',
    });
    expect(resolvePlacement([], 'intermediate', 'start')).toEqual({
      currentCourseId: null,
      placementBand: 'B1',
    });
  });
});

describe('placementState', () => {
  it('is placed with a pointer, no_course for a deliberate C1 opt-out, unplaced otherwise', () => {
    expect(placementState({ currentCourseId: 'b1', placementBand: 'B1' }, COURSES)).toBe('placed');
    expect(placementState({ currentCourseId: null, placementBand: 'C1' }, COURSES)).toBe('no_course');
    // Pre-migration account: no band at all.
    expect(placementState({ currentCourseId: null, placementBand: null }, COURSES)).toBe('unplaced');
    // A course exists at the band but the pointer is gone (FK SET NULL, trigger).
    expect(placementState({ currentCourseId: null, placementBand: 'B1' }, COURSES)).toBe('unplaced');
  });
});

describe('initialCourseSelection', () => {
  it('opens the stored pointer when it is one of the courses shown', () => {
    expect(
      initialCourseSelection(COURSES, { currentCourseId: 'a1', placementBand: 'B1', level: 'intermediate' }),
    ).toBe('a1');
  });

  it('falls to the level default when the pointer is stale', () => {
    expect(
      initialCourseSelection(COURSES, { currentCourseId: 'gone', placementBand: 'B1', level: 'intermediate' }),
    ).toBe('b1');
    expect(
      initialCourseSelection(COURSES, { currentCourseId: null, placementBand: null, level: 'upper_intermediate' }),
    ).toBe('b2');
  });

  it('opens nothing for a deliberate no-course placement', () => {
    expect(
      initialCourseSelection(COURSES, { currentCourseId: null, placementBand: 'C1', level: 'advanced' }),
    ).toBeNull();
  });

  it('never leaves the screen empty by accident', () => {
    expect(initialCourseSelection([course('only', 'A1')], { currentCourseId: null, placementBand: null, level: 'intermediate' })).toBe('only');
    expect(initialCourseSelection([], { currentCourseId: null, placementBand: null, level: 'intermediate' })).toBeNull();
  });
});

describe('settingsNeedsPlacementConfirm', () => {
  it('asks only when the level moved and the language did not', () => {
    expect(settingsNeedsPlacementConfirm('intermediate', 'upper_intermediate', 'es', 'es')).toBe(true);
    expect(settingsNeedsPlacementConfirm('intermediate', 'intermediate', 'es', 'es')).toBe(false);
    expect(settingsNeedsPlacementConfirm('intermediate', 'upper_intermediate', 'es', 'fr')).toBe(false);
  });
});

describe('placementAfterSettingsChange', () => {
  const previous = { level: 'intermediate' as const, targetLanguage: 'es' as const, currentCourseId: 'b1', placementBand: 'B1' };

  it('re-places on a language change whatever the decision', () => {
    const fr = COURSES.map((c) => ({ ...c, id: `fr-${c.id}`, targetLanguage: 'fr' as const }));
    for (const decision of ['keep', 'move', 'none'] as const) {
      expect(
        placementAfterSettingsChange({ previous, nextLevel: 'intermediate', nextLanguage: 'fr', courses: fr, decision }),
      ).toEqual({ currentCourseId: 'fr-b1', placementBand: 'B1' });
    }
  });

  it('follows the confirm on a same-language level change', () => {
    const args = { previous, nextLevel: 'upper_intermediate' as const, nextLanguage: 'es' as const, courses: COURSES };
    expect(placementAfterSettingsChange({ ...args, decision: 'keep' })).toBeNull();
    expect(placementAfterSettingsChange({ ...args, decision: 'move' })).toEqual({ currentCourseId: 'b2', placementBand: 'B2' });
    expect(
      placementAfterSettingsChange({ ...args, nextLevel: 'advanced', decision: 'none' }),
    ).toEqual({ currentCourseId: null, placementBand: 'C1' });
  });

  it('writes nothing when neither level nor language changed', () => {
    expect(
      placementAfterSettingsChange({ previous, nextLevel: 'intermediate', nextLanguage: 'es', courses: COURSES, decision: 'move' }),
    ).toBeNull();
  });
});
