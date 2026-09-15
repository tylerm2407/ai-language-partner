/** Use the visible marker, not whitespace token positions: Japanese and
 * Chinese sentences normally have no inter-word spaces. Keep legacy indexed
 * scaffolds readable until they are migrated to a literal ___ marker. */
export function writingBlankParts(data: Record<string, unknown>): { before: string; after: string } {
  const sentence = typeof data.sentence === 'string' ? data.sentence : '';
  const marker = sentence.indexOf('___');
  if (marker >= 0) return { before: sentence.slice(0, marker), after: sentence.slice(marker + 3) };
  const words = [...sentence.matchAll(/\S+/g)];
  const index = typeof data.blank_index === 'number' ? data.blank_index : -1;
  const word = Number.isInteger(index) ? words[index] : undefined;
  if (word?.index !== undefined) return { before: sentence.slice(0, word.index), after: sentence.slice(word.index + word[0].length) };
  return { before: sentence, after: '' };
}

export function completeWritingBlank(data: Record<string, unknown>, answer: string): string {
  const { before, after } = writingBlankParts(data);
  return `${before}${answer}${after}`;
}

/** Marked frames support languages whose verb/sentence ending follows the
 * learner's answer. Existing prefix-only frames keep their old spacing. */
export function completeWritingFrame(frame: string, answer: string): string {
  return frame.includes('___') ? frame.replace('___', () => answer) : `${frame} ${answer}`;
}
