/**
 * Bulk Gutenberg ingestion script.
 * Run with: npx tsx scripts/ingest-gutenberg-bulk.ts
 *
 * Imports all available public-domain books from Project Gutenberg
 * for 9 target languages via the Gutendex API.
 *
 * Loads credentials from .env file automatically.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env file from project root
function loadEnvFile(): void {
  try {
    const envPath = resolve(__dirname, '..', '.env');
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      // Remove surrounding quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env file not found, fall back to env vars
  }
}

loadEnvFile();

const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '').trim();
const SUPABASE_ANON_KEY = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
const SUPABASE_SECRET_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();

const SUPABASE_KEY = SUPABASE_SECRET_KEY || SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY / EXPO_PUBLIC_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

if (!SUPABASE_SECRET_KEY) {
  console.warn('⚠ No SUPABASE_SERVICE_ROLE_KEY found — using anon key. Inserts may fail due to RLS.');
}

// Use service role key to bypass RLS for bulk ingestion
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const LANGUAGES = ['es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh', 'ru'] as const;

// ─── CEFR Estimation ────────────────────────────────────────────

type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

function estimateCefrLevel(text: string): CefrLevel {
  const sentences = text.split(/[.!?]+\s+/).filter((s) => s.trim().length > 0);
  const sentenceCount = Math.max(sentences.length, 1);

  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = Math.max(words.length, 1);

  const avgSentenceLength = wordCount / sentenceCount;

  const totalChars = words.reduce(
    (sum, w) => sum + w.replace(/[^a-zA-ZÀ-ÿ\u0400-\u04ff\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g, '').length,
    0
  );
  const avgWordLength = totalChars / wordCount;

  const sampleWords = words
    .slice(0, 1000)
    .map((w) => w.toLowerCase().replace(/[^a-zA-ZÀ-ÿ\u0400-\u04ff\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g, ''));
  const validSample = sampleWords.filter((w) => w.length > 0);
  const uniqueWords = new Set(validSample);
  const sampleSize = Math.max(validSample.length, 1);
  const typeTokenRatio = uniqueWords.size / sampleSize;

  let sentenceScore: number;
  if (avgSentenceLength < 10) sentenceScore = 0;
  else if (avgSentenceLength < 15) sentenceScore = 1;
  else if (avgSentenceLength < 20) sentenceScore = 2;
  else if (avgSentenceLength < 25) sentenceScore = 3;
  else sentenceScore = 4;

  let wordLengthScore: number;
  if (avgWordLength < 4) wordLengthScore = 0;
  else if (avgWordLength < 5) wordLengthScore = 1;
  else if (avgWordLength < 6) wordLengthScore = 2;
  else if (avgWordLength < 7) wordLengthScore = 3;
  else wordLengthScore = 4;

  let ttrScore: number;
  if (typeTokenRatio < 0.4) ttrScore = 0;
  else if (typeTokenRatio < 0.5) ttrScore = 1;
  else if (typeTokenRatio < 0.6) ttrScore = 2;
  else if (typeTokenRatio < 0.7) ttrScore = 3;
  else ttrScore = 4;

  const avgScore = (sentenceScore * 2 + wordLengthScore + ttrScore) / 4;

  if (avgScore < 0.5) return 'A1';
  if (avgScore < 1.5) return 'A2';
  if (avgScore < 2.0) return 'B1';
  if (avgScore < 2.75) return 'B2';
  if (avgScore < 3.5) return 'C1';
  return 'C2';
}

// ─── Gutenberg helpers ──────────────────────────────────────────

interface GutenbergBook {
  id: number;
  title: string;
  authors: { name: string }[];
  languages: string[];
  formats: Record<string, string>;
}

interface GutenbergPage {
  count: number;
  next: string | null;
  results: GutenbergBook[];
}

function stripGutenbergBoilerplate(text: string): string {
  const startMarker = /\*{3}\s*START OF.*?\*{3}/i;
  const startMatch = text.match(startMarker);
  if (startMatch && startMatch.index !== undefined) {
    text = text.slice(startMatch.index + startMatch[0].length);
  }

  const endMarker = /\*{3}\s*END OF/i;
  const endMatch = text.match(endMarker);
  if (endMatch && endMatch.index !== undefined) {
    text = text.slice(0, endMatch.index);
  }

  return text.trim();
}

function detectChapterBreaks(content: string): number[] {
  const breaks: number[] = [];
  const pattern = /^(CHAPTER|Chapter|CAPITULO|Capítulo|Chapitre|Kapitel|PARTE|Parte|LIBRO|Libro|ГЛАВА|Глава|ЧАСТЬ|Часть)\s+[\dIVXLCDM]+/gm;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    breaks.push(match.index);
  }
  return breaks;
}

function getPlainTextUrl(formats: Record<string, string>): string | null {
  return (
    formats['text/plain; charset=utf-8'] ??
    formats['text/plain'] ??
    (Object.entries(formats).find(([k]) => k.startsWith('text/plain'))?.[1] ?? null)
  );
}

function getCoverImageUrl(formats: Record<string, string>): string | null {
  return formats['image/jpeg'] ?? null;
}

async function fetchWithRetry(url: string, retries = 2): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      if (attempt < retries) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
      throw new Error(`HTTP ${response.status} for ${url}`);
    } catch (err) {
      if (attempt < retries) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Unreachable');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Ingestion ──────────────────────────────────────────────────

async function getExistingSourceIds(language: string): Promise<Set<string>> {
  const ids = new Set<string>();
  let offset = 0;
  const batchSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('reading_books')
      .select('source_id')
      .eq('source', 'gutenberg')
      .eq('language', language)
      .range(offset, offset + batchSize - 1);

    if (error) throw new Error(`Supabase query failed: ${error.message} (code: ${error.code})`);
    if (!data || data.length === 0) break;

    for (const row of data) {
      if (row.source_id) ids.add(row.source_id);
    }

    if (data.length < batchSize) break;
    offset += batchSize;
  }

  return ids;
}

async function ingestLanguage(language: string): Promise<{ ingested: number; skipped: number; errors: number }> {
  console.log(`\n[${language}] Starting ingestion...`);

  const existingIds = await getExistingSourceIds(language);
  console.log(`[${language}] Found ${existingIds.size} existing books (will skip)`);

  let ingested = 0;
  let skipped = 0;
  let errors = 0;
  let page = 1;
  let totalPages = '?';
  let nextUrl: string | null = `https://gutendex.com/books/?languages=${language}&page=1`;

  while (nextUrl) {
    let pageData: GutenbergPage;
    try {
      const response = await fetchWithRetry(nextUrl);
      pageData = (await response.json()) as GutenbergPage;
    } catch (err) {
      console.error(`[${language}] Failed to fetch page ${page}: ${err}`);
      errors++;
      break;
    }

    if (page === 1) {
      totalPages = String(Math.ceil(pageData.count / 32));
      console.log(`[${language}] Total books listed: ${pageData.count} (~${totalPages} pages)`);
    }

    for (const book of pageData.results) {
      const sourceId = String(book.id);

      // Dedup check
      if (existingIds.has(sourceId)) {
        skipped++;
        continue;
      }

      // Check for plain text format
      const textUrl = getPlainTextUrl(book.formats);
      if (!textUrl) {
        skipped++;
        continue;
      }

      try {
        // Rate limit
        await sleep(1000);

        // Fetch text
        const textResponse = await fetchWithRetry(textUrl);
        let content = await textResponse.text();
        content = stripGutenbergBoilerplate(content);

        // Skip empty/tiny entries
        const wordCount = content.split(/\s+/).filter(Boolean).length;
        if (wordCount < 100) {
          skipped++;
          continue;
        }

        const cefrLevel = estimateCefrLevel(content);
        const chapterBreaks = detectChapterBreaks(content);
        const author = book.authors?.[0]?.name ?? null;
        const imageUrl = getCoverImageUrl(book.formats);

        const { error: insertError } = await supabase.from('reading_books').insert({
          source: 'gutenberg',
          source_id: sourceId,
          language,
          cefr_level: cefrLevel,
          title: book.title,
          author,
          description: author ? `A classic work by ${author}.` : 'A classic public domain work.',
          content,
          word_count: wordCount,
          chapter_breaks: chapterBreaks,
          image_url: imageUrl,
          tags: ['classic', 'literature'],
          is_published: true,
        });

        if (insertError) {
          // Duplicate key = already exists, just skip
          if (insertError.code === '23505') {
            skipped++;
            existingIds.add(sourceId);
          } else {
            console.error(`[${language}] Insert error for book ${book.id} ("${book.title}"): ${insertError.message}`);
            errors++;
          }
        } else {
          ingested++;
          existingIds.add(sourceId);
        }
      } catch (err) {
        console.error(`[${language}] Error processing book ${book.id} ("${book.title}"): ${err}`);
        errors++;
      }
    }

    console.log(`[${language}] Page ${page}/${totalPages} — ingested ${ingested}, skipped ${skipped}, errors ${errors}`);

    nextUrl = pageData.next;
    page++;

    // Small delay between pages
    await sleep(500);
  }

  console.log(`[${language}] Done — ingested ${ingested}, skipped ${skipped}, errors ${errors}`);
  return { ingested, skipped, errors };
}

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  console.log('=== Gutenberg Bulk Ingestion ===');
  console.log(`Languages: ${LANGUAGES.join(', ')}`);
  console.log(`Started at: ${new Date().toISOString()}\n`);

  const results: Record<string, { ingested: number; skipped: number; errors: number }> = {};

  for (const lang of LANGUAGES) {
    try {
      results[lang] = await ingestLanguage(lang);
    } catch (err) {
      console.error(`[${lang}] Fatal error:`, err instanceof Error ? err.message : JSON.stringify(err));
      results[lang] = { ingested: 0, skipped: 0, errors: 1 };
    }
  }

  // Summary
  console.log('\n=== Ingestion Summary ===');
  let totalIngested = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const lang of LANGUAGES) {
    const r = results[lang];
    console.log(`  ${lang}: ${r.ingested} ingested, ${r.skipped} skipped, ${r.errors} errors`);
    totalIngested += r.ingested;
    totalSkipped += r.skipped;
    totalErrors += r.errors;
  }

  console.log(`\n  TOTAL: ${totalIngested} ingested, ${totalSkipped} skipped, ${totalErrors} errors`);
  console.log(`Finished at: ${new Date().toISOString()}`);
}

main().catch((e) => {
  console.error('Ingestion failed:', e);
  process.exit(1);
});
