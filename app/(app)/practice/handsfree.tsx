import { useCallback, useEffect, useState } from 'react';
import { View, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSafeBack } from '../../../hooks/useSafeBack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../hooks/useAuth';
import { useAiConsent } from '../../../hooks/useAiConsent';
import { useHandsFreeSession } from '../../../hooks/useHandsFreeSession';
import { useMotion } from '../../../hooks/useMotion';
import { useUi2Theme } from '../../../hooks/useUi2Theme';
import { Body, Heading, Hero } from '../../../components/ui2/Ui2Text';
import {
  acknowledgeDrivingSafety,
  hasAcknowledgedDrivingSafety,
  loadHandsFreeConfig,
  saveHandsFreeConfig,
} from '../../../lib/handsfree-storage';
import { HANDSFREE_DEFAULTS } from '../../../config/app';
// `colors` is deliberately NOT imported: it is the fixed DARK palette, and a
// screen that reads it stays dark whatever the phone is set to. `radii` and
// `spacing` are plain scheme-independent numbers and carry over unchanged.
import { spacing, radii } from '../../../config/theme';

/**
 * The eyes-free session screen.
 *
 * Design constraints here are unlike anywhere else in the app, and they are
 * not stylistic:
 *
 *  - Nothing may REQUIRE a tap. If the session cannot advance without touching
 *    the screen, the feature has failed its own premise. Every control here is
 *    optional.
 *  - Controls are 88pt tall, twice the HIG minimum. This is a glance-and-jab
 *    surface, sometimes in a mount, sometimes in a pocket. That is why the CTAs
 *    stay hand-rolled slabs rather than `SlabButton`, whose block is 56pt: the
 *    UI 2.0 shape tokens give them the same 2px/6px edge at the height this
 *    screen needs.
 *  - One status line, announced to VoiceOver as a live region, so a learner
 *    using a screen reader hears phase changes without touching anything.
 *  - No glow layer, no decorative motion, no progress countdown, no XP. Motion
 *    costs battery across twenty minutes, and a countdown invites looking.
 *  - "End" is separated below a divider so it is not hit by accident with a
 *    thumb aiming for Pause.
 */

type Screen = 'disclaimer' | 'setup' | 'running';

export default function HandsFreeScreen() {
  const { c, shape } = useUi2Theme();
  const router = useRouter();
  const goBack = useSafeBack('/(app)');
  const { user } = useAuth();
  const { ensureConsent, consentSheet } = useAiConsent(user?.id);
  const { shouldReduce } = useMotion();

  const [screen, setScreen] = useState<Screen | null>(null);
  const [durationMs, setDurationMs] = useState<number>(HANDSFREE_DEFAULTS.targetDurationMs);

  const handleEnded = useCallback(() => {
    // Returning automatically means the learner never has to find the screen
    // again to get out of it.
    goBack();
  }, [router]);

  const session = useHandsFreeSession({
    targetDurationMs: durationMs,
    onEnded: handleEnded,
  });

  // Decide the entry screen once the stored preferences are known.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!user) return;
      const [acknowledged, stored] = await Promise.all([
        hasAcknowledgedDrivingSafety(user.id),
        loadHandsFreeConfig(user.id),
      ]);
      if (cancelled) return;
      if (stored) setDurationMs(stored.targetDurationMs);
      setScreen(acknowledged ? 'setup' : 'disclaimer');
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const acknowledge = useCallback(async () => {
    if (user) await acknowledgeDrivingSafety(user.id);
    setScreen('setup');
  }, [user]);

  const begin = useCallback(async () => {
    // Consent before the session, not per turn: hands-free is a continuous
    // loop, so a mid-conversation prompt would be both hostile and useless.
    // Declining leaves the learner on setup rather than dumping them out.
    if (!(await ensureConsent('voice'))) return;
    if (user) await saveHandsFreeConfig(user.id, { targetDurationMs: durationMs });
    setScreen('running');
    await session.start();
  }, [user, durationMs, session, ensureConsent]);

  const rootStyle = [styles.root, { backgroundColor: c.bg }];
  // The 88pt slab, in UI 2.0 shape: fill on a thicker bottom edge.
  const primaryButtonStyle = [
    styles.primaryButton,
    {
      backgroundColor: c.primary,
      borderBottomColor: c.slab,
      borderBottomWidth: shape.buttonSlab,
      borderRadius: shape.radiusButton,
    },
  ];

  if (screen === null) {
    return (
      <SafeAreaView style={rootStyle}>
        <ActivityIndicator color={c.primary} />
      </SafeAreaView>
    );
  }

  // ── Safety notice ──────────────────────────────────────────────────────
  if (screen === 'disclaimer') {
    return (
      <SafeAreaView style={rootStyle}>
        <View style={styles.centered}>
          <Ionicons name="car-outline" size={44} color={c.primary} />
          <Heading level={2} accessibilityRole="header">
            Before you start
          </Heading>
          <Body tone="secondary">
            This session runs entirely by voice. You do not need to look at or touch your phone
            at any point — it will keep going on its own.
          </Body>
          <Body tone="secondary">
            If you are driving, keep your eyes on the road. Pull over before touching the screen.
          </Body>
        </View>

        <Pressable
          style={primaryButtonStyle}
          onPress={acknowledge}
          accessibilityRole="button"
          accessibilityLabel="I understand"
        >
          <Heading level={2} tone="onPrimary">I understand</Heading>
        </Pressable>
      </SafeAreaView>
    );
  }

  // ── Session length ─────────────────────────────────────────────────────
  if (screen === 'setup') {
    return (
      <SafeAreaView style={rootStyle}>
        <View style={styles.centered}>
          <Heading level={2} accessibilityRole="header">
            How long have you got?
          </Heading>
          <Body tone="secondary">
            Your review queue, out loud. Pick a length that matches your journey.
          </Body>

          <View style={styles.durationList}>
            {HANDSFREE_DEFAULTS.durationOptionsMs.map((ms) => {
              const minutes = Math.round(ms / 60_000);
              const selected = ms === durationMs;
              return (
                <Pressable
                  key={ms}
                  style={[
                    styles.durationOption,
                    {
                      backgroundColor: c.card,
                      borderColor: c.cardBorder,
                      borderWidth: shape.border,
                      borderBottomWidth: shape.slab,
                      borderRadius: shape.radiusCard,
                    },
                    selected && { backgroundColor: c.primaryTint, borderColor: c.primaryTintBorder },
                  ]}
                  onPress={() => setDurationMs(ms)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${minutes} minutes`}
                >
                  <Body size="lg" weight="bold">{minutes} minutes</Body>
                </Pressable>
              );
            })}
          </View>
        </View>

        {session.error ? (
          <Body size="sm" tone="error" style={styles.error} accessibilityRole="alert">
            {session.error}
          </Body>
        ) : null}

        <Pressable
          style={primaryButtonStyle}
          onPress={begin}
          disabled={session.preparing}
          accessibilityRole="button"
          accessibilityLabel={session.preparing ? 'Preparing your session' : 'Start session'}
        >
          {session.preparing ? (
            <ActivityIndicator color={c.onPrimary} />
          ) : (
            <Heading level={2} tone="onPrimary">Start</Heading>
          )}
        </Pressable>
        {consentSheet}
      </SafeAreaView>
    );
  }

  // ── Running ────────────────────────────────────────────────────────────
  const paused = session.state.phase === 'paused';
  const listening = session.state.phase === 'listening';

  const controlStyle = [
    styles.control,
    {
      backgroundColor: c.card,
      borderColor: c.cardBorder,
      borderWidth: shape.border,
      borderBottomWidth: shape.slab,
      borderRadius: shape.radiusCard,
    },
  ];

  return (
    <SafeAreaView style={rootStyle}>
      <View style={styles.statusArea}>
        <Hero
          style={styles.status}
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
        >
          {session.statusLine}
        </Hero>

        {/* The only moving element on the screen, and it is gated: a pulsing
            indicator is useful peripheral feedback that the mic is open, and
            useless-to-harmful for anyone who has asked for reduced motion. */}
        <View
          style={[
            styles.listeningBar,
            { backgroundColor: c.track },
            listening && !shouldReduce && { backgroundColor: c.primary },
            listening && shouldReduce && { backgroundColor: c.slab },
          ]}
        />
      </View>

      <View style={styles.controls}>
        <Pressable
          style={controlStyle}
          onPress={session.repeat}
          accessibilityRole="button"
          accessibilityLabel={`Repeat card ${session.state.index + 1}`}
        >
          <Heading level={2}>Repeat</Heading>
        </Pressable>

        <Pressable
          style={controlStyle}
          onPress={session.skip}
          accessibilityRole="button"
          accessibilityLabel="Skip this card without scoring it"
        >
          <Heading level={2}>Skip</Heading>
        </Pressable>

        <Pressable
          style={controlStyle}
          onPress={paused ? session.resume : session.pause}
          accessibilityRole="button"
          accessibilityLabel={
            paused
              ? 'Resume the session'
              : `Pause the session. Currently on card ${session.state.index + 1}.`
          }
        >
          <Heading level={2}>{paused ? 'Resume' : 'Pause'}</Heading>
        </Pressable>
      </View>

      <View style={[styles.divider, { backgroundColor: c.cardBorder }]} />

      <Pressable
        style={styles.endButton}
        onPress={() => void session.end('user_ended')}
        accessibilityRole="button"
        accessibilityLabel="End session"
        accessibilityHint="Ends the session and saves your progress."
      >
        <Body weight="bold" tone="error">End session</Body>
      </Pressable>
    </SafeAreaView>
  );
}

/** Twice the 44pt HIG minimum — this is a glance-and-jab surface. */
const CONTROL_HEIGHT = 88;

/**
 * Layout only. Every colour on this screen comes from `useUi2Theme()` and is
 * merged in at the call site — a StyleSheet is created once at module load and
 * cannot see the scheme, which is exactly how a screen ends up dark on a phone
 * set to light.
 */
const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  statusArea: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  status: {
    textAlign: 'center',
  },
  listeningBar: {
    height: 6,
    borderRadius: radii.pill,
  },
  controls: {
    gap: spacing.sm,
  },
  control: {
    minHeight: CONTROL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.xl,
  },
  endButton: {
    minHeight: 56,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationList: {
    gap: spacing.xs,
  },
  durationOption: {
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    minHeight: CONTROL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
});
