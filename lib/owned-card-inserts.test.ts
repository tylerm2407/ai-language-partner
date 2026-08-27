/**
 * Source guard: every client-side insert into `cards` carries `user_id`.
 *
 * `public.cards` holds two kinds of row: shared curriculum (`user_id IS NULL`,
 * written by the service role) and learner-authored cards. Migration 088 gates
 * the client INSERT on `WITH CHECK (user_id = auth.uid())`, so an insert that
 * omits the column is refused by RLS.
 *
 * The reason this is a guard and not just a fix: the three features that write
 * here — save a word from a book, from a passage, and save a chat correction —
 * were ALL broken for the entire life of the product, and nobody noticed,
 * because every call site swallowed the error into a `console.warn` or a bare
 * `catch { return null }`. The button appeared to work. A missing `user_id` is
 * invisible at runtime and invisible to typecheck (the column is nullable in
 * the generated row type, because curriculum rows legitimately have none), so
 * scanning the source is the only thing that catches a regression here.
 *
 * If you are adding a genuinely unowned card, do it from an edge function with
 * the service role — not from the client.
 */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');

function clientSources(): string[] {
  // Tracked client code only. `supabase/` is Deno/service-role and is
  // deliberately allowed to write curriculum rows with no owner.
  //
  // Directories are listed and filtered here rather than passed as a glob:
  // `git ls-files "lib/**/*.ts"` matches NOTHING, because git's `**` wants an
  // intervening directory, so a glob like that silently scans zero files and
  // the guard passes for the wrong reason. That is not hypothetical — the
  // first draft of this file shipped with exactly that bug.
  const out = execSync('git ls-files app components hooks lib stores', {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return out
    .split('\n')
    .filter(Boolean)
    .filter((f) => /\.tsx?$/.test(f))
    .filter((f) => !/\.test\.tsx?$/.test(f));
}

describe('learner-authored cards are owned', () => {
  it('actually scans the files that write cards', () => {
    // A guard that silently scans nothing is worse than no guard, so anchor on
    // the specific files that own the write paths — not just a count.
    const files = clientSources();
    expect(files.length).toBeGreaterThan(50);
    expect(files).toContain('lib/supabase-queries.ts');
    expect(files).toContain('app/(app)/learn/reading/book/[bookId].tsx');
  });

  it("every client .from('cards').insert() sets user_id", () => {
    const offenders: string[] = [];

    for (const file of clientSources()) {
      const src = readFileSync(resolve(ROOT, file), 'utf8');
      // Walk each `.from('cards')` and look at the insert payload that follows.
      const re = /\.from\(\s*['"]cards['"]\s*\)\s*\n?\s*\.insert\(/g;
      let m: RegExpExecArray | null;

      while ((m = re.exec(src)) !== null) {
        // Take the balanced argument list of the .insert( call.
        let depth = 1;
        let i = m.index + m[0].length;
        while (i < src.length && depth > 0) {
          if (src[i] === '(') depth++;
          else if (src[i] === ')') depth--;
          i++;
        }
        const payload = src.slice(m.index + m[0].length, i - 1);
        if (!/\buser_id\s*:/.test(payload)) {
          const line = src.slice(0, m.index).split('\n').length;
          offenders.push(`${file}:${line}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
