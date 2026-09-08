/**
 * The voice-tutor lobby.
 *
 * The screen a learner sees before committing to a live call, and the one
 * place where everything that can refuse the call gets to refuse it while
 * refusing is still cheap.
 *
 * ── THE ORDER OF OPERATIONS ON START IS THE FEATURE ──
 *
 * Consent, then microphone, then token, then navigate. Every step is here
 * rather than on the call screen, and each one is placed deliberately:
 *
 *   1. `ensureConsent('voice')` comes BEFORE the system microphone prompt.
 *      Apple 5.1.2(i) wants the disclosure about sending audio to a third
 *      party in front of the learner before the OS asks for the hardware, not
 *      after — and `app/(app)/practice/handsfree.tsx` already does it in this
 *      order, so doing it differently here would make one of the two wrong.
 *
 *   2. The microphone permission is requested here, not on the call screen. A
 *      denial is then a sentence on a screen the learner still has context
 *      for, instead of a call screen that appears and immediately dies. It
 *      also means no token is minted — and so no spend is committed — for a
 *      call that could never have had audio.
 *
 *   3. `startTutorSession` is called HERE. This is the important one. Minting
 *      the token in the lobby turns "you have used your tutor time today"
 *      into a line on the screen they are already looking at, rather than a
 *      call that connects, greets them, and dies thirty seconds later. A
 *      `TutorLimitError` is a settled state, not a failure — it renders as
 *      copy with an upgrade path, and never as a retry.
 *
 * ── THE CORRECTION MODE IS ASKED, NOT ASSUMED ──
 *
 * `needsCorrectionModeChoice` gates Start on first launch and nothing is
 * pre-selected. `lib/tutor-storage.ts` goes to some length to keep "never
 * answered" distinct from "answered the same as the default", and defaulting
 * it here would throw that away and silently impose a correction style on
 * everyone who has not chosen — permanently, since the question is only asked
 * while the answer is unknown.
 */

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../../hooks/useAuth';
import { useAiConsent } from '../../../hooks/useAiConsent';
import { useScreenView } from '../../../hooks/useScreenView';
import { useAppStore, effectiveTier } from '../../../stores/useAppStore';
import { CallStatusRing } from '../../../components/tutor/CallStatusRing';
import { CorrectionModeToggle } from '../../../components/tutor/CorrectionModeToggle';
import { LastSessionCard } from '../../../components/tutor/LastSessionCard';
import { SlabButton } from '../../../components/ui2/SlabButton';
import { SlabCard } from '../../../components/ui2/SlabCard';
import { Ui2InlineError } from '../../../components/ui2/Ui2InlineError';
import { Body, Caption, Heading } from '../../../components/ui2/Ui2Text';
import { useUi2Theme } from '../../../hooks/useUi2Theme';
import { floatingTabBarSpace } from '../../../components/navigation/FloatingTabBar';
import { startTutorSession, TutorLimitError } from '../../../lib/tutor-api';
import { fetchLastTutorSession } from '../../../lib/supabase-queries';
import {
  loadTutorPreferences,
  needsCorrectionModeChoice,
  saveCorrectionMode,
  saveTutorPersona,
  NOTHING_CHOSEN,
  type CorrectionMode,
  type TutorPreferences,
} from '../../../lib/tutor-storage';
import { personaForLearner } from '../../../lib/tutor-personas';
import { clearDebriefHandoff } from '../../../lib/tutor-debrief-handoff';
import { lowBudgetLine, startBlockedReason } from '../../../lib/tutor-screen-flow';
import { stashCallHandoff } from '../../../lib/tutor-call-handoff';
import { cefrAccessibilityLabel, cefrLabel } from '../../../lib/cefr-labels';
import { CEFR_BAND_BY_LEVEL } from '../../../lib/cefr-proficiency';
import { tutorLimitCopy, type LimitCopy } from '../../../lib/limit-messaging';
import { saveErrorCopy } from '../../../lib/error-copy';
import type { ErrorCopy } from '../../../lib/error-copy';
import { SCHOOL_ENABLED } from '../../../config/app';
// `colors` is deliberately NOT imported: it is the fixed DARK palette, and a
// screen that reads it stays dark whatever the phone is set to. `radii` and
// `spacing` are plain scheme-independent numbers and carry over unchanged.
import { radii, spacing } from '../../../config/theme';

interface LastSession {
  minutes: number;
  headline: string | null;
}

export default function TutorLobbyScreen() {
  const { c } = useUi2Theme();
  const router = useRouter();
  const { user } = useAuth();
  const { profile, subscription, entitledTier, roles } = useAppStore();
  const { ensureConsent, consentSheet } = useAiConsent(user?.id);

  const band = profile ? CEFR_BAND_BY_LEVEL[profile.level] : null;
  const tier = effectiveTier(subscription, entitledTier);
  useScreenView('tutor', { language: profile?.targetLanguage, band: band ?? undefined, tier });

  // `null` while the store is still being read — distinct from NOTHING_CHOSEN,
  // which is a real answer meaning "asked and not yet decided". Rendering the
  // toggle before we know would flash an unselected control at a learner who
  // chose weeks ago.
  const [prefs, setPrefs] = useState<TutorPreferences | null>(null);
  const [lastSession, setLastSession] = useState<LastSession | null>(null);
  const [loadingLast, setLoadingLast] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<ErrorCopy | null>(null);
  const [limit, setLimit] = useState<LimitCopy | null>(null);
  /**
   * Only known once a call has been started from this screen — the server
   * reports it on the grant. Held so that returning from a call can say how
   * much is left, which is the moment it is actually worth knowing.
   */
  const [remainingMinutes, setRemainingMinutes] = useState<number | null>(null);

  // ── Preferences ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      const loaded = await loadTutorPreferences(user.id);
      if (cancelled) return;
      setPrefs(loaded);

      // Persist the deterministic assignment the first time we make it.
      // `personaForLearner`'s header warns that adding a fifth tutor changes
      // the modulus and reassigns everyone who never chose explicitly — which
      // is a rapport cost paid by exactly the learners who never noticed they
      // had a choice. Writing it down now is the cheap half of that fix.
      if (loaded.personaId === null) {
        const assigned = personaForLearner(user.id, null);
        await saveTutorPersona(user.id, assigned.id);
        if (!cancelled) setPrefs((p) => (p ? { ...p, personaId: assigned.id } : p));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // ── Last session ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      try {
        const last = await fetchLastTutorSession(user.id);
        if (!cancelled) setLastSession(last);
      } catch {
        // A missing "last time you said…" line is not worth an error state on
        // a screen whose job is to start a call. The card renders its
        // first-session invitation instead, which is also the honest thing to
        // show when we cannot tell whether there was a last session.
        if (!cancelled) setLastSession(null);
      } finally {
        if (!cancelled) setLoadingLast(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleCorrectionMode = useCallback(
    (mode: CorrectionMode) => {
      setPrefs((p) => ({ ...(p ?? NOTHING_CHOSEN), correctionMode: mode }));
      if (user) void saveCorrectionMode(user.id, mode);
    },
    [user],
  );

  const persona = user ? personaForLearner(user.id, prefs?.personaId ?? null) : null;

  const blocked = startBlockedReason({
    hasProfile: profile !== null,
    needsCorrectionMode: prefs === null || needsCorrectionModeChoice(prefs),
    starting,
  });

  const handleStart = useCallback(async () => {
    if (!user || !profile || !persona) return;
    const mode = prefs?.correctionMode;
    if (!mode) return;

    setError(null);
    setLimit(null);
    setStarting(true);
    try {
      // 1. Consent BEFORE the OS microphone prompt. See the file header.
      if (!(await ensureConsent('voice'))) return;

      // 2. The hardware. Denied here costs the learner nothing — no session
      //    row, no grant, no spend.
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setError({
          title: 'Fluenci needs the microphone',
          message:
            'A live conversation needs to hear you. Turn the microphone on for Fluenci in Settings, then start again.',
        });
        return;
      }

      // 3. The token. A refusal lands here, on a screen with context, rather
      //    than as a call that dies after the learner has committed to it.
      const session = await startTutorSession({
        targetLanguage: profile.targetLanguage,
        nativeLanguage: profile.nativeLanguage,
        level: profile.level,
        correctionMode: mode,
        personaId: persona.id,
      });
      setRemainingMinutes(session.remainingTutorMinutesToday);

      // A new call invalidates the previous call's analysis. Clearing it here
      // rather than on arrival at the debrief means a stale debrief can never
      // outlive the session that follows it.
      clearDebriefHandoff();
      stashCallHandoff(session);
      router.push('/(app)/tutor/call');
    } catch (err) {
      if (err instanceof TutorLimitError) {
        // A settled state, not a failure. There is nothing to retry — the
        // server will refuse identically a second later — so this renders as
        // copy with an upgrade path instead of a retry button.
        setLimit(tutorLimitCopy(err.code, tier));
      } else {
        setError(saveErrorCopy(err, 'your tutor session'));
      }
    } finally {
      setStarting(false);
    }
  }, [user, profile, persona, prefs, ensureConsent, router, tier]);

  // ── Free tier ────────────────────────────────────────────────────────
  // Walled exactly as chat is, and for the same reason: the free plan's tutor
  // minutes are zero server-side, so a learner who taps Start would be refused
  // by `startTutorSession` on the first call. Saying so before they commit is
  // the honest version. Classroom members are exempt — their allowance comes
  // from the org contract, not a personal subscription.
  const schoolExempt = SCHOOL_ENABLED && (roles.includes('student') || roles.includes('teacher'));
  if (tier === 'starter' && !schoolExempt) {
    return (
      <View style={[styles.flex, { backgroundColor: c.bg }]}>
        <SafeAreaView style={styles.flex} edges={['top']}>
          <View style={styles.wall}>
            <View style={[styles.wallIcon, { backgroundColor: c.primaryTint }]}>
              <Ionicons name="mic-outline" size={28} color={c.primary} />
            </View>
            <Heading level={1} style={styles.wallTitle} accessibilityRole="header">
              The live tutor is part of a plan
            </Heading>
            <Body tone="secondary" style={styles.wallBody}>
              Speaking with a tutor in real time is the part of Fluenci that costs the most to
              run, so it sits behind a subscription. Everything else — lessons, reviews, reading
              and the daily news — stays free.
            </Body>
            <SlabButton label="See plans" onPress={() => router.push('/(app)/plans')} />
            <Pressable
              style={styles.tertiaryButton}
              onPress={() => router.push('/(app)/learn')}
              accessibilityRole="button"
              accessibilityLabel="Go to lessons instead"
            >
              <Body size="sm" tone="secondary">
                Keep learning for free
              </Body>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const budgetLine = lowBudgetLine(remainingMinutes);
  const mode = prefs?.correctionMode ?? null;

  // The tab IS the conversation screen, at rest (Talk C1, 2026-09-08). Same
  // frame as app/(app)/tutor/call.tsx — centred name, compact correction
  // pills, the stage (portrait over the analyser, "Ready"), captions, then the
  // controls row — so starting a call changes the state of the screen the
  // learner is already looking at rather than swapping in a new one. Every
  // lobby feature is still here: persona bio and level, last session, the
  // correction question (unanswered stays unanswered), minutes left, limit
  // card, errors, consent, and the Starter plan wall above.
  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerSide} />
            <Heading level={2} style={styles.headerName} accessibilityRole="header" numberOfLines={1}>
              {persona?.name ?? 'Your tutor'}
            </Heading>
            <View style={styles.headerSide}>
              {remainingMinutes !== null ? (
                <Caption tone="tertiary" accessibilityLabel={`${remainingMinutes} minutes left today`}>
                  {remainingMinutes} min left
                </Caption>
              ) : null}
            </View>
          </View>

          {/* Unanswered stays a real question: the compact row drops the
              question text, so it is asked here until one pill is chosen. */}
          {mode === null ? (
            <Caption tone="secondary" style={styles.question}>
              How should I correct you?
            </Caption>
          ) : null}
          <CorrectionModeToggle mode={mode} onChange={handleCorrectionMode} compact />

          {budgetLine ? (
            <Caption tone="tertiary" style={styles.centeredText} accessibilityLiveRegion="polite">
              {budgetLine}
            </Caption>
          ) : null}
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.stage}>
            {persona ? (
              <>
                <CallStatusRing phase="idle" portraitId={persona.portraitId} name={persona.name} />
                <Body tone="secondary" style={styles.centeredText}>
                  {persona.bio}
                </Body>
              </>
            ) : (
              <ActivityIndicator color={c.primary} />
            )}

            {/* Never a bare band code — see lib/cefr-labels.ts. */}
            {band ? (
              <Caption tone="tertiary" style={styles.centeredText} accessibilityLabel={cefrAccessibilityLabel(band)}>
                {cefrLabel(band)}
              </Caption>
            ) : null}
          </View>

          <LastSessionCard
            minutes={lastSession?.minutes ?? null}
            headline={lastSession?.headline ?? null}
            loading={loadingLast}
          />

          {/* A ceiling is a settled state with an upgrade path, never a retry. */}
          {limit ? (
            <SlabCard tint="yellow" style={styles.limit} accessibilityRole="alert">
              <Body weight="semibold">
                {limit.title}
              </Body>
              <Body size="sm" tone="secondary" style={styles.limitMessage}>
                {limit.message}
              </Body>
              {limit.upgrade ? (
                <Pressable
                  style={styles.tertiaryButton}
                  onPress={() => router.push('/(app)/profile/subscription')}
                  accessibilityRole="button"
                  accessibilityLabel={limit.upgrade.label}
                >
                  <Body size="sm" weight="semibold" tone="accent">
                    {limit.upgrade.label}
                  </Body>
                </Pressable>
              ) : null}
            </SlabCard>
          ) : null}

          {error ? <Ui2InlineError copy={error} onRetry={() => void handleStart()} /> : null}
        </ScrollView>

        {/* ── Start: the call screen's controls row, with one control ── */}
        <View style={styles.footer}>
          {blocked === 'needs_correction_mode' ? (
            <Caption tone="tertiary" style={styles.centeredText}>
              Choose how you want to be corrected first.
            </Caption>
          ) : null}
          <Pressable
            onPress={() => void handleStart()}
            disabled={blocked !== null}
            accessibilityRole="button"
            accessibilityLabel={starting ? 'Starting your call' : 'Start call'}
            accessibilityHint={
              blocked === 'needs_correction_mode'
                ? 'Choose how you want to be corrected to enable this.'
                : 'Starts a live voice conversation with your tutor.'
            }
            accessibilityState={{ disabled: blocked !== null, busy: starting }}
            style={[
              styles.startButton,
              { backgroundColor: c.primary, opacity: blocked !== null && !starting ? 0.5 : 1 },
            ]}
          >
            {starting ? (
              <ActivityIndicator color={c.onPrimary} />
            ) : (
              <Ionicons name="mic" size={30} color={c.onPrimary} />
            )}
          </Pressable>
          <Body weight="bold" style={styles.centeredText}>
            {starting ? 'Starting your call' : 'Start call'}
          </Body>
        </View>

        {consentSheet}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    gap: spacing.xs,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    minHeight: 44,
  },
  headerName: {
    flex: 1,
    textAlign: 'center',
  },
  headerSide: {
    width: 88,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  question: {
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  stage: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  centeredText: {
    textAlign: 'center',
  },
  limit: {
    padding: spacing.md,
    gap: spacing.xxs,
  },
  limitMessage: {
    marginTop: spacing.xxs,
  },
  footer: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: floatingTabBarSpace(),
    gap: spacing.xs,
  },
  startButton: {
    width: 72,
    height: 72,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tertiaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wall: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: floatingTabBarSpace(),
    gap: spacing.sm,
  },
  wallIcon: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wallTitle: {
    marginTop: spacing.xs,
  },
  wallBody: {
    marginBottom: spacing.sm,
  },
});
