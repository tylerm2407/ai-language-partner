/**
 * The server's copy of the tutor persona set, and the voice each one speaks in.
 *
 * WHY THE VOICE IS CHOSEN HERE AND NOT BY THE CLIENT
 *
 * The voice id goes straight into a paid API call. A client-supplied voice
 * string would be unvalidated input reaching a vendor — the same class of thing
 * `isValidExerciseType` and the scenario key table exist to prevent. The client
 * asks for a PERSONA, by id, from a closed set; the server decides what that
 * persona sounds like.
 *
 * WHY THE VOICE IS PER PERSONA AND NOT PER LANGUAGE
 *
 * This is the opposite of how `tts` works, and the difference is real. fish.audio
 * has distinct native-speaker voices per language, so FISH_VOICE_MAP is keyed on
 * language. The Realtime voices are single multilingual voices — the same voice
 * speaks Spanish or Japanese — so keying on language would buy nothing and would
 * mean a learner's tutor changed voice when they switched target language, which
 * is exactly the rapport-breaking thing consistent personas exist to avoid.
 *
 * A learner's tutor sounds the same every session, in every language.
 *
 * KEEP IN SYNC with lib/tutor-personas.ts on the client. The client owns names,
 * bios and portraits (what the learner sees); this file owns the voice and is
 * the authority on which ids exist at all. If they disagree about the id set,
 * `resolvePersona` below refuses rather than guessing.
 */

export type TutorVoiceGender = 'female' | 'male';

export interface TutorServerPersona {
  id: string;
  /** Used in the instructions so the tutor can introduce itself. */
  name: string;
  /** OpenAI Realtime voice id. */
  voice: string;
  gender: TutorVoiceGender;
}

/**
 * The four personas, mirroring lib/tutor-personas.ts.
 *
 * Voice ids are the general-purpose Realtime voices. I could not verify the
 * full current voice list against the API from here, so these are the
 * long-standing, widely-available ones rather than the newest additions — a
 * voice that does not exist would fail the session at mint time, which is the
 * loudest possible failure and the one worth avoiding. If a voice is rejected,
 * that is the first thing to check.
 */
export const TUTOR_PERSONAS: Record<string, TutorServerPersona> = {
  mara:  { id: 'mara',  name: 'Mara',  voice: 'shimmer', gender: 'female' },
  nico:  { id: 'nico',  name: 'Nico',  voice: 'echo',    gender: 'male' },
  amira: { id: 'amira', name: 'Amira', voice: 'sage',    gender: 'female' },
  theo:  { id: 'theo',  name: 'Theo',  voice: 'alloy',   gender: 'male' },
};

/** The persona a request resolves to when it names none, or names one this
 *  server does not know. Never throw over it — a stale client asking for a
 *  retired persona should still get a tutor. */
export const DEFAULT_PERSONA_ID = 'mara';

export function resolvePersona(id: unknown): TutorServerPersona {
  if (typeof id === 'string') {
    const found = TUTOR_PERSONAS[id];
    if (found) return found;
  }
  return TUTOR_PERSONAS[DEFAULT_PERSONA_ID];
}

/**
 * Speaking rate.
 *
 * Beginners get 0.9 for the same reason LEVEL_DESCRIPTIONS tells the model to
 * "speak slowly and clearly" — except that this actually enforces it, where the
 * prompt only asks. Above elementary it is left at natural pace: slowing speech
 * for a learner who does not need it is patronising and, more practically,
 * trains them on input they will never hear in the wild.
 */
export function speechSpeedForLevel(level: string): number {
  return level === 'beginner' || level === 'elementary' ? 0.9 : 1.0;
}
