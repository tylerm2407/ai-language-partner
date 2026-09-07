/**
 * The UI 2.0 migration, enforced.
 *
 * Every screen was moved off the Dark Glow palette so the app can follow the
 * phone's light/dark setting. The failure this guards against is not a crash —
 * it is a screen that reads `colors.*` (a FIXED DARK palette) or a hardcoded
 * hex, looks perfectly fine on a developer's dark phone, and renders as
 * grey-on-grey or a black slab for a user in light mode. Nobody notices until
 * someone complains, because the person who wrote it never saw it.
 *
 * So the rule is mechanical rather than aesthetic: colour comes from
 * `useUi2Theme()` and nowhere else.
 *
 * SCOPE IS THE WHOLE POINT, AND IT WAS WRONG ONCE. An earlier version of this
 * file scanned `app`, `components/ui2` and `components/tutor` and passed — while
 * 82 files under `components/` were still on Dark Glow. The first symptom was a
 * sign-in screen that went light except the password field, which stayed black:
 * `components/auth/PasswordField.tsx` had never been migrated, and the guard had
 * never looked at it. A suite that passes because it scanned the wrong place is
 * worse than no suite, because it is trusted. Hence: `app` and `components`
 * entire, no directory allowlist.
 *
 * COMMENTS ARE STRIPPED FIRST, and that is load-bearing. During this migration
 * three separate checks cried wolf on prose — a comment saying "there is no
 * `require()` here", another documenting the old `'#94A3B8'` fallback, a third
 * naming `Audio.setAudioModeAsync` to say it is never called. A guard that
 * cannot tell code from commentary teaches people to delete the commentary,
 * which is the opposite of what it is for.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..');

/** `colors.*` is banned everywhere: it is the fixed DARK palette and nothing
 *  should read it any more. */
const SCANNED_FOR_COLORS = ['app', 'components'];

/**
 * Hardcoded hex is banned everywhere EXCEPT inside the design system.
 *
 * That distinction is principled rather than an exemption of convenience.
 * `components/ui2` is where colour is DEFINED, and two legitimate kinds of
 * literal live there: the mascot's character art, which keeps its colours in
 * both schemes because a mascot does not change colour, and contrast-on-fill
 * values like a white checkmark on an accent fill or dark ink on a yellow tint
 * — those are fixed precisely because the fill they sit on is fixed.
 *
 * Nothing else has that excuse. A component that names a colour has pinned one
 * scheme and will be wrong in the other.
 */
const SCANNED_FOR_HEX = ['app', 'components'];
const HEX_EXEMPT = ['components/ui2'];

/** `config/theme` is still the token home — `ui2Light`, `ui2Dark`, `ui2Type`,
 *  `ui2Shape` and the `Ui2Palette` type all live there, and `spacing`/`radii`
 *  are plain scheme-independent numbers. Only the fixed DARK `colors` export is
 *  forbidden. */
const FORBIDDEN_COLORS = /\bcolors\s*\./;
const HEX = /#[0-9A-Fa-f]{6}\b/;

/**
 * The third way to pin a colour, and the one neither check above can see.
 *
 * `tailwind.config.js` mirrors the OLD Dark Glow palette — `dark-card` is
 * `#151921`, `text-primary` is `#F1F5F9`. So `className="bg-dark-card"` is a
 * hardcoded near-black with no `colors.` and no hex anywhere in the file. Two
 * `components/stats` files were fully dark-pinned this way while reading
 * completely clean, and one live pair survived in the chat screen's toolbar
 * until an agent reported it by hand.
 *
 * Width and layout utilities are untouched — `border-b` and `px-3` do not name
 * a colour. Only the palette keys below do.
 */
const TAILWIND_COLOUR_KEYS = [
  'dark', 'dark-raised', 'dark-card', 'dark-card-alt', 'dark-border',
  'accent-blue', 'accent-purple', 'accent-pink', 'accent-violet', 'accent-amber',
  'gradient-start', 'gradient-end', 'primary', 'success', 'error', 'warning',
  'flame', 'surface', 'border', 'input-border',
  'text-primary', 'text-secondary', 'text-tertiary', 'text-quaternary',
].join('|');
const TAILWIND_PINNED = new RegExp(
  '\\b(bg|text|border|from|to|via|ring|fill|stroke|decoration|placeholder|divide|shadow)-(' +
    TAILWIND_COLOUR_KEYS +
    ')(-[a-z]+)?\\b'
);

function sourceFiles(dir: string, exempt: string[] = []): string[] {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  const exemptAbs = exempt.map((e) => path.join(ROOT, e));
  const out: string[] = [];
  const walk = (d: string) => {
    if (exemptAbs.includes(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(full);
    }
  };
  walk(abs);
  return out;
}

/** Strip BLOCK comments and LINE comments. Both, or the guard fires on prose. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

describe('UI 2.0 migration is complete and stays complete', () => {
  const colorFiles = SCANNED_FOR_COLORS.flatMap((d) => sourceFiles(d));
  const hexFiles = SCANNED_FOR_HEX.flatMap((d) => sourceFiles(d, HEX_EXEMPT));

  it('scans the whole of app/ and components/, not a hand-picked subset', () => {
    // The bug this file exists to catch once hid behind a three-directory
    // allowlist. These floors are set just under the real counts so that
    // dropping a directory from the scan fails LOUDLY rather than passing.
    expect(colorFiles.length).toBeGreaterThan(180);
    expect(hexFiles.length).toBeGreaterThan(160);
    // And the exemption is a directory, not a back door that swallowed the scan.
    expect(colorFiles.length - hexFiles.length).toBeLessThan(40);
  });

  it('nothing reads the fixed dark `colors` palette', () => {
    const offenders = colorFiles
      .filter((f) => FORBIDDEN_COLORS.test(stripComments(fs.readFileSync(f, 'utf8'))))
      .map((f) => path.relative(ROOT, f));
    expect(offenders).toEqual([]);
  });

  it('nothing outside the design system hardcodes a hex colour', () => {
    const offenders = hexFiles
      .filter((f) => HEX.test(stripComments(fs.readFileSync(f, 'utf8'))))
      .map((f) => path.relative(ROOT, f));
    expect(offenders).toEqual([]);
  });

  it('nothing pins a colour through a NativeWind class', () => {
    const offenders = colorFiles
      .filter((f) => TAILWIND_PINNED.test(stripComments(fs.readFileSync(f, 'utf8'))))
      .map((f) => path.relative(ROOT, f));
    expect(offenders).toEqual([]);
  });

  it('the guard still bites — it is not passing because the regexes are dead', () => {
    // Loosening a check is only safe if you prove it still catches the thing.
    expect(FORBIDDEN_COLORS.test(stripComments('const x = colors.text.primary;'))).toBe(true);
    expect(HEX.test(stripComments('const x = "#08090F";'))).toBe(true);
    // ...and still ignores prose, in both comment forms.
    expect(FORBIDDEN_COLORS.test(stripComments('// never use colors.text here'))).toBe(false);
    expect(HEX.test(stripComments('/* the old default was #94A3B8 */'))).toBe(false);
    expect(HEX.test(stripComments('/*\n * documenting #FFFFFF in a block comment\n */'))).toBe(false);
    // The NativeWind check catches palette keys and leaves layout alone.
    expect(TAILWIND_PINNED.test('className="bg-dark-card rounded-full"')).toBe(true);
    expect(TAILWIND_PINNED.test('className="text-text-primary"')).toBe(true);
    expect(TAILWIND_PINNED.test('className="flex-row px-3 border-b min-h-9"')).toBe(false);
    expect(TAILWIND_PINNED.test(stripComments('// was `bg-primary` before'))).toBe(false);
  });

  it('the hex exemption covers the design system and nothing else', () => {
    // If someone adds a directory to HEX_EXEMPT, this fails until they say so
    // here — which is the conversation worth forcing.
    expect(HEX_EXEMPT).toEqual(['components/ui2']);
    const scanned = hexFiles.map((f) => path.relative(ROOT, f));
    expect(scanned.some((f) => f.startsWith('components/ui2/'))).toBe(false);
    expect(scanned.some((f) => f.startsWith('components/ui/'))).toBe(true);
  });
});
