/**
 * Consent to send learner content to third-party AI providers.
 *
 * Apple guideline 5.1.2(i) (added 2025-11-13) requires explicit permission
 * before personal data is shared with third-party AI, and Google's prominent-
 * disclosure rule requires the disclosure immediately before the request —
 * neither is satisfied by a privacy policy. So this is a product gate, not a
 * document.
 *
 * Two separate consents, because they are different disclosures with different
 * sensitivity:
 *   'text'  — typed messages and writing go to Anthropic
 *   'voice' — the raw recording goes to OpenAI for transcription
 *
 * They are deliberately independent. Declining voice must leave text chat fully
 * working: 5.1.1(ii) forbids making paid functionality depend on granting access
 * to data, and the same rule appears in Google's policy.
 *
 * Stored per-user on the device, mirroring lib/handsfree-storage.ts. That is a
 * conscious trade for launch: a reinstall re-asks, which is the safe direction
 * to fail. If a provable, timestamped record is needed (BIPA §15(b) asks for a
 * written release for biometric identifiers), move `read`/`write` below to a
 * user_profiles column — the rest of this module and every call site stay as-is.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Bump when the set of providers, what is sent, or how it is used changes.
 * A bump invalidates every stored consent and re-asks, which is what GDPR
 * Art. 28(2) expects when subprocessors change — consent to the old list is
 * not consent to the new one.
 *
 * v1 — Anthropic (text), OpenAI (audio + photos).
 */
export const AI_CONSENT_VERSION = 1;

export type AiConsentKind = 'text' | 'voice';

const key = (kind: AiConsentKind, userId: string) =>
  `ai-consent:${kind}:v${AI_CONSENT_VERSION}:${userId}`;

/**
 * Legacy keys for every superseded version, so revoking clears them too and a
 * downgrade can never resurrect an old consent.
 */
function staleKeys(kind: AiConsentKind, userId: string): string[] {
  const keys: string[] = [];
  for (let v = 1; v < AI_CONSENT_VERSION; v += 1) {
    keys.push(`ai-consent:${kind}:v${v}:${userId}`);
  }
  return keys;
}

/**
 * Whether this user has consented on this device, at the current version.
 *
 * Fails CLOSED: a storage error returns false and the sheet is shown again.
 * Asking twice is a minor annoyance; sending someone's voice to a third party
 * because AsyncStorage hiccuped is not a trade worth making.
 */
export async function hasAiConsent(
  kind: AiConsentKind,
  userId: string,
): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key(kind, userId))) !== null;
  } catch {
    return false;
  }
}

/** Record consent. Stores the ISO timestamp — that is the audit value. */
export async function grantAiConsent(
  kind: AiConsentKind,
  userId: string,
): Promise<void> {
  await AsyncStorage.setItem(key(kind, userId), new Date().toISOString());
}

/**
 * When consent was granted, or null if it was not (or is unreadable).
 * Surfaced in Settings so a learner can see what they agreed to and when.
 */
export async function aiConsentGrantedAt(
  kind: AiConsentKind,
  userId: string,
): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key(kind, userId));
  } catch {
    return null;
  }
}

/**
 * Withdraw consent. Apple 5.1.1(ii) requires withdrawal to be as easy as
 * granting, so this is wired to a Settings control, not a support email.
 * Clears superseded versions too.
 */
export async function revokeAiConsent(
  kind: AiConsentKind,
  userId: string,
): Promise<void> {
  await AsyncStorage.multiRemove([key(kind, userId), ...staleKeys(kind, userId)]);
}

/** Withdraw both. Used by the single "Withdraw AI consent" control. */
export async function revokeAllAiConsent(userId: string): Promise<void> {
  await Promise.all([revokeAiConsent('text', userId), revokeAiConsent('voice', userId)]);
}

/**
 * Disclosure copy. Kept here rather than in the component so it is one source
 * of truth for the sheet, the Settings detail, and the privacy policy — the
 * three have to agree, and reviewers do compare them.
 *
 * Every claim below must stay true of the code. In particular the voiceprint
 * line is load-bearing: GDPR Art. 9, CCPA sensitive-PI status and the Illinois
 * BIPA definition all turn on the PURPOSE of processing, not the data type.
 * Transcribing speech is not identification. Building speaker verification —
 * for assignment anti-cheating, say — would make that sentence false and move
 * the whole voice pipeline into biometric-identifier territory.
 */
export interface AiConsentCopy {
  title: string;
  intro: string;
  points: string[];
  agreeLabel: string;
  declineLabel: string;
  /** Shown after declining, so the consequence is honest and specific. */
  declinedNote: string;
}

export const AI_CONSENT_COPY: Record<AiConsentKind, AiConsentCopy> = {
  text: {
    title: 'Before you chat with your tutor',
    intro:
      'Your tutor is an AI. To write replies, what you type is sent to our AI provider.',
    points: [
      'Your messages are sent to Anthropic, which generates the tutor’s replies.',
      'Anthropic does not use your messages to train their models.',
      'Your conversation is saved to your account so you can pick up where you left off, and deleting your account deletes it.',
      'Please don’t type anything you wouldn’t want stored — passwords, card numbers, or anyone else’s personal details.',
    ],
    agreeLabel: 'I agree — start chatting',
    declineLabel: 'Not now',
    declinedNote:
      'No problem. Lessons, reviews and reading all work without this — you just won’t be able to use the AI tutor.',
  },
  voice: {
    title: 'Before you use your microphone',
    intro:
      'To understand what you say, your recording is sent off your device to be turned into text.',
    points: [
      'Your recording is sent to OpenAI, which converts your speech to text.',
      'OpenAI does not use your audio to train their models, and does not retain it.',
      'We do not create voiceprints, and we never use your voice to identify or authenticate you.',
      'Only the text of what you said is saved to your account — the audio itself is not stored on our servers.',
      'Recording only ever happens when you tap or hold the mic. Nothing is captured in the background.',
    ],
    agreeLabel: 'I agree — enable microphone',
    declineLabel: 'Not now',
    declinedNote:
      'No problem. You can keep chatting by typing — everything except speaking works exactly the same.',
  },
};
