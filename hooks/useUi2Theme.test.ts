import { paletteForScheme } from './useUi2Theme';
import { ui2Dark, ui2Light } from '../config/theme';

/** WCAG relative luminance of a #RRGGBB colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('paletteForScheme', () => {
  it('returns the light palette for light and the dark palette for dark', () => {
    expect(paletteForScheme('light')).toBe(ui2Light);
    expect(paletteForScheme('dark')).toBe(ui2Dark);
  });

  it('both palettes carry the same keys', () => {
    expect(Object.keys(ui2Dark).sort()).toEqual(Object.keys(ui2Light).sort());
  });
});

describe('UI 2.0 contrast floors', () => {
  // Every text/ground pair a screen actually renders. Muted text is body-size
  // helper copy, so it needs the full AA 4.5:1; ink is held to AAA.
  it.each([
    ['light ink on bg', ui2Light.ink, ui2Light.bg, 7],
    ['light muted on bg', ui2Light.muted, ui2Light.bg, 4.5],
    ['light muted on card', ui2Light.muted, ui2Light.card, 4.5],
    ['light onPrimary on primary', ui2Light.onPrimary, ui2Light.primary, 4.5],
    ['light onTint on primaryTint', ui2Light.onTint, ui2Light.primaryTint, 4.5],
    ['dark ink on bg', ui2Dark.ink, ui2Dark.bg, 7],
    ['dark muted on bg', ui2Dark.muted, ui2Dark.bg, 4.5],
    ['dark muted on card', ui2Dark.muted, ui2Dark.card, 4.5],
    ['dark onPrimary on primary', ui2Dark.onPrimary, ui2Dark.primary, 4.5],
    ['dark onTint on primaryTint', ui2Dark.onTint, ui2Dark.primaryTint, 4.5],
    ['dark muted on greenTint', ui2Dark.muted, ui2Dark.greenTint, 4.5],
  ])('%s is at least %s:1', (_label, fg, bg, floor) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(floor as number);
  });
});
