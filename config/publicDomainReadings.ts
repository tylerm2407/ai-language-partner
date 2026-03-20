/**
 * Curated public-domain book excerpts and texts for advanced reading practice.
 * Used by the reading materials seeding script to populate reading_materials
 * with is_public_domain = true.
 *
 * Add entries here as needed. The seeding script will insert them if not already present.
 */

import type { CEFRLevel, LanguageCode } from '../types';

export interface PublicDomainEntry {
  language: LanguageCode;
  level: CEFRLevel;
  title: string;
  author: string;
  sourceUrl: string;
  isPublicDomain: true;
  downloadUrlPdf?: string;
  downloadUrlEpub?: string;
  tags: string[];
  /** Short excerpt or first chapter to store as the text field.
   *  For full books, provide download URLs and store an excerpt here. */
  excerptWordCount: number;
}

export const PUBLIC_DOMAIN_READINGS: PublicDomainEntry[] = [
  // ─── Spanish ──────────────────────────────────────────────────
  {
    language: 'es',
    level: 'B2',
    title: 'Don Quijote de la Mancha (Excerpt)',
    author: 'Miguel de Cervantes',
    sourceUrl: 'https://www.gutenberg.org/ebooks/2000',
    isPublicDomain: true,
    downloadUrlEpub: 'https://www.gutenberg.org/ebooks/2000.epub.images',
    tags: ['classic', 'novel', 'adventure'],
    excerptWordCount: 2000,
  },
  {
    language: 'es',
    level: 'C1',
    title: 'La Regenta (Excerpt)',
    author: 'Leopoldo Alas (Clarín)',
    sourceUrl: 'https://www.gutenberg.org/ebooks/49836',
    isPublicDomain: true,
    tags: ['classic', 'novel', 'realism'],
    excerptWordCount: 2000,
  },
  {
    language: 'es',
    level: 'C2',
    title: 'Niebla (Excerpt)',
    author: 'Miguel de Unamuno',
    sourceUrl: 'https://www.gutenberg.org/ebooks/49836',
    isPublicDomain: true,
    tags: ['classic', 'novel', 'philosophy', 'existentialism'],
    excerptWordCount: 2500,
  },

  // ─── French ───────────────────────────────────────────────────
  {
    language: 'fr',
    level: 'B2',
    title: 'Le Petit Prince (Excerpt)',
    author: 'Antoine de Saint-Exupéry',
    sourceUrl: 'https://www.gutenberg.org/ebooks/56840',
    isPublicDomain: true,
    tags: ['classic', 'novella', 'philosophy', 'children'],
    excerptWordCount: 1500,
  },
  {
    language: 'fr',
    level: 'C1',
    title: 'Les Misérables (Excerpt)',
    author: 'Victor Hugo',
    sourceUrl: 'https://www.gutenberg.org/ebooks/17489',
    isPublicDomain: true,
    downloadUrlEpub: 'https://www.gutenberg.org/ebooks/17489.epub.images',
    tags: ['classic', 'novel', 'social justice', 'epic'],
    excerptWordCount: 2500,
  },
  {
    language: 'fr',
    level: 'C2',
    title: 'Madame Bovary (Excerpt)',
    author: 'Gustave Flaubert',
    sourceUrl: 'https://www.gutenberg.org/ebooks/14155',
    isPublicDomain: true,
    tags: ['classic', 'novel', 'realism'],
    excerptWordCount: 2500,
  },

  // ─── German ───────────────────────────────────────────────────
  {
    language: 'de',
    level: 'B2',
    title: 'Die Verwandlung (Excerpt)',
    author: 'Franz Kafka',
    sourceUrl: 'https://www.gutenberg.org/ebooks/5200',
    isPublicDomain: true,
    tags: ['classic', 'novella', 'surrealism', 'existentialism'],
    excerptWordCount: 2000,
  },
  {
    language: 'de',
    level: 'C1',
    title: 'Faust (Excerpt)',
    author: 'Johann Wolfgang von Goethe',
    sourceUrl: 'https://www.gutenberg.org/ebooks/14591',
    isPublicDomain: true,
    tags: ['classic', 'drama', 'poetry', 'philosophy'],
    excerptWordCount: 2000,
  },
  {
    language: 'de',
    level: 'C2',
    title: 'Also sprach Zarathustra (Excerpt)',
    author: 'Friedrich Nietzsche',
    sourceUrl: 'https://www.gutenberg.org/ebooks/7205',
    isPublicDomain: true,
    tags: ['classic', 'philosophy', 'prose'],
    excerptWordCount: 2500,
  },

  // ─── Italian ──────────────────────────────────────────────────
  {
    language: 'it',
    level: 'B2',
    title: 'Le avventure di Pinocchio (Excerpt)',
    author: 'Carlo Collodi',
    sourceUrl: 'https://www.gutenberg.org/ebooks/52484',
    isPublicDomain: true,
    tags: ['classic', 'novel', 'children', 'adventure'],
    excerptWordCount: 1500,
  },
  {
    language: 'it',
    level: 'C1',
    title: 'La Divina Commedia — Inferno (Excerpt)',
    author: 'Dante Alighieri',
    sourceUrl: 'https://www.gutenberg.org/ebooks/1012',
    isPublicDomain: true,
    tags: ['classic', 'poetry', 'epic', 'allegory'],
    excerptWordCount: 2000,
  },
  {
    language: 'it',
    level: 'C2',
    title: 'I Promessi Sposi (Excerpt)',
    author: 'Alessandro Manzoni',
    sourceUrl: 'https://www.gutenberg.org/ebooks/35155',
    isPublicDomain: true,
    tags: ['classic', 'novel', 'historical'],
    excerptWordCount: 2500,
  },

  // ─── Japanese ─────────────────────────────────────────────────
  {
    language: 'ja',
    level: 'B2',
    title: '吾輩は猫である (I Am a Cat) — Excerpt',
    author: 'Natsume Sōseki',
    sourceUrl: 'https://www.aozora.gr.jp/cards/000148/card789.html',
    isPublicDomain: true,
    tags: ['classic', 'novel', 'satire'],
    excerptWordCount: 1500,
  },
  {
    language: 'ja',
    level: 'C1',
    title: '羅生門 (Rashōmon)',
    author: 'Akutagawa Ryūnosuke',
    sourceUrl: 'https://www.aozora.gr.jp/cards/000879/card127.html',
    isPublicDomain: true,
    tags: ['classic', 'short story', 'moral ambiguity'],
    excerptWordCount: 2000,
  },
  {
    language: 'ja',
    level: 'C2',
    title: '雪国 (Snow Country) — Excerpt',
    author: 'Kawabata Yasunari',
    sourceUrl: 'https://www.aozora.gr.jp/cards/001224/card49834.html',
    isPublicDomain: true,
    tags: ['classic', 'novel', 'literary'],
    excerptWordCount: 2000,
  },

  // ─── Mandarin Chinese ─────────────────────────────────────────
  {
    language: 'zh',
    level: 'B2',
    title: '阿Q正传 (The True Story of Ah Q) — Excerpt',
    author: 'Lu Xun (鲁迅)',
    sourceUrl: 'https://www.gutenberg.org/ebooks/27166',
    isPublicDomain: true,
    tags: ['classic', 'novella', 'satire', 'social commentary'],
    excerptWordCount: 1500,
  },
  {
    language: 'zh',
    level: 'C1',
    title: '狂人日记 (A Madman\'s Diary)',
    author: 'Lu Xun (鲁迅)',
    sourceUrl: 'https://www.gutenberg.org/ebooks/27166',
    isPublicDomain: true,
    tags: ['classic', 'short story', 'modernism'],
    excerptWordCount: 2000,
  },
  {
    language: 'zh',
    level: 'C2',
    title: '红楼梦 (Dream of the Red Chamber) — Excerpt',
    author: 'Cao Xueqin (曹雪芹)',
    sourceUrl: 'https://ctext.org/hongloumeng',
    isPublicDomain: true,
    tags: ['classic', 'novel', 'epic', 'literary'],
    excerptWordCount: 2500,
  },
];
