/**
 * UI 2.0 primitive layer — the contracts a screen migration depends on.
 *
 * Three kinds of assertion live here, and they are deliberately different
 * kinds:
 *
 *  1. SOURCE SCANS. The whole reason UI 2.0 exists is that the old components
 *     baked a dark-only palette into themselves, so a hex literal or an import
 *     of `config/theme`'s `colors` in one of these files is not a style nit —
 *     it is the exact defect being migrated away from, reintroduced. A scan is
 *     the only thing that catches it, because a hardcoded colour renders
 *     perfectly happily in whichever scheme it happened to be written for.
 *
 *  2. PURE HELPERS. Each component pushes its one real decision (clamping,
 *     the variant table, state precedence, which glyph closes a row) into an
 *     exported function, so the rule can be asserted directly instead of being
 *     inferred from a rendered tree.
 *
 *  3. RENDER SMOKE TESTS, for the accessibility contract only. Layout is
 *     verified on device; what is asserted here is what a screen reader is
 *     told, which is invisible in a screenshot and silently lost in a refactor.
 */

import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import TestRenderer, { type ReactTestInstance } from 'react-test-renderer';

import { ui2Dark, ui2Light, type Ui2Palette } from '../../config/theme';
import { Ui2Header } from './Ui2Header';
import { Ui2ProgressBar, clampProgress } from './Ui2ProgressBar';
import { Ui2Badge, badgeColors, type Ui2BadgeVariant } from './Ui2Badge';
import { Ui2EmptyState } from './Ui2EmptyState';
import { Ui2InlineError } from './Ui2InlineError';
import { scrimColor } from './Ui2Sheet';
import { Ui2Input, inputSurface } from './Ui2Input';
import { Ui2ListRow, trailingGlyph } from './Ui2ListRow';

// The icon set resolves its font asynchronously and setState()s after the
// assertion has already run. Nothing here depends on the glyph shape — only on
// the NAME the component chose, which survives this substitution.
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

// `useMotion` -> `lib/motion-preference` reaches for the native AsyncStorage
// module, which does not exist under jest. Every primitive that animates pulls
// it in transitively.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(async () => {}),
    getItem: jest.fn(async () => null),
    removeItem: jest.fn(async () => {}),
  },
}));

// Reanimated has no worklet runtime under the test renderer. This stands in
// the shape the components actually use: a shared value is a plain box, an
// animated style is its factory evaluated once, and a spring settles instantly.
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (initial: number) => ({ value: initial }),
    useAnimatedStyle: (factory: () => unknown) => factory(),
    withSpring: (to: number) => to,
    FadeInDown: { delay: () => ({ duration: () => ({}) }) },
  };
});

const DIR = __dirname;
const FILES = [
  'Ui2Header.tsx',
  'Ui2ProgressBar.tsx',
  'Ui2Badge.tsx',
  'Ui2EmptyState.tsx',
  'Ui2InlineError.tsx',
  'Ui2Sheet.tsx',
  'Ui2Input.tsx',
  'Ui2ListRow.tsx',
];

/**
 * Strip comments before scanning — the same lesson as the `setAudioModeAsync`
 * gate in `lib/audio-session.test.ts`. Every file here explains WHY the old
 * component's hardcoded `#7DD3FC` / `#818CF8` was wrong, and a scan that
 * punished a file for naming the colour it removed would teach people to stop
 * writing the explanation. Match code, not prose.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // block comments, including JSDoc
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 '); // line comments, but not the // in a URL
}

function codeOf(file: string): string {
  return stripComments(fs.readFileSync(path.join(DIR, file), 'utf8'));
}

const HEX = /#[0-9a-fA-F]{3,8}\b/;

describe('no hardcoded colour survives in the UI 2.0 primitives', () => {
  it.each(FILES)('%s contains no hex literal', (file) => {
    const offending = codeOf(file)
      .split('\n')
      .map((line, i) => ({ line: line.trim(), n: i + 1 }))
      .filter(({ line }) => HEX.test(line));
    expect(offending).toEqual([]);
  });

  it.each(FILES)('%s does not import the Dark Glow palette', (file) => {
    // `colors` is the old dark-only object. Importing it here is how a screen
    // ends up near-white on white the moment the OS is set to light.
    expect(codeOf(file)).not.toMatch(/import\s*\{[^}]*\bcolors\b[^}]*\}\s*from\s*'\.\.\/\.\.\/config\/theme'/);
  });

  it('still catches a real hex, so the gate has not been softened into uselessness', () => {
    // Loosening a guard is only safe if you prove it still bites.
    for (const violation of [
      "shadowColor: '#818CF8',",
      '<Ionicons color="#7DD3FC" />',
      'const bg = `#fff`;',
    ]) {
      expect(HEX.test(stripComments(violation))).toBe(true);
    }
    // And these must not trip it: the explanation, and a non-colour hash.
    for (const innocent of [
      '// the old one hardcoded #7DD3FC, which only works on the dark ground',
      '/** `primary` (#6A4CFF) is 4.4:1 there, just under AA. */',
      'accessibilityLabel={`Step #${step}`}',
    ]) {
      expect(HEX.test(stripComments(innocent))).toBe(false);
    }
  });
});

describe('clampProgress', () => {
  it('passes an in-range value through', () => {
    expect(clampProgress(0)).toBe(0);
    expect(clampProgress(0.42)).toBe(0.42);
    expect(clampProgress(1)).toBe(1);
  });

  it('clamps out-of-range values instead of throwing', () => {
    expect(clampProgress(-3)).toBe(0);
    expect(clampProgress(1.5)).toBe(1);
  });

  it('maps a non-finite value to 0', () => {
    // `done / total` with total still 0 on the first render is the real source
    // of this — a NaN width collapses the fill silently rather than erroring.
    expect(clampProgress(0 / 0)).toBe(0);
    expect(clampProgress(1 / 0)).toBe(0);
  });
});

const SCHEMES: [name: string, palette: Ui2Palette][] = [
  ['light', ui2Light],
  ['dark', ui2Dark],
];

describe('badgeColors', () => {
  const VARIANTS: Ui2BadgeVariant[] = ['primary', 'success', 'warning'];

  it.each(SCHEMES)('every variant resolves to palette values in %s', (_name, c) => {
    const palette = new Set(Object.values(c));
    for (const variant of VARIANTS) {
      const { bg, border, text } = badgeColors(c, variant);
      expect(palette.has(bg)).toBe(true);
      expect(palette.has(border)).toBe(true);
      expect(palette.has(text)).toBe(true);
    }
  });

  it.each(SCHEMES)('never puts the saturated fill colour on its own tint in %s', (_name, c) => {
    // `green` on `greenTint` is roughly 2:1 — legible as a 20px fill, not as
    // 13px type. Only `primary` has a purpose-built on-tint colour.
    expect(badgeColors(c, 'success').text).not.toBe(c.green);
    expect(badgeColors(c, 'warning').text).not.toBe(c.yellow);
    expect(badgeColors(c, 'primary').text).toBe(c.onTint);
  });

  it.each(SCHEMES)('gives each variant a distinguishable fill in %s', (_name, c) => {
    const fills = VARIANTS.map((v) => badgeColors(c, v).bg);
    expect(new Set(fills).size).toBe(VARIANTS.length);
  });

  it('falls back to primary for an unknown variant', () => {
    // Variants arrive from data in a few places; an unrecognised one must
    // still render something readable rather than an undefined background.
    const rogue = 'danger' as Ui2BadgeVariant;
    expect(badgeColors(ui2Light, rogue)).toEqual(badgeColors(ui2Light, 'primary'));
  });
});

/** WCAG relative luminance, so "is this scrim actually dark" is measured. */
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const channels = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe('scrimColor', () => {
  it('is dark in both schemes', () => {
    expect(luminance(scrimColor('light', ui2Light))).toBeLessThan(0.1);
    expect(luminance(scrimColor('dark', ui2Dark))).toBeLessThan(0.1);
  });

  it('does not reach for `ink` in dark, where ink is near-white', () => {
    // The trap: `ink` is the obvious "dark colour" in light mode and inverts
    // in dark mode, while `opacity` does not care. Picking it in both schemes
    // paints a white veil over a dark app.
    expect(scrimColor('dark', ui2Dark)).not.toBe(ui2Dark.ink);
    expect(scrimColor('light', ui2Light)).toBe(ui2Light.ink);
  });
});

describe('inputSurface precedence', () => {
  const c = ui2Light;

  it('shows the focus ring only when focused, valid and editable', () => {
    expect(inputSurface(c, { focused: true, invalid: false, disabled: false }).border).toBe(c.primary);
    expect(inputSurface(c, { focused: false, invalid: false, disabled: false }).border).toBe(c.cardBorder);
  });

  it('keeps an invalid field red even while the caret is in it', () => {
    expect(inputSurface(c, { focused: true, invalid: true, disabled: false }).border).toBe(c.error);
  });

  it('lets disabled outrank everything', () => {
    // A read-only field must never claim focus or report an error state it
    // gives the user no way to fix.
    const s = inputSurface(c, { focused: true, invalid: true, disabled: true });
    expect(s.border).toBe(c.cardBorder);
    expect(s.bg).toBe(c.surface2);
  });
});

describe('trailingGlyph', () => {
  it('offers no affordance on a row that cannot be tapped', () => {
    expect(trailingGlyph('button', false)).toBeNull();
    expect(trailingGlyph('link', false)).toBeNull();
  });

  it('matches the glyph to the role', () => {
    expect(trailingGlyph('button', true)).toBe('chevron-forward');
    expect(trailingGlyph('link', true)).toBe('open-outline');
  });
});

/* ── Render smoke tests: the accessibility contract ─────────────────────── */

function render(element: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer;
}

/** Host (not composite) nodes only — a composite and the host it renders both
 *  carry the same props, so an unfiltered findAll doubles every match. */
function hosts(
  renderer: TestRenderer.ReactTestRenderer,
  predicate: (node: ReactTestInstance) => boolean,
): ReactTestInstance[] {
  return renderer.root.findAll((n) => typeof n.type === 'string' && predicate(n));
}

function byLabel(renderer: TestRenderer.ReactTestRenderer, label: string) {
  return hosts(renderer, (n) => n.props?.accessibilityLabel === label);
}

/**
 * The one node a user can actually press. A Pressable renders as a composite
 * plus a host View and both carry the label, so the handler is what tells them
 * apart — the same trick `components/reading/tappable-text.test.tsx` uses.
 */
function pressableByLabel(renderer: TestRenderer.ReactTestRenderer, label: string): ReactTestInstance[] {
  return renderer.root.findAll(
    (n) => n.props?.accessibilityLabel === label && typeof n.props?.onPress === 'function',
    { deep: true },
  );
}

function press(node: ReactTestInstance) {
  TestRenderer.act(() => {
    node.props.onPress();
  });
}

function texts(renderer: TestRenderer.ReactTestRenderer): string[] {
  return renderer.root
    .findAll((n) => String(n.type) === 'Text')
    .flatMap((n) => n.children.filter((ch): ch is string => typeof ch === 'string'));
}

describe('Ui2Header', () => {
  it('labels the back control and fires it', () => {
    const onBack = jest.fn();
    const r = render(<Ui2Header title="Settings" onBack={onBack} />);
    const [back] = pressableByLabel(r, 'Back');
    expect(back).toBeTruthy();
    expect(back.props.accessibilityRole).toBe('button');
    press(back);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders no back control when onBack is absent', () => {
    const r = render(<Ui2Header title="Settings" />);
    expect(pressableByLabel(r, 'Back')).toHaveLength(0);
  });

  it('renders the subtitle alongside the title', () => {
    const r = render(<Ui2Header title="Settings" subtitle="Account and preferences" />);
    expect(texts(r)).toEqual(expect.arrayContaining(['Settings', 'Account and preferences']));
  });
});

describe('Ui2ProgressBar', () => {
  it('announces a percentage, clamped', () => {
    const r = render(<Ui2ProgressBar progress={1.4} accessibilityLabel="Lesson progress" />);
    const [bar] = byLabel(r, 'Lesson progress');
    expect(bar.props.accessibilityRole).toBe('progressbar');
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 100 });
  });
});

describe('Ui2Badge', () => {
  it('always carries its label as text, so status is never colour-only', () => {
    const r = render(<Ui2Badge label="B1" variant="success" />);
    expect(texts(r)).toContain('B1');
  });
});

describe('Ui2EmptyState', () => {
  it('renders the action when both halves are given', () => {
    const onAction = jest.fn();
    const r = render(
      <Ui2EmptyState icon="book" title="No books yet" description="Add one to start." actionLabel="Add a book" onAction={onAction} />,
    );
    const [button] = pressableByLabel(r, 'Add a book');
    expect(button.props.accessibilityRole).toBe('button');
    press(button);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('renders no action when only the label is given', () => {
    // Mirrors the old component: a labelled button with no handler is worse
    // than no button, and a screen relying on that must keep behaving.
    const r = render(<Ui2EmptyState icon="book" title="No books yet" description="Add one." actionLabel="Add a book" />);
    expect(pressableByLabel(r, 'Add a book')).toHaveLength(0);
  });
});

describe('Ui2InlineError', () => {
  it('shows both lines of copy and a labelled retry', () => {
    const onRetry = jest.fn();
    const r = render(
      <Ui2InlineError copy={{ title: 'You are offline', message: 'Reconnect and try again.' }} onRetry={onRetry} />,
    );
    expect(texts(r)).toEqual(expect.arrayContaining(['You are offline', 'Reconnect and try again.', 'Try again']));
    const [retry] = pressableByLabel(r, 'Try again');
    press(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('honours a custom retry label', () => {
    const r = render(
      <Ui2InlineError copy={{ title: 'Nope', message: 'Nope.' }} onRetry={jest.fn()} retryLabel="Reload" />,
    );
    expect(pressableByLabel(r, 'Reload')).toHaveLength(1);
  });
});

describe('Ui2Input', () => {
  it('names the field from its label when no explicit a11y label is given', () => {
    const r = render(<Ui2Input label="Display name" value="" onChangeText={jest.fn()} />);
    expect(byLabel(r, 'Display name')).toHaveLength(1);
  });

  it('replaces the helper with the error, and pairs the error with a glyph', () => {
    const r = render(
      <Ui2Input label="Email" helper="We never share this" error="That is not an email" value="x" onChangeText={jest.fn()} />,
    );
    const shown = texts(r);
    expect(shown).toContain('That is not an email');
    expect(shown).not.toContain('We never share this');
    // The glyph is what keeps the error from being a red outline and nothing
    // else — a colour-only signal.
    expect(hosts(r, (n) => String(n.type) === 'Ionicons' && n.props?.name === 'alert-circle').length).toBeGreaterThan(0);
  });

  it('marks a non-editable field disabled to assistive tech', () => {
    const r = render(<Ui2Input label="Email" editable={false} value="a@b.c" onChangeText={jest.fn()} />);
    const [field] = byLabel(r, 'Email');
    expect(field.props.accessibilityState).toEqual({ disabled: true });
  });
});

describe('Ui2ListRow', () => {
  it('announces a tappable row as a button and includes the subtitle', () => {
    const onPress = jest.fn();
    const r = render(<Ui2ListRow title="Privacy Policy" subtitle="Opens in your browser" onPress={onPress} />);
    const [row] = pressableByLabel(r, 'Privacy Policy. Opens in your browser');
    expect(row.props.accessibilityRole).toBe('button');
    press(row);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('announces a link row as a link', () => {
    const r = render(<Ui2ListRow title="Terms of Service" role="link" onPress={jest.fn()} />);
    const [row] = pressableByLabel(r, 'Terms of Service');
    expect(row.props.accessibilityRole).toBe('link');
  });

  it('is not focusable at all when it has no handler', () => {
    // The old settings rows wrapped everything in a Pressable, so a read-only
    // row still announced as a button and promised a tap that did nothing.
    const r = render(<Ui2ListRow title="App version" subtitle="1.4.0" />);
    expect(hosts(r, (n) => n.props?.accessibilityRole === 'button')).toHaveLength(0);
  });

  it('does not tap through when disabled', () => {
    const onPress = jest.fn();
    const r = render(<Ui2ListRow title="Delete account" destructive disabled onPress={onPress} />);
    expect(hosts(r, (n) => n.props?.accessibilityRole === 'button')).toHaveLength(0);
    // Destructive still says what it does in words, not only in red.
    expect(texts(r)).toContain('Delete account');
  });
});
