/** Exact-ID patch compiler, not a semantic reviewer. All edits must be authored. */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
export const SNAPSHOT_SHA = '8c7f381c78d87e57593febe851526355d300c7a704e5a57dd49a614edabd7c0f';
const allowedTables = ['courses', 'units', 'lessons', 'exercises', 'cards', 'grammar_rules', 'writing_prompts', 'reading_passages', 'reading_questions', 'checkpoint_items'];
const immutable = new Set(['id', 'created_at', 'user_id']);

/** Inserting a row is strictly more dangerous than correcting one: there is no
 * frozen original to guard against, so the only things standing between an
 * authored row and production are these declarations. A table earns a place
 * here only when a *new* row is meaningful on its own and cannot silently
 * change what a learner already saw. `reading_questions` qualifies: a passage's
 * questions are an ordered list, an extra one adds practice without altering
 * any existing item, and the passage that owns it is itself audited.
 *
 * Every other table is deliberately refused for now, each for its own reason:
 * `exercises` are ordered inside a lesson and are the unit of SRS scheduling;
 * `cards` are the SRS payload and a new card mutates every learner's queue;
 * `checkpoint_items` change measured CEFR placement; `courses`/`units`/
 * `lessons`/`reading_passages` create curriculum structure, not corrections;
 * `grammar_rules` and `writing_prompts` are referenced by id from elsewhere.
 * Widening this map means revisiting the SQL below as well, which knows that
 * `order_index` is how the parent orders its children. */
const insertParents = {
  reading_questions: { table: 'reading_passages', column: 'passage_id', order: 'order_index' },
};
const allowedInsertTables = Object.keys(insertParents);

/** Deterministic id for an inserted row, so that re-running the builder emits a
 * byte-identical draft and the same row is recognised on a re-applied patch set.
 *
 * id = sha256("question-audit-insert:v1:<table>:<parent id>:<slug>"), first 16
 * bytes, with the version nibble forced to 8 and the variant nibble to 8/9/a/b.
 * That is a syntactically valid RFC 9562 version-8 (custom) UUID, which is what
 * this is: a locally derived, non-random identifier. The slug is the author's
 * stable name for the row, so wording may be revised without moving the id, and
 * two different authored rows under one parent cannot share one. */
export function derivedInsertId(table, parentId, slug) {
  if (typeof slug !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new Error(`Insert slug must be lowercase kebab-case: ${slug}`);
  if (typeof parentId !== 'string' || !parentId) throw new Error(`Insert parent id must be a string: ${parentId}`);
  const digest = createHash('sha256').update(`question-audit-insert:v1:${table}:${parentId}:${slug}`).digest('hex');
  const hex = `${digest.slice(0, 12)}8${digest.slice(13, 16)}${'89ab'[parseInt(digest[16], 16) % 4]}${digest.slice(17, 32)}`;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** `deriveId` is a seam for the tests only: it lets them exercise the collision
 * and malformed-id guards, which a real sha256 derivation can never reach.
 * Every producer calls this with no arguments and gets the real derivation. */
export async function createPatchSet({ deriveId = derivedInsertId } = {}) {
  const raw = await readFile('.question-audit/snapshot-8c7f381c78d8.json');
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
    const patch = patchMap.get(key) ?? { table, id, before: {}, after: {}, reasons: [], sources: [], review_status: 'awaiting_independent_remediation_review' };
    for (const field of ['lesson_id', 'course_id', 'passage_id', 'unit_id', 'language', 'band', 'cefr_level', 'type', 'strand', 'question_type']) {
      if (Object.hasOwn(original, field)) patch.before[field] = original[field];
    }
    for (const [field, value] of Object.entries(after)) {
      if (!Object.hasOwn(original, field) || immutable.has(field)) throw new Error(`Unapproved field ${table}.${field}`);
      if (isDeepStrictEqual(original[field], value)) continue;
      if (Object.hasOwn(patch.after, field) && !isDeepStrictEqual(patch.after[field], value)) throw new Error(`Conflicting authored edits: ${key}.${field}`);
      patch.before[field] = original[field];
      patch.after[field] = value;
    }
    // Reassignments depend on both category names, not merely on their IDs.
    // A concurrent curriculum rename must trigger review instead of silently
    // moving a passage into a category whose meaning has changed.
    if (typeof after.unit_id === 'string' && after.unit_id !== original.unit_id) {
      patch.context_guards = [...new Set([original.unit_id, after.unit_id].filter(Boolean))].map(unitId => {
        const unit = row('units', unitId);
        return { table: 'units', id: unitId, before: { title: unit.title, course_id: unit.course_id } };
      });
    }
    if (!Object.keys(patch.after).length) throw new Error(`No actual correction: ${key}`);
    patch.reasons = [...new Set([...patch.reasons, reason])];
    patch.sources = [...new Set([...patch.sources, ...sources])];
    patchMap.set(key, patch);
  };
  let everyId = null;
  const snapshotIds = () => everyId ??= new Set(Object.values(snapshot).filter(Array.isArray).flatMap(rows => rows.map(r => r.id)));
  /** Add a row that does not exist in the frozen snapshot. `slug` is the
   * author's stable name for it and fixes the derived id; `after` must name
   * every column of the table except the derived `id`, so an omission is an
   * error rather than a silent NULL. Returns the derived id. */
  const insert = (table, slug, after, reason, sources = []) => {
    const parent = insertParents[table];
    if (!parent) throw new Error(`Inserts are not supported for table: ${table}`);
    if (!reason?.trim()) throw new Error('Every correction needs a reason');
    if (!after || typeof after !== 'object' || Array.isArray(after)) throw new Error(`Insert row must be an object: ${table}/${slug}`);
    const columns = Object.keys(snapshot[table][0]);
    for (const field of Object.keys(after)) {
      if (!columns.includes(field) || immutable.has(field)) throw new Error(`Unapproved field ${table}.${field}`);
    }
    for (const field of columns) {
      if (!immutable.has(field) && !Object.hasOwn(after, field)) throw new Error(`Missing required column ${table}.${field}`);
    }
    if (after.type === 'speaking' || after.strand === 'speaking' || after.response_mode === 'speak') throw new Error(`Excluded content: ${table}/${slug}`);
    const parentRow = row(parent.table, after[parent.column]);
    if (parentRow.user_id) throw new Error(`Excluded content: ${parent.table}/${parentRow.id}`);
    const id = deriveId(table, parentRow.id, slug);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id ?? '')) throw new Error(`Derived id is not a valid UUID: ${table}/${id}`);
    if (snapshotIds().has(id)) throw new Error(`Derived id already exists in the frozen snapshot: ${table}/${id}`);
    const key = `${table}/${id}`;
    if (patchMap.has(key)) throw new Error(`Duplicate insert: ${key}`);
    // A new child must not land on an ordinal another child already occupies,
    // counting both the frozen siblings and any reordering this build authors.
    const order = after[parent.order];
    if (!Number.isInteger(order) || order < 0) throw new Error(`Insert ${parent.order} must be a non-negative integer: ${key}`);
    for (const sibling of snapshot[table]) {
      if (sibling[parent.column] !== parentRow.id) continue;
      const patched = patchMap.get(`${table}/${sibling.id}`);
      const effective = patched && Object.hasOwn(patched.after, parent.order) ? patched.after[parent.order] : sibling[parent.order];
      if (sibling[parent.order] === order || effective === order) throw new Error(`Sibling ${parent.order} ${order} is taken: ${key}`);
    }
    for (const other of patchMap.values()) {
      if (other.op === 'insert' && other.table === table && other.after[parent.column] === parentRow.id && other.after[parent.order] === order) {
        throw new Error(`Sibling ${parent.order} ${order} is taken: ${key}`);
      }
    }
    patchMap.set(key, {
      op: 'insert', table, id,
      parent: { table: parent.table, column: parent.column, id: parentRow.id },
      before: null,
      after: Object.fromEntries(Object.entries(after).sort(([a], [b]) => a.localeCompare(b))),
      reasons: [reason], sources: [...new Set(sources)], review_status: 'awaiting_independent_remediation_review',
    });
    return id;
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
  return { snapshot, row, update, insert, replaceText, patches: () => [...patchMap.values()].sort((a, b) => `${a.table}/${a.id}`.localeCompare(`${b.table}/${b.id}`)) };
}

export function renderPatchSql(patches) {
  const guards = new Map();
  for (const patch of patches) for (const guard of patch.context_guards ?? []) {
    const key = `${guard.table}/${guard.id}`;
    if (guards.has(key) && !isDeepStrictEqual(guards.get(key), guard)) throw new Error(`Conflicting context guards: ${key}`);
    guards.set(key, guard);
  }
  // Inserts are carried separately and applied last, so a new child never races
  // an update that is still moving its siblings around.
  const inserts = patches.filter(patch => patch.op === 'insert');
  const updates = patches.filter(patch => patch.op !== 'insert');
  for (const patch of inserts) {
    const parent = insertParents[patch.table];
    if (!parent) throw new Error(`Out-of-scope insert table: ${patch.table}`);
    if (patch.parent?.table !== parent.table || patch.parent?.column !== parent.column || typeof patch.parent?.id !== 'string') {
      throw new Error(`Malformed insert parent: ${patch.table}/${patch.id}`);
    }
    if (patch.after?.[parent.column] !== patch.parent.id) throw new Error(`Insert parent does not match its row: ${patch.table}/${patch.id}`);
    if (Object.hasOwn(patch.after, 'id')) throw new Error(`Insert row must not carry its own id: ${patch.table}/${patch.id}`);
  }
  const payload = JSON.stringify({
    context_guards: [...guards.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, guard]) => guard),
    patches: updates.map(({ table, id, before, after }) => ({ table, id, before, after })),
    ...(inserts.length ? { inserts: inserts.map(({ table, id, parent, after }) => ({ table, id, parent, row: { id, ...after } })) } : {}),
  });
  const tag = '$question_audit_payload$';
  if (payload.includes(tag)) throw new Error('Unsafe SQL delimiter');
  return `-- Generated from the frozen question audit; NOT deployed by this audit.
-- Exact IDs and old field values guard against overwriting concurrent edits.
-- Category guards also protect the meaning and course of reassigned units.
-- One atomic block: any mismatch rolls back every change. Already-applied rows are safe.
DO $question_audit$
DECLARE
  plan jsonb := ${tag}${payload}${tag}::jsonb;
  patch jsonb; guard jsonb; current_row jsonb; assignments text; changed integer;
BEGIN
  FOR guard IN SELECT value FROM jsonb_array_elements(plan->'context_guards') LOOP
    IF guard->>'table' <> 'units' THEN RAISE EXCEPTION 'Out-of-scope question audit context'; END IF;
    EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id = $1::uuid FOR SHARE', guard->>'table') INTO current_row USING guard->>'id';
    IF current_row IS NULL OR EXISTS (SELECT 1 FROM jsonb_each(guard->'before') field WHERE current_row->field.key IS DISTINCT FROM field.value) THEN
      RAISE EXCEPTION 'Audited category changed; review before applying: %/%', guard->>'table', guard->>'id';
    END IF;
  END LOOP;
  FOR patch IN SELECT value FROM jsonb_array_elements(plan->'patches') LOOP
    IF NOT (patch->>'table' = ANY(ARRAY[${allowedTables.map(x => `'${x}'`).join(',')}])) THEN
      RAISE EXCEPTION 'Out-of-scope question audit table';
    END IF;
    EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id = $1::uuid FOR UPDATE', patch->>'table') INTO current_row USING patch->>'id';
    IF current_row IS NULL THEN RAISE EXCEPTION 'Missing audited row %/%', patch->>'table', patch->>'id'; END IF;
    IF NOT EXISTS (SELECT 1 FROM jsonb_each(patch->'after') field WHERE current_row->field.key IS DISTINCT FROM field.value) THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_each(patch->'before') field WHERE current_row->field.key IS DISTINCT FROM field.value) THEN RAISE EXCEPTION 'Audited row changed; review before applying: %/%', patch->>'table', patch->>'id'; END IF;
    SELECT string_agg(format('%I = (jsonb_populate_record(NULL::public.%I, $1)).%I', key, patch->>'table', key), ', ' ORDER BY key) INTO assignments FROM jsonb_object_keys(patch->'after') key;
    EXECUTE format('UPDATE public.%I SET %s WHERE id = $2::uuid', patch->>'table', assignments) USING patch->'after', patch->>'id';
    GET DIAGNOSTICS changed = ROW_COUNT;
    IF changed <> 1 THEN RAISE EXCEPTION 'Unexpected affected-row count: %', changed; END IF;
  END LOOP;
${inserts.length ? `  -- Authored new rows, applied after every update. A row already present with
  -- these exact values is left alone, so re-running is safe; one present with
  -- this id and any other value aborts the block like every other mismatch.
  FOR patch IN SELECT value FROM jsonb_array_elements(plan->'inserts') LOOP
    IF NOT (patch->>'table' = ANY(ARRAY[${allowedInsertTables.map(x => `'${x}'`).join(',')}])) THEN
      RAISE EXCEPTION 'Out-of-scope question audit insert table';
    END IF;
    EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id = $1::uuid FOR SHARE', patch->'parent'->>'table') INTO current_row USING patch->'parent'->>'id';
    IF current_row IS NULL THEN RAISE EXCEPTION 'Missing audited parent %/%', patch->'parent'->>'table', patch->'parent'->>'id'; END IF;
    EXECUTE format('SELECT count(*) FROM public.%I t WHERE t.%I = $1::uuid AND t.order_index = $2::numeric AND t.id <> $3::uuid', patch->>'table', patch->'parent'->>'column')
      INTO changed USING patch->'parent'->>'id', patch->'row'->>'order_index', patch->>'id';
    IF changed <> 0 THEN RAISE EXCEPTION 'Audited sibling order taken; review before applying: %/%', patch->>'table', patch->>'id'; END IF;
    EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id = $1::uuid FOR UPDATE', patch->>'table') INTO current_row USING patch->>'id';
    IF current_row IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM jsonb_each(patch->'row') field WHERE current_row->field.key IS DISTINCT FROM field.value) THEN
        RAISE EXCEPTION 'Audited row changed; review before applying: %/%', patch->>'table', patch->>'id';
      END IF;
      CONTINUE;
    END IF;
    SELECT string_agg(format('%I', key), ', ' ORDER BY key) INTO assignments FROM jsonb_object_keys(patch->'row') key;
    EXECUTE format('INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_record(NULL::public.%I, $1)', patch->>'table', assignments, assignments, patch->>'table') USING patch->'row';
    GET DIAGNOSTICS changed = ROW_COUNT;
    IF changed <> 1 THEN RAISE EXCEPTION 'Unexpected inserted-row count: %', changed; END IF;
  END LOOP;
` : ''}END
$question_audit$;
`;
}

/**
 * The same patch set, undone.
 *
 * A rollback is not a fresh patch: it must be at least as careful as the thing
 * it reverses, because by the time anyone runs it the rows are already live and
 * may have been edited since. So this emits the same guarded shape as
 * `renderPatchSql` and lives beside it, under the same tests, rather than in a
 * script of its own where the two could drift apart.
 *
 * Three differences from the forward direction:
 *
 * - **Updates swap.** The guard becomes the patch's `after` and the value
 *   written becomes its `before`, RESTRICTED to the fields the patch actually
 *   wrote. `before` also carries ten identity fields (lesson_id, language,
 *   type, …) purely so the forward apply can confirm it has the right row.
 *   Writing those back would at best be a no-op and at worst undo a `unit_id`
 *   move that was never this patch's to make.
 *
 * - **Inserts become deletes**, and they go FIRST, mirroring the forward order
 *   where inserts go last. A row that is already gone is skipped, so re-running
 *   is safe; a row whose values someone has since changed aborts the block
 *   rather than destroying an edit nobody reviewed.
 *
 * - **Context guards are unchanged.** They lock the title and course of the
 *   units involved in a reassignment, and that is as necessary moving a row
 *   back as it was moving it out.
 */
export function renderReverseSql(patches) {
  const guards = new Map();
  for (const patch of patches) for (const guard of patch.context_guards ?? []) {
    const key = `${guard.table}/${guard.id}`;
    if (guards.has(key) && !isDeepStrictEqual(guards.get(key), guard)) throw new Error(`Conflicting context guards: ${key}`);
    guards.set(key, guard);
  }
  const inserts = patches.filter(patch => patch.op === 'insert');
  const updates = patches.filter(patch => patch.op !== 'insert');
  const reversed = updates.map(({ table, id, before, after }) => {
    const restored = {};
    for (const field of Object.keys(after)) {
      if (!Object.hasOwn(before, field)) throw new Error(`Cannot reverse ${table}/${id}: no prior value for ${field}`);
      restored[field] = before[field];
    }
    if (isDeepStrictEqual(restored, after)) throw new Error(`Reverse of ${table}/${id} writes nothing`);
    return { table, id, before: after, after: restored };
  });
  for (const patch of inserts) {
    if (!allowedInsertTables.includes(patch.table)) throw new Error(`Out-of-scope insert table: ${patch.table}`);
  }
  const payload = JSON.stringify({
    context_guards: [...guards.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, guard]) => guard),
    patches: reversed,
    ...(inserts.length ? { deletes: inserts.map(({ table, id, after }) => ({ table, id, row: { id, ...after } })) } : {}),
  });
  const tag = '$question_audit_payload$';
  if (payload.includes(tag)) throw new Error('Unsafe SQL delimiter');
  return `-- Rollback for the frozen question audit content patch. NOT part of the deploy.
-- Restores every audited field to its pre-patch value and removes the authored rows.
-- Guarded in both directions: a row edited since the patch landed aborts the block
-- instead of being reverted, so this can never silently discard someone else's work.
-- One atomic block. Safe to re-run, and safe over a partially applied patch.
DO $question_audit$
DECLARE
  plan jsonb := ${tag}${payload}${tag}::jsonb;
  patch jsonb; guard jsonb; current_row jsonb; assignments text; changed integer;
BEGIN
  FOR guard IN SELECT value FROM jsonb_array_elements(plan->'context_guards') LOOP
    IF guard->>'table' <> 'units' THEN RAISE EXCEPTION 'Out-of-scope question audit context'; END IF;
    EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id = $1::uuid FOR SHARE', guard->>'table') INTO current_row USING guard->>'id';
    IF current_row IS NULL OR EXISTS (SELECT 1 FROM jsonb_each(guard->'before') field WHERE current_row->field.key IS DISTINCT FROM field.value) THEN
      RAISE EXCEPTION 'Audited category changed; review before reverting: %/%', guard->>'table', guard->>'id';
    END IF;
  END LOOP;
${inserts.length ? `  -- Authored rows go first, mirroring the forward order where they went last.
  FOR patch IN SELECT value FROM jsonb_array_elements(plan->'deletes') LOOP
    IF NOT (patch->>'table' = ANY(ARRAY[${allowedInsertTables.map(x => `'${x}'`).join(',')}])) THEN
      RAISE EXCEPTION 'Out-of-scope question audit delete table';
    END IF;
    EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id = $1::uuid FOR UPDATE', patch->>'table') INTO current_row USING patch->>'id';
    IF current_row IS NULL THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_each(patch->'row') field WHERE current_row->field.key IS DISTINCT FROM field.value) THEN
      RAISE EXCEPTION 'Authored row changed; review before reverting: %/%', patch->>'table', patch->>'id';
    END IF;
    EXECUTE format('DELETE FROM public.%I WHERE id = $1::uuid', patch->>'table') USING patch->>'id';
    GET DIAGNOSTICS changed = ROW_COUNT;
    IF changed <> 1 THEN RAISE EXCEPTION 'Unexpected deleted-row count: %', changed; END IF;
  END LOOP;
` : ''}  FOR patch IN SELECT value FROM jsonb_array_elements(plan->'patches') LOOP
    IF NOT (patch->>'table' = ANY(ARRAY[${allowedTables.map(x => `'${x}'`).join(',')}])) THEN
      RAISE EXCEPTION 'Out-of-scope question audit table';
    END IF;
    EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id = $1::uuid FOR UPDATE', patch->>'table') INTO current_row USING patch->>'id';
    IF current_row IS NULL THEN RAISE EXCEPTION 'Missing audited row %/%', patch->>'table', patch->>'id'; END IF;
    IF NOT EXISTS (SELECT 1 FROM jsonb_each(patch->'after') field WHERE current_row->field.key IS DISTINCT FROM field.value) THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_each(patch->'before') field WHERE current_row->field.key IS DISTINCT FROM field.value) THEN RAISE EXCEPTION 'Audited row changed; review before reverting: %/%', patch->>'table', patch->>'id'; END IF;
    SELECT string_agg(format('%I = (jsonb_populate_record(NULL::public.%I, $1)).%I', key, patch->>'table', key), ', ' ORDER BY key) INTO assignments FROM jsonb_object_keys(patch->'after') key;
    EXECUTE format('UPDATE public.%I SET %s WHERE id = $2::uuid', patch->>'table', assignments) USING patch->'after', patch->>'id';
    GET DIAGNOSTICS changed = ROW_COUNT;
    IF changed <> 1 THEN RAISE EXCEPTION 'Unexpected affected-row count: %', changed; END IF;
  END LOOP;
END
$question_audit$;
`;
}
