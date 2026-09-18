/**
 * LanguageKeepSheet — a paid plan lapsed with more languages open than the
 * plan now allows, so the learner picks which to keep (migration 147).
 *
 * Until they do, the server refuses every switch (FLL03). So this is mounted
 * once, app-wide, in app/(app)/_layout.tsx, and shows itself whenever the
 * allowance says `overLimit` — not only when a switch happens to be tried.
 *
 * WHEN IT LOOKS. On mount, whenever the app comes back to the foreground (a
 * lapse happens while the phone is in a pocket, and a restart should not be
 * what notices it), and when another mount of the switcher hears FLL03
 * (`lib/language-access-events.ts`). Never per render.
 *
 * WHAT IT WILL NOT DO. It cannot be swiped away without choosing or
 * upgrading — the server would refuse the next switch anyway, and a sheet
 * that reappears on every foreground is worse than one decision. But it never
 * traps anyone on an error: a failed keep shows the reason, a retry, and a
 * "Not now" that steps aside until the next check. A failed READ fails
 * hidden: the allowance becomes unknown (null), and an unknown allowance is
 * never grounds to demand a choice. The next foreground reads again.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, ScrollView, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';

import { useLanguageEnrollments } from '../../hooks/useLanguageEnrollments';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { effectiveTier, useAppStore } from '../../stores/useAppStore';
import { spacing } from '../../config/theme';
import { saveErrorCopy, type ErrorCopy } from '../../lib/error-copy';
import { onLanguageAccessCheck, onSwitcherOpenChange, openSwitcherCount } from '../../lib/language-access-events';
import { languageAccessRefusal } from '../../lib/language-access';
import {
  PAYWALL_PATHNAME,
  advancePaywallTrip,
  canConfirmKeep,
  initialKeepSelection,
  orderKeepSelection,
  toggleKeep,
  upgradePendingCopy,
  type PaywallTrip,
} from '../../lib/language-limit-flow';
import { trackEvent } from '../../lib/analytics';
import type { LanguageCode } from '../../types';
import { languageFlag, languageName } from './LanguageSwitcherSheet';
import { LanguageLimitPanel } from './LanguageLimitPanel';
import { OptionRow } from './OptionRow';
import { SlabButton } from './SlabButton';
import { Ui2InlineError } from './Ui2InlineError';
import { Ui2Sheet } from './Ui2Sheet';
import { Body } from './Ui2Text';

/** Long enough for an RN Modal's iOS dismiss transition to finish. */
const SWITCHER_SETTLE_MS = 400;

export function LanguageKeepSheet() {
  const { c, type } = useUi2Theme();
  const router = useRouter();
  const pathname = usePathname();
  const devicePaid = useAppStore((s) => effectiveTier(s.subscription, s.entitledTier) !== 'starter');
  // Allowance only: this sheet never draws the enrollment list, so it does
  // not pay for reading it on every mount, foreground and FLL03 nudge.
  const { active, access, switching, reload, keep } = useLanguageEnrollments({ list: false });

  const [selection, setSelection] = useState<LanguageCode[] | null>(null);
  const [keepError, setKeepError] = useState<ErrorCopy | null>(null);
  /** "Not now" after an error: stand aside until the next check. */
  const [snoozed, setSnoozed] = useState(false);
  const [trip, setTrip] = useState<PaywallTrip>('idle');
  /**
   * Back from the paywall, the device is paid, the server still says over:
   * 'activating' if the device became paid on this trip, 'mismatch' if it
   * already believed it was paid before (a stale entitlement, not a purchase).
   */
  const [pending, setPending] = useState<'activating' | 'mismatch' | null>(null);
  const paidAtDeparture = useRef(false);
  /** A switcher is on screen, or dismissed too recently for iOS to present another Modal. */
  const [switcherBlocking, setSwitcherBlocking] = useState(() => openSwitcherCount() > 0);
  const [checking, setChecking] = useState(false);
  /** A tap on a full selection (max > 1) did nothing; say why on screen too. */
  const [fullNotice, setFullNotice] = useState(false);
  /** Set after a post-paywall re-read; decided on the render that has it. */
  const [returnCheck, setReturnCheck] = useState(false);

  const overLimit = access?.overLimit === true;

  const check = useCallback(async () => {
    setSnoozed(false);
    setChecking(true);
    try {
      await reload();
    } finally {
      setChecking(false);
    }
  }, [reload]);

  // Foreground and cross-mount re-checks. The hook reads once on mount.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'active') void check();
    });
    const off = onLanguageAccessCheck(() => void check());
    return () => {
      sub.remove();
      off();
    };
  }, [check]);

  // Preselect once per lapse; a fresh read must not undo the learner's taps.
  useEffect(() => {
    if (!overLimit || !access) {
      setSelection(null);
      setPending(null);
      return;
    }
    setSelection((prev) => prev ?? initialKeepSelection(access, active));
  }, [overLimit, access, active]);

  useEffect(() => {
    if (overLimit) trackEvent('language_limit_shown', { screen: 'keep', code: 'FLL03', count: access?.open.length });
    // Once per lapse, not per re-read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overLimit]);

  // ─── The paywall round trip ─────────────────────────────────────────────
  const recheckAfterPaywall = useCallback(async () => {
    await check();
    setReturnCheck(true);
  }, [check]);

  useEffect(() => {
    if (trip === 'idle') return;
    // The layout never loses focus to the paywall (it is inside it), so the
    // pathname alone says when the learner is back.
    const next = advancePaywallTrip(trip, { onPaywall: pathname === PAYWALL_PATHNAME, hostFocused: true });
    if (next.trip !== trip) setTrip(next.trip);
    if (next.returned) void recheckAfterPaywall();
  }, [trip, pathname, recheckAfterPaywall]);

  useEffect(() => {
    if (!returnCheck) return;
    setReturnCheck(false);
    // Still over after a purchase the device believes in: the webhook has not
    // landed. Say so rather than sending them back to the paywall.
    setPending(overLimit && devicePaid ? (paidAtDeparture.current ? 'mismatch' : 'activating') : null);
  }, [returnCheck, overLimit, devicePaid]);

  // iOS drops a Modal presented while another is up or still dismissing, and
  // Ui2Sheet unmounts its Modal the frame it hides. So wait for every
  // switcher to be gone, then long enough for the dismiss to finish.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const off = onSwitcherOpenChange((open) => {
      if (timer) clearTimeout(timer);
      timer = null;
      if (open > 0) setSwitcherBlocking(true);
      else timer = setTimeout(() => setSwitcherBlocking(false), SWITCHER_SETTLE_MS);
    });
    return () => {
      off();
      if (timer) clearTimeout(timer);
    };
  }, []);

  const onUpgrade = useCallback(() => {
    trackEvent('language_limit_resolved', { screen: 'keep', outcome: 'upgrade' });
    setPending(null);
    paidAtDeparture.current = devicePaid;
    setTrip('leaving');
    router.push('/(app)/plans');
  }, [router, devicePaid]);

  const onKeep = useCallback(async () => {
    if (!access || !selection || !canConfirmKeep(selection, access.maxLanguages)) return;
    setKeepError(null);
    const ordered = orderKeepSelection(selection, access);
    try {
      await keep(ordered);
      trackEvent('language_limit_resolved', { screen: 'keep', outcome: 'kept', count: ordered.length });
    } catch (err) {
      if (languageAccessRefusal(err)) {
        // The allowance or the open set moved under us (another device, a
        // contract change). Retrying the same pick would be refused forever:
        // re-read and preselect again from what is true now.
        setSelection(null);
        void check();
        return;
      }
      setKeepError(saveErrorCopy(err, 'your choice'));
    }
  }, [access, selection, keep, check]);

  const max = access?.maxLanguages ?? 1;
  const visible = overLimit && !snoozed && trip === 'idle' && selection !== null && !switcherBlocking;
  const busy = switching !== null;
  // Only a failed KEEP is shown here; a failed read hides the sheet (header).
  const shownError = keepError;

  const heading = max === 1 ? 'Pick the language to keep' : `Pick up to ${max} languages to keep`;
  const intro = useMemo(
    () =>
      max === 1
        ? 'Your plan now keeps one language open at a time. The others will be locked: their level, lessons and review deck are saved, and a paid plan reopens them.'
        : `Your plan now keeps ${max} languages open at a time. The others will be locked: their level, lessons and review deck are saved, and a plan with more languages reopens them.`,
    [max],
  );

  return (
    <Ui2Sheet visible={visible} dismissOnBackdrop={false}>
      <View style={styles.headerRow}>
        <Text accessibilityRole="header" style={{ fontFamily: type.heading, fontSize: 22, color: c.ink }}>
          {pending ? upgradePendingCopy(pending).title : heading}
        </Text>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {shownError ? (
          <>
            <Ui2InlineError copy={shownError} onRetry={() => void onKeep()} />
            <SlabButton variant="ghost" label="Not now" arrow={false} onPress={() => setSnoozed(true)} />
          </>
        ) : null}

        {pending ? (
          <LanguageLimitPanel
            icon={pending === 'activating' ? 'hourglass-outline' : 'alert-circle-outline'}
            body={upgradePendingCopy(pending).body}
            primary={{
              label: 'Try again',
              loading: checking,
              onPress: () => void recheckAfterPaywall(),
            }}
            secondary={{ label: 'Pick instead', onPress: () => setPending(null) }}
          />
        ) : (
          <>
            <Body tone="secondary" style={styles.intro}>
              {intro}
            </Body>

            {(access?.open ?? []).map((language, i) => {
              const selected = selection?.includes(language) ?? false;
              return (
                <OptionRow
                  key={language}
                  index={i}
                  title={languageName(language)}
                  subtitle={selected ? 'Stays open' : 'Will be locked'}
                  selected={selected}
                  onSelect={() => {
                    setKeepError(null);
                    const prev = selection ?? [];
                    const next = toggleKeep(prev, language, max);
                    if (next === prev) {
                      // Full, and max > 1: say why the tap did nothing.
                      AccessibilityInfo.announceForAccessibility(
                        `You can keep up to ${max}. Unselect one first.`,
                      );
                      setFullNotice(true);
                      return;
                    }
                    setFullNotice(false);
                    setSelection(next);
                  }}
                  lead={<Text style={styles.flag}>{languageFlag(language)}</Text>}
                  role={max === 1 ? 'radio' : 'checkbox'}
                  disabled={busy}
                  accessibilityLabel={`${languageName(language)}. ${selected ? 'Stays open' : 'Will be locked'}`}
                />
              );
            })}

            {fullNotice ? (
              <Body tone="secondary" style={styles.intro} accessibilityLiveRegion="polite">
                {`You can keep up to ${max}. Unselect one first.`}
              </Body>
            ) : null}

            <SlabButton
              label={selection && selection.length > 1 ? `Keep these ${selection.length}` : 'Keep this one'}
              onPress={() => void onKeep()}
              loading={busy}
              disabled={!selection || !canConfirmKeep(selection, max) || checking}
              arrow={false}
              style={styles.confirm}
            />
            <SlabButton
              variant="ghost"
              label="Keep them all: upgrade"
              arrow={false}
              onPress={onUpgrade}
              disabled={busy}
              accessibilityHint="Opens the plans"
            />
          </>
        )}
      </ScrollView>
    </Ui2Sheet>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  body: { maxHeight: 520 },
  bodyContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  intro: { marginBottom: spacing.md },
  flag: { fontSize: 24 },
  confirm: { marginTop: spacing.md },
});
