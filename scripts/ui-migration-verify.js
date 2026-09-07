/**
 * Compare two behavioural skeletons and decide whether a UI migration changed
 * anything that can affect runtime behaviour.
 *
 * `ui-migration-skeleton.js` already excludes `style`, `className` and `color`
 * as JSX ATTRIBUTES. But render-prop bodies (`renderItem`, `ListEmptyComponent`)
 * are captured wholesale, so cosmetic edits nested inside them still show up.
 * This strips those from both sides before comparing.
 *
 * The one sanctioned non-cosmetic change is adding `const { c } = useUi2Theme();`
 * at the TOP of a component — unconditional, so hook order stays consistent.
 * Anything else it reports is a real behavioural difference: a moved handler, a
 * changed dependency array, a dropped accessibility prop.
 *
 *   node scripts/ui-migration-verify.js before.txt after.txt
 */
const fs = require('fs');

// Any destructuring of the theme hook is the sanctioned insertion — a screen
// that also needs the scheme (to pick a StatusBar style) writes `{ c, scheme }`.
const HOOK = /const \{[^}]*\} = useUi2Theme\(\);\s*/;

/**
 * Component swaps sanctioned by DESIGN.md's migration table. These are element
 * NAME changes with identical children, so they are cosmetic — but the skeleton
 * captures render-prop bodies wholesale, so they surface as differences unless
 * normalised here.
 */
const SWAPS = [
  [/GlassSurface/g, 'SlabCard'], [/GradientBorderCard/g, 'SlabCard'],
  [/GlassCard/g, 'SlabCard'], [/\bSurface\b/g, 'SlabCard'], [/\bCard\b/g, 'SlabCard'],
  [/GradientBackground/g, 'View'], [/GlowBackground/g, 'View'],
  [/TactileButton/g, 'SlabButton'], [/GradientButton/g, 'SlabButton'],
  [/\bButton\b/g, 'SlabButton'],
  [/ScreenHeader/g, 'Ui2Header'], [/ProgressBar/g, 'Ui2ProgressBar'],
  [/\bBadge\b/g, 'Ui2Badge'], [/EmptyState/g, 'Ui2EmptyState'],
  [/InlineError/g, 'Ui2InlineError'], [/\bSheet\b/g, 'Ui2Sheet'],
];

function stripCosmetic(t) {
  for (const [re, to] of SWAPS) t = t.replace(re, to);
  return t
    // Non-greedy to the CLOSING double brace. A `[^}]*` class stops at the first
    // `}` and leaves a stray brace behind, which silently breaks the comparison.
    .replace(/style=\{\{[\s\S]*?\}\}/g, '')
    // Also the single-brace and string forms: `style={cond ? 'a' : 'b'}` on a
    // StatusBar, `style="light"`. Function bodies are captured wholesale, so a
    // cosmetic style inside one still reaches this comparison.
    .replace(/style=\{[^{}]*\}/g, '')
    .replace(/style="[^"]*"/g, '')
    .replace(/className="[^"]*"/g, '')
    .replace(/color=\{[^}]*\}/g, '')
    .replace(/color="#[0-9A-Fa-f]{3,8}"/g, '')
    .replace(/\s+/g, ' ')
    // Removing an attribute leaves `<View >` where the other side has `<View>`.
    // Collapse that, or every swapped element reads as a difference.
    .replace(/\s+>/g, '>')
    .replace(/\s+\/>/g, '/>')
    .trim();
}

const before = fs.readFileSync(process.argv[2], 'utf8').split('\n');
const after = fs.readFileSync(process.argv[3], 'utf8').split('\n');

if (before.length !== after.length) {
  console.log(`FAIL: item count changed ${before.length} -> ${after.length}`);
  process.exit(1);
}

const unexplained = [];
for (let i = 0; i < before.length; i++) {
  const b = stripCosmetic(before[i]);
  // Allow the hook insertion, anywhere it appears, once per item.
  const a = stripCosmetic(after[i]).replace(HOOK, '');
  if (a !== b) unexplained.push({ i, b, a });
}

if (unexplained.length === 0) {
  console.log(`PASS: ${before.length} behavioural items, every difference is cosmetic or the useUi2Theme hook`);
  process.exit(0);
}
console.log(`FAIL: ${unexplained.length} unexplained behavioural difference(s)`);
for (const u of unexplained.slice(0, 3)) {
  console.log(`\n--- item ${u.i} ---\n  before: ${u.b.slice(0, 300)}\n  after : ${u.a.slice(0, 300)}`);
}
process.exit(1);
