/**
 * The photo a learner picks for their avatar BEFORE they have an account.
 *
 * Photo-to-avatar is a paid image-model call behind `generate-avatar`, which
 * needs a JWT, so it cannot run on the name + avatar step of onboarding. What
 * can happen there is everything except the call: consent, camera or picker,
 * crop, downscale, style. The prepared JPEG is parked in the app's document
 * directory and only its URI rides in the onboarding draft — the draft is
 * mirrored to AsyncStorage on every answer, and a base64 image in it would
 * make each keystroke on the name field rewrite ~100 KB.
 *
 * After sign-up `flushDraftToProfile` reads the file back and starts the
 * generation (components/onboarding/deferred-avatar.ts). The file is deleted
 * once the job settles either way; the document directory is not purged by
 * the OS the way the cache directory can be, so a draft resumed a day later
 * still has its photo.
 */
import { File, Paths } from 'expo-file-system';
import type { PreparedPhoto } from './avatar-generation';

export interface StashedAvatarPhoto {
  /** file:// URI of the prepared JPEG in the document directory. */
  uri: string;
  /** The art style the learner picked in the generator sheet. */
  styleKey: string;
}

const STASH_NAME = 'onboarding-avatar-photo.jpg';

/** Park a prepared photo for generation after sign-up. Replaces any earlier one. */
export function stashOnboardingPhoto(photo: PreparedPhoto, styleKey: string): StashedAvatarPhoto {
  const dest = new File(Paths.document, STASH_NAME);
  if (dest.exists) dest.delete();
  dest.write(photo.base64, { encoding: 'base64' });
  return { uri: dest.uri, styleKey };
}

/** Read a stashed photo back as the shape `generateAvatar` takes, or null if it is gone. */
export async function loadStashedPhoto(stash: StashedAvatarPhoto): Promise<PreparedPhoto | null> {
  const file = new File(stash.uri);
  if (!file.exists) return null;
  return { base64: await file.base64(), uri: file.uri, mimeType: 'image/jpeg' };
}

/** Delete the stashed photo. Safe to call when it is already gone. */
export function discardStashedPhoto(stash: StashedAvatarPhoto): void {
  try {
    const file = new File(stash.uri);
    if (file.exists) file.delete();
  } catch (err) {
    console.warn('[onboarding] could not delete the stashed avatar photo:', err);
  }
}
