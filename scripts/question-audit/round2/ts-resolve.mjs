/**
 * `lib/grading.ts` imports `./confusable-pairs` without an extension, which
 * Node's type stripping does not resolve on its own. This adds the extension
 * and nothing else, so the runtime check runs the SHIPPED grader rather than a
 * copy of it. Used only by `runtime-round2.mjs`; the SQL rehearsal needs none of it.
 */
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  try { return await next(specifier, context); }
  catch (error) {
    if (specifier.startsWith('.') && !/\\.[cm]?[jt]sx?$/.test(specifier)) {
      for (const extension of ['.ts', '.tsx', '/index.ts']) {
        try { return await next(specifier + extension, context); } catch {}
      }
    }
    throw error;
  }
}
`), pathToFileURL('./'));
