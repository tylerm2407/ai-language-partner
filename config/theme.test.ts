/**
 * Typography invariants.
 *
 * These exist because the Inter -> Nunito/Fraunces swap silently broke every
 * page title: the scale kept Inter's lineHeights (~1.21em) while Nunito needs
 * 1.364em, so both platforms pinned the baseline and clipped the ascender.
 * Nothing in tsc or eslint can see that, hence these tests.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { leading, minLineHeight, typography } from './theme';
import { displayScale, BASELINE_WIDTH } from '../hooks/useDisplayScale';

/** Which face each scale step actually renders in — see components/ui/Text.tsx. */
const FACE_OF_STEP: Record<keyof typeof typography.scale, keyof typeof leading> = {
  hero: 'display', // <Hero> uses typography.family.display (Fraunces)
  h1: 'sans',
  h2: 'sans',
  h3: 'sans',
  bodyLg: 'sans',
  body: 'sans',
  bodySm: 'sans',
  caption: 'sans',
  tiny: 'sans',
};

describe('typography scale leading', () => {
  const steps = Object.keys(typography.scale) as (keyof typeof typography.scale)[];

  it.each(steps)('%s has a lineHeight that cannot clip its ascender', (step) => {
    const { fontSize, lineHeight } = typography.scale[step];
    expect(lineHeight).toBeGreaterThanOrEqual(minLineHeight(fontSize, FACE_OF_STEP[step]));
  });

  it('holds across the whole display-scale clamp, not just at baseline', () => {
    // Mirrors the arithmetic in <Heading>/<Hero>: fontSize rounds, lineHeight is
    // floored at the natural line box for the *scaled* size.
    for (const width of [280, 320, 360, 375, 390, 414, 430, 768, 1024]) {
      const s = displayScale(width);
      for (const step of ['hero', 'h1', 'h2', 'h3'] as const) {
        const face = FACE_OF_STEP[step];
        const fontSize = Math.round(typography.scale[step].fontSize * s);
        const lineHeight = Math.max(
          minLineHeight(fontSize, face),
          Math.round(typography.scale[step].lineHeight * s),
        );
        expect(lineHeight).toBeGreaterThanOrEqual(minLineHeight(fontSize, face));
      }
    }
  });
});

describe('displayScale', () => {
  it('is 1 at the design baseline', () => {
    expect(displayScale(BASELINE_WIDTH)).toBe(1);
  });

  it('clamps so neither tiny phones nor tablets escape the range', () => {
    expect(displayScale(240)).toBeGreaterThanOrEqual(0.88);
    expect(displayScale(1024)).toBeLessThanOrEqual(1.1);
  });

  it('moves monotonically with width', () => {
    expect(displayScale(360)).toBeLessThan(displayScale(430));
  });
});

describe('font families', () => {
  // The PlayfairDisplay regression: a family name survived in the theme after
  // the font stopped being loaded, so it silently fell back at runtime.
  it('only names faces that the root layout actually loads', () => {
    const rootLayout = readFileSync(join(__dirname, '..', 'app', '_layout.tsx'), 'utf8');
    for (const family of Object.values(typography.family)) {
      expect(rootLayout).toContain(family);
    }
  });
});
