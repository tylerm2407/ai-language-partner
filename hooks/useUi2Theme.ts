/**
 * UI 2.0 theme hook: the light or dark palette, chosen from the OS setting.
 *
 * `app.json` sets `userInterfaceStyle: "automatic"` so `useColorScheme()`
 * actually follows the device; before the redesign it was pinned to `dark`,
 * which made the hook always answer dark.
 *
 * ONE OVERRIDE, SCOPED BY CONTEXT. `Ui2VariantProvider` lets a subtree swap the
 * palette without touching the OS scheme. The only variant is `'warm'` — the
 * reader's amber-on-black Night reading palette (`ui2Warm` in config/theme.ts).
 * Under it the hook still reports `scheme: 'dark'`: every `scheme === 'dark'`
 * branch in the app (the sheet scrim, the status bar, the launch splash) is
 * asking whether the ground is dark, and under warm it is black. A third
 * scheme literal would have sent all of them down the light branch.
 *
 * Context crosses a React Native `Modal` — the Modal's children are ordinary
 * children of the same fiber tree; only the native view is re-parented — so a
 * sheet opened from inside a warm subtree renders warm too. The test file pins
 * that rather than trusting it.
 *
 * `c` is always one of three module-level constants, never a derived object,
 * so every `useMemo(..., [c])` downstream keeps its cache across renders and
 * invalidates exactly once when the variant actually changes.
 */
import { createContext, createElement, useContext, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { ui2Dark, ui2Light, ui2Shape, ui2Type, ui2Warm, type Ui2Palette } from '../config/theme';

export type Ui2Scheme = 'light' | 'dark';

/** `'system'` follows the OS; `'warm'` is the reader's Night reading palette. */
export type Ui2Variant = 'system' | 'warm';

export interface Ui2Theme {
  /** `'dark'` whenever the ground is dark — including under the warm variant. */
  scheme: Ui2Scheme;
  variant: Ui2Variant;
  c: Ui2Palette;
  type: typeof ui2Type;
  shape: typeof ui2Shape;
}

const Ui2VariantContext = createContext<Ui2Variant>('system');

interface Ui2VariantProviderProps {
  variant: Ui2Variant;
  /** Optional only so `createElement(Provider, props, child)` typechecks. */
  children?: ReactNode;
}

/** Scopes a palette variant to a subtree. `createElement` rather than JSX so
 *  this file keeps its `.ts` extension and its hundred-odd import paths. */
export function Ui2VariantProvider({ variant, children }: Ui2VariantProviderProps) {
  return createElement(Ui2VariantContext.Provider, { value: variant }, children);
}

export function paletteForScheme(scheme: Ui2Scheme, variant: Ui2Variant = 'system'): Ui2Palette {
  if (variant === 'warm') return ui2Warm;
  return scheme === 'dark' ? ui2Dark : ui2Light;
}

export function useUi2Theme(): Ui2Theme {
  const os = useColorScheme();
  const variant = useContext(Ui2VariantContext);
  const scheme: Ui2Scheme = variant === 'warm' || os === 'dark' ? 'dark' : 'light';
  return { scheme, variant, c: paletteForScheme(scheme, variant), type: ui2Type, shape: ui2Shape };
}
