/**
 * Round-4 patch compiler. Exact-ID edits only, never a semantic reviewer.
 *
 * Round one is applied, so `scripts/question-audit/patch-set.mjs` is pinned to a
 * database that no longer exists. That file is left byte-identical as the
 * historical record of what shipped; this one pins the CURRENT snapshot and
 * reuses round one's `renderPatchSql` / `renderReverseSql` unchanged, so the
 * emitted SQL — guards, atomicity, idempotence, rollback — is literally the
 * same code that was rehearsed and deployed.
 *
 * The only part that could not be reused is `createPatchSet`, whose snapshot
 * path and hash are module constants. It is re-implemented here WITHOUT insert
 * support: round two authors no new rows, and a capability nothing uses is a
 * capability nobody re-tests.
 */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
export { renderPatchSql, renderReverseSql } from '../patch-set.mjs';

export const SNAPSHOT_FILE = '.question-audit/snapshot-b758c2a2ae07.json';
export const SNAPSHOT_SHA = 'b758c2a2ae0797fbdd97402c94ad2a0a872130f3a143c89c6a647dfb6b2b5718';

/** The same table allowlist as round one, and the same immutable columns. */
const allowedTables = ['courses', 'units', 'lessons', 'exercises', 'cards', 'grammar_rules', 'writing_prompts', 'reading_passages', 'reading_questions', 'checkpoint_items'];
const immutable = new Set(['id', 'created_at', 'user_id']);
/** Carried on every patch so the apply can confirm it has the right row. The
 * reverse deliberately does not write these back; see renderReverseSql. */
const identity = ['lesson_id', 'course_id', 'passage_id', 'unit_id', 'language', 'band', 'cefr_level', 'type', 'strand', 'question_type'];

export async function createRound4PatchSet({ file = SNAPSHOT_FILE } = {}) {
  const raw = await readFile(file);
  if (createHash('sha256').update(raw).digest('hex') !== SNAPSHOT_SHA) throw new Error('Frozen snapshot hash mismatch');
  const snapshot = JSON.parse(raw);
  const patchMap = new Map();
  const row = (table, id) => {
    if (!allowedTables.includes(table)) throw new Error(`Out-of-scope table: ${table}`);
    const matches = snapshot[table].filter(r => r.id === id);
    if (matches.length !== 1) throw new Error(`Expected exactly one ${table}/${id}, found ${matches.length}`);
    return matches[0];
  };
  /**
   * The one thing a speaking row may receive: a correction that changes only
   * letter case.
   *
   * Speaking is excluded from this audit end to end, and the rule above is what
   * enforces that. But the exclusion has produced a worse artefact than it
   * prevented: the de B1 `Würde` cluster is corrected on five surfaces and left
   * wrong on the one speaking row, and the next reader will take the odd one out
   * for a deliberate choice. It is not.
   *
   * This exception is deliberately too narrow to reintroduce speaking content.
   * Every field written must be a string, must already exist, and must be equal
   * to its new value under `toLowerCase()` — so it can fix a capital letter and
   * can do nothing else. It cannot change a word, add an accepted answer, retime
   * audio, or touch a pronunciation score. What is spoken is unchanged, because
   * text-to-speech reads the same word either way, and grading is unchanged,
   * because `normalize()` lowercases before comparing.
   */
  const sameButForCase = (before, value) =>
    typeof value === 'string' && typeof before === 'string' &&
    value.toLowerCase() === before.toLowerCase();

  const caseOnly = (original, after) =>
    Object.entries(after).every(([field, value]) => {
      const before = original[field];
      // An array of accepted answers is corrected element by element, in place:
      // same length, same order, each entry equal but for case. It therefore
      // cannot add an answer, remove one, or reorder them.
      if (Array.isArray(value)) {
        return Array.isArray(before) && before.length === value.length &&
          value.every((entry, i) => sameButForCase(before[i], entry));
      }
      return sameButForCase(before, value);
    });

  const update = (table, id, after, reason, sources = []) => {
    const original = row(table, id);
    const speaking = original.type === 'speaking' || original.strand === 'speaking' || original.response_mode === 'speak';
    if (original.user_id || (speaking && !caseOnly(original, after))) throw new Error(`Excluded content: ${table}/${id}`);
    if (!reason?.trim()) throw new Error('Every correction needs a reason');
    const key = `${table}/${id}`;
    const patch = patchMap.get(key) ?? { table, id, before: {}, after: {}, reasons: [], sources: [], review_status: 'awaiting_independent_round4_review' };
    for (const field of identity) if (Object.hasOwn(original, field)) patch.before[field] = original[field];
    for (const [field, value] of Object.entries(after)) {
      if (!Object.hasOwn(original, field) || immutable.has(field)) throw new Error(`Unapproved field ${table}.${field}`);
      if (isDeepStrictEqual(original[field], value)) continue;
      if (Object.hasOwn(patch.after, field) && !isDeepStrictEqual(patch.after[field], value)) throw new Error(`Conflicting authored edits: ${key}.${field}`);
      patch.before[field] = original[field];
      patch.after[field] = value;
    }
    if (!Object.keys(patch.after).length) throw new Error(`No actual correction: ${key}`);
    patch.reasons = [...new Set([...patch.reasons, reason])];
    patch.sources = [...new Set([...patch.sources, ...sources])];
    patchMap.set(key, patch);
  };
  const replaceText = (table, id, field, edits, reason, sources = []) => {
    let text = row(table, id)[field];
    if (typeof text !== 'string') throw new Error(`Not a text field: ${table}/${id}/${field}`);
    for (const [before, after] of edits) {
      if (text.split(before).length !== 2) throw new Error(`Replacement must match exactly once: ${id}: ${before}`);
      text = text.replace(before, () => after);
    }
    update(table, id, { [field]: text }, reason, sources);
  };
  return { snapshot, row, update, replaceText, patches: () => [...patchMap.values()].sort((a, b) => `${a.table}/${a.id}`.localeCompare(`${b.table}/${b.id}`)) };
}

/** Course/unit/lesson lookup for the producers. Not a semantic review. */
export function curriculum(snapshot) {
  const courses = new Map(snapshot.courses.map(x => [x.id, x]));
  const units = new Map(snapshot.units.map(x => [x.id, x]));
  const lessons = new Map(snapshot.lessons.map(x => [x.id, x]));
  const of = exercise => {
    const lesson = lessons.get(exercise.lesson_id);
    const unit = units.get(lesson.unit_id);
    const course = courses.get(unit.course_id);
    return { lesson, unit, course, language: course.target_language, band: course.cefr_level };
  };
  const lessonContext = lesson => {
    const unit = units.get(lesson.unit_id);
    const course = courses.get(unit.course_id);
    return { unit, course, language: course.target_language, band: course.cefr_level };
  };
  return { courses, units, lessons, of, lessonContext };
}
