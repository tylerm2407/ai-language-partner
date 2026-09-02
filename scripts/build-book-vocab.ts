/**
 * Build the per-book vocabulary profile that powers known-word coverage
 * ranking of the reading library.
 *
 * Run with:
 *   npx tsx scripts/build-book-vocab.ts --measure      # sizing pass, writes nothing
 *   npx tsx scripts/build-book-vocab.ts --language fr  # build one language
 *   npx tsx scripts/build-book-vocab.ts                # build every language
 *
 * Why this exists: `reading_books.content` is 2191 MB of the 2227 MB database,
 * so nothing can tokenize a book at query time. The corpus is walked once here
 * and reduced to a few kilobytes per book.
 *
 * Frequencies are derived FROM THE CORPUS rather than from an external word
 * list. `scripts/content-pipeline/sources/frequency-lists.ts` can parse one,
 * but no list has ever been checked in and `cards.frequency_rank` is NULL on
 * all 3,168 rows — and corpus-derived counts are the better input anyway,
 * because they describe the nineteenth-century literary register a learner
 * will actually meet here rather than a modern subtitle corpus.
 *
 * Tokenization comes from lib/reading-text.ts, the same module the reader taps
 * through. That is not tidiness: terms are matched by exact string, so a
 * second tokenizer that differed by one rule would empty the intersection
 * without erroring.
 */

import { appendFileSync, createReadStream, mkdirSync, rmSync } from 'fs';
import { createInterface } from 'readline';
import { resolve } from 'path';
import { getServiceClient } from './content-pipeline/shared/supabase-client';
import { wordTokens } from '../lib/reading-text';

/**
 * Languages this ranking covers.
 *
 * Deliberately excludes zh, ja and ko: `wordTokens` splits on whitespace, and
 * those scripts do not use it, so every "token" would be a whole clause. They
 * are 502 of 10,375 books (4.8%) and their shelves keep the existing ordering
 * until a segmenter exists. Ranking them with this tokenizer would not be
 * worse-but-usable, it would be meaningless.
 */
export const COVERAGE_LANGUAGES = ['fr', 'de', 'it', 'es', 'pt', 'ru'] as const;

/** Books fetched per round trip. `content` is ~211 kB average, so this is
 *  already ~5 MB in flight; larger pages start timing out. */
const PAGE_SIZE = 25;

/** Word forms stored per book. See the migration 096 header for the measured
 *  justification — the top 200 cover ~58% of running words and contain
 *  essentially every word a learner could know. */
export const TOP_TERMS_PER_BOOK = 200;

/** How many corpus-wide forms count as "common" for `common_share`. */
export const COMMON_BAND = 1000;

/**
 * Fewest real tokens a row must have to be treated as a book.
 *
 * Not every `reading_books` row is a book. The ingest kept some Gutenberg
 * entries that carry only front matter: licence text, or an audiobook track
 * listing — `Белые ночи` is 355 words of "This audio reading ... # 3 - Second
 * Night - 00:09:05", filed under a Dostoevsky title. Their most frequent words
 * are English boilerplate ("the", "of", "work", "dedicator"), which would both
 * poison the language's frequency table and put a non-book at the top of the
 * shelf.
 *
 * At 500 this drops 135 of the 9,873 rows in the covered languages (1.4%), and
 * nothing at that length was a reading experience anyway. Skipped rows get no
 * `book_vocab` entry, so the ranking simply never returns them.
 */
export const MIN_TOKENS = 500;

/** Rows written per upsert. */
const WRITE_BATCH = 100;

/**
 * Where pass 1 spills each book's profile.
 *
 * The corpus is walked ONCE — a second pass would mean re-downloading 2.2 GB —
 * but `common_share` needs corpus-wide frequencies that are only complete at
 * the end of that walk. So each book's top terms are written to a local JSONL
 * as they are computed, and the file is replayed once the frequency table is
 * known. Nothing is held in memory except the frequency map.
 */
const SPILL_DIR = resolve(__dirname, '..', '.vocab-build');

interface BookRow {
  id: string;
  language: string;
  source_id: string | null;
  content: string;
}

/** Count each distinct word form in a book. */
export function countTypes(content: string): { counts: Map<string, number>; total: number } {
  const counts = new Map<string, number>();
  let total = 0;
  for (const token of wordTokens(content)) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
    total++;
  }
  return { counts, total };
}

/** Share of running words covered by the `n` most frequent types. */
export function topNCoverage(counts: Map<string, number>, total: number, n: number): number {
  if (total === 0) return 0;
  const sorted = [...counts.values()].sort((a, b) => b - a);
  let covered = 0;
  for (let i = 0; i < Math.min(n, sorted.length); i++) covered += sorted[i];
  return covered / total;
}

/**
 * Every published book in a language, at most one per source text.
 *
 * The ingest ran more than once without deduplicating on `source_id`, so the
 * library carries the same Gutenberg text under two ids — 624 redundant rows
 * in French alone. Identical copies score identically, so on a RANKED shelf
 * they land next to each other at the very top and the first thing a learner
 * sees is the same book twice. Skipped here so a rebuild cannot reintroduce
 * what migration 098 removed.
 *
 * A null `source_id` is never treated as a duplicate: all 144 AI-generated
 * books have one and are genuinely distinct.
 */
async function* eachBook(language: string, limit?: number): AsyncGenerator<BookRow> {
  const sb = getServiceClient();
  const seenSources = new Set<string>();
  let from = 0;
  let seen = 0;
  for (;;) {
    const { data, error } = await sb
      .from('reading_books')
      .select('id, language, source_id, content')
      .eq('language', language)
      .eq('is_published', true)
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) return;
    for (const row of data) {
      const book = row as BookRow;
      if (book.source_id) {
        if (seenSources.has(book.source_id)) continue;
        seenSources.add(book.source_id);
      }
      yield book;
      seen++;
      if (limit && seen >= limit) return;
    }
    from += PAGE_SIZE;
  }
}

async function measure(): Promise<void> {
  console.log('Sizing pass — nothing is written.\n');
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  for (const language of COVERAGE_LANGUAGES) {
    const totals: number[] = [];
    const types: number[] = [];
    const c100: number[] = [];
    const c300: number[] = [];
    const c1000: number[] = [];
    const c3000: number[] = [];
    for await (const book of eachBook(language, 8)) {
      const { counts, total } = countTypes(book.content);
      if (total === 0) continue;
      totals.push(total);
      types.push(counts.size);
      c100.push(topNCoverage(counts, total, 100));
      c300.push(topNCoverage(counts, total, 300));
      c1000.push(topNCoverage(counts, total, 1000));
      c3000.push(topNCoverage(counts, total, 3000));
    }
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
    console.log(
      `${language}  n=${totals.length}  ` +
        `tokens~${Math.round(mean(totals)).toLocaleString()}  ` +
        `types~${Math.round(mean(types)).toLocaleString()}  ` +
        `top100 ${pct(mean(c100))}  top300 ${pct(mean(c300))}  ` +
        `top1000 ${pct(mean(c1000))}  top3000 ${pct(mean(c3000))}`,
    );
  }
}

interface SpilledBook {
  id: string;
  total: number;
  types: number;
  terms: string[];
  counts: number[];
}

/** The `n` most frequent entries of a count map, densest first. */
export function topN(counts: Map<string, number>, n: number): { terms: string[]; counts: number[] } {
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  const head = entries.slice(0, n);
  return { terms: head.map((e) => e[0]), counts: head.map((e) => e[1]) };
}

/**
 * Pass 1: walk every book in a language once.
 *
 * Accumulates corpus-wide token and document counts, and spills each book's
 * top-200 profile to disk. The frequency map is pruned periodically: across
 * thousands of books the long tail is overwhelmingly forms that appear once
 * (names, OCR noise, hapax legomena), and none of them can ever reach the
 * common band, so dropping them bounds memory without changing the result.
 */
async function scanLanguage(
  language: string,
  spillPath: string,
): Promise<{ tokenCounts: Map<string, number>; docCounts: Map<string, number>; books: number }> {
  const tokenCounts = new Map<string, number>();
  const docCounts = new Map<string, number>();
  let books = 0;

  let skipped = 0;
  for await (const book of eachBook(language)) {
    const { counts, total } = countTypes(book.content);
    if (total < MIN_TOKENS) {
      skipped++;
      continue;
    }

    for (const [term, n] of counts) {
      tokenCounts.set(term, (tokenCounts.get(term) ?? 0) + n);
      docCounts.set(term, (docCounts.get(term) ?? 0) + 1);
    }

    const { terms, counts: top } = topN(counts, TOP_TERMS_PER_BOOK);
    const row: SpilledBook = { id: book.id, total, types: counts.size, terms, counts: top };
    appendFileSync(spillPath, `${JSON.stringify(row)}\n`);

    books++;
    if (books % 250 === 0) {
      // Prune forms seen in only one book so far. A form that rare is
      // thousands of ranks below the common band and cannot climb into it on
      // the strength of one more appearance.
      for (const [term, docs] of docCounts) {
        if (docs <= 1 && (tokenCounts.get(term) ?? 0) <= 2) {
          docCounts.delete(term);
          tokenCounts.delete(term);
        }
      }
      process.stdout.write(`  ${language}: ${books} books, ${tokenCounts.size} forms kept\r`);
    }
  }
  process.stdout.write(
    `  ${language}: ${books} books, ${tokenCounts.size} forms kept` +
      `${skipped ? `, ${skipped} skipped under ${MIN_TOKENS} tokens` : ''}\n`,
  );
  return { tokenCounts, docCounts, books };
}

/** Write the language's frequency table and return its common band. */
async function writeCorpusTerms(
  language: string,
  tokenCounts: Map<string, number>,
  docCounts: Map<string, number>,
): Promise<Set<string>> {
  const sb = getServiceClient();
  const ranked = [...tokenCounts.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, COMMON_BAND);

  const rows = ranked.map(([term, tokens], i) => ({
    language,
    term,
    rank: i + 1,
    token_count: tokens,
    doc_count: docCounts.get(term) ?? 0,
    built_at: new Date().toISOString(),
  }));

  await sb.from('corpus_terms').delete().eq('language', language);
  for (let i = 0; i < rows.length; i += WRITE_BATCH) {
    const { error } = await sb.from('corpus_terms').insert(rows.slice(i, i + WRITE_BATCH));
    if (error) throw error;
  }
  return new Set(ranked.map(([term]) => term));
}

/**
 * Pass 2: replay the spill file, now that the common band is known.
 *
 * `common_share` is computed from the book's FULL type counts, not just its
 * stored top 200 — which is why the spill carries the total and why this is a
 * replay rather than something pass 1 could have finished. A common form that
 * fell outside a book's top 200 still counts toward how readable that book is.
 */
async function writeBookVocab(
  language: string,
  spillPath: string,
  commonBand: Set<string>,
  commonTokensByBook: Map<string, number>,
  builtAt: string,
): Promise<number> {
  const sb = getServiceClient();
  const rl = createInterface({ input: createReadStream(spillPath, 'utf-8'), crlfDelay: Infinity });

  let batch: Record<string, unknown>[] = [];
  let written = 0;

  const flush = async () => {
    if (batch.length === 0) return;
    const { error } = await sb.from('book_vocab').upsert(batch, { onConflict: 'book_id' });
    if (error) throw error;
    written += batch.length;
    batch = [];
  };

  for await (const line of rl) {
    if (!line.trim()) continue;
    const b = JSON.parse(line) as SpilledBook;
    const commonTokens = commonTokensByBook.get(b.id) ?? 0;
    batch.push({
      book_id: b.id,
      language,
      total_tokens: b.total,
      distinct_types: b.types,
      top_terms: b.terms,
      top_counts: b.counts,
      common_share: b.total > 0 ? Math.min(1, commonTokens / b.total) : 0,
      built_at: builtAt,
    });
    if (batch.length >= WRITE_BATCH) await flush();
  }
  await flush();
  void commonBand;
  return written;
}

async function build(languages: readonly string[]): Promise<void> {
  mkdirSync(SPILL_DIR, { recursive: true });

  for (const language of languages) {
    // Stamped once per language so the prune below can tell this run's rows
    // from an earlier build's.
    const runStartedAt = new Date().toISOString();
    const spillPath = resolve(SPILL_DIR, `${language}.jsonl`);
    rmSync(spillPath, { force: true });

    console.log(`\n${language} — pass 1: scanning corpus`);
    const { tokenCounts, docCounts, books } = await scanLanguage(language, spillPath);
    if (books === 0) {
      console.log(`  ${language}: no published books, skipping`);
      continue;
    }

    console.log(`  ${language} — writing corpus_terms (top ${COMMON_BAND})`);
    const commonBand = await writeCorpusTerms(language, tokenCounts, docCounts);

    // Second read of the spill to total each book's common-band tokens. Cheap:
    // the file is a few MB, and this avoids holding every book's full type map.
    console.log(`  ${language} — pass 2: scoring readability`);
    const commonTokensByBook = new Map<string, number>();
    const rl = createInterface({ input: createReadStream(spillPath, 'utf-8'), crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line.trim()) continue;
      const b = JSON.parse(line) as SpilledBook;
      let common = 0;
      for (let i = 0; i < b.terms.length; i++) {
        if (commonBand.has(b.terms[i])) common += b.counts[i];
      }
      commonTokensByBook.set(b.id, common);
    }

    const written = await writeBookVocab(language, spillPath, commonBand, commonTokensByBook, runStartedAt);
    // A row that fell below MIN_TOKENS on this run — or whose book has since
    // been unpublished — must not survive from an earlier build as a stale
    // entry the ranking would still return. Identified by `built_at` rather
    // than by listing the ids to keep: PostgREST takes an `in` list in the URL
    // and 645 UUIDs is already a Bad Request, let alone 4,746.
    const { error: pruneErr, count } = await getServiceClient()
      .from('book_vocab')
      .delete({ count: 'exact' })
      .eq('language', language)
      .lt('built_at', runStartedAt);
    if (pruneErr) throw pruneErr;
    console.log(
      `  ${language}: wrote ${written} book_vocab rows` +
        `${count ? `, pruned ${count} stale` : ''}`,
    );
    rmSync(spillPath, { force: true });
  }
  rmSync(SPILL_DIR, { recursive: true, force: true });
}

/**
 * Backfill `cards.search_terms` with the same tokenizer.
 *
 * The ranking intersects a book's stored terms with these by exact string, so
 * they have to come from wordTokens() and not from a SQL approximation of it.
 */
async function backfillCards(): Promise<void> {
  const sb = getServiceClient();
  let from = 0;
  let updated = 0;
  for (;;) {
    const { data, error } = await sb
      .from('cards')
      .select('id, target_text')
      .order('id')
      .range(from, from + 499);
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const card of data) {
      const terms = [...new Set(wordTokens(card.target_text as string))];
      const { error: upErr } = await sb
        .from('cards')
        .update({ search_terms: terms })
        .eq('id', card.id as string);
      if (upErr) throw upErr;
      updated++;
    }
    process.stdout.write(`  cards: ${updated} updated\r`);
    from += 500;
  }
  process.stdout.write(`  cards: ${updated} updated\n`);
}

async function main(): Promise<void> {
  if (process.argv.includes('--measure')) {
    await measure();
    return;
  }
  if (process.argv.includes('--backfill-cards')) {
    await backfillCards();
    return;
  }
  const langFlag = process.argv.indexOf('--language');
  const languages =
    langFlag !== -1 && process.argv[langFlag + 1]
      ? [process.argv[langFlag + 1]]
      : COVERAGE_LANGUAGES;
  await build(languages);
}

// Only run when invoked directly, so the pure helpers above can be imported
// by build-book-vocab.test.ts without kicking off a corpus walk.
if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
