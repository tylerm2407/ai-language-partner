/**
 * BrandRamp — the pure parts of the swell: the ramp order, the clamp, and the
 * glow curve the UI thread samples every frame.
 */
// BrandRamp pulls hooks/useMotion -> AsyncStorage, which has no native module
// under jest; this is the same mock the other UI suites use.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { setItem: jest.fn(async () => {}), getItem: jest.fn(async () => null), removeItem: jest.fn(async () => {}) },
}));
import { brandRamp, brandRampCool, brandRampWarm, clampPct, swellAt, FLOW_MS } from './BrandRamp';
import { ui2Dark, ui2Light, ui2Warm } from '../../config/theme';

describe('brandRamp', () => {
  it('runs the icon left to right: cyan, sky, violet, magenta', () => {
    expect(brandRamp(ui2Light)).toEqual([ui2Light.logoAqua, ui2Light.logoSky, ui2Light.logoViolet, ui2Light.logoMagenta]);
    // The logo does not change with the scheme.
    expect(brandRamp(ui2Dark)).toEqual(brandRamp(ui2Light));
  });

  it('halves are the two bubbles', () => {
    expect(brandRampCool(ui2Light)).toEqual([ui2Light.logoSky, ui2Light.logoAqua]);
    expect(brandRampWarm(ui2Light)).toEqual([ui2Light.logoViolet, ui2Light.logoMagenta]);
  });

  it('the reader palette carries blue-free stand-ins, never the real ramp', () => {
    for (const hex of brandRamp(ui2Warm)) expect(parseInt(hex.slice(5, 7), 16)).toBeLessThanOrEqual(0x10);
  });
});

describe('clampPct', () => {
  it.each([
    [50, 50],
    [0, 0],
    [100, 100],
    [-4, 0],
    [130, 100],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
  ])('%p → %p', (input, expected) => {
    expect(clampPct(input)).toBe(expected);
  });
});

describe('swellAt', () => {
  it('is dark at the start of a pass and brightest at the far end', () => {
    expect(swellAt(0)).toBe(0);
    expect(swellAt(1)).toBeCloseTo(1, 6);
  });

  it('rises monotonically in between and never leaves 0–1', () => {
    let prev = -1;
    for (let i = 0; i <= 20; i++) {
      const v = swellAt(i / 20);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    expect(swellAt(-1)).toBe(0);
    expect(swellAt(2)).toBeCloseTo(1, 6);
  });

  it('one pass is slower than the canvas take Tyler asked to slow down (3.6 s)', () => {
    expect(FLOW_MS).toBeGreaterThan(3600);
  });
});
