/**
 * Round-2 patch compiler. Exact-ID edits only, never a semantic reviewer.
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

export const SNAPSHOT_FILE = '.question-audit/snapshot-9a20145dc6b5.json';
export const SNAPSHOT_SHA = '9a20145dc6b53d1e4b5f17388b3f24c4ee4dd43c19b9bdac935ba8256bfb489c';

/** The same table allowlist as round one, and the same immutable columns. */
const allowedTables = ['courses', 'units', 'lessons', 'exercises', 'cards', 'grammar_rules', 'writing_prompts', 'reading_passages', 'reading_questions', 'checkpoint_items'];
const immutable = new Set(['id', 'created_at', 'user_id']);
/** Carried on every patch so the apply can confirm it has the right row. The
 * reverse deliberately does not write these back; see renderReverseSql. */
const identity = ['lesson_id', 'course_id', 'passage_id', 'unit_id', 'language', 'band', 'cefr_level', 'type', 'strand', 'question_type'];

export async function createRound2PatchSet({ file = SNAPSHOT_FILE } = {}) {
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
  const update = (table, id, after, reason, sources = []) => {
    const original = row(table, id);
    if (original.user_id || original.type === 'speaking' || original.strand === 'speaking' || original.response_mode === 'speak') throw new Error(`Excluded content: ${table}/${id}`);
    if (!reason?.trim()) throw new Error('Every correction needs a reason');
    const key = `${table}/${id}`;
    const patch = patchMap.get(key) ?? { table, id, before: {}, after: {}, reasons: [], sources: [], review_status: 'awaiting_independent_round2_review' };
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
