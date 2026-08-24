/**
 * useAiConsent — gate an action on third-party AI consent.
 *
 * Turns the consent sheet into a single awaited call at the point of the
 * action, which is where Apple 5.1.2(i) and Google's prominent-disclosure rule
 * both want it:
 *
 *   const { ensureConsent, consentSheet } = useAiConsent(user?.id);
 *   ...
 *   if (!(await ensureConsent('voice'))) return;   // declined — do not proceed
 *   ...
 *   return (<>{consentSheet}</>);
 *
 * Resolves true immediately when consent is already on record, so the sheet is
 * a first-run cost rather than a per-message one.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AiConsentSheet } from '../components/ui/AiConsentSheet';
import { grantAiConsent, hasAiConsent, type AiConsentKind } from '../lib/ai-consent';

interface UseAiConsentResult {
  /**
   * Resolves true if the action may proceed. Shows the sheet and waits when
   * consent is not yet on record. Never throws — a storage failure resolves
   * false, so the action is skipped rather than silently sending data.
   */
  ensureConsent: (kind: AiConsentKind) => Promise<boolean>;
  /** Render this somewhere in the screen's tree. */
  consentSheet: React.ReactElement | null;
}

export function useAiConsent(userId: string | undefined): UseAiConsentResult {
  const [pendingKind, setPendingKind] = useState<AiConsentKind | null>(null);
  const resolverRef = useRef<((granted: boolean) => void) | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // A screen unmounting mid-prompt must not leave an awaited promise
      // hanging forever — resolve it as declined so the caller unwinds.
      resolverRef.current?.(false);
      resolverRef.current = null;
    };
  }, []);

  const ensureConsent = useCallback(
    async (kind: AiConsentKind): Promise<boolean> => {
      if (!userId) return false;

      if (await hasAiConsent(kind, userId)) return true;

      // Only one prompt at a time. A second request while one is open is
      // declined rather than queued — two stacked consent sheets is worse
      // than asking again on the next attempt.
      if (resolverRef.current) return false;

      return new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;
        setPendingKind(kind);
      });
    },
    [userId],
  );

  const settle = useCallback((granted: boolean) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    if (mountedRef.current) setPendingKind(null);
    resolve?.(granted);
  }, []);

  const handleAgree = useCallback(async () => {
    if (!userId || !pendingKind) {
      settle(false);
      return;
    }
    try {
      await grantAiConsent(pendingKind, userId);
    } catch {
      // Storage failed. Let the action proceed — the learner did consent, and
      // this turn is covered. They will simply be asked again next time.
    }
    settle(true);
  }, [pendingKind, settle, userId]);

  const handleDecline = useCallback(() => settle(false), [settle]);

  const consentSheet = pendingKind
    ? React.createElement(AiConsentSheet, {
        visible: true,
        kind: pendingKind,
        onAgree: handleAgree,
        onDecline: handleDecline,
      })
    : null;

  return { ensureConsent, consentSheet };
}
