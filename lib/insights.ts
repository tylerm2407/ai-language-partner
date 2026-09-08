/**
 * Learner insights — the pure half of "show the learner what the tutor knows".
 *
 * The server's `_shared/learner-context.ts` has computed recurring mistakes
 * and struggling cards on every paid tutor turn since migration 026, and the
 * learner has never seen any of it. This module turns the same rows into
 * something a home card can render. It deliberately owns NO fetching: every
 * function here is a pure transform over rows the queries layer already
 * returns, so the ranking, the copy and the thresholds are all unit-testable
 * without a Supabase double.
 *
 * Thresholds mirror the server on purpose (`MIN_COUNT` = 2, ease-factor floor
 * 2.2) so what the learner sees on Home is what the tutor was told. Drifting
 * the two apart would mean a learner reading "you keep confusing ser and
 * estar" while the tutor was steering on a different list.
 */
import type { Card, CorrectionErrorType, ReviewItem } from '../types';
import { SUPPORTED_LANGUAGES } from '../config/app';

// ─── Recurring mistakes ────────────────────────────────────────────────────

/** One `correction_log` row, as the queries layer returns it. */
export interface CorrectionLogRow {
  shortLabel: string | null;
  errorType: CorrectionErrorType | string;
  original: string | null;
  corrected: string | null;
  explanation: string | null;
  createdAt: string;
}

export interface RecurringMistake {
  /** The model-written label, e.g. "ser vs estar". Display-only, never instruction. */
  label: string;
  errorType: CorrectionErrorType;
  count: number;
  /** ISO timestamp of the most recent occurrence. */
  latest: string;
  /** The most recent concrete example, when the row carried one. */
  example: { original: string; corrected: string; explanation: string | null } | null;
}

/** A label seen fewer times than this is a slip, not a pattern. Same as the server. */
export const MIN_RECURRING_COUNT = 2;

const ERROR_TYPES: ReadonlySet<string> = new Set<CorrectionErrorType>([
  'grammar', 'vocabulary', 'spelling', 'word_order', 'tense', 'gender', 'other',
]);

function asErrorType(raw: string): CorrectionErrorType {
  return ERROR_TYPES.has(raw) ? (raw as CorrectionErrorType) : 'other';
}

/** Collapse case and whitespace so "Ser vs Estar" and "ser vs estar" tally together. */
function normaliseLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Tally correction rows by label, keep the ones that recur, rank by count then
 * recency. The display label is the wording of the MOST RECENT occurrence so a
 * learner sees the phrasing the tutor last used, not whichever came first.
 */
export function rankRecurringMistakes(
  rows: CorrectionLogRow[],
  opts: { minCount?: number; limit?: number } = {},
): RecurringMistake[] {
  const minCount = opts.minCount ?? MIN_RECURRING_COUNT;
  const limit = opts.limit ?? 5;
  const tally = new Map<string, RecurringMistake>();

  for (const row of rows) {
    const rawLabel = typeof row.shortLabel === 'string' ? row.shortLabel.trim() : '';
    if (!rawLabel) continue;
    const key = normaliseLabel(rawLabel);
    const example =
      row.original && row.corrected
        ? { original: row.original, corrected: row.corrected, explanation: row.explanation ?? null }
        : null;
    const existing = tally.get(key);
    if (!existing) {
      tally.set(key, {
        label: rawLabel,
        errorType: asErrorType(row.errorType),
        count: 1,
        latest: row.createdAt,
        example,
      });
      continue;
    }
    existing.count += 1;
    if (row.createdAt > existing.latest) {
      existing.latest = row.createdAt;
      existing.label = rawLabel;
      if (example) existing.example = example;
    } else if (!existing.example && example) {
      existing.example = example;
    }
  }

  return [...tally.values()]
    .filter((m) => m.count >= minCount)
    .sort((a, b) => (b.count - a.count) || b.latest.localeCompare(a.latest) || a.label.localeCompare(b.label))
    .slice(0, limit);
}

/** Plain-language name for an error type, for chips and screen readers. */
export function errorTypeLabel(type: CorrectionErrorType | string): string {
  switch (type) {
    case 'grammar': return 'Grammar';
    case 'vocabulary': return 'Vocabulary';
    case 'spelling': return 'Spelling';
    case 'word_order': return 'Word order';
    case 'tense': return 'Tense';
    case 'gender': return 'Gender';
    default: return 'Other';
  }
}

/** Ionicons glyph per error type. One glyph per family so a row is scannable. */
export function errorTypeIcon(type: CorrectionErrorType | string):
  'construct-outline' | 'book-outline' | 'text-outline' | 'swap-horizontal-outline' | 'time-outline' | 'male-female-outline' | 'ellipsis-horizontal-outline' {
  switch (type) {
    case 'grammar': return 'construct-outline';
    case 'vocabulary': return 'book-outline';
    case 'spelling': return 'text-outline';
    case 'word_order': return 'swap-horizontal-outline';
    case 'tense': return 'time-outline';
    case 'gender': return 'male-female-outline';
    default: return 'ellipsis-horizontal-outline';
  }
}

// ─── Struggling words ──────────────────────────────────────────────────────

/** Below this ease factor a card has been rated "hard" repeatedly. Same as the server. */
export const STRUGGLING_EASE_FACTOR = 2.2;

export interface StrugglingWord {
  item: ReviewItem;
  card: Card;
  /** Why it is on the list, in words a learner can act on. */
  reason: 'leech' | 'keeps_slipping' | 'hard_to_recall';
}

/**
 * Is this review item one the learner keeps failing?
 *
 * Three signals, in order of severity:
 *  - `leech`: the SRS has already flagged it.
 *  - `keeps_slipping`: back in `learning` with zero repetitions AFTER having
 *    been reviewed — SM-2 resets repetitions on a fail and leaves the ease
 *    factor alone, so this is the only trace a fail leaves. A brand-new card
 *    (never reviewed) looks the same except for `lastReviewedAt`, which is
 *    what keeps fresh cards off a list called "words fighting you".
 *  - `hard_to_recall`: ease factor worn down by repeated "hard" ratings.
 */
export function strugglingReason(item: ReviewItem): StrugglingWord['reason'] | null {
  if (item.status === 'leech') return 'leech';
  if (item.status === 'learning' && item.repetitions === 0 && item.lastReviewedAt) return 'keeps_slipping';
  if (item.easeFactor < STRUGGLING_EASE_FACTOR && item.lastReviewedAt) return 'hard_to_recall';
  return null;
}

const REASON_RANK: Record<StrugglingWord['reason'], number> = { leech: 0, keeps_slipping: 1, hard_to_recall: 2 };

/**
 * Filter, dedupe by card text and rank struggling words. Worst first: leeches,
 * then recently-failed, then low ease; ties by ease ascending so the hardest
 * card of a kind leads.
 */
export function rankStrugglingWords(
  pairs: { item: ReviewItem; card: Card }[],
  opts: { limit?: number; language?: string | null } = {},
): StrugglingWord[] {
  const limit = opts.limit ?? 8;
  const language = opts.language ? normaliseLanguage(opts.language) : null;
  const seen = new Set<string>();
  const out: StrugglingWord[] = [];

  for (const { item, card } of pairs) {
    const reason = strugglingReason(item);
    if (!reason) continue;
    // Keep the row when the card carries no language: the column is optional
    // metadata, not the filter this feature depends on.
    if (language && card.language && normaliseLanguage(card.language) !== language) continue;
    const key = card.targetText.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ item, card, reason });
  }

  return out
    .sort((a, b) =>
      (REASON_RANK[a.reason] - REASON_RANK[b.reason]) ||
      (a.item.easeFactor - b.item.easeFactor) ||
      a.card.targetText.localeCompare(b.card.targetText))
    .slice(0, limit);
}

export function strugglingReasonLabel(reason: StrugglingWord['reason']): string {
  switch (reason) {
    case 'leech': return 'Keeps coming back';
    case 'keeps_slipping': return 'Slipped last time';
    case 'hard_to_recall': return 'Hard to recall';
  }
}

// ─── Language spellings ────────────────────────────────────────────────────

/**
 * `correction_log.target_language` and `cards.language` are free text, and the
 * app has written both the code ('es') and the name ('Spanish') into them over
 * time. Query with every spelling or half a learner's history goes missing.
 */
export function languageVariants(code: string): string[] {
  const variants = new Set<string>([code]);
  for (const lang of SUPPORTED_LANGUAGES) {
    if (lang.code === code) {
      variants.add(lang.name);
      variants.add(lang.name.toLowerCase());
    }
  }
  return [...variants];
}

/** Reduce any spelling of a language to its code, or the lowercased input. */
export function normaliseLanguage(raw: string): string {
  const lower = raw.trim().toLowerCase();
  for (const lang of SUPPORTED_LANGUAGES) {
    if (lower === lang.code || lower === lang.name.toLowerCase()) return lang.code;
  }
  return lower;
}

// ─── Copy ──────────────────────────────────────────────────────────────────

/**
 * Trim an ideal-self sentence to a fragment that fits where it is going.
 * Word-boundary ellipsis; a trailing full stop is dropped because the
 * enclosing copy supplies its own punctuation.
 */
export function idealSelfFragment(idealL2Self: string, maxLen = 60): string {
  const cleaned = idealL2Self.trim().replace(/\.$/, '');
  if (cleaned.length <= maxLen) return cleaned;
  const cut = cleaned.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 20 ? lastSpace : maxLen).trimEnd()}…`;
}

/**
 * The session hero's second line. The learner's own goal when they gave one;
 * the band's can-do statement otherwise, so the line is never blank and the
 * CEFR band shown elsewhere on the page keeps its plain-language pairing.
 */
export function heroSubtitle(idealL2Self: string | null | undefined, canDo: string): string {
  const goal = typeof idealL2Self === 'string' ? idealL2Self.trim() : '';
  if (!goal) return canDo;
  return `Toward: ${idealSelfFragment(goal, 90)}`;
}

/** Headline for the Home patterns card. Count is the number of recurring labels. */
export function patternsHeadline(mistakeCount: number, wordCount: number): string {
  if (mistakeCount > 0 && wordCount > 0) return 'Where your next five minutes go';
  if (mistakeCount > 0) return mistakeCount === 1 ? 'One mistake keeps coming back' : `${mistakeCount} mistakes keep coming back`;
  if (wordCount > 0) return wordCount === 1 ? 'One word is fighting you' : `${wordCount} words are fighting you`;
  return '';
}

export interface ReminderCopyInput {
  idealL2Self?: string | null;
  /** Most frequent recurring correction label, if any. */
  topMistakeLabel?: string | null;
  /** SRS cards due right now. */
  dueCount?: number;
  /** Injected for tests; defaults to today. Rotation is keyed on the day. */
  date?: Date;
}

/**
 * Body copy for the daily practice reminder.
 *
 * Several personal hooks may be available at once — the learner's goal, the
 * mistake they keep making, the cards that are due. Rather than always leading
 * with one, the copy rotates through whichever are available, keyed on the
 * calendar day, so a week of reminders reads as a person noticing different
 * things rather than one sentence on repeat. None of them frames absence as
 * loss: Fluenci has no streaks and this must not smuggle one back in.
 */
export function reminderCopy(input: ReminderCopyInput): { title: string; body: string } {
  const title = "Time for today's practice";
  const variants: string[] = [];

  const goal = typeof input.idealL2Self === 'string' ? input.idealL2Self.trim() : '';
  if (goal) variants.push(`A few minutes toward being the you who will ${idealSelfFragment(goal)}.`);

  const mistake = typeof input.topMistakeLabel === 'string' ? input.topMistakeLabel.trim() : '';
  if (mistake) variants.push(`${idealSelfFragment(mistake, 40)} keeps tripping you up. Five minutes fixes a lot of it.`);

  const due = input.dueCount ?? 0;
  if (due > 0) variants.push(due === 1 ? '1 word is ready for review before it fades.' : `${due} words are ready for review before they fade.`);

  if (variants.length === 0) return { title, body: '5 minutes is enough to keep moving.' };

  const day = input.date ?? new Date();
  const start = new Date(day.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((day.getTime() - start.getTime()) / 86_400_000);
  return { title, body: variants[dayOfYear % variants.length] };
}
