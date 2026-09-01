/**
 * Source guard: nothing reaches `reading_annotations`.
 *
 * The table was dropped in migration 094. It had 0 rows in production and no
 * writer anywhere in the repo, and its single reader decided which words the
 * passage viewer made tappable — so the answer was always "none" and every
 * one of the 126 passages rendered as untappable text. Help is on demand now
 * (lib/word-lookup.ts).
 *
 * This is a guard rather than just a deletion because a re-added query would
 * typecheck cleanly, pass every unit test, and fail only at runtime against
 * production, as a Postgres error swallowed into an empty annotation list —
 * which is indistinguishable from the state it was already in.
 *
 * Migration files are exempt: 003 and 012 are a record of what was applied and
 * must not be rewritten, and 094 has to name the table in order to drop it.
 * Comments are exempt too — explaining why a table is gone is the opposite of
 * reaching for it, and stripping them is what lets that explanation stay next
 * to the code it explains.
 */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');

/** Source with comments blanked out, so prose about the table does not trip
 *  the guard. Crude on purpose: it only has to be right about `//` and `/* *\/`,
 *  and a string literal containing one of those would at worst hide a line
 *  that the other two checks would still catch. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

function scannedSources(): string[] {
  // Directories are listed and filtered here rather than passed as a glob:
  // `git ls-files "lib/**/*.ts"` matches NOTHING, because git's `**` wants an
  // intervening directory — see lib/owned-card-inserts.test.ts for the time
  // that shipped.
  const out = execSync('git ls-files app components hooks lib stores supabase/functions', {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return out
    .split('\n')
    .filter(Boolean)
    .filter((f) => /\.tsx?$/.test(f))
    .filter((f) => !/\.test\.tsx?$/.test(f));
}

describe('reading_annotations is gone', () => {
  it('actually scans the files that used to reach it', () => {
    const files = scannedSources();
    expect(files.length).toBeGreaterThan(50);
    expect(files).toContain('lib/supabase-queries.ts');
    expect(files).toContain('hooks/useReadingPassage.ts');
    expect(files).toContain('components/reading/ReadingPassageViewer.tsx');
  });

  it('no source file names the dropped table', () => {
    const offenders: string[] = [];
    for (const file of scannedSources()) {
      const src = stripComments(readFileSync(resolve(ROOT, file), 'utf8'));
      const index = src.indexOf('reading_annotations');
      if (index !== -1) {
        offenders.push(`${file}:${src.slice(0, index).split('\n').length}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no source file declares a ReadingAnnotation type', () => {
    const offenders: string[] = [];
    for (const file of scannedSources()) {
      // The replacement is WordLookup (types/index.ts), which describes a
      // meaning however it was obtained rather than a row of a dead table.
      const src = stripComments(readFileSync(resolve(ROOT, file), 'utf8'));
      if (/\bReadingAnnotation\b/.test(src)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
