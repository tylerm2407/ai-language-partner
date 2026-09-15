/**
 * "Listen" — hear the target-language word on any exercise, not just the ones
 * whose task is listening.
 *
 * A learner can finish a whole vocabulary lesson having read `Fièvre` and
 * never once heard it, which is how you end up with a large silent vocabulary
 * you cannot use in conversation. This button is the fix, and it is
 * deliberately a small one: no autoplay, no second column of controls, no
 * competing with the exercise's own answer affordance.
 *
 * WHAT IT COSTS
 * -------------
 * Nothing, in the normal case, and that is load-bearing rather than lucky.
 * The tts function checks its content-addressed cache BEFORE the quota and
 * before the provider (supabase/functions/tts/index.ts — "hits cost nothing,
 * so they bypass quota and burst limits"), the cache is shared across every
 * learner, and `scripts/warm-shared-caches.ts` pre-generates the word behind
 * every one of these buttons. So a tap is a cache hit, which spends no money
 * and no `lesson_tts_plays`. A word the warm run has not reached yet — new
 * curriculum, a generated goal track — is exempted server-side when it is a
 * known curriculum term, and only otherwise falls through to the daily
 * allowance.
 *
 * `getLessonAudioUri` adds a second, on-device cache in front of all that, so
 * a replay is instant and works with no connection.
 */
import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { haptic } from '../../lib/haptics';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { VoiceError } from '../../lib/ai';
import { getLessonAudioUri, LESSON_SLOW_RATE } from '../../lib/lesson-audio';
import { radii, spacing, typography } from '../../config/theme';

interface ListenWordButtonProps {
  /** Target-language text to speak. From `exerciseListenTarget`. */
  text: string;
  /** Course target language code. */
  language: string;
  userId?: string;
  /**
   * Offer the slower replay. Only after a normal-speed play, and only for a
   * word short enough that a slowed rendering is a pronunciation aid rather
   * than a two-minute recital.
   */
  allowSlow?: boolean;
}

/** Longest text the slower replay is offered for. A word or a short phrase. */
const SLOW_MAX_CHARS = 40;

export function ListenWordButton({
  text,
  language,
  userId,
  allowSlow = true,
}: ListenWordButtonProps) {
  const { c } = useUi2Theme();
  const { play, playing, loading, error: playbackError } = useAudioPlayer();
  const [synthesizing, setSynthesizing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  // A quota refusal is terminal for the day, so stop offering a button that
  // can only refuse again. Mirrors ListeningExercise's handling.
  const [quotaExhausted, setQuotaExhausted] = useState(false);
  const busy = useRef(false);

  const handlePlay = async (rate?: number) => {
    if (busy.current) return;
    busy.current = true;
    setSynthesizing(true);
    setFailed(false);
    try {
      const uri = await getLessonAudioUri({ text, language, userId, rate });
      await play(uri);
      setHasPlayed(true);
    } catch (err) {
      if (err instanceof VoiceError && err.code === 'DAILY_LIMIT') {
        setQuotaExhausted(true);
      } else {
        setFailed(true);
      }
      haptic('failure');
    } finally {
      setSynthesizing(false);
      busy.current = false;
    }
  };

  if (quotaExhausted) {
    return (
      <Text
        style={{
          fontFamily: typography.family.medium,
          fontSize: 13,
          color: c.muted,
          marginBottom: spacing.sm,
        }}
        accessibilityRole="text"
      >
        You&apos;ve used today&apos;s lesson audio. It resets tomorrow.
      </Text>
    );
  }

  const disabled = playing || loading || synthesizing;
  const errored = failed || !!playbackError;

  return (
    <View style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm }}>
      <Pill
        icon={synthesizing ? 'hourglass' : playing ? 'volume-high' : 'volume-medium'}
        label={errored ? 'Retry' : 'Listen'}
        tone={errored ? c.error : c.primary}
        tint={errored ? c.pinkTint : c.primaryTint}
        ink={errored ? c.error : c.onTint}
        disabled={disabled}
        onPress={() => handlePlay()}
        accessibilityLabel={
          errored
            ? `Audio failed. Tap to hear ${text} again.`
            : synthesizing
              ? 'Loading audio'
              : `Listen to ${text}`
        }
      />
      {hasPlayed && !errored && allowSlow && text.length <= SLOW_MAX_CHARS && (
        <Pill
          icon="play-outline"
          label="Slower"
          tone={c.primary}
          tint={c.surface2}
          ink={c.muted}
          disabled={disabled}
          onPress={() => handlePlay(LESSON_SLOW_RATE)}
          accessibilityLabel={`Listen to ${text} again, slower`}
        />
      )}
    </View>
  );
}

function Pill(props: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tone: string;
  tint: string;
  ink: string;
  disabled: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel}
      accessibilityState={{ disabled: props.disabled }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xxs,
        // 44, not less: .claude/rules/mobile-ui.md's minimum target, and this
        // sits next to an exercise's own controls where a near-miss tap would
        // land on something that grades the answer.
        minHeight: 44,
        paddingHorizontal: spacing.sm + 2,
        borderRadius: radii.md,
        backgroundColor: props.tint,
        opacity: props.disabled ? 0.6 : 1,
      }}
    >
      <Ionicons name={props.icon} size={16} color={props.tone} />
      <Text style={{ fontFamily: typography.family.semibold, fontSize: 13, color: props.ink }}>
        {props.label}
      </Text>
    </Pressable>
  );
}
