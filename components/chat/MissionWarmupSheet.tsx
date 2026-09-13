/**
 * MissionWarmupSheet — the phrases a learner sees before a mission attempt.
 *
 * Opened by the chat screen for a FRESH attempt only (the parent decides; a
 * resumed attempt never sees it). It fetches the 4-6 key phrases for the
 * scene and stage (`mission-phrases`, cached server-side per language pair),
 * lets the learner hear each one, and offers exactly two ways out — Start and
 * Skip — both of which the parent owns. The backdrop tap IS Skip: there is no
 * state in which the sheet closes and nothing has been decided.
 *
 * ── AUDIO IS ON TAP ONLY, NEVER PREWARMED ──
 *
 * Every phrase goes through `getLessonAudioUri`, which costs one lesson-audio
 * play from the learner's daily allowance (25 on basic) unless the device
 * already has the clip. Six phrases warmed on open would spend a quarter of
 * that allowance on a sheet the learner may Skip in two seconds. So a clip is
 * requested when, and only when, its row is tapped. When the allowance runs
 * out (`VoiceError` 'DAILY_LIMIT') the ceiling alert shows ONCE per open and
 * every row goes mute — but the phrases stay readable, because the text was
 * never the metered part.
 *
 * ── WHAT NEVER BLOCKS ──
 *
 * Start and Skip are usable in every phrase state: still loading, empty,
 * failed to fetch, paid-only refused. The warm-up is a courtesy on the way
 * into the mission, not a gate in front of it. Only `starting` (the parent is
 * creating the attempt row) disables them, so a double-tap cannot create two.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { minLineHeight, spacing, typography } from '../../config/theme';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { useMotion } from '../../hooks/useMotion';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { fetchMissionPhrases, MissionApiError, VoiceError, type MissionPhrase } from '../../lib/ai';
import { trackEvent } from '../../lib/analytics';
import { loadErrorCopy, type ErrorCopy } from '../../lib/error-copy';
import { haptic } from '../../lib/haptics';
import { getLessonAudioUri } from '../../lib/lesson-audio';
import { showLimitAlert } from '../../lib/limit-messaging';
import { missionFor, stageLabel } from '../../lib/missions';
import { SlabButton } from '../ui2/SlabButton';
import { Ui2InlineError } from '../ui2/Ui2InlineError';
import { Ui2Sheet } from '../ui2/Ui2Sheet';
import { Body, Caption, Heading } from '../ui2/Ui2Text';
import type { LanguageCode } from '../../types';
import type { MissionScenarioKey } from '../../types/missions';

export interface MissionWarmupSheetProps {
  visible: boolean;
  scenarioKey: MissionScenarioKey;
  stage: number;
  targetLanguage: LanguageCode;
  nativeLanguage: LanguageCode;
  userId: string;
  /** The learner's EFFECTIVE tier, for the ceiling alert's upsell rule. */
  tier: string;
  /** Parent creates the attempt row, then opens the chat. */
  onStart: () => void | Promise<void>;
  /** Same, without playing. Backdrop dismiss calls this too. */
  onSkip: () => void | Promise<void>;
  /** Parent is creating the attempt: both buttons disabled, spinner on Start. */
  starting?: boolean;
  /** Creation failed: shown under the buttons with a retry that calls `onStart`. */
  startError?: string | null;
}

type Fetch =
  | { status: 'loading' }
  | { status: 'ready'; phrases: MissionPhrase[] }
  | { status: 'error'; copy: ErrorCopy; retryable: boolean };

/** The row's icon well, in precedence order. Exported so the table is testable. */
export type RowGlyph = 'muted' | 'loading' | 'playing' | 'failed' | 'idle';

export function rowGlyph(input: {
  quotaExhausted: boolean;
  active: boolean;
  fetching: boolean;
  loading: boolean;
  playing: boolean;
  failed: boolean;
}): RowGlyph {
  if (input.quotaExhausted) return 'muted';
  if (!input.active) return 'idle';
  if (input.fetching || input.loading) return 'loading';
  if (input.failed) return 'failed';
  if (input.playing) return 'playing';
  return 'idle';
}

const GLYPH_ICON: Record<RowGlyph, keyof typeof Ionicons.glyphMap> = {
  muted: 'volume-mute-outline',
  loading: 'volume-medium-outline',
  playing: 'volume-high',
  failed: 'alert-circle-outline',
  idle: 'volume-medium-outline',
};

/**
 * What a failed phrase fetch says. A paid-only refusal is settled — the picker
 * should have pre-empted it with the paywall — so it gets a sentence and no
 * retry. Everything else is worth one more try.
 */
export function warmupErrorCopy(err: unknown): { copy: ErrorCopy; retryable: boolean } {
  if (err instanceof MissionApiError && err.code === 'MISSION_PAID_ONLY') {
    return {
      copy: { title: 'Part of a plan', message: 'Missions are part of the paid plans' },
      retryable: false,
    };
  }
  if (err instanceof MissionApiError && err.code === 'RATE_LIMITED') {
    return {
      copy: { title: 'Too many requests', message: 'Wait a moment, then try again.' },
      retryable: true,
    };
  }
  return { copy: loadErrorCopy(err, 'the warm-up phrases'), retryable: true };
}

export function MissionWarmupSheet({
  visible,
  scenarioKey,
  stage,
  targetLanguage,
  nativeLanguage,
  userId,
  tier,
  onStart,
  onSkip,
  starting = false,
  startError = null,
}: MissionWarmupSheetProps) {
  const { c, shape } = useUi2Theme();
  const { shouldReduce, duration } = useMotion();
  const router = useRouter();
  const player = useAudioPlayer();

  const [fetch, setFetch] = useState<Fetch>({ status: 'loading' });
  const [active, setActive] = useState<number | null>(null);
  const [fetching, setFetching] = useState(false);
  const [rowFailed, setRowFailed] = useState(false);
  const [quotaExhausted, setQuotaExhausted] = useState(false);
  /** Bumped on every open so a slow response for a previous open is dropped. */
  const openId = useRef(0);
  const rowsOpacity = useRef(new Animated.Value(1)).current;
  // Read through a ref: `shouldReduce` resolves asynchronously after mount,
  // and a `load` that depended on it would re-run the open effect and fetch
  // twice. The fade is cosmetic; it reads the latest value when it runs.
  const motionRef = useRef({ shouldReduce, short: duration.short });
  motionRef.current = { shouldReduce, short: duration.short };

  const mission = missionFor(scenarioKey, stage);
  const captionText = mission ? `${stageLabel(stage)} · ${mission.title}` : stageLabel(stage);

  const load = useCallback(async () => {
    const id = ++openId.current;
    setFetch({ status: 'loading' });
    try {
      const { phrases } = await fetchMissionPhrases({ scenarioKey, stage, targetLanguage, nativeLanguage });
      if (id !== openId.current) return;
      setFetch({ status: 'ready', phrases });
      const m = motionRef.current;
      if (m.shouldReduce) {
        rowsOpacity.setValue(1);
      } else {
        rowsOpacity.setValue(0);
        Animated.timing(rowsOpacity, { toValue: 1, duration: m.short, useNativeDriver: true }).start();
      }
    } catch (err) {
      if (id !== openId.current) return;
      setFetch({ status: 'error', ...warmupErrorCopy(err) });
    }
  }, [scenarioKey, stage, targetLanguage, nativeLanguage, rowsOpacity]);

  // Open: reset everything from the last open and fetch. Close: stop whatever
  // is playing and invalidate any in-flight fetch. The parent keeps this
  // component mounted across opens, so `visible` is the lifecycle, not mount.
  const { cleanup } = player;
  useEffect(() => {
    if (!visible) {
      openId.current += 1;
      void cleanup().catch(() => {});
      return;
    }
    setActive(null);
    setFetching(false);
    setRowFailed(false);
    setQuotaExhausted(false);
    void load();
  }, [visible, load, cleanup]);

  const { play, stop, loading: playerLoading, playing, error: playerError } = player;

  const onRowPress = useCallback(
    async (index: number, phrase: MissionPhrase) => {
      if (quotaExhausted) return;
      haptic('select');
      if (active === index && playing) {
        await stop();
        setActive(null);
        return;
      }
      setActive(index);
      setRowFailed(false);
      setFetching(true);
      let uri: string;
      try {
        uri = await getLessonAudioUri({ text: phrase.phrase, language: targetLanguage, userId });
      } catch (err) {
        setFetching(false);
        if (err instanceof VoiceError && err.code === 'DAILY_LIMIT') {
          // Once per open: the flag is reset when the sheet reopens, and every
          // row goes mute from here, so a second alert could never fire anyway.
          setQuotaExhausted(true);
          setActive(null);
          showLimitAlert('lesson audio', tier, () => router.push('/(app)/profile/subscription'));
          return;
        }
        haptic('failure');
        setRowFailed(true);
        return;
      }
      setFetching(false);
      await play(uri);
    },
    [quotaExhausted, active, playing, stop, targetLanguage, userId, tier, router, play],
  );

  const handleStart = useCallback(() => {
    void stop().catch(() => {});
    void onStart();
  }, [stop, onStart]);

  const handleSkip = useCallback(() => {
    if (starting) return;
    void stop().catch(() => {});
    trackEvent('mission_warmup_skipped', { contentId: scenarioKey, step: stage });
    void onSkip();
  }, [starting, stop, scenarioKey, stage, onSkip]);

  const iconColor = (glyph: RowGlyph): string => {
    switch (glyph) {
      case 'playing': return c.green;
      case 'failed': return c.error;
      case 'muted': return c.idle;
      default: return c.onTint;
    }
  };

  return (
    <Ui2Sheet visible={visible} onDismiss={handleSkip} dismissOnBackdrop={!starting}>
      <View style={styles.sheet}>
        <View style={styles.head}>
          <Heading level={3} accessibilityRole="header">
            Before you start
          </Heading>
          <Caption tone="tertiary">{captionText}</Caption>
        </View>

        {fetch.status === 'loading' ? (
          <View style={styles.loading} accessibilityLiveRegion="polite">
            <ActivityIndicator color={c.onTint} />
            <Caption tone="tertiary">Getting your phrases…</Caption>
          </View>
        ) : fetch.status === 'error' ? (
          fetch.retryable ? (
            <Ui2InlineError copy={fetch.copy} onRetry={() => void load()} />
          ) : (
            <View style={styles.settled}>
              <Ionicons name="lock-closed-outline" size={16} color={c.muted} />
              <Body size="sm" tone="secondary">
                {fetch.copy.message}
              </Body>
            </View>
          )
        ) : fetch.phrases.length < 1 ? (
          <Body size="sm" tone="secondary">
            No warm-up this time
          </Body>
        ) : (
          <Animated.View style={[styles.rows, { opacity: rowsOpacity }]}>
            <Caption tone="tertiary">
              {quotaExhausted ? 'Audio is used up for today. The phrases are still here.' : 'Tap a phrase to hear it.'}
            </Caption>
            {fetch.phrases.map((p, i) => {
              const glyph = rowGlyph({
                quotaExhausted,
                active: active === i,
                fetching,
                loading: playerLoading,
                playing,
                failed: !!playerError || rowFailed,
              });
              return (
                <Pressable
                  key={`${i}-${p.phrase}`}
                  onPress={() => void onRowPress(i, p)}
                  disabled={quotaExhausted}
                  accessibilityRole="button"
                  accessibilityLabel={`Play: ${p.phrase}. ${p.meaning}`}
                  accessibilityState={{ disabled: quotaExhausted, busy: glyph === 'loading' }}
                  style={({ pressed }) => [
                    styles.row,
                    { backgroundColor: pressed ? c.surface2 : 'transparent', borderRadius: shape.radiusCard - 8 },
                  ]}
                >
                  <View style={[styles.well, { backgroundColor: c.primaryTint }]}>
                    {glyph === 'loading' ? (
                      <ActivityIndicator size="small" color={c.onTint} />
                    ) : (
                      <Ionicons name={GLYPH_ICON[glyph]} size={20} color={iconColor(glyph)} />
                    )}
                  </View>
                  <View style={styles.rowText}>
                    <Text
                      style={[styles.phrase, { color: quotaExhausted ? c.muted : c.ink }]}
                      maxFontSizeMultiplier={1.6}
                    >
                      {p.phrase}
                    </Text>
                    <Caption tone="secondary">{p.meaning}</Caption>
                  </View>
                </Pressable>
              );
            })}
          </Animated.View>
        )}

        <View style={styles.actions}>
          <SlabButton
            label={`Start mission ${stage}`}
            onPress={handleStart}
            disabled={starting}
            loading={starting}
            accessibilityHint="Opens the chat and begins the mission."
          />
          <SlabButton label="Skip" variant="ghost" arrow={false} onPress={handleSkip} disabled={starting} />
        </View>

        {startError ? (
          <Ui2InlineError
            copy={{ title: "Couldn't start the mission", message: startError }}
            onRetry={handleStart}
          />
        ) : null}
      </View>
    </Ui2Sheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    gap: spacing.md,
    paddingBottom: spacing.xs,
  },
  head: { gap: 2 },
  loading: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  settled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
  },
  rows: { gap: spacing.xxs },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  well: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  phrase: {
    fontFamily: typography.family.monoMedium,
    fontSize: 16,
    lineHeight: minLineHeight(16, 'mono'),
  },
  actions: { gap: spacing.xxs },
});
