/**
 * Onboarding's first job on mount: read the local draft, and either flush it
 * into the freshly created account or restore it into the form.
 *
 * Returns `hydrated` (the draft has been read, the form may render) and
 * `flushing` (the screen exists only to write the profile and leave). Both are
 * false until the session has resolved: before that a signed-out learner and a
 * signed-in one whose session is still loading look identical.
 */
import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { trackEvent } from '../../lib/analytics';
import { isFlushable, loadPendingOnboarding, type PendingOnboarding } from '../../lib/pending-onboarding';
import { DEFAULT_LANGUAGE, DEFAULT_LEVEL } from './steps/config';

export function useDraftBootstrap({
  authLoading,
  userId,
  writeProfile,
  applyPending,
  onFlushFailed,
}: {
  authLoading: boolean;
  userId: string | null;
  /** Flush the draft server-side and navigate away. Throws on failure. */
  writeProfile: (userId: string, draft: PendingOnboarding) => Promise<void>;
  /** Restore a saved draft into the form state. */
  applyPending: (pending: PendingOnboarding) => void;
  /**
   * Where to land the learner after a failed flush, with their answers
   * restored. MUST be referentially stable (useCallback): a fresh function on
   * every render would re-run the effect after the failure and retry the
   * flush in a loop.
   */
  onFlushFailed: () => void;
}) {
  const [hydrated, setHydrated] = useState(false);
  const [flushing, setFlushing] = useState(false);
  // A flush writes the profile and navigates away; it must happen at most
  // once even if this effect re-runs on a dependency identity change.
  const flushedRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;

    (async () => {
      let pending: PendingOnboarding | null = null;
      try {
        pending = await loadPendingOnboarding();
      } catch (err) {
        console.error('loadPendingOnboarding failed:', err);
      }
      if (cancelled) return;

      // isFlushable also requires the draft to have been claimed by THIS
      // account at sign-in — a draft left behind by someone else on a shared
      // device must not be written into this profile.
      if (userId && isFlushable(pending, userId) && pending && !flushedRef.current) {
        flushedRef.current = true;
        setFlushing(true);
        try {
          await writeProfile(userId, pending);
          trackEvent('onboarding_completed', {
            language: pending.targetLanguage ?? DEFAULT_LANGUAGE,
            band: pending.level ?? DEFAULT_LEVEL,
            count: Math.round((Date.now() - pending.startedAt) / 1000),
            source: 'post_signup_flush',
            outcome: 'profile_persisted',
          });
          return;
        } catch (err: unknown) {
          if (cancelled) return;
          flushedRef.current = false;
          console.error('flush pending onboarding failed:', err);
          // Don't strand the learner on a spinner — drop them back into the
          // flow with their answers intact so they can retry the last step.
          // The flush is one idempotent RPC (migration 127), so retrying it
          // is safe whatever happened to the first attempt.
          Alert.alert(
            'We couldn\'t save your setup',
            'Your answers are still here. Please try again.',
          );
          applyPending(pending);
          onFlushFailed();
          setFlushing(false);
          setHydrated(true);
          return;
        }
      }

      if (pending) applyPending(pending);
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, userId, writeProfile, applyPending, onFlushFailed]);

  return { hydrated, flushing };
}
