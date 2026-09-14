/**
 * Turn the photo stashed during onboarding into the learner's avatar, once an
 * account exists to attach it to.
 *
 * Runs AFTER the profile flush and never blocks it: a 'high' quality render
 * takes 100–235 s (see generate-avatar/index.ts), and holding the learner on
 * "Setting up your course…" for that long would cost more sign-ups than the
 * avatar earns. The learner goes on to the paywall and Home with their preset
 * or initials; when the job settles the store is patched and every avatar on
 * screen re-renders. If the app is killed mid-render the job still finishes
 * server-side, and Profile → Avatar offers the same flow again.
 *
 * Entitlement is the server's call (generate-avatar checks the monthly
 * allowance for every tier, including free); this only relays the outcome.
 */
import { generateAvatar } from '../../lib/avatar-generation';
import {
  discardStashedPhoto,
  loadStashedPhoto,
  type StashedAvatarPhoto,
} from '../../lib/onboarding-avatar-photo';
import { invalidateAvatarImage } from '../../hooks/useAvatarImage';
import { useAppStore } from '../../stores/useAppStore';
import { trackEvent } from '../../lib/analytics';

export async function startDeferredAvatarGeneration(stash: StashedAvatarPhoto): Promise<void> {
  const photo = await loadStashedPhoto(stash);
  if (!photo) {
    console.warn('[onboarding] stashed avatar photo is gone; skipping generation');
    return;
  }
  try {
    const result = await generateAvatar(photo, stash.styleKey);
    // The Edge Function has already written avatar_kind and avatar_image_path;
    // this mirrors the result into the store rather than issuing a second
    // write. Read the profile fresh: the flush replaced it after this started.
    invalidateAvatarImage(result.path);
    const { profile, setProfile } = useAppStore.getState();
    if (profile) {
      setProfile({ ...profile, avatarKind: 'generated', avatarImagePath: result.path });
    }
    trackEvent('free_avatar_generated', { source: 'onboarding' });
  } catch (err) {
    // Not surfaced: the learner is on the paywall or Home by now and the
    // preset or initials they already have are a complete avatar. Profile
    // offers the photo flow again, where a failure IS shown in place.
    console.error('[onboarding] deferred avatar generation failed:', err);
  } finally {
    discardStashedPhoto(stash);
  }
}
