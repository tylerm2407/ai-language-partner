/**
 * Normalize text: lowercase, trim, collapse whitespace, normalize unicode.
 */
export function normalizeText(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Remove sentence-ending punctuation (.!?;:) from the end of a string.
 */
export function stripPunctuation(text: string): string {
  return text.replace(/[.!?;:,]+$/g, '').trim();
}

/**
 * Split text into word tokens.
 * Strips punctuation from each token and filters out empty strings.
 */
export function tokenize(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter((w) => w.length > 0);
}
