/**
 * One writer for `accepted_answers`, because four blocks now reach the same rows.
 *
 * The triage block, the Japanese script ruling and the register ruling each
 * decide independently, and five rows fall to more than one of them: ja-E0892
 * and ja-E0970 (triage + script), ko-E0856 and ko-E0862 (triage + register), and
 * ja-E0712 (script + register). The compiler refuses two different authored
 * values for one field on purpose, so the union has to be composed somewhere
 * explicit rather than discovered by whichever producer happened to run second.
 * This is that place — the same role round one's composition modules played.
 *
 * Order matters and is not alphabetical: additions appear in the order the
 * blocks contributed them, so the stored list reads as the decisions were made.
 * Each contributing block still supplies its OWN reason, and the row carries all
 * of them, so a reviewer reading a five-string list can see which ruling put
 * each string there.
 */
export function createAcceptedAnswerLedger() {
  const contributions = new Map();

  /** Record one block's additions for one row. Nothing is written yet. */
  const contribute = (id, { block, additions, reason, sources = [] }) => {
    if (!block?.trim()) throw new Error(`${id}: a contribution must name its block`);
    if (!reason?.trim()) throw new Error(`${id}: a contribution must carry a reason`);
    if (!Array.isArray(additions) || !additions.length) throw new Error(`${id}: a contribution must add something`);
    for (const addition of additions) {
      if (typeof addition !== 'string' || !addition.trim()) throw new Error(`${id}: empty addition from ${block}`);
    }
    const existing = contributions.get(id) ?? [];
    if (existing.some(entry => entry.block === block)) throw new Error(`${id}: ${block} contributed twice`);
    contributions.set(id, [...existing, { block, additions, reason, sources }]);
  };

  /**
   * Write every row once.
   *
   * `update` is called once per contribution with the SAME union value: the
   * compiler treats a repeat of an identical value as a no-op on the field and
   * appends the reason, so the row ends with one patch, one value and one reason
   * per block. A contribution that disagreed about the value would still throw,
   * which is the guard worth keeping.
   */
  const write = set => {
    const written = [];
    for (const [id, entries] of [...contributions].sort(([a], [b]) => a.localeCompare(b))) {
      const original = set.row('exercises', id);
      const before = original.accepted_answers ?? [];
      if (!Array.isArray(before)) throw new Error(`${id}: accepted_answers is not a list`);
      const union = [...before];
      for (const entry of entries) {
        for (const addition of entry.additions) {
          if (addition === original.correct_answer) throw new Error(`${id}: ${entry.block} repeats the key`);
          if (!union.includes(addition)) union.push(addition);
        }
      }
      if (union.length === before.length) throw new Error(`${id}: the union adds nothing`);
      for (const entry of entries) set.update('exercises', id, { accepted_answers: union }, entry.reason, entry.sources);
      written.push({ id, blocks: entries.map(entry => entry.block), before, after: union });
    }
    return written;
  };

  return { contribute, write, rows: () => contributions.size };
}
