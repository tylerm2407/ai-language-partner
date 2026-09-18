/**
 * Generates lib/script-input/ja-kanji-readings.ts — one kanji at a time.
 *
 * WHY A SECOND JAPANESE TABLE. ja-lexicon.ts converts whole words, which is
 * what a learner wants and what almost every row asks for. But 87 of the 90
 * Japanese rows that could not be typed at all are `fill_blank` answers, and a
 * fill-blank answer is a FRAGMENT rather than a word: 乳 is the tail of 牛乳,
 * 護師 the tail of 看護師, 人公 the middle of 主人公. Not one of the 90 is a
 * whole word, so no word list — not JMdict, not any dictionary — contains them.
 * Sixty are a single character.
 *
 * A fragment is always spellable one character at a time, so that is what this
 * table is for. It is the fallback under the word lexicon, not a replacement:
 * a learner typing `sakana` still gets 魚 as one candidate from the word list.
 *
 * Readings come from Unihan's `kJapanese`, which is already written in kana
 * (U+4E73 -> ニュウ ジュ ニュ ちち ち), so on-readings and kun-readings both
 * arrive in the form a learner will have typed. Unicode licence, same source
 * the Chinese table uses.
 *
 * SCOPE IS JIS X 0208, NOT THE CURRICULUM. Every other generated table here is
 * scoped to what the courses teach, and this one deliberately is not. The
 * numbered files in supabase/migrations are a record of intent rather than the
 * applied history, so scoping to them dropped nine kanji that are in the live
 * Japanese answers — 我, 漢, 席, 壊 among them — and nothing but counting would
 * have caught it. Scoping to the Joyo list fixed eight of the nine and left
 * 噛, which is ordinary Japanese and simply not on that list.
 *
 * JIS X 0208 is the standard Japanese character set: what a Japanese keyboard
 * has been able to produce for forty years. Taking all of it costs about 110KB
 * and ends the whole class of bug where a content patch makes some kanji
 * untypeable. Ordering still puts the curriculum first, so the extra 4,000
 * characters cost nothing but bytes.
 *
 * Run: node scripts/gen-ja-kanji-readings.mjs <Unihan_Readings.txt> <Unihan_OtherMappings.txt>
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const unihanPath = process.argv[2];
const mappingsPath = process.argv[3];
if (!unihanPath || !mappingsPath) {
  console.error(
    'usage: node scripts/gen-ja-kanji-readings.mjs <Unihan_Readings.txt> <Unihan_OtherMappings.txt>',
  );
  process.exit(1);
}

/** Katakana to hiragana: the converter emits hiragana, so readings match there. */
function toHiragana(s) {
  return s.replace(/[ァ-ヶ]/g, (ch) => String.fromCodePoint(ch.codePointAt(0) - 0x60));
}

/** kanji -> readings, in Unihan's order (on-readings first, then kun). */
const readings = new Map();
for (const line of readFileSync(unihanPath, 'utf8').split('\n')) {
  if (line[0] !== 'U') continue;
  const [cp, field, value] = line.split('\t');
  if (field !== 'kJapanese') continue;
  const code = parseInt(cp.slice(2), 16);
  if (code < 0x4e00 || code > 0x9fff) continue;
  const kana = [
    ...new Set(
      value
        .trim()
        .split(/\s+/)
        .map((r) => toHiragana(r).replace(/[^ぁ-ゖー]/g, ''))
        .filter(Boolean),
    ),
  ];
  if (kana.length) readings.set(String.fromCodePoint(code), kana);
}

/** JIS X 0208 — the standard set — and Joyo within it, which ranks higher. */
const jis = new Set();
const joyo = new Set();
for (const line of readFileSync(mappingsPath, 'utf8').split('\n')) {
  if (line[0] !== 'U') continue;
  const [cp, field] = line.split('\t');
  if (field !== 'kJis0' && field !== 'kJoyoKanji') continue;
  const code = parseInt(cp.slice(2), 16);
  if (code < 0x4e00 || code > 0x9fff) continue;
  const ch = String.fromCodePoint(code);
  jis.add(ch);
  if (field === 'kJoyoKanji') joyo.add(ch);
}

// ─── Which kanji the Japanese courses actually use ──────────────────
const sources = [join(root, 'supabase', 'seed.sql'), join(root, 'supabase', 'seed-content.sql')];
const migrations = join(root, 'supabase', 'migrations');
for (const f of readdirSync(migrations)) if (f.endsWith('.sql')) sources.push(join(migrations, f));

const HAN = /[一-鿿]/g;
const KANA = /[぀-ヿ]/;
/** Seen anywhere in the curriculum; weighted up when seen in Japanese context. */
const weight = new Map();

for (const path of sources) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    continue;
  }
  for (const line of text.split('\n')) {
    // A line carrying kana is Japanese content. The seed file holds Chinese
    // too, and both are Han — kana is what separates them. Chinese-only
    // characters still get in (they are real kanji with real readings), they
    // just sort below the ones the Japanese course teaches.
    const japanese = KANA.test(line);
    for (const ch of line.match(HAN) ?? []) {
      weight.set(ch, (weight.get(ch) ?? 0) + (japanese ? 10 : 1));
    }
  }
}

// ─── Emit ───────────────────────────────────────────────────────────
// Curriculum use dominates; Joyo breaks ties among characters the courses
// never touch, so a learner typing こう sees 高 before some rare homophone.
for (const ch of jis) weight.set(ch, (weight.get(ch) ?? 0) + (joyo.has(ch) ? 3 : 0));

const entries = [...weight.entries()]
  .filter(([ch]) => readings.has(ch))
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  .map(([ch]) => `${readings.get(ch).join('|')}\t${ch}`);

const out = `/**
 * Kanji readings, one character at a time, for the in-app Japanese input.
 *
 * GENERATED by scripts/gen-ja-kanji-readings.mjs — do not edit by hand.
 * Readings are Unihan's \`kJapanese\` (Unicode, Unicode licence), folded to
 * hiragana because that is what the romaji converter produces.
 *
 * This is the FALLBACK under ja-lexicon.ts. Whole words come from the word
 * list and rank above these; a single character is what makes a fill-blank
 * fragment — 乳 out of 牛乳, 護師 out of 看護師 — typeable at all, since no
 * dictionary holds a fragment.
 *
 * Ordered by how much the Japanese courses use each character, so the common
 * reading of a common kanji is the first candidate rather than the twentieth.
 *
 * ${entries.length} characters: JIS X 0208 plus anything else the courses use.
 */

/** \`reading|reading\\tkanji\`, one per line, most used first. */
export const JA_KANJI_READINGS = \`${entries.join('\n')}\`;
`;

writeFileSync(join(root, 'lib', 'script-input', 'ja-kanji-readings.ts'), out);
console.log(`kanji: ${entries.length}  jis: ${jis.size}  joyo: ${joyo.size}  bytes: ${out.length}`);
