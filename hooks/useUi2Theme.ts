/**
 * UI 2.0 theme hook: the light or dark palette, chosen from the OS setting.
 *
 * `app.json` sets `userInterfaceStyle: "automatic"` so `useColorScheme()`
 * actually follows the device; before the redesign it was pinned to `dark`,
 * which made the hook always answer dark. Screens that have not migrated to
 * UI 2.0 keep reading `colors` from config/theme.ts and are unaffected by the
 * scheme — they were designed dark-only and stay that way until their turn.
 */
import { useColorScheme } from 'react-native';
import { ui2Dark, ui2Light, ui2Shape, ui2Type, type Ui2Palette } from '../config/theme';

export type Ui2Scheme = 'light' | 'dark';

export interface Ui2Theme {
  scheme: Ui2Scheme;
  c: Ui2Palette;
  type: typeof ui2Type;
  shape: typeof ui2Shape;
}

export function paletteForScheme(scheme: Ui2Scheme): Ui2Palette {
  return scheme === 'dark' ? ui2Dark : ui2Light;
}

export function useUi2Theme(): Ui2Theme {
  const scheme: Ui2Scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { scheme, c: paletteForScheme(scheme), type: ui2Type, shape: ui2Shape };
}
