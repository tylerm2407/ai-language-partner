import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSafeBack } from '../../../hooks/useSafeBack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../hooks/useAuth';
import { useAiConsent } from '../../../hooks/useAiConsent';
import { useHandsFreeSession } from '../../../hooks/useHandsFreeSession';
import { useMotion } from '../../../hooks/useMotion';
import {
  acknowledgeDrivingSafety,
  hasAcknowledgedDrivingSafety,
  loadHandsFreeConfig,
  saveHandsFreeConfig,
} from '../../../lib/handsfree-storage';
import { HANDSFREE_DEFAULTS } from '../../../config/app';
import { colors, spacing, radii, typography } from '../../../config/theme';

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
 *    surface, sometimes in a mount, sometimes in a pocket.
 *  - One status line, announced to VoiceOver as a live region, so a learner
 *    using a screen reader hears phase changes without touching anything.
 *  - No glow layer, no decorative motion, no progress countdown, no XP. Motion
 *    costs battery across twenty minutes, and a countdown invites looking.
 *  - "End" is separated below a divider so it is not hit by accident with a
 *    thumb aiming for Pause.
 */

type Screen = 'disclaimer' | 'setup' | 'running';

export default function HandsFreeScreen() {
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

  if (screen === null) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator color={colors.action.accent} />
      </SafeAreaView>
    );
  }

  // ── Safety notice ──────────────────────────────────────────────────────
  if (screen === 'disclaimer') {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.centered}>
          <Ionicons name="car-outline" size={44} color={colors.action.accent} />
          <Text style={styles.title} accessibilityRole="header">
            Before you start
          </Text>
          <Text style={styles.body}>
            This session runs entirely by voice. You do not need to look at or touch your phone
            at any point — it will keep going on its own.
          </Text>
          <Text style={styles.body}>
            If you are driving, keep your eyes on the road. Pull over before touching the screen.
          </Text>
        </View>

        <Pressable
          style={styles.primaryButton}
          onPress={acknowledge}
          accessibilityRole="button"
          accessibilityLabel="I understand"
        >
          <Text style={styles.primaryLabel}>I understand</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // ── Session length ─────────────────────────────────────────────────────
  if (screen === 'setup') {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.centered}>
          <Text style={styles.title} accessibilityRole="header">
            How long have you got?
          </Text>
          <Text style={styles.body}>
            Your review queue, out loud. Pick a length that matches your journey.
          </Text>

          <View style={styles.durationList}>
            {HANDSFREE_DEFAULTS.durationOptionsMs.map((ms) => {
              const minutes = Math.round(ms / 60_000);
              const selected = ms === durationMs;
              return (
                <Pressable
                  key={ms}
                  style={[styles.durationOption, selected && styles.durationOptionSelected]}
                  onPress={() => setDurationMs(ms)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${minutes} minutes`}
                >
                  <Text style={styles.durationLabel}>{minutes} minutes</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {session.error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {session.error}
          </Text>
        ) : null}

        <Pressable
          style={styles.primaryButton}
          onPress={begin}
          disabled={session.preparing}
          accessibilityRole="button"
          accessibilityLabel={session.preparing ? 'Preparing your session' : 'Start session'}
        >
          {session.preparing ? (
            <ActivityIndicator color={colors.text.onPrimary} />
          ) : (
            <Text style={styles.primaryLabel}>Start</Text>
          )}
        </Pressable>
        {consentSheet}
      </SafeAreaView>
    );
  }

  // ── Running ────────────────────────────────────────────────────────────
  const paused = session.state.phase === 'paused';
  const listening = session.state.phase === 'listening';

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.statusArea}>
        <Text
          style={styles.status}
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
        >
          {session.statusLine}
        </Text>

        {/* The only moving element on the screen, and it is gated: a pulsing
            indicator is useful peripheral feedback that the mic is open, and
            useless-to-harmful for anyone who has asked for reduced motion. */}
        <View
          style={[
            styles.listeningBar,
            listening && !shouldReduce && styles.listeningBarActive,
            listening && shouldReduce && styles.listeningBarStatic,
          ]}
        />
      </View>

      <View style={styles.controls}>
        <Pressable
          style={styles.control}
          onPress={session.repeat}
          accessibilityRole="button"
          accessibilityLabel={`Repeat card ${session.state.index + 1}`}
        >
          <Text style={styles.controlLabel}>Repeat</Text>
        </Pressable>

        <Pressable
          style={styles.control}
          onPress={session.skip}
          accessibilityRole="button"
          accessibilityLabel="Skip this card without scoring it"
        >
          <Text style={styles.controlLabel}>Skip</Text>
        </Pressable>

        <Pressable
          style={styles.control}
          onPress={paused ? session.resume : session.pause}
          accessibilityRole="button"
          accessibilityLabel={
            paused
              ? 'Resume the session'
              : `Pause the session. Currently on card ${session.state.index + 1}.`
          }
        >
          <Text style={styles.controlLabel}>{paused ? 'Resume' : 'Pause'}</Text>
        </Pressable>
      </View>

      <View style={styles.divider} />

      <Pressable
        style={styles.endButton}
        onPress={() => void session.end('user_ended')}
        accessibilityRole="button"
        accessibilityLabel="End session"
        accessibilityHint="Ends the session and saves your progress."
      >
        <Text style={styles.endLabel}>End session</Text>
      </Pressable>
    </SafeAreaView>
  );
}

/** Twice the 44pt HIG minimum — this is a glance-and-jab surface. */
const CONTROL_HEIGHT = 88;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface.base,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  title: {
    fontFamily: typography.family.extrabold,
    fontSize: typography.scale.h2.fontSize,
    lineHeight: typography.scale.h2.lineHeight,
    color: colors.text.primary,
  },
  body: {
    fontFamily: typography.family.medium,
    fontSize: typography.scale.body.fontSize,
    lineHeight: typography.scale.body.lineHeight,
    color: colors.text.secondary,
  },
  statusArea: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  status: {
    fontFamily: typography.family.extrabold,
    fontSize: typography.scale.hero.fontSize,
    lineHeight: typography.scale.hero.lineHeight,
    color: colors.text.primary,
    textAlign: 'center',
  },
  listeningBar: {
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surface.cardAlt,
  },
  listeningBarActive: {
    backgroundColor: colors.action.accent,
  },
  listeningBarStatic: {
    backgroundColor: colors.action.primaryFill,
  },
  controls: {
    gap: spacing.sm,
  },
  control: {
    minHeight: CONTROL_HEIGHT,
    borderRadius: radii.xl,
    backgroundColor: colors.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlLabel: {
    fontFamily: typography.family.extrabold,
    fontSize: typography.scale.h3.fontSize,
    lineHeight: typography.scale.h3.lineHeight,
    color: colors.text.primary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing.xl,
  },
  endButton: {
    minHeight: 56,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endLabel: {
    fontFamily: typography.family.bold,
    fontSize: typography.scale.body.fontSize,
    lineHeight: typography.scale.body.lineHeight,
    color: colors.error.light,
  },
  durationList: {
    gap: spacing.xs,
  },
  durationOption: {
    minHeight: 64,
    borderRadius: radii.xl,
    backgroundColor: colors.surface.card,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationOptionSelected: {
    backgroundColor: colors.action.primaryTint,
    borderColor: colors.action.primaryFill,
  },
  durationLabel: {
    fontFamily: typography.family.bold,
    fontSize: typography.scale.bodyLg.fontSize,
    lineHeight: typography.scale.bodyLg.lineHeight,
    color: colors.text.primary,
  },
  primaryButton: {
    minHeight: CONTROL_HEIGHT,
    borderRadius: radii.xl,
    backgroundColor: colors.action.primaryFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    fontFamily: typography.family.extrabold,
    fontSize: typography.scale.h3.fontSize,
    lineHeight: typography.scale.h3.lineHeight,
    color: colors.text.onPrimary,
  },
  error: {
    fontFamily: typography.family.medium,
    fontSize: typography.scale.bodySm.fontSize,
    lineHeight: typography.scale.bodySm.lineHeight,
    color: colors.error.light,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
});
