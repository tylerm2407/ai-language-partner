/** Only explicitly authored no-space banks opt in. Existing exercises retain
 * their original spacing; language alone does not rewrite stored answers. */
export function sentenceTileJoiner(metadata?: Record<string, unknown>): '' | ' ' {
  return metadata?.tile_joiner === '' ? '' : ' ';
}

/** Restore a concatenated Japanese/Chinese answer after a reshuffle. Tiles can
 * be words or phrase chunks, so character-by-character splitting is invalid.
 * Backtracking handles overlapping chunks; equivalent duplicate indices are
 * interchangeable. A bounded search fails closed instead of freezing the UI. */
export function restoreUnspacedTiles(tiles: string[], answer: string): number[] {
  if (!answer) return [];
  const used = new Set<number>();
  const failed = new Set<string>();
  let visits = 0;
  const search = (offset: number): number[] | null => {
    if (offset === answer.length) return [];
    if (++visits > 10000) return null;
    const state = `${offset}:${[...used].sort((a, b) => a - b).join(',')}`;
    if (failed.has(state)) return null;
    const tried = new Set<string>();
    const candidates = tiles.map((tile, index) => ({ tile, index }))
      .filter(({ tile, index }) => tile.length > 0 && !used.has(index) && answer.startsWith(tile, offset))
      .sort((a, b) => b.tile.length - a.tile.length || a.index - b.index);
    for (const { tile, index } of candidates) {
      if (tried.has(tile)) continue;
      tried.add(tile);
      used.add(index);
      const rest = search(offset + tile.length);
      used.delete(index);
      if (rest !== null) return [index, ...rest];
    }
    failed.add(state);
    return null;
  };
  return search(0) ?? [];
}
