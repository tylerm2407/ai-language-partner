// Narrator voice resolution for the news podcast.
//
// Pure, no I/O, no `Deno.env` at module scope — the raw secret strings are
// passed in, so `deno test` can exercise every branch without a runtime.
// Same split as ./script.ts and ./mp3-duration.ts.
//
// ── Resolution order ──
//
//   1. FISH_NEWS_VOICE_MAP[language]  — the editorial override.
//   2. FISH_VOICE_MAP[language]       — the voices chat already uses.
//   3. ElevenLabs                     — last resort.
//
// Step 2 is what makes this work today. The product decision is to reuse the
// fish voices already vetted and configured for chat rather than stand up a
// second secret: a voice good enough to teach a learner in conversation is
// good enough to read them the news, and one secret that is populated beats
// two where the new one is empty.
//
// Step 1 survives anyway, unused, because the editorial case is real — a
// news reader and a conversational tutor are different performances, and
// when someone eventually vets a dedicated narrator for a language, setting
// FISH_NEWS_VOICE_MAP is the whole change.
//
// Step 3 is CURRENTLY BROKEN IN PRODUCTION: the ELEVENLABS_KEY secret holds
// an API key *ID* rather than an `sk_` key, so ElevenLabs rejects every
// request. That is not this module's problem to fix, but it does mean a
// language absent from BOTH fish maps will fail rather than degrade — which
// is exactly why `narratorCoverage()` exists below.

export type NarratorProvider = 'fish' | 'elevenlabs';

export interface Narrator {
  provider: NarratorProvider;
  voiceId: string;
}

/** Shape of one language's entry in the chat FISH_VOICE_MAP secret. */
export interface ChatVoiceEntry {
  male?: string[];
  female?: string[];
}

const GENDERS = ['male', 'female'] as const;

/**
 * Parse FISH_NEWS_VOICE_MAP — flat `{"es": "<reference_id>"}`.
 *
 * Flat rather than the chat map's per-gender shape because a news reader is
 * an editorial choice made at render time with nobody present: there is no
 * learner whose gender preference could apply.
 *
 * Malformed input degrades to `{}` and never throws. A bad secret must cost
 * us the fish voices, not the feature.
 */
export function parseNewsVoiceMap(raw: string | undefined | null): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      console.error('[news-audio] FISH_NEWS_VOICE_MAP must be a JSON object; ignoring.');
      return {};
    }
    const map: Record<string, string> = {};
    for (const [lang, id] of Object.entries(parsed)) {
      if (typeof id === 'string' && id.length > 0) map[lang] = id;
      else console.error(`[news-audio] FISH_NEWS_VOICE_MAP.${lang} must be a string; skipping.`);
    }
    return map;
  } catch (err) {
    console.error('[news-audio] FISH_NEWS_VOICE_MAP is not valid JSON; ignoring.', err);
    return {};
  }
}

/**
 * Parse FISH_VOICE_MAP — `{"es": {"male": [ids], "female": [ids]}}`.
 *
 * Mirrors the defensive parse in ../tts/index.ts deliberately, rather than
 * importing it: that module calls `serve()` at import time, so importing it
 * here would start a second HTTP server inside this function.
 *
 * Every layer degrades instead of throwing — bad JSON, a non-object root, a
 * non-object language entry, a non-array gender, a non-string id. The chat
 * tutor and the news podcast now share this secret, so a parse that threw
 * would take down two features at once instead of none.
 */
export function parseChatVoiceMap(
  raw: string | undefined | null,
): Record<string, ChatVoiceEntry> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      console.error('[news-audio] FISH_VOICE_MAP must be a JSON object; ignoring.');
      return {};
    }
    const map: Record<string, ChatVoiceEntry> = {};
    for (const [lang, byGender] of Object.entries(parsed)) {
      if (!byGender || typeof byGender !== 'object' || Array.isArray(byGender)) {
        console.error(`[news-audio] FISH_VOICE_MAP.${lang} must be {male:[],female:[]}; skipping.`);
        continue;
      }
      const entry: ChatVoiceEntry = {};
      for (const gender of GENDERS) {
        const ids = (byGender as Record<string, unknown>)[gender];
        const valid = Array.isArray(ids)
          ? ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
          : [];
        if (valid.length > 0) entry[gender] = valid;
      }
      if (Object.keys(entry).length > 0) map[lang] = entry;
    }
    return map;
  } catch (err) {
    console.error('[news-audio] FISH_VOICE_MAP is not valid JSON; ignoring.', err);
    return {};
  }
}

/**
 * Pick one narrator out of a chat entry's gendered lists.
 *
 * `female[0] ?? male[0]` — deterministic, and that is the entire point. A
 * news feed that narrated in a different voice each morning would read as a
 * different product each morning; the daily article is the one piece of
 * content a learner returns to on a schedule, so its reader has to be a
 * constant. Index 0 is the shipping voice in both lists, so this also picks
 * the voice most likely to have actually been listened to by a human.
 *
 * The female-first default is arbitrary but fixed; what matters is that it
 * never varies for a given secret.
 */
export function pickChatNarrator(entry: ChatVoiceEntry | undefined): string | undefined {
  if (!entry) return undefined;
  return entry.female?.[0] ?? entry.male?.[0];
}

/** ElevenLabs narrator per language — the index-0 "shipping voice" from
 *  VOICE_MAP in ../tts/index.ts. Copied rather than imported for the
 *  `serve()`-at-import reason above. Keep in sync if a language's index-0
 *  voice is ever re-vetted. */
export const ELEVEN_NEWS_VOICES: Record<string, string> = {
  es: 'pFZP5JQG7iQjIQuC4Bku', // Lily
  fr: 'XB0fDUnXU5powFXDhCwa', // Charlotte
  de: 'onwK4e9ZLuTAKqWW03F9', // Daniel
  it: 'XrExE9yKIg1WjnnlVkGX', // Matilda
  pt: 'jsCqWAovK2LkecY7zXl4', // Freya
  ja: 'Xb7hH8MSUJpSbSDYk0k2', // Alice
  ko: 'pqHfZKP75CvOlQylNhV4', // Bill
  zh: 'FGY2WhTYpPnrIDTdsKH5', // Laura
  ru: 'CwhRBWXzGAHq8TQ4Fs17', // Roger
  en: 'EXAVITQu4vr4xnSDxMaL', // Sarah
};

export const DEFAULT_ELEVEN_VOICE = 'EXAVITQu4vr4xnSDxMaL'; // Sarah

/** The languages `daily_news` actually publishes (9 languages × 2 tiers).
 *  Mirrors SUPPORTED_LANGUAGES in ../daily-news-cron/index.ts; `en` is
 *  excluded because the app teaches English speakers, it does not publish an
 *  English edition. */
export const NARRATABLE_LANGUAGES = ['es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh', 'ru'];

export interface ResolveOptions {
  language: string;
  /** Parsed FISH_NEWS_VOICE_MAP — the editorial override. */
  newsMap: Record<string, string>;
  /** Parsed FISH_VOICE_MAP — the voices chat already uses. */
  chatMap: Record<string, ChatVoiceEntry>;
  /** False when FISH_KEY is unset, which disables both fish steps. */
  fishEnabled: boolean;
}

/**
 * Resolve the narrator for a language: editorial fish → chat fish → ElevenLabs.
 *
 * Always returns something. ElevenLabs is the floor even for a language with
 * no entry of its own (it falls back to the default voice), because a
 * multilingual model rendering an unlisted language is still better than
 * refusing to narrate — and the caller records which provider was used, so a
 * quality complaint is traceable to a voice.
 */
export function resolveNarrator(opts: ResolveOptions): Narrator {
  const { language, newsMap, chatMap, fishEnabled } = opts;

  if (fishEnabled) {
    const editorial = newsMap[language];
    if (editorial) return { provider: 'fish', voiceId: editorial };

    const fromChat = pickChatNarrator(chatMap[language]);
    if (fromChat) return { provider: 'fish', voiceId: fromChat };
  }

  return {
    provider: 'elevenlabs',
    voiceId: ELEVEN_NEWS_VOICES[language] ?? DEFAULT_ELEVEN_VOICE,
  };
}

/**
 * Which provider each publishable language would narrate on right now.
 *
 * Reported by daily-news-audio-cron so "does every language have a voice?"
 * is answerable without reading a secret or waiting for a render to fail.
 * Deliberately returns only the PROVIDER per language and never a voice id —
 * this ends up in an HTTP response and a log line, and the reference ids are
 * the secret.
 *
 * With ElevenLabs currently broken in production, any language reporting
 * `elevenlabs` here is a language whose podcast will fail.
 */
export function narratorCoverage(
  opts: Omit<ResolveOptions, 'language'>,
  languages: string[] = NARRATABLE_LANGUAGES,
): Record<string, NarratorProvider> {
  const coverage: Record<string, NarratorProvider> = {};
  for (const language of languages) {
    coverage[language] = resolveNarrator({ ...opts, language }).provider;
  }
  return coverage;
}
