import { createReadStream } from 'fs';
import { createInterface } from 'readline';

/**
 * Parse a frequency list file into a word → rank mapping.
 *
 * Supports tab-separated and space-separated formats:
 *   rank  word  frequency
 *   1     the   23135851
 *   2     of    13151942
 *
 * Lines starting with # are treated as comments and skipped.
 */
export async function parseFrequencyList(
  filePath: string,
  _language: string
): Promise<Map<string, number>> {
  const freqMap = new Map<string, number>();

  const rl = createInterface({
    input: createReadStream(filePath, 'utf-8'),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Split by tab first, then fall back to whitespace
    const parts = trimmed.includes('\t')
      ? trimmed.split('\t')
      : trimmed.split(/\s+/);

    if (parts.length < 2) continue;

    // Determine which column is rank and which is word
    const first = parts[0].trim();
    const second = parts[1].trim();

    let rank: number;
    let word: string;

    if (/^\d+$/.test(first)) {
      // Format: rank word [frequency]
      rank = parseInt(first, 10);
      word = second.toLowerCase();
    } else if (/^\d+$/.test(second)) {
      // Format: word rank [frequency]
      word = first.toLowerCase();
      rank = parseInt(second, 10);
    } else {
      // Cannot determine format, skip
      continue;
    }

    if (word && !freqMap.has(word)) {
      freqMap.set(word, rank);
    }
  }

  return freqMap;
}

/**
 * Get the frequency rank of a word. Lower rank = more common.
 * Returns undefined if the word is not in the frequency list.
 */
export function getFrequencyRank(
  word: string,
  freqMap: Map<string, number>
): number | undefined {
  return freqMap.get(word.toLowerCase());
}
