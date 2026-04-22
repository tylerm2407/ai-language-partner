/**
 * Content Safety Validator (Stream 3).
 *
 * CLAUDE.md §5 mandates that all AI-generated content pass a safety check
 * before being shown to learners. This module implements a two-pass strategy:
 *
 *   1. Deterministic regex/blocklist pass (fast, offline, zero cost).
 *   2. Optional LLM pass via Claude Haiku (only if the first pass is clean).
 *
 * Posture (user decision, vast-weaving-liskov.md):
 *   - Strict: callers must block on rejection and regenerate up to N times,
 *     then fall back to pre-authored content. See validated-generate.ts.
 *   - Fail-open on validator outage: if the LLM call fails for network/auth
 *     reasons we return safe=true so real content is not starved during an
 *     incident. The structured log tag `[safety-check][error]` makes outages
 *     grep-able in Supabase logs.
 *
 * Blocklist sources / caveats:
 *   - English seed list: adapted from the Shutterstock "List of Dirty, Naughty,
 *     Obscene, and Otherwise Bad Words" (CC-BY-4.0, 2016 snapshot). Small
 *     curated subset — not exhaustive; the LLM pass covers edge cases.
 *   - Spanish / French / German / Italian / Portuguese seeds: curated by hand
 *     from the same LDNOOBW project's per-locale files.
 *   - Non-Latin languages (ja/ko/zh/ar/hi/ru): the deterministic pass is a
 *     best-effort substring scan on a SHORT list only. The LLM pass is the
 *     primary safety gate for those locales. Known limitation — expand the
 *     seed lists when we have native-speaker reviewers.
 *   - Self-harm terms are intentionally broader than profanity (English only
 *     today; stricter regeneration for any detected mention).
 *
 * Minors (userAge < 18): we ALSO reject common "adult-but-legal" vocabulary
 *   (alcohol slang, mild violence, mature sexual euphemisms). Age data is
 *   currently NOT hooked to user profiles — callers pass the param directly
 *   and the user profile wiring happens in a later stream (out of scope here).
 */

export type SafetyCheck = { safe: boolean; reasons: string[] };

export type SafetyCheckOpts = {
  /** Learner age. If < 18 we apply stricter rules. */
  userAge?: number;
  /** 2-letter or full-name language hint; used to pick the right blocklist. */
  language?: string;
  /** For logging only — which edge function triggered this check. */
  fn?: string;
};

// ───────── Deterministic blocklist (seed content) ─────────
//
// Keep these lists small and conservative. The LLM pass catches
// what regex misses. Entries are lowercased, diacritic-stripped at
// match time — so we only need the stem / root form here.

const PROFANITY_EN = [
  'fuck', 'shit', 'bitch', 'bastard', 'asshole', 'cunt', 'dick', 'pussy',
  'cock', 'twat', 'wanker', 'prick', 'motherfucker', 'whore', 'slut',
];

const SLURS_EN = [
  // Racial, ethnic, homophobic, transphobic, ableist slurs.
  // Deliberately NOT spelled out in full in comments; the strings below are
  // load-bearing only for the blocklist — they should never surface in logs.
  'nigger', 'nigga', 'chink', 'spic', 'kike', 'gook', 'wetback',
  'faggot', 'fag', 'tranny', 'dyke', 'retard', 'retarded',
];

const SELF_HARM_EN = [
  'kill yourself', 'kys', 'commit suicide', 'hang yourself', 'end your life',
  'cut yourself', 'self harm', 'self-harm',
];

const SEXUAL_EXPLICIT_EN = [
  'porn', 'pornography', 'blowjob', 'handjob', 'masturbat', 'jerk off',
  'cum on', 'ejaculat', 'orgasm',
];

// Spanish (seed)
const PROFANITY_ES = [
  'mierda', 'joder', 'cabron', 'cabrón', 'puta', 'puto', 'coño', 'cono',
  'pendejo', 'chingar', 'polla', 'gilipollas', 'hijoputa',
];

// French (seed)
const PROFANITY_FR = [
  'merde', 'putain', 'connard', 'connasse', 'salope', 'enculé', 'encule',
  'bite', 'couilles', 'pétasse', 'petasse',
];

// German (seed)
const PROFANITY_DE = [
  'scheiße', 'scheisse', 'arschloch', 'fotze', 'wichser', 'schlampe', 'hurensohn',
];

// Italian (seed)
const PROFANITY_IT = [
  'cazzo', 'merda', 'puttana', 'stronzo', 'vaffanculo', 'coglione',
];

// Portuguese (seed)
const PROFANITY_PT = [
  'merda', 'porra', 'caralho', 'foda-se', 'foda se', 'puta', 'cu',
];

// Under-18 stricter addenda (English — applies on top of normal list).
const MINORS_STRICTER_EN = [
  'alcohol', 'beer', 'vodka', 'whisky', 'whiskey', 'drunk',
  'gun', 'kill', 'murder', 'blood',
  'sexy', 'hot girl', 'hot guy', 'making love',
];

function normalizeLanguageCode(lang?: string): string {
  if (!lang) return 'en';
  const lower = lang.toLowerCase();
  // Map full names back to 2-letter codes.
  const map: Record<string, string> = {
    english: 'en', spanish: 'es', french: 'fr', german: 'de',
    italian: 'it', portuguese: 'pt', japanese: 'ja', korean: 'ko',
    chinese: 'zh', russian: 'ru', arabic: 'ar', hindi: 'hi',
  };
  if (map[lower]) return map[lower];
  return lower.slice(0, 2);
}

function blocklistFor(lang: string, userAge?: number): string[] {
  const code = normalizeLanguageCode(lang);
  // English is always checked because a lot of AI content bleeds English.
  const base = [
    ...PROFANITY_EN,
    ...SLURS_EN,
    ...SELF_HARM_EN,
    ...SEXUAL_EXPLICIT_EN,
  ];

  switch (code) {
    case 'es': base.push(...PROFANITY_ES); break;
    case 'fr': base.push(...PROFANITY_FR); break;
    case 'de': base.push(...PROFANITY_DE); break;
    case 'it': base.push(...PROFANITY_IT); break;
    case 'pt': base.push(...PROFANITY_PT); break;
    default: break; // ja/ko/zh/ar/hi/ru rely on LLM pass (see comment at top).
  }

  if (typeof userAge === 'number' && userAge < 18) {
    base.push(...MINORS_STRICTER_EN);
  }

  return base;
}

/**
 * Strip diacritics and lowercase for a locale-agnostic substring search.
 * `NFD` decomposes "é" into "e" + combining acute; the regex removes the
 * combining mark. Works correctly for European languages. For CJK / Arabic /
 * Hindi it's a no-op, which is fine — we rely on the LLM pass there.
 */
function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Word-boundary-aware substring check. For short tokens (<=5 chars) we
 * require word boundaries to avoid false positives like "Scunthorpe".
 * For longer tokens a plain includes() is safer (less false-positive surface)
 * and catches compound forms (e.g. "masturbat" -> "masturbated").
 */
function matches(haystack: string, needle: string): boolean {
  if (needle.length >= 6) {
    return haystack.includes(needle);
  }
  // Escape regex special chars in needle.
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
  return re.test(haystack);
}

function deterministicCheck(text: string, opts?: SafetyCheckOpts): SafetyCheck {
  const normalized = normalize(text);
  const reasons: string[] = [];
  const list = blocklistFor(opts?.language ?? 'en', opts?.userAge);

  for (const term of list) {
    const needle = normalize(term);
    if (matches(normalized, needle)) {
      // Do NOT echo the matched term back — avoid leaking slurs into logs.
      reasons.push('blocklist match');
      break; // one hit is enough; we bail on first fail for speed.
    }
  }

  return { safe: reasons.length === 0, reasons };
}

// ───────── Optional LLM pass ─────────

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
// Match the hardcoded model in ai-chat/index.ts:18; allow env override for
// future swaps without redeploy.
const CLAUDE_HAIKU_MODEL =
  Deno.env.get('CLAUDE_HAIKU_MODEL') ?? 'claude-haiku-4-5-20251001';

const LLM_SYSTEM_PROMPT =
  'Return JSON {safe: boolean, reasons: string[]}. Flag profanity, hate speech, sexual content, self-harm, illegal activity, or politically inflammatory content.';

async function llmCheck(text: string, opts?: SafetyCheckOpts): Promise<SafetyCheck> {
  // If we have no API key, we can't call Claude — fail open.
  if (!ANTHROPIC_API_KEY) {
    return { safe: true, reasons: [] };
  }

  // Short-circuit trivially safe strings (empty, whitespace, 1 word).
  const trimmed = text.trim();
  if (trimmed.length === 0) return { safe: true, reasons: [] };

  // Cap input to Claude — 4000 chars covers every edge-function output we generate.
  const body = {
    model: CLAUDE_HAIKU_MODEL,
    max_tokens: 100,
    system: LLM_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Input: ${trimmed.slice(0, 4000)}` }],
  };

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.log(JSON.stringify({
        evt: 'safety_check_error',
        tag: '[safety-check][error]',
        fn: opts?.fn,
        status: res.status,
        ts: new Date().toISOString(),
      }));
      return { safe: true, reasons: ['validator error, defaulted to safe'] };
    }

    const data = await res.json();
    const raw = data.content?.[0]?.text ?? '';

    // Best-effort JSON parse — Claude is usually good but defend anyway.
    try {
      // Find the first {...} block in case the model wrapped it in prose.
      const m = raw.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(m ? m[0] : raw);
      const safe = typeof parsed.safe === 'boolean' ? parsed.safe : true;
      const reasons = Array.isArray(parsed.reasons)
        ? parsed.reasons.map((r: unknown) => String(r))
        : [];
      return { safe, reasons };
    } catch {
      // If we can't parse, treat as safe (fail-open) and note it.
      return { safe: true, reasons: ['validator parse error, defaulted to safe'] };
    }
  } catch (err) {
    console.log(JSON.stringify({
      evt: 'safety_check_error',
      tag: '[safety-check][error]',
      fn: opts?.fn,
      error: (err as Error).message,
      ts: new Date().toISOString(),
    }));
    return { safe: true, reasons: ['validator error, defaulted to safe'] };
  }
}

/**
 * Run both passes. Returns `safe: false` only if either pass says unsafe.
 * Fails open on transport / parse errors during the LLM pass.
 */
export async function validateContentSafety(
  text: string,
  opts?: SafetyCheckOpts,
): Promise<SafetyCheck> {
  const det = deterministicCheck(text, opts);
  if (!det.safe) return det;

  const llm = await llmCheck(text, opts);
  return llm;
}
