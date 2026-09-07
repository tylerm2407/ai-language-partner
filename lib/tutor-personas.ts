/**
 * The four tutors.
 *
 * A voice call needs someone on the other end of it. Not a brand, not "the
 * assistant" — a name, a face and a manner that are the SAME every time the
 * learner opens the tab. That consistency is the entire point of this module:
 * rapport is what gets someone to make the twelfth call, and rapport cannot
 * form with a stranger who is a different person each session. A tutor whose
 * name changes between sessions is worse than no persona at all, because it
 * actively contradicts the thing the persona was there to build.
 *
 * ── WHY FOUR BUNDLED PORTRAITS AND NOT A GENERATED ONE ──
 *
 * This is explicitly NOT `lib/avatar-generation.ts` / the `generate-avatar`
 * edge function. That path costs roughly $0.211 per image — which is defensible
 * for a learner's own avatar, generated once, on request, because they asked
 * for it and it is theirs. It is not defensible for the tutor's face: every
 * learner would be paying us 21c for a picture of a person they did not choose
 * and cannot change, and at any real scale that is a five-figure line item for
 * four distinct outcomes. Four portraits shipped in the binary cost nothing per
 * learner and are identical for everyone, which is also what makes the tutor
 * recognisable when it is talked about.
 *
 * ── portraitId IS A STRING ON PURPOSE ──
 *
 * Do NOT `require()` an image here. The portrait PNGs do not exist yet, and a
 * `require()` of a missing asset is a Metro BUNDLER failure, not a runtime
 * one — it takes down the whole app, not the tutor screen. `portraitId` stays
 * a plain string and a component maps it to a real asset once the art lands.
 * That also keeps this module pure and testable, which a `require` would not.
 */

import type { VoiceGender } from './voice-preference';

export interface TutorPersona {
  id: string;
  /** Shown to the learner. Short, so it fits in a call header. */
  name: string;
  /**
   * One line, LANGUAGE-NEUTRAL. The same four tutors teach all nine languages,
   * so nothing here may imply a nationality, a city or a mother tongue — a bio
   * saying "from Madrid" is wrong the moment the learner switches to Japanese.
   */
  bio: string;
  /** Asset key, not an asset. See the header. */
  portraitId: string;
  /**
   * Hint for TTS voice selection, shared with `lib/voice-preference.ts`. The
   * server treats it as a hint: a language with no vetted voice in this gender
   * falls back to that language's default rather than refusing to speak.
   */
  voiceGender: VoiceGender;
}

/**
 * The closed set. Two of each voice gender so the deterministic assignment
 * below cannot skew everyone toward one.
 *
 * Adding a fifth changes who existing learners are assigned — see the note on
 * `personaForLearner`.
 */
export const TUTOR_PERSONAS: readonly TutorPersona[] = [
  {
    id: 'mara',
    name: 'Mara',
    bio: 'Patient and unhurried. Lets you finish your sentence.',
    portraitId: 'tutor-mara',
    voiceGender: 'female',
  },
  {
    id: 'nico',
    name: 'Nico',
    bio: 'Chatty and quick. Keeps the conversation moving.',
    portraitId: 'tutor-nico',
    voiceGender: 'male',
  },
  {
    id: 'amira',
    name: 'Amira',
    bio: 'Warm and encouraging. Notices what you got right.',
    portraitId: 'tutor-amira',
    voiceGender: 'female',
  },
  {
    id: 'theo',
    name: 'Theo',
    bio: 'Calm and precise. Good when you want to be corrected.',
    portraitId: 'tutor-theo',
    voiceGender: 'male',
  },
];

export function isTutorPersonaId(value: unknown): value is string {
  return typeof value === 'string' && TUTOR_PERSONAS.some((p) => p.id === value);
}

export function personaById(id: string | null | undefined): TutorPersona | null {
  return TUTOR_PERSONAS.find((p) => p.id === id) ?? null;
}

/**
 * Stable non-negative hash of a string.
 *
 * djb2. Mirrored from `supabase/functions/ai-chat/dialogue-act.ts` rather than
 * imported: that file is Deno, on the other side of the client/server boundary,
 * and nothing in `lib/` may reach across it. Collision resistance is irrelevant
 * here — all we need is a spread that is the same on every run.
 */
function hash(text: string): number {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  }
  return h;
}

/**
 * Which tutor this learner gets.
 *
 * A stored choice always wins — the learner picking a tutor is the strongest
 * possible signal, and it is why the stored value is checked before anything
 * is computed. An unrecognised stored id (an old persona, a corrupt blob) is
 * treated as absent rather than as an error: falling back to an assignment is
 * invisible, whereas failing here would leave the call with nobody on it.
 *
 * Otherwise the tutor is assigned by hashing the user id. Deterministic, not
 * random, and that distinction is the whole feature: `Math.random()` here would
 * give the learner a different tutor every launch, which is precisely the
 * failure this module exists to prevent. The same id maps to the same tutor on
 * every device, before any preference has been stored, and after storage has
 * been cleared.
 *
 * NOTE for whoever adds a fifth persona: the modulus changes, so every learner
 * who has never made an explicit choice is reassigned. That is a real cost to
 * rapport. Either persist the assignment first, or accept it knowingly.
 */
export function personaForLearner(userId: string, stored: string | null): TutorPersona {
  const chosen = personaById(stored);
  if (chosen) return chosen;
  return TUTOR_PERSONAS[hash(userId) % TUTOR_PERSONAS.length];
}
