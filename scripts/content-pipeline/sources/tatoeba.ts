import { createReadStream, existsSync, createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { resolve } from 'path';
import { createInterface } from 'readline';
import { RawContentItem } from '../shared/types';
import { estimateCefrLevel } from '../shared/cefr-estimator';

const TATOEBA_SENTENCES_URL = 'https://downloads.tatoeba.org/exports/sentences.tar.bz2';
const TATOEBA_LINKS_URL = 'https://downloads.tatoeba.org/exports/links.tar.bz2';

// For direct TSV downloads (no archive extraction needed)
const TATOEBA_SENTENCES_DETAILED_URL =
  'https://downloads.tatoeba.org/exports/sentences_detailed.tsv.bz2';
const TATOEBA_LINKS_CSV_URL = 'https://downloads.tatoeba.org/exports/links.csv';

/**
 * Download Tatoeba sentence and link data for a given language.
 * Downloads the links.csv and per-language sentence files.
 *
 * Note: For a production setup you would download the full archives
 * and extract them. This simplified version downloads the links CSV
 * and expects sentence TSV files to already exist or be placed manually.
 */
export async function downloadTatoeba(language: string, dataDir: string): Promise<void> {
  const dir = resolve(dataDir, 'tatoeba');
  await mkdir(dir, { recursive: true });

  const linksPath = resolve(dir, 'links.csv');
  if (!existsSync(linksPath)) {
    console.log(`Downloading Tatoeba links from ${TATOEBA_LINKS_CSV_URL}...`);
    const response = await fetch(TATOEBA_LINKS_CSV_URL);
    if (!response.ok) {
      throw new Error(`Failed to download links: HTTP ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const ws = createWriteStream(linksPath);
    ws.write(buffer);
    ws.end();
    await new Promise<void>((res, rej) => {
      ws.on('finish', res);
      ws.on('error', rej);
    });
    console.log(`Links saved to ${linksPath}`);
  } else {
    console.log(`Links file already exists at ${linksPath}`);
  }

  console.log(
    `\nTo complete setup, place sentence TSV files in: ${dir}`
  );
  console.log(
    `Expected files:\n  - sentences_eng.tsv (English sentences)\n  - sentences_${language}.tsv (${language} sentences)`
  );
  console.log(
    `\nYou can download the full sentences archive from:\n  ${TATOEBA_SENTENCES_URL}`
  );
  console.log(
    `Or the detailed TSV (bz2) from:\n  ${TATOEBA_SENTENCES_DETAILED_URL}`
  );
}

/**
 * Parse Tatoeba TSV sentence files and link them into English ↔ target pairs.
 *
 * Expected file layout in dataDir/tatoeba/:
 *   - sentences_eng.tsv   — tab-separated: id, lang, text
 *   - sentences_{lang}.tsv — tab-separated: id, lang, text
 *   - links.csv            — tab-separated: id1, id2
 *
 * Yields RawContentItem objects for each linked sentence pair.
 */
export async function* parseTatoeba(
  language: string,
  dataDir: string,
  limit?: number
): AsyncGenerator<RawContentItem> {
  const dir = resolve(dataDir, 'tatoeba');

  const engPath = resolve(dir, 'sentences_eng.tsv');
  const targetPath = resolve(dir, `sentences_${language}.tsv`);
  const linksPath = resolve(dir, 'links.csv');

  if (!existsSync(engPath)) {
    throw new Error(`English sentences file not found: ${engPath}`);
  }
  if (!existsSync(targetPath)) {
    throw new Error(`Target language sentences file not found: ${targetPath}`);
  }
  if (!existsSync(linksPath)) {
    throw new Error(`Links file not found: ${linksPath}`);
  }

  // Load English sentences into memory: id → text
  console.log('Loading English sentences...');
  const engSentences = new Map<string, string>();
  const engStream = createInterface({
    input: createReadStream(engPath, 'utf-8'),
    crlfDelay: Infinity,
  });
  for await (const line of engStream) {
    const parts = line.split('\t');
    if (parts.length >= 3) {
      engSentences.set(parts[0], parts[2]);
    }
  }
  console.log(`Loaded ${engSentences.size} English sentences`);

  // Load target language sentences: id → text
  console.log(`Loading ${language} sentences...`);
  const targetSentences = new Map<string, string>();
  const targetStream = createInterface({
    input: createReadStream(targetPath, 'utf-8'),
    crlfDelay: Infinity,
  });
  for await (const line of targetStream) {
    const parts = line.split('\t');
    if (parts.length >= 3) {
      targetSentences.set(parts[0], parts[2]);
    }
  }
  console.log(`Loaded ${targetSentences.size} ${language} sentences`);

  // Stream through links and yield matched pairs
  console.log('Processing links...');
  const linksStream = createInterface({
    input: createReadStream(linksPath, 'utf-8'),
    crlfDelay: Infinity,
  });

  let count = 0;
  for await (const line of linksStream) {
    if (limit !== undefined && count >= limit) break;

    const parts = line.split('\t');
    if (parts.length < 2) continue;

    const [id1, id2] = parts;

    // Check both directions: eng→target and target→eng
    let engText: string | undefined;
    let targetText: string | undefined;

    if (engSentences.has(id1) && targetSentences.has(id2)) {
      engText = engSentences.get(id1);
      targetText = targetSentences.get(id2);
    } else if (engSentences.has(id2) && targetSentences.has(id1)) {
      engText = engSentences.get(id2);
      targetText = targetSentences.get(id1);
    }

    if (!engText || !targetText) continue;

    const cefrLevel = estimateCefrLevel(targetText, language);

    yield {
      type: 'sentence_pair',
      language,
      cefrLevel,
      nativeText: engText,
      targetText,
      tags: [`en-${language}`, 'tatoeba'],
      sourceDatasetId: 'tatoeba',
      sourceItemId: `${id1}-${id2}`,
    };

    count++;
  }

  console.log(`Yielded ${count} sentence pairs`);
}
