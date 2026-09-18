/**
 * What the learner reads after Finish.
 *
 * A route, not a mode of the chat screen, for the reason the tutor debrief
 * is: the chat screen resets to the picker the moment the mission ends, and
 * the debrief has to outlive that. It takes a `sessionId` and can be
 * reached — or returned to — with the conversation gone.
 *
 * It never trusts the handover. The Finish turn stashes the result it got
 * back inline (`lib/chat-debrief-handoff.ts`), which makes the common path
 * instant, but an empty slot is an ordinary state — a cold link, a relaunch,
 * a second visit — and `fetchMissionResult` reads the stored
 * `chat_mission_attempts.result` behind it.
 *
 * Two languages on one screen: the tutor's send-off and the You said / Better
 * pairs are in the TARGET language and set in the mono face; everything
 * around them is the learner's own. Never colour alone — the caption and
 * the face carry the distinction.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useScreenView } from '../../../hooks/useScreenView';
import { useMotion } from '../../../hooks/useMotion';
import { useUi2Theme } from '../../../hooks/useUi2Theme';
import { Chip } from '../../../components/ui2/Chip';
import { SlabButton } from '../../../components/ui2/SlabButton';
import { SlabCard } from '../../../components/ui2/SlabCard';
import { Ui2Header } from '../../../components/ui2/Ui2Header';
import { Body, Caption, Heading } from '../../../components/ui2/Ui2Text';
import { floatingTabBarSpace } from '../../../components/navigation/FloatingTabBar';
import { fetchMissionResult } from '../../../lib/supabase-queries';
import { peekChatDebrief } from '../../../lib/chat-debrief-handoff';
import { cefrAccessibilityLabel, cefrLabel } from '../../../lib/cefr-labels';
import { accuracyLine, correctionHabits, nextMissionAfter, stageLabel } from '../../../lib/missions';
import type { MissionResult } from '../../../lib/ai';
// `colors` is deliberately NOT imported: it is the fixed DARK palette. The
// mono FACE and `spacing` are scheme-independent and carry over unchanged.
import { spacing, typography } from '../../../config/theme';

type ViewState = 'ready' | 'loading' | 'missing' | 'unavailable';

function firstParam(value: string | string[] | undefined): string | null {
  const one = Array.isArray(value) ? value[0] : value;
  return typeof one === 'string' && one.length > 0 ? one : null;
}

export default function ChatDebriefScreen() {
  const { c } = useUi2Theme();
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId?: string | string[] }>();
  const sessionId = firstParam(params.sessionId);
  useScreenView('chat_debrief');

  const handoff = sessionId ? peekChatDebrief(sessionId) : null;
  const [result, setResult] = useState<MissionResult | null>(handoff?.result ?? null);
  const [state, setState] = useState<ViewState>(handoff ? 'ready' : sessionId ? 'loading' : 'missing');
  const [attempt, setAttempt] = useState(0);

  // Cold open: the stored result is the source of truth.
  useEffect(() => {
    if (!sessionId || result !== null) return;
    let cancelled = false;
    setState('loading');
    fetchMissionResult(sessionId)
      .then((stored) => {
        if (cancelled) return;
        if (stored) {
          setResult(stored);
          setState('ready');
        } else {
          setState('missing');
        }
      })
      .catch(() => {
        if (!cancelled) setState('unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, result, attempt]);

  const backToSituations = useCallback(() => router.replace('/(app)/chat'), [router]);
  const playStage = useCallback(
    (scenarioKey: string, stage: number) =>
      router.replace({ pathname: '/(app)/chat', params: { scenario: scenarioKey, stage: String(stage) } }),
    [router],
  );

  const footer = result ? footerFor(result, playStage, backToSituations) : null;

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <Ui2Header title="How that went" onBack={backToSituations} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {state === 'loading' ? (
            <View style={styles.waiting}>
              <ActivityIndicator color={c.primary} />
              <Body tone="secondary" style={styles.centered} accessibilityLiveRegion="polite">
                Fetching your result…
              </Body>
            </View>
          ) : null}

          {state === 'ready' && result ? <DebriefBody result={result} /> : null}

          {state === 'missing' ? (
            <View style={styles.section}>
              <Body tone="secondary">This mission has not been finished.</Body>
              <SlabButton label="Back" onPress={backToSituations} arrow={false} variant="tint" />
            </View>
          ) : null}

          {state === 'unavailable' ? (
            <View style={styles.section}>
              <Body tone="secondary">
                Your result could not be loaded. Nothing was lost — it is saved and will be here when you try again.
              </Body>
              <SlabButton label="Retry" onPress={() => setAttempt((n) => n + 1)} arrow={false} />
              <SlabButton label="Back" onPress={backToSituations} arrow={false} variant="ghost" />
            </View>
          ) : null}
        </ScrollView>

        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </SafeAreaView>
    </View>
  );
}

function footerFor(
  result: MissionResult,
  playStage: (scenarioKey: string, stage: number) => void,
  back: () => void,
) {
  switch (nextMissionAfter(result)) {
    case 'next':
      return (
        <>
          <SlabButton label="Next mission" onPress={() => playStage(result.scenarioKey, result.stage + 1)} />
          <SlabButton label="Back to situations" onPress={back} variant="ghost" arrow={false} />
        </>
      );
    case 'retry':
      return (
        <>
          <SlabButton label="Try again" onPress={() => playStage(result.scenarioKey, result.stage)} arrow={false} />
          <SlabButton label="Back to situations" onPress={back} variant="ghost" arrow={false} />
        </>
      );
    default:
      return <SlabButton label="Back to situations" onPress={back} arrow={false} />;
  }
}

/** Split out so the entrance fade wraps the result, not the header or footer. */
function DebriefBody({ result }: { result: MissionResult }) {
  const { c } = useUi2Theme();
  const router = useRouter();
  const { shouldReduce, durationOr0 } = useMotion();
  const opacity = useRef(new Animated.Value(shouldReduce ? 1 : 0)).current;

  useEffect(() => {
    // Gated: at zero duration this is one frame at full opacity, not a no-op
    // that leaves the content invisible.
    Animated.timing(opacity, { toValue: 1, duration: durationOr0('medium'), useNativeDriver: true }).start();
  }, [opacity, durationOr0]);

  const habits = correctionHabits(result);
  const metCount = result.objectives.filter((o) => o.met).length;

  return (
    <Animated.View style={{ opacity }}>
      <SlabCard tint={result.passed ? 'green' : 'yellow'} hero style={styles.hero}>
        <View style={styles.heroRow}>
          <Ionicons
            name={result.passed ? 'trophy-outline' : 'flag-outline'}
            size={28}
            color={result.passed ? c.green : c.yellow}
          />
          <Heading level={2} accessibilityRole="header">
            {result.passed ? 'Mission passed' : 'Not yet'}
          </Heading>
        </View>
        <Body weight="semibold">
          {stageLabel(result.stage)} · {result.title}
        </Body>
        <Caption tone="secondary" accessibilityLabel={cefrAccessibilityLabel(result.band)}>
          {cefrLabel(result.band)}
        </Caption>
        {result.sendoff ? (
          <Body style={styles.quote} accessibilityLabel={`Your tutor says: ${result.sendoff}`}>
            “{result.sendoff}”
          </Body>
        ) : null}
        <Caption tone="secondary" style={styles.cardBody}>
          {accuracyLine(result.accuracy, result.scoredTurns)}
          {' · '}
          {metCount} of {result.objectives.length} objectives
        </Caption>
        {!result.passed && result.reason ? (
          <Caption tone="secondary">
            {result.reason === 'accuracy_below_pass'
              ? 'Accuracy was under the pass mark for this level.'
              : 'Not every objective was met.'}
          </Caption>
        ) : null}
      </SlabCard>

      <View style={styles.section}>
        <Caption tone="tertiary">Objectives</Caption>
        {result.objectives.map((objective) => (
          <View
            key={objective.id}
            style={styles.objectiveRow}
            accessible
            accessibilityLabel={`${objective.met ? 'Done' : 'Not done'}: ${objective.text}`}
          >
            <Ionicons
              name={objective.met ? 'checkmark-circle' : 'close-circle'}
              size={20}
              color={objective.met ? c.green : c.error}
            />
            <Body size="sm" style={styles.flex}>
              {objective.text}
            </Body>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Caption tone="tertiary">Habits worth fixing</Caption>
        {habits.length === 0 ? (
          <Body tone="secondary">No corrections this time</Body>
        ) : (
          habits.map((habit) => (
            <SlabCard key={habit.errorType} style={styles.card}>
              <View style={styles.habitRow}>
                <View style={[styles.iconWell, { backgroundColor: c.primaryTint }]}>
                  <Ionicons name={habit.icon} size={18} color={c.onTint} />
                </View>
                <Body weight="semibold" style={styles.flex}>
                  {habit.label}
                </Body>
                <Chip label={`×${habit.count}`} variant="neutral" />
              </View>
              {habit.examples.map((example, i) => (
                <View key={`${habit.errorType}-${i}`} style={styles.pair}>
                  {example.original ? (
                    <>
                      <Caption tone="tertiary" size="sm">
                        You said
                      </Caption>
                      <Body style={styles.target} accessibilityLabel={`You said: ${example.original}`}>
                        {example.original}
                      </Body>
                    </>
                  ) : null}
                  {example.corrected ? (
                    <>
                      <Caption tone="tertiary" size="sm" style={styles.cardBody}>
                        Better
                      </Caption>
                      {/* `onTint`, not green: green words on a light card are
                          under AA. The "Better" caption and the face are the
                          real cues. */}
                      <Body
                        style={[styles.target, { color: c.onTint }]}
                        accessibilityLabel={`Better: ${example.corrected}`}
                      >
                        {example.corrected}
                      </Body>
                    </>
                  ) : null}
                </View>
              ))}
            </SlabCard>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Caption tone="tertiary">Words banked</Caption>
        {result.savedWords.length > 0 ? (
          <>
            <Caption tone="secondary">
              {result.savedWords.length} word{result.savedWords.length === 1 ? '' : 's'} added to your reviews:{' '}
              {result.savedWords.join(', ')}
            </Caption>
            <SlabButton
              label="Review them"
              onPress={() => router.push('/(app)/learn/review')}
              variant="ghost"
              arrow={false}
            />
          </>
        ) : (
          <Caption tone="secondary">No new words were saved this time</Caption>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  section: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  hero: {
    padding: spacing.md,
    gap: spacing.xxs,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xxs,
  },
  card: {
    padding: spacing.md,
    gap: spacing.xxs,
  },
  cardBody: { marginTop: spacing.xxs },
  /** Target language: the mono face is the app's signal for "read this as
   *  the language being learned" — see DESIGN.md. */
  quote: {
    fontFamily: typography.family.mono,
    marginTop: spacing.xs,
  },
  target: {
    fontFamily: typography.family.mono,
    marginTop: spacing.xxs,
  },
  pair: { marginTop: spacing.xs },
  objectiveRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  habitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWell: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waiting: {
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  centered: { textAlign: 'center' },
  footer: {
    paddingHorizontal: spacing.md,
    paddingBottom: floatingTabBarSpace(),
    paddingTop: spacing.xs,
    gap: spacing.xxs,
  },
});
