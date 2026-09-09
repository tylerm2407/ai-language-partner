/**
 * Launch splash — holds the native half (app.json → storyboard) to the in-app
 * half (lib/launch-splash.ts → LaunchSplash.tsx). The two are only ever seen
 * together for one frame, so a drift between them is invisible in a screenshot
 * and shows up as a jump on every cold start.
 */
import * as fs from 'fs';
import * as path from 'path';

import { ui2Dark, ui2Light } from '../config/theme';
import { PEEK, SOL_SIZE, TILE_SIZE, launchSplashPlan, launchSplashTotalMs } from './launch-splash';

const ROOT = path.join(__dirname, '..');

interface SplashPluginConfig {
  image: string;
  imageWidth: number;
  resizeMode: string;
  backgroundColor: string;
  dark: { image: string; backgroundColor: string };
}

function readSplashPlugin(): SplashPluginConfig {
  const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8')) as {
    expo: { splash?: unknown; plugins: unknown[] };
  };
  expect(app.expo.splash).toBeUndefined(); // the legacy full-image key is gone
  const entry = app.expo.plugins.find(
    (p): p is [string, SplashPluginConfig] => Array.isArray(p) && p[0] === 'expo-splash-screen',
  );
  if (!entry) throw new Error('expo-splash-screen plugin missing from app.json');
  return entry[1];
}

describe('native launch frame (app.json)', () => {
  const plugin = readSplashPlugin();

  it('shows the tile at the size the in-app stage draws it', () => {
    expect(plugin.imageWidth).toBe(TILE_SIZE);
    expect(plugin.resizeMode).toBe('contain');
  });

  it('uses the UI 2.0 Home ground in each scheme, so the first frame matches the first screen', () => {
    expect(plugin.backgroundColor).toBe(ui2Light.bg);
    expect(plugin.dark.backgroundColor).toBe(ui2Dark.bg);
  });

  it('points at square, transparent PNG assets that exist', () => {
    for (const rel of [plugin.image, plugin.dark.image]) {
      const file = path.join(ROOT, rel);
      expect(fs.existsSync(file)).toBe(true);
      const png = fs.readFileSync(file);
      // IHDR: width @16, height @20, colour type @25 (6 = RGBA)
      expect(png.readUInt32BE(16)).toBe(1024);
      expect(png.readUInt32BE(20)).toBe(1024);
      expect(png[25]).toBe(6);
    }
  });
});

describe('launchSplashPlan', () => {
  it('keeps the full stage under two seconds and Sol inside the tile', () => {
    const plan = launchSplashPlan(false);
    expect(plan.sol).toBe(true);
    expect(launchSplashTotalMs(plan)).toBeLessThanOrEqual(2400);
    expect(plan.fadeDelay).toBeGreaterThan(plan.solDelay + plan.peekOut + plan.twitch + plan.peekBack);
    expect(plan.holdUntil).toBeGreaterThan(plan.solDelay + plan.peekOut);
    expect(SOL_SIZE).toBeLessThan(TILE_SIZE);
    // He has to actually clear the tile edge to be seen.
    expect(Math.abs(PEEK.y)).toBeGreaterThan(TILE_SIZE - SOL_SIZE);
  });

  it('with reduced motion nothing travels and the stage is shorter', () => {
    const full = launchSplashPlan(false);
    const reduced = launchSplashPlan(true);
    expect(reduced.sol).toBe(false);
    expect(reduced.breatheUp + reduced.breatheDown + reduced.peekOut + reduced.peekBack).toBe(0);
    expect(launchSplashTotalMs(reduced)).toBeLessThan(launchSplashTotalMs(full));
  });
});
