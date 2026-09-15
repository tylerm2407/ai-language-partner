import React from 'react';
import { Modal, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { Ui2VariantProvider, paletteForScheme, useUi2Theme } from './useUi2Theme';
import { ui2Dark, ui2Light, ui2Warm, type Ui2Palette } from '../config/theme';

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

  it('returns the warm palette under the warm variant whatever the scheme', () => {
    expect(paletteForScheme('light', 'warm')).toBe(ui2Warm);
    expect(paletteForScheme('dark', 'warm')).toBe(ui2Warm);
    expect(paletteForScheme('dark', 'system')).toBe(ui2Dark);
  });

  it('all three palettes carry the same keys', () => {
    expect(Object.keys(ui2Dark).sort()).toEqual(Object.keys(ui2Light).sort());
    expect(Object.keys(ui2Warm).sort()).toEqual(Object.keys(ui2Light).sort());
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
    ['warm ink on bg', ui2Warm.ink, ui2Warm.bg, 7],
    ['warm muted on bg', ui2Warm.muted, ui2Warm.bg, 4.5],
    ['warm muted on card', ui2Warm.muted, ui2Warm.card, 4.5],
    ['warm onPrimary on primary', ui2Warm.onPrimary, ui2Warm.primary, 4.5],
    ['warm onTint on primaryTint', ui2Warm.onTint, ui2Warm.primaryTint, 4.5],
    ['warm muted on greenTint', ui2Warm.muted, ui2Warm.greenTint, 4.5],
    ['warm onGreen on green', ui2Warm.onGreen, ui2Warm.green, 4.5],
    ['warm onError on error', ui2Warm.onError, ui2Warm.error, 4.5],
  ])('%s is at least %s:1', (_label, fg, bg, floor) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(floor as number);
  });
});

describe('warm palette is blue-free', () => {
  // The whole point of Night reading. On OLED a black pixel is off and a pixel
  // with a zero blue byte emits no blue; both facts are only true if every key
  // honours them, so every key is checked rather than a representative few.
  it('grounds on true black', () => {
    expect(ui2Warm.bg).toBe('#000000');
  });

  it.each(Object.entries(ui2Warm))('%s has a blue byte of at most 0x10', (_key, hex) => {
    expect(hex).toMatch(/^#[0-9A-F]{6}$/);
    expect(parseInt(hex.slice(5, 7), 16)).toBeLessThanOrEqual(0x10);
  });
});

describe('Ui2VariantProvider', () => {
  // The hook returns a fresh object per render, so the probe records what it
  // saw rather than the tree asserting on rendered colour.
  let seen: { scheme: string; variant: string; c: Ui2Palette } | null = null;
  function Probe() {
    const { scheme, variant, c } = useUi2Theme();
    seen = { scheme, variant, c };
    return React.createElement(Text, null, variant);
  }

  beforeEach(() => {
    seen = null;
  });

  it('answers system by default', () => {
    act(() => {
      TestRenderer.create(React.createElement(Probe));
    });
    expect(seen?.variant).toBe('system');
    expect(seen?.c).not.toBe(ui2Warm);
  });

  it('swaps the palette and reports a dark ground under warm', () => {
    act(() => {
      TestRenderer.create(
        React.createElement(Ui2VariantProvider, { variant: 'warm' }, React.createElement(Probe)),
      );
    });
    expect(seen?.variant).toBe('warm');
    expect(seen?.scheme).toBe('dark');
    expect(seen?.c).toBe(ui2Warm);
  });

  it('reaches a consumer inside a Modal opened within the scope', () => {
    // Ui2Sheet is a Modal. If context did not cross it, the display sheet the
    // reader opens would render violet-on-white over an amber-on-black page.
    act(() => {
      TestRenderer.create(
        React.createElement(
          Ui2VariantProvider,
          { variant: 'warm' },
          React.createElement(Modal, { visible: true }, React.createElement(Probe)),
        ),
      );
    });
    expect(seen?.c).toBe(ui2Warm);
  });
});
