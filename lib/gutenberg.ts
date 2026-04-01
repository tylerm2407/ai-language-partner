import { supabase } from './supabase';

// Language code mapping (app uses 2-letter codes, Gutenberg uses them too)
const GUTENBERG_LANG_MAP: Record<string, string> = {
  es: 'es', fr: 'fr', de: 'de', it: 'it', pt: 'pt', ja: 'ja', ko: 'ko', zh: 'zh',
};

interface GutenbergBook {
  id: number;
  title: string;
  authors: { name: string }[];
  languages: string[];
  formats: Record<string, string>;
}

interface GutenbergSearchResult {
  count: number;
  results: GutenbergBook[];
}

export async function searchGutenbergBooks(
  language: string,
  topic?: string,
  page = 1
): Promise<GutenbergSearchResult> {
  const lang = GUTENBERG_LANG_MAP[language] ?? language;
  let url = `https://gutendex.com/books/?languages=${lang}&page=${page}`;
  if (topic) url += `&topic=${encodeURIComponent(topic)}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Gutendex API error: ${response.status}`);
  return response.json();
}

export async function fetchGutenbergText(bookId: number): Promise<string> {
  // Search for plain text format
  const url = `https://gutendex.com/books/${bookId}/`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch book ${bookId}`);

  const book = await response.json();
  const textUrl = book.formats?.['text/plain; charset=utf-8']
    ?? book.formats?.['text/plain']
    ?? Object.entries(book.formats).find(([k]) => k.startsWith('text/plain'))?.[1];

  if (!textUrl) throw new Error(`No plain text format available for book ${bookId}`);

  const textResponse = await fetch(textUrl as string);
  if (!textResponse.ok) throw new Error(`Failed to fetch text for book ${bookId}`);

  let text = await textResponse.text();

  // Strip Gutenberg header/footer boilerplate
  text = stripGutenbergBoilerplate(text);

  return text;
}

function stripGutenbergBoilerplate(text: string): string {
  // Remove everything before "*** START OF" line
  const startMarker = /\*{3}\s*START OF.*?\*{3}/i;
  const startMatch = text.match(startMarker);
  if (startMatch && startMatch.index !== undefined) {
    text = text.slice(startMatch.index + startMatch[0].length);
  }

  // Remove everything after "*** END OF" line
  const endMarker = /\*{3}\s*END OF/i;
  const endMatch = text.match(endMarker);
  if (endMatch && endMatch.index !== undefined) {
    text = text.slice(0, endMatch.index);
  }

  return text.trim();
}

export async function ingestGutenbergBook(
  gutenbergId: number,
  cefrLevel: string,
  language: string
): Promise<{ id: string }> {
  // Fetch metadata
  const metaUrl = `https://gutendex.com/books/${gutenbergId}/`;
  const metaResponse = await fetch(metaUrl);
  if (!metaResponse.ok) throw new Error(`Failed to fetch metadata for book ${gutenbergId}`);
  const meta = await metaResponse.json();

  // Fetch text
  const content = await fetchGutenbergText(gutenbergId);
  const wordCount = content.split(/\s+/).filter(Boolean).length;

  // Detect chapter breaks (common patterns)
  const chapterBreaks: number[] = [];
  const chapterPattern = /^(CHAPTER|Chapter|CAPITULO|Chapitre|Kapitel)\s+[\dIVXLCDM]+/gm;
  let match;
  while ((match = chapterPattern.exec(content)) !== null) {
    chapterBreaks.push(match.index);
  }

  const author = meta.authors?.[0]?.name ?? null;

  const { data, error } = await supabase
    .from('reading_books')
    .insert({
      source: 'gutenberg',
      source_id: String(gutenbergId),
      language,
      cefr_level: cefrLevel,
      title: meta.title,
      author,
      description: `A classic work by ${author ?? 'unknown author'}.`,
      content,
      word_count: wordCount,
      chapter_breaks: chapterBreaks,
      tags: ['classic', 'literature'],
      is_published: true,
    })
    .select('id')
    .single();

  if (error) throw error;
  return { id: data.id };
}
