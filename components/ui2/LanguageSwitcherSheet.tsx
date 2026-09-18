/**
 * LanguageSwitcherSheet — which language the app is in, and how to start
 * another one (migration 133).
 *
 * WHY A SHEET, AND WHY FROM HOME. A learner studying two languages switches
 * several times a week; a control three taps deep in Settings is a control
 * they stop using. It opens from the chip in the Home header, and Settings
 * opens the same sheet so the setting is still where someone would look for
 * it.
 *
 * WHAT A ROW SAYS. The language, and the band its lessons start at paired with
 * its can-do line — never a bare "A2" (CLAUDE.md §1). A language with no
 * lesson path says so in words rather than showing nothing. A locked language
 * says it is locked, what was kept, and what reopening it takes.
 *
 * ADDING ONE ASKS FOR A LEVEL. A B1 Spanish speaker starting Japanese is a
 * beginner in Japanese, so the level is asked per language rather than carried
 * across from the profile. The answer resolves a course through
 * `lib/course-placement.ts`, exactly as onboarding and Settings do.
 *
 * SEVERAL AT ONCE IS PAID (migration 147). On the free plan "Add a language"
 * explains that, and offers Upgrade or "switch instead" — which walks the same
 * pick-language → pick-level path and ends on a confirmation that says what
 * gets locked and that only upgrading brings it back. Which step to show is
 * decided in `lib/language-limit-flow.ts`; the server's refusal codes override
 * it whenever the two disagree, because the server is the gate.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';

import { useLanguageEnrollments } from '../../hooks/useLanguageEnrollments';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { effectiveTier, useAppStore } from '../../stores/useAppStore';
import { cefrCanDo } from '../../lib/cefr-labels';
import { cefrBandForProficiencyLevel } from '../../lib/cefr-proficiency';
import { SUPPORTED_LANGUAGES } from '../../config/app';
import { spacing } from '../../config/theme';
import { loadErrorCopy, type ErrorCopy } from '../../lib/error-copy';
import { languageAccessRefusal, type LanguageAccessRefusal } from '../../lib/language-access';
import { requestLanguageAccessCheck } from '../../lib/language-access-events';
import {
  PAYWALL_PATHNAME,
  actionForLockedTapped,
  advancePaywallTrip,
  lockedSubtitle,
  outcomeForRefusal,
  previousStep,
  stepForAddTapped,
  switcherFooterNote,
  upgradeReturnOutcome,
  type AddMode,
  type PaywallTrip,
  type SwitcherStep,
} from '../../lib/language-limit-flow';
import { trackEvent } from '../../lib/analytics';
import type { LanguageCode, LanguageEnrollment, ProficiencyLevel } from '../../types';
import { LanguageLimitPanel } from './LanguageLimitPanel';
import { OptionRow } from './OptionRow';
import { Ui2InlineError } from './Ui2InlineError';
import { Ui2Sheet } from './Ui2Sheet';

const LEVELS: { value: ProficiencyLevel; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'elementary', label: 'Elementary' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'upper_intermediate', label: 'Upper Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const REFUSAL_CODE: Record<LanguageAccessRefusal, string> = { limit: 'FLL01', locked: 'FLL02', resolve: 'FLL03' };

export function languageName(code: LanguageCode): string {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.name ?? code.toUpperCase();
}

export function languageFlag(code: LanguageCode): string {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.flag ?? '🌐';
}

/**
 * The line under a language in the switcher. Pure so both halves — a placed
 * language and one with no lesson path — can be asserted without a render.
 */
export function enrollmentSubtitle(enrollment: LanguageEnrollment): string {
  if (!enrollment.placementBand) return 'Reading, chat and the tutor — no lesson path yet';
  return `Lessons start at ${enrollment.placementBand} · ${cefrCanDo(enrollment.placementBand)}`;
}

interface LanguageSwitcherSheetProps {
  visible: boolean;
  onDismiss: () => void;
}

export function LanguageSwitcherSheet({ visible, onDismiss }: LanguageSwitcherSheetProps) {
  const { c, type } = useUi2Theme();
  const router = useRouter();
  const pathname = usePathname();
  const devicePaid = useAppStore((s) => effectiveTier(s.subscription, s.entitledTier) !== 'starter');
  const { enrollments, active, loading, error, switching, reload, access, switchTo, addLanguage } =
    useLanguageEnrollments();
  // `access` survives a failed re-read with its old value; after a failure the
  // allowance is unknown, and unknown must not be read as either answer.
  const knownAccess = error ? null : access;

  const [step, setStep] = useState<SwitcherStep>('list');
  const [mode, setMode] = useState<AddMode>('add');
  const [pending, setPending] = useState<LanguageCode | null>(null);
  const [pendingLevel, setPendingLevel] = useState<ProficiencyLevel | null>(null);
  /** The locked language the learner tapped, when the locked step is up. */
  const [lockedTarget, setLockedTarget] = useState<LanguageCode | null>(null);
  /** The step the paywall was opened from — where a decline comes back to. */
  const [upgradeFrom, setUpgradeFrom] = useState<'limit' | 'locked'>('limit');
  const [trip, setTrip] = useState<PaywallTrip>('idle');
  const [upgradeCheck, setUpgradeCheck] = useState<'idle' | 'checking' | 'ready'>('idle');
  // A failed switch keeps the sheet open with the reason on it: the learner is
  // mid-decision, and an Alert over a dismissed sheet loses where they were.
  const [actionError, setActionError] = useState<ErrorCopy | null>(null);

  // A switch can settle after the sheet was dismissed; its result must not
  // be written into the NEXT open (it would open straight onto a wall or an
  // old error).
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  useEffect(() => {
    // Reset on close AND on open: the close-time reset can be overtaken by a
    // call that was still in flight when the learner tapped away.
    setStep('list');
    setMode('add');
    setPending(null);
    setPendingLevel(null);
    setLockedTarget(null);
    setTrip('idle');
    setUpgradeCheck('idle');
    setActionError(null);
    if (visible) {
      // The allowance changes off-device (a purchase, a lapse, a school
      // contract), so every open reads it fresh rather than trusting the read
      // this mount made when Home first rendered.
      void reload();
    }
  }, [visible, reload]);

  const enrolled = new Set(enrollments.map((e) => e.language));
  const available = SUPPORTED_LANGUAGES.filter((l) => !enrolled.has(l.code));

  const showWall = useCallback(
    (next: 'limit' | 'locked', refusal: LanguageAccessRefusal) => {
      setActionError(null);
      setStep(next);
      trackEvent('language_limit_shown', { screen: 'switcher', code: REFUSAL_CODE[refusal] });
    },
    [],
  );

  /** A thrown switch: the server's refusal picks the step, anything else is an ordinary error. */
  const handleSwitchError = useCallback(
    (err: unknown, language: LanguageCode) => {
      const refusal = languageAccessRefusal(err);
      if (!visibleRef.current) {
        // Dismissed mid-flight: nothing to draw on. A lapse still has to be
        // noticed, so FLL03 still wakes the keep sheet.
        if (refusal === 'resolve') requestLanguageAccessCheck();
        return;
      }
      if (!refusal) {
        setActionError(loadErrorCopy(err, 'that language'));
        return;
      }
      const outcome = outcomeForRefusal(refusal);
      if (outcome.kind === 'resolve') {
        // A paid plan lapsed. The app-wide keep sheet resolves that; nudge it
        // to look, and get out of its way.
        trackEvent('language_limit_shown', { screen: 'switcher', code: REFUSAL_CODE.resolve });
        requestLanguageAccessCheck();
        void reload();
        onDismiss();
        return;
      }
      if (outcome.step === 'locked') setLockedTarget(language);
      showWall(outcome.step, refusal);
    },
    [reload, onDismiss, showWall],
  );

  const doSwitch = useCallback(
    async (language: LanguageCode) => {
      setActionError(null);
      try {
        await switchTo(language);
        onDismiss();
      } catch (err) {
        handleSwitchError(err, language);
      }
    },
    [switchTo, onDismiss, handleSwitchError],
  );

  const onPickExisting = useCallback(
    async (enrollment: LanguageEnrollment) => {
      const language = enrollment.language;
      // One switch at a time: a second tap would reset navigation twice.
      if (switching !== null) return;
      if (language === active) {
        onDismiss();
        return;
      }
      if (enrollment.lockedAt) {
        const action = actionForLockedTapped(knownAccess);
        // Unknown allowance: the list is already showing the loading or error
        // state for it, and neither answer can be assumed.
        if (action === null) return;
        if (action === 'locked') {
          setLockedTarget(language);
          showWall('locked', 'locked');
          return;
        }
      }
      await doSwitch(language);
    },
    [active, switching, onDismiss, knownAccess, showWall, doSwitch],
  );

  const onAddTapped = useCallback(() => {
    if (switching !== null) return;
    const next = stepForAddTapped(knownAccess);
    if (next === null) return;
    setMode('add');
    if (next === 'limit') showWall('limit', 'limit');
    else setStep('pick-language');
  }, [switching, knownAccess, showWall]);

  const addPending = useCallback(
    async (level: ProficiencyLevel, lockCurrent: boolean) => {
      if (!pending) return;
      setActionError(null);
      try {
        await addLanguage(pending, level, { lockCurrent });
        if (lockCurrent) {
          trackEvent('language_limit_resolved', { screen: 'switcher', outcome: 'switch_instead', language: pending });
        }
        onDismiss();
      } catch (err) {
        handleSwitchError(err, pending);
      }
    },
    [pending, addLanguage, onDismiss, handleSwitchError],
  );

  const onPickLevel = useCallback(
    (level: ProficiencyLevel) => {
      if (switching !== null) return;
      if (mode === 'switch-instead') {
        setPendingLevel(level);
        setStep('confirm-lock');
        return;
      }
      void addPending(level, false);
    },
    [mode, switching, addPending],
  );

  // ─── The paywall round trip ─────────────────────────────────────────────
  const onUpgrade = useCallback(() => {
    setUpgradeFrom(step === 'locked' ? 'locked' : 'limit');
    trackEvent('language_limit_resolved', { screen: 'switcher', outcome: 'upgrade' });
    setTrip('leaving');
    router.push('/(app)/plans');
  }, [step, router]);

  const checkUpgrade = useCallback(async () => {
    setUpgradeCheck('checking');
    await reload();
    // Read on the next render, where the re-read access is in state.
    setUpgradeCheck('ready');
  }, [reload]);

  useEffect(() => {
    if (trip === 'idle') return;
    // hostFocused is not waited for. The paywall is a sibling tab and the tab
    // navigator goes back to Home, not to Settings, so a switcher opened from
    // Settings would wait for a focus that may come minutes later — and then
    // resume a purchase-time switch out of context. The sheet is a modal; it
    // finishes the round trip over whatever screen the learner landed on.
    const next = advancePaywallTrip(trip, { onPaywall: pathname === PAYWALL_PATHNAME, hostFocused: true });
    if (next.trip !== trip) setTrip(next.trip);
    if (next.returned) void checkUpgrade();
  }, [trip, pathname, checkUpgrade]);

  useEffect(() => {
    if (upgradeCheck !== 'ready') return;
    setUpgradeCheck('idle');
    const outcome = upgradeReturnOutcome(knownAccess, devicePaid, upgradeFrom === 'locked' ? lockedTarget : null);
    if (outcome === 'resume') {
      if (upgradeFrom === 'locked' && lockedTarget) void doSwitch(lockedTarget);
      else {
        setMode('add');
        setStep('pick-language');
      }
    } else if (outcome === 'activating') setStep('activating');
    else if (outcome === 'declined') setStep(upgradeFrom);
    // 'unknown': the list carries the read error and its retry.
    else setStep('list');
  }, [upgradeCheck, knownAccess, devicePaid, upgradeFrom, lockedTarget, doSwitch]);

  const activeName = active ? languageName(active) : 'the language you are on';
  const pendingName = pending ? languageName(pending) : '';
  const title =
    step === 'list'
      ? 'Your languages'
      : step === 'pick-language'
        ? mode === 'switch-instead'
          ? 'Switch to'
          : 'Add a language'
        : step === 'pick-level'
          ? `How much ${pendingName} do you know?`
          : step === 'limit'
            ? 'More than one language'
            : step === 'locked'
              ? `${lockedTarget ? languageName(lockedTarget) : 'This language'} is locked`
              : step === 'confirm-lock'
                ? `Lock ${activeName}?`
                : 'Finishing your upgrade';

  return (
    <Ui2Sheet visible={visible && trip === 'idle'} onDismiss={onDismiss}>
      <View style={styles.headerRow}>
        {step !== 'list' ? (
          <Pressable
            onPress={() => {
              setStep(previousStep(step, mode));
              setActionError(null);
            }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.back}
          >
            <Ionicons name="chevron-back" size={22} color={c.ink} />
          </Pressable>
        ) : null}
        <Text
          accessibilityRole="header"
          style={{ fontFamily: type.heading, fontSize: 22, color: c.ink, flex: 1 }}
        >
          {title}
        </Text>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {actionError ? <Ui2InlineError copy={actionError} onRetry={() => setActionError(null)} retryLabel="Dismiss" /> : null}

        {step === 'list' ? (
          <>
            {error ? (
              <Ui2InlineError copy={error} onRetry={() => void reload()} />
            ) : (loading && enrollments.length === 0) || upgradeCheck !== 'idle' ? (
              <ActivityIndicator color={c.primary} style={styles.spinner} />
            ) : (
              enrollments.map((enrollment, i) => {
                const locked = enrollment.lockedAt !== null;
                const subtitle = locked ? lockedSubtitle(knownAccess) : enrollmentSubtitle(enrollment);
                return (
                  <OptionRow
                    key={enrollment.language}
                    index={i}
                    title={languageName(enrollment.language)}
                    subtitle={subtitle}
                    selected={enrollment.language === active}
                    onSelect={() => void onPickExisting(enrollment)}
                    disabled={switching !== null && switching !== enrollment.language}
                    lead={<Text style={styles.flag}>{languageFlag(enrollment.language)}</Text>}
                    trail={
                      switching === enrollment.language ? (
                        <ActivityIndicator color={c.primary} />
                      ) : locked ? (
                        <Ionicons name="lock-closed" size={18} color={c.muted} />
                      ) : undefined
                    }
                    accessibilityLabel={`${languageName(enrollment.language)}. ${subtitle}`}
                  />
                );
              })
            )}

            {available.length > 0 ? (
              <Pressable
                onPress={onAddTapped}
                disabled={!knownAccess}
                accessibilityRole="button"
                accessibilityLabel="Add a language"
                accessibilityState={{ disabled: !knownAccess }}
                style={[styles.addRow, { borderColor: c.cardBorder, opacity: knownAccess ? 1 : 0.5 }]}
              >
                <Ionicons name="add-circle-outline" size={22} color={c.primary} />
                <Text style={{ fontFamily: type.uiBold, fontSize: 16, color: c.ink, marginLeft: spacing.sm }}>
                  Add a language
                </Text>
              </Pressable>
            ) : null}

            <Text style={[styles.note, { color: c.muted, fontFamily: type.ui }]}>
              {switcherFooterNote(knownAccess)}
            </Text>
          </>
        ) : null}

        {step === 'limit' ? (
          <LanguageLimitPanel
            icon="layers-outline"
            body={[
              'Keeping several languages open at once is part of the paid plans.',
              `On the free plan you can switch to a new language instead. ${activeName} would be locked: its level, lessons and review deck are saved, but it only reopens if you upgrade.`,
            ]}
            primary={{ label: 'Upgrade', onPress: onUpgrade, accessibilityHint: 'Opens the plans' }}
            secondary={{
              label: 'Switch to a new language instead',
              onPress: () => {
                setMode('switch-instead');
                setStep('pick-language');
              },
            }}
          />
        ) : null}

        {step === 'locked' ? (
          <LanguageLimitPanel
            icon="lock-closed-outline"
            body={[
              `Your ${lockedTarget ? languageName(lockedTarget) : ''} level, lessons and review deck are saved.`,
              'On the free plan a locked language cannot be reopened. Any paid plan reopens it, alongside the language you are on now.',
            ]}
            primary={{ label: 'Upgrade', onPress: onUpgrade, accessibilityHint: 'Opens the plans' }}
            secondary={{ label: 'Not now', onPress: () => setStep('list') }}
          />
        ) : null}

        {step === 'confirm-lock' && pending && pendingLevel ? (
          <LanguageLimitPanel
            icon="swap-horizontal-outline"
            body={[
              `Starting ${pendingName} locks ${activeName}. Its level, lessons and review deck are saved, but on the free plan it cannot be reopened.`,
              `The only way back to ${activeName} is upgrading to a paid plan.`,
            ]}
            primary={{
              label: `Lock ${activeName} and start ${pendingName}`,
              onPress: () => void addPending(pendingLevel, true),
              loading: switching === pending,
            }}
            secondary={{ label: 'Go back', onPress: () => setStep('pick-level'), disabled: switching === pending }}
          />
        ) : null}

        {step === 'activating' ? (
          <LanguageLimitPanel
            icon="hourglass-outline"
            body={[
              'Your plan shows as active on this phone, but our servers have not caught up with it yet.',
              'This usually takes a few seconds. Try again in a moment.',
            ]}
            primary={{ label: 'Try again', onPress: () => void checkUpgrade(), loading: upgradeCheck !== 'idle' }}
            secondary={{ label: 'Back', onPress: () => setStep('list') }}
          />
        ) : null}

        {step === 'pick-language'
          ? available.map((lang, i) => (
              <OptionRow
                key={lang.code}
                index={i}
                title={lang.name}
                selected={false}
                onSelect={() => {
                  setPending(lang.code);
                  setStep('pick-level');
                }}
                lead={<Text style={styles.flag}>{lang.flag}</Text>}
              />
            ))
          : null}

        {step === 'pick-level'
          ? LEVELS.map((l, i) => (
              <OptionRow
                key={l.value}
                index={i}
                title={l.label}
                subtitle={cefrCanDo(cefrBandForProficiencyLevel(l.value))}
                selected={false}
                onSelect={() => onPickLevel(l.value)}
                disabled={switching !== null}
                trail={switching === pending && pending ? <ActivityIndicator color={c.primary} /> : undefined}
                accessibilityLabel={`${l.label}. ${cefrCanDo(cefrBandForProficiencyLevel(l.value))}`}
              />
            ))
          : null}
      </ScrollView>
    </Ui2Sheet>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  back: { marginRight: spacing.sm },
  body: { maxHeight: 460 },
  bodyContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  spinner: { marginVertical: spacing.xl },
  flag: { fontSize: 24 },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    borderStyle: 'dashed',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    minHeight: 56,
  },
  note: { fontSize: 13, lineHeight: 18, marginTop: spacing.md },
});
