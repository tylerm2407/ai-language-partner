/**
 * Source guard: no callback-form `style` on a Pressable.
 *
 * React Native supports `style={({ pressed }) => [...]}`. NativeWind (v4)
 * wraps Pressable for its className interop and silently drops that form —
 * no error, no warning, the styles just never reach the view. A row written
 * that way renders with no background, no padding and no flexDirection, so
 * its children stack vertically.
 *
 * This is a source check rather than a render test on purpose: this exact bug
 * shipped to the simulator with a green suite behind it, because
 * react-test-renderer invokes the style function itself and sees correct
 * props. Only the real NativeWind-wrapped component drops it, so no unit test
 * of a component can catch the class. Scanning the source can.
 *
 * The fix is hooks/usePressed.ts — a plain boolean plus an array style.
 */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');

function sourceFiles(): string[] {
  // Tracked files only: node_modules and build output are irrelevant, and
  // git already knows what belongs to the project.
  const out = execSync('git ls-files "app/**/*.tsx" "components/**/*.tsx" "hooks/**/*.tsx"', {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return out.split('\n').filter(Boolean);
}

describe('no callback-form style props', () => {
  it('finds source files to scan', () => {
    // A guard that silently scans nothing is worse than no guard.
    expect(sourceFiles().length).toBeGreaterThan(20);
  });

  it('never passes a function to a style prop', () => {
    const pattern = /style=\{\s*\(/;
    const offenders: string[] = [];

    for (const file of sourceFiles()) {
      const contents = readFileSync(resolve(ROOT, file), 'utf8');
      contents.split('\n').forEach((line, i) => {
        if (pattern.test(line)) offenders.push(`${file}:${i + 1}  ${line.trim()}`);
      });
    }

    expect(offenders).toEqual([]);
  });
});
