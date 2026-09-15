/**
 * The learner's tutor preferences: which tutor, and how they want to be
 * corrected.
 *
 * ── USER-SCOPED, NOT DEVICE-WIDE ──
 *
 * Keyed on the user id, following `lib/handsfree-storage.ts` rather than
 * `lib/voice-preference.ts`, and the difference is not stylistic.
 *
 * `voice-preference` is device-wide on purpose: which synthetic timbre you
 * prefer is a playback setting, one bit from a closed enum, and a second
 * learner on a shared tablet inheriting it is a mismatch, not a disclosure.
 * It behaves like volume.
 *
 * Correction mode is not that. "Correct me as I go" versus "let me finish"
 * is a LEARNING preference — it is a statement about how this person copes
 * with being interrupted while struggling in a foreign language, and it
 * belongs to the learner, not to the glass. Inheriting it is not a mismatch
 * you shrug at: a nervous learner who chose "let me talk" and then borrows a
 * confident friend's phone gets interrupted on every sentence, which is the
 * experience that made them choose otherwise in the first place. The persona
 * is scoped the same way for the same reason — the tutor you have a rapport
 * with is yours.
 *
 * ── "NOT CHOSEN" IS A REAL STATE ──
 *
 * Both fields read back as `null` until the learner actually decides, and that
 * is distinct from any default. The plan is to ASK on first launch, and asking
 * is only possible if we can tell "never answered" from "answered the same as
 * the default". Collapsing the two would silently impose a correction style on
 * everyone who has not chosen and remove the question forever.
 *
 * Every read and write degrades to "not chosen" rather than throwing.
 * AsyncStorage genuinely fails — private mode, cleared data, a full disk — and
 * the worst acceptable outcome is being asked the question again. Taking down
 * the call because a preference could not be read is not.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { isTutorPersonaId } from './tutor-personas';

/**
 * When to correct.
 *
 *   `as_you_go`  — fix it in the moment, while the error is still live.
 *   `let_me_talk` — hold corrections until the learner has finished the thought.
 */
export type CorrectionMode = 'as_you_go' | 'let_me_talk';

/** Key namespace version. Bumping it discards every learner's stored choice
 *  and re-asks the question, so bump only when the KEY shape changes; value
 *  shape changes go through the schema version below. */
export const TUTOR_STORAGE_VERSION = 1;

/**
 * Schema version of the stored value. A blob carrying any other version is
 * discarded whole rather than read field by field — we do not guess at the
 * meaning of a shape we did not write.
 */
export const TUTOR_PREFS_SCHEMA_VERSION = 1;

const prefsKey = (userId: string) => `tutor:prefs:v${TUTOR_STORAGE_VERSION}:${userId}`;

export interface TutorPreferences {
  /** `null` = never chosen. See the header. */
  personaId: string | null;
  /** `null` = never chosen, which is NOT the same as either mode. */
  correctionMode: CorrectionMode | null;
}

/** What actually goes on disk: the preferences plus a schema stamp. */
interface StoredEnvelope extends TutorPreferences {
  version: number;
}

/** The state before anything has been decided, and the answer to every failure. */
export const NOTHING_CHOSEN: TutorPreferences = { personaId: null, correctionMode: null };

function isCorrectionMode(value: unknown): value is CorrectionMode {
  return value === 'as_you_go' || value === 'let_me_talk';
}

/**
 * Read this learner's preferences.
 *
 * Never rejects and never throws. Each field is validated independently: a
 * recognised persona with an unreadable correction mode keeps the persona and
 * re-asks only the question it cannot answer. An unknown persona id — one
 * retired since it was written — reads as "not chosen", which
 * `personaForLearner` then turns into a deterministic assignment rather than
 * an empty call screen.
 */
export async function loadTutorPreferences(userId: string): Promise<TutorPreferences> {
  try {
    const raw = await AsyncStorage.getItem(prefsKey(userId));
    if (raw === null) return NOTHING_CHOSEN;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return NOTHING_CHOSEN;

    const v = parsed as Record<string, unknown>;
    // A foreign schema version, or a pre-envelope blob from before this stamp
    // existed. Discarding costs the learner one question; misreading it costs
    // them a tutor and a correction style they never picked.
    if (v.version !== TUTOR_PREFS_SCHEMA_VERSION) {
      await AsyncStorage.removeItem(prefsKey(userId)).catch(() => undefined);
      return NOTHING_CHOSEN;
    }

    return {
      personaId: isTutorPersonaId(v.personaId) ? v.personaId : null,
      correctionMode: isCorrectionMode(v.correctionMode) ? v.correctionMode : null,
    };
  } catch {
    // Unparseable JSON, or storage unavailable. Same answer either way.
    return NOTHING_CHOSEN;
  }
}

/**
 * Write one or both fields, leaving the other as it was.
 *
 * Read-modify-write rather than a blind overwrite: the persona is chosen on
 * one screen and the correction mode on another, and saving one must not erase
 * the other. There is no locking here and none is needed — both writes are
 * user-initiated taps on a single device, seconds apart at the closest.
 *
 * Silent on failure, deliberately. The learner made a choice and the UI has
 * already moved on; an alert about AsyncStorage would be noise about something
 * they cannot act on, and the only consequence is being asked again.
 *
 * One accepted consequence of read-modify-write over a store that can fail:
 * if the READ fails but the write succeeds, the untouched field is written
 * back as `null` — the learner is asked that one question again. There is no
 * better answer available. Preserving a value we could not read would mean
 * inventing it, and refusing to save would throw away the choice they just
 * made in favour of one we cannot see.
 */
export async function saveTutorPreferences(
  userId: string,
  patch: Partial<TutorPreferences>,
): Promise<void> {
  try {
    const current = await loadTutorPreferences(userId);
    const envelope: StoredEnvelope = {
      version: TUTOR_PREFS_SCHEMA_VERSION,
      personaId: patch.personaId !== undefined ? patch.personaId : current.personaId,
      correctionMode:
        patch.correctionMode !== undefined ? patch.correctionMode : current.correctionMode,
    };
    await AsyncStorage.setItem(prefsKey(userId), JSON.stringify(envelope));
  } catch {
    // Non-fatal: the question is asked again next time.
  }
}

export async function saveTutorPersona(userId: string, personaId: string): Promise<void> {
  await saveTutorPreferences(userId, { personaId });
}

export async function saveCorrectionMode(userId: string, mode: CorrectionMode): Promise<void> {
  await saveTutorPreferences(userId, { correctionMode: mode });
}

/**
 * Whether the first-launch question still needs asking.
 *
 * Only the correction mode counts: the persona has a deterministic assignment
 * that is good enough to start a call with, so there is always someone on the
 * other end. There is no equivalent safe default for correction style — that
 * is the question, and guessing it is what we are avoiding.
 */
export function needsCorrectionModeChoice(prefs: TutorPreferences): boolean {
  return prefs.correctionMode === null;
}
