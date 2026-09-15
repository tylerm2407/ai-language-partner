// Comprehension questions for a daily-news article (migration 129).
//
// Three four-option questions in the target language, generated right after
// the article through `generateValidated` — the same safety gate and the same
// CEFR band the article itself went through (CLAUDE.md §1.1). The shape is
// validated strictly here before anything is stored, because
// `record_news_reading` grades against the stored JSON blind: an option array
// of three, or an `answer` of 4, would make a question impossible to get right
// and silently lower every learner's reading evidence for that article.
//
// A failure here never loses the article. The cron stores `questions: null`
// and logs; the client hides the check for that article.

import { generateValidated, type ValidatedGenerateOpts, type ValidatedResult } from '../_shared/validated-generate.ts';
import type { CEFR } from '../_shared/level-checker.ts';

export interface NewsQuestion {
  question: string;
  /** Exactly four, in the target language. */
  options: string[];
  /** Index into `options`. */
  answer: number;
}

export const QUESTION_COUNT = 3;
export const OPTION_COUNT = 4;
/** An option is a short answer, not a sentence. Longer than this and the
 *  four-option list no longer fits a phone screen without scrolling inside
 *  the card. */
export const MAX_OPTION_CHARS = 80;
export const MAX_QUESTION_CHARS = 200;

// Sentinel used by the generateValidated fallback: an explicit "nothing" that
// the shape check rejects, so a safety or provider failure lands on the same
// null path as a malformed answer.
const QUESTIONS_FALLBACK_SENTINEL = '__DAILY_NEWS_QUESTIONS_FALLBACK__';

export function stripCodeFences(s: string): string {
  return s
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
}

export type QuestionValidation =
  | { ok: true; questions: NewsQuestion[] }
  | { ok: false; reason: string };

function nonEmptyString(v: unknown, max: number): v is string {
  return typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max;
}

/**
 * Accepts either a bare array or `{ questions: [...] }` (the prompt asks for
 * the latter; models sometimes return the former). Everything else is a
 * reason, never a partial result — two good questions and one broken one is
 * still an article the RPC cannot grade fairly.
 */
export function validateQuestions(value: unknown): QuestionValidation {
  const list = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as { questions?: unknown }).questions)
      ? (value as { questions: unknown[] }).questions
      : null;
  if (!list) return { ok: false, reason: 'not an array' };
  if (list.length !== QUESTION_COUNT) {
    return { ok: false, reason: `expected ${QUESTION_COUNT} questions, got ${list.length}` };
  }

  const questions: NewsQuestion[] = [];
  for (let i = 0; i < list.length; i++) {
    const q = list[i] as { question?: unknown; options?: unknown; answer?: unknown } | null;
    if (!q || typeof q !== 'object') return { ok: false, reason: `question ${i + 1}: not an object` };
    if (!nonEmptyString(q.question, MAX_QUESTION_CHARS)) {
      return { ok: false, reason: `question ${i + 1}: empty or overlong question` };
    }
    if (!Array.isArray(q.options) || q.options.length !== OPTION_COUNT) {
      return { ok: false, reason: `question ${i + 1}: expected ${OPTION_COUNT} options` };
    }
    const options: string[] = [];
    for (let j = 0; j < q.options.length; j++) {
      const o = q.options[j];
      if (!nonEmptyString(o, MAX_OPTION_CHARS)) {
        return { ok: false, reason: `question ${i + 1}: option ${j + 1} empty or over ${MAX_OPTION_CHARS} chars` };
      }
      options.push(o.trim());
    }
    if (new Set(options.map((o) => o.toLocaleLowerCase())).size !== OPTION_COUNT) {
      return { ok: false, reason: `question ${i + 1}: duplicate options` };
    }
    if (typeof q.answer !== 'number' || !Number.isInteger(q.answer) || q.answer < 0 || q.answer >= OPTION_COUNT) {
      return { ok: false, reason: `question ${i + 1}: answer must be an integer 0-${OPTION_COUNT - 1}` };
    }
    questions.push({ question: q.question.trim(), options, answer: q.answer });
  }
  return { ok: true, questions };
}

/** Parse model text (fences tolerated) and validate. */
export function parseQuestions(raw: string): QuestionValidation {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFences(raw));
  } catch {
    return { ok: false, reason: 'JSON parse failed' };
  }
  return validateQuestions(parsed);
}

export function questionsSystemPrompt(languageName: string, band: CEFR): string {
  return `You write reading-comprehension checks for language learners. The questions and every option are in ${languageName}, at CEFR ${band} or simpler than the article. Always respond with valid JSON only, no markdown or extra text.`;
}

export function questionsUserPrompt(article: { title: string; content: string }, languageName: string): string {
  return [
    `Write exactly ${QUESTION_COUNT} multiple-choice comprehension questions about the article below, in ${languageName}.`,
    `Each question tests something stated in the article (a fact, a reason, a consequence), not outside knowledge or opinion.`,
    `Each question has exactly ${OPTION_COUNT} short options (at most ${MAX_OPTION_CHARS} characters each), all plausible, exactly one correct. Vary the position of the correct option.`,
    `Return JSON: {"questions":[{"question":string,"options":[string,string,string,string],"answer":0|1|2|3}]}.`,
    '',
    `Title: ${article.title}`,
    '',
    article.content,
  ].join('\n');
}

export interface GenerateQuestionsInput {
  article: { title: string; content: string };
  language: { code: string; name: string };
  band: CEFR;
  /** One model call: system + user → raw text. Provider, key and timeout are the caller's. */
  callModel: (system: string, user: string) => Promise<string>;
  /** Injected for tests; the real gate otherwise. */
  validated?: (opts: ValidatedGenerateOpts) => Promise<ValidatedResult>;
  log?: (entry: Record<string, unknown>) => void;
}

/**
 * Never throws. Returns the validated questions, or null when generation,
 * safety, or shape failed — the caller stores the article either way.
 */
export async function generateQuestions(input: GenerateQuestionsInput): Promise<NewsQuestion[] | null> {
  const validated = input.validated ?? generateValidated;
  const log = input.log ?? ((entry) => console.log(JSON.stringify(entry)));
  const system = questionsSystemPrompt(input.language.name, input.band);
  const user = questionsUserPrompt(input.article, input.language.name);

  try {
    const { text, usedFallback } = await validated({
      fn: 'daily-news-cron:questions',
      targetLevel: input.band,
      language: input.language.code,
      safetyRetries: 1,
      generate: () => input.callModel(system, user),
      fallback: async () => QUESTIONS_FALLBACK_SENTINEL,
    });
    if (usedFallback || text === QUESTIONS_FALLBACK_SENTINEL) {
      log({ evt: 'news_questions_skipped', reason: 'fallback', language: input.language.code, band: input.band });
      return null;
    }
    const result = parseQuestions(text);
    if (!result.ok) {
      log({ evt: 'news_questions_skipped', reason: result.reason, language: input.language.code, band: input.band });
      return null;
    }
    return result.questions;
  } catch (err) {
    // generateValidated already retries and falls back; anything that still
    // escapes is a bug, and it must not take the article down with it.
    log({
      evt: 'news_questions_skipped',
      reason: err instanceof Error ? err.message : String(err),
      language: input.language.code,
      band: input.band,
    });
    return null;
  }
}
