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
import { TutorPortrait } from '../../../components/tutor/TutorPortrait';
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

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Who is on the other end ── */}
          <View style={styles.hero}>
            {persona ? (
              <>
                <TutorPortrait portraitId={persona.portraitId} name={persona.name} size="hero" />
                <Heading level={1} style={styles.heroName} accessibilityRole="header">
                  {persona.name}
                </Heading>
                <Body tone="secondary" style={styles.heroBio}>
                  {persona.bio}
                </Body>
              </>
            ) : (
              <ActivityIndicator color={c.primary} />
            )}

            {/* Never a bare band code — see lib/cefr-labels.ts. */}
            {band ? (
              <Caption
                tone="tertiary"
                style={styles.level}
                accessibilityLabel={cefrAccessibilityLabel(band)}
              >
                {cefrLabel(band)}
              </Caption>
            ) : null}
          </View>

          <LastSessionCard
            minutes={lastSession?.minutes ?? null}
            headline={lastSession?.headline ?? null}
            loading={loadingLast}
          />

          {/* ── How they want to be corrected ── */}
          <View style={styles.section}>
            <CorrectionModeToggle
              mode={prefs?.correctionMode ?? null}
              onChange={handleCorrectionMode}
            />
          </View>

          {budgetLine ? (
            <Caption tone="tertiary" style={styles.budget} accessibilityLiveRegion="polite">
              {budgetLine}
            </Caption>
          ) : null}

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
                  // The literal rather than `limit.upgrade.route`, which is a
                  // plain string and would need a cast past expo-router's typed
                  // routes. Same destination, checked at build time.
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

        {/* ── Start ── */}
        <View style={styles.footer}>
          {blocked === 'needs_correction_mode' ? (
            <Caption tone="tertiary" style={styles.blockedHint}>
              Choose how you want to be corrected first.
            </Caption>
          ) : null}
          {/* SlabButton owns the button role, the disabled/busy state and the
              spinner. The label is still switched by hand so VoiceOver hears
              "Starting your call" while the spinner is up — the label text is
              not drawn in that state, so nothing visible changes with it. */}
          <SlabButton
            label={starting ? 'Starting your call' : 'Start call'}
            onPress={() => void handleStart()}
            disabled={blocked !== null}
            loading={starting}
            accessibilityHint={
              blocked === 'needs_correction_mode'
                ? 'Choose how you want to be corrected to enable this.'
                : 'Starts a live voice conversation with your tutor.'
            }
          />
        </View>

        {consentSheet}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  heroName: {
    marginTop: spacing.xs,
  },
  heroBio: {
    textAlign: 'center',
  },
  level: {
    textAlign: 'center',
    marginTop: spacing.xxs,
  },
  section: {
    marginTop: spacing.xxs,
  },
  budget: {
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
    paddingHorizontal: spacing.md,
    // The tab bar is absolutely positioned over every tab route.
    paddingBottom: floatingTabBarSpace(),
    gap: spacing.xs,
  },
  blockedHint: {
    textAlign: 'center',
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
