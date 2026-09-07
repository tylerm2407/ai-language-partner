/**
 * What the learner reads after the call.
 *
 * ── WHY THIS IS A ROUTE AND NOT A MODE OF THE CALL SCREEN ──
 *
 * Because the call screen is the thing that breaks. A debrief rendered inside
 * it would be unreachable in exactly the cases where a learner most wants it:
 * the call that dropped after nine minutes, the one that hit the budget, the
 * one where the peer connection died and the screen unmounted. As its own
 * route it takes a `sessionId` and can be reached — or returned to — with the
 * call screen gone.
 *
 * That independence is also why it never trusts the handover. The call screen
 * stashes the analysis it already has (`lib/tutor-debrief-handoff.ts`), which
 * makes the common path instant, but an empty slot is an ordinary state — a
 * cold link, a relaunch, a second visit — and `fetchTutorSessionSummary` is
 * the source of truth behind it.
 *
 * ── TWO LANGUAGES ON ONE SCREEN ──
 *
 * `theirs`, `better` and `phrase` are in the TARGET language; everything else
 * — the pattern label, the why, the meaning, when to use it, the highlight,
 * what to try next time — is in the learner's own. Mixing them without a
 * visual difference is how a learner ends up trying to memorise the English
 * explanation as though it were the phrase. Target-language text is set in the
 * mono face at primary weight; the native-language text around it stays
 * secondary. The distinction is never colour alone.
 *
 * ── AND IT IS NEVER EMPTY ──
 *
 * The analysis runs after the session closes and can genuinely fail. When it
 * does, this screen shows the conversation itself with an honest line about
 * the notes, which is worth more than a spinner and considerably more than a
 * blank page (CLAUDE.md §5).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useScreenView } from '../../../hooks/useScreenView';
import { useMotion } from '../../../hooks/useMotion';
import { LiveTranscript } from '../../../components/tutor/LiveTranscript';
import { SlabButton } from '../../../components/ui2/SlabButton';
import { SlabCard } from '../../../components/ui2/SlabCard';
import { Body, Caption, Heading } from '../../../components/ui2/Ui2Text';
import { useUi2Theme } from '../../../hooks/useUi2Theme';
import { floatingTabBarSpace } from '../../../components/navigation/FloatingTabBar';
import { fetchTutorSessionSummary } from '../../../lib/supabase-queries';
import { peekDebrief } from '../../../lib/tutor-debrief-handoff';
import {
  DEBRIEF_POLL_ATTEMPTS,
  DEBRIEF_POLL_INTERVAL_MS,
  MAX_SHOWN_PATTERNS,
  MAX_SHOWN_PHRASES,
  debriefView,
  parseSessionIdParam,
} from '../../../lib/tutor-screen-flow';
import type { TutorDebrief } from '../../../types';
import type { TranscriptTurn } from '../../../lib/tutor-transcript';
// `colors` is deliberately NOT imported: it is the fixed DARK palette, and a
// screen that reads it stays dark whatever the phone is set to. `spacing` and
// the mono FACE are scheme-independent and carry over unchanged.
import { spacing, typography } from '../../../config/theme';

/** Stable identity, so a debrief with no transcript does not hand
 *  `LiveTranscript` a fresh array on every render. */
const NO_TURNS: readonly TranscriptTurn[] = [];

export default function TutorDebriefScreen() {
  const { c } = useUi2Theme();
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId?: string | string[] }>();
  const sessionId = parseSessionIdParam(params.sessionId);
  useScreenView('tutor_debrief');

  const handoff = sessionId ? peekDebrief(sessionId) : null;

  const [debrief, setDebrief] = useState<TutorDebrief | null>(handoff?.debrief ?? null);
  const [minutes, setMinutes] = useState<number>(handoff?.minutes ?? 0);
  const [savedWords, setSavedWords] = useState<string[]>(handoff?.savedWords ?? []);
  const [transcriptLost, setTranscriptLost] = useState(handoff?.transcriptLost ?? false);
  const [attempts, setAttempts] = useState(0);

  const transcript: readonly TranscriptTurn[] = handoff?.transcript ?? NO_TURNS;

  // ── Poll for an analysis that had not finished when the call ended ───
  useEffect(() => {
    if (!sessionId || debrief !== null || transcriptLost) return;
    if (attempts >= DEBRIEF_POLL_ATTEMPTS) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const summary = await fetchTutorSessionSummary(sessionId);
          if (cancelled) return;
          if (summary?.debrief) setDebrief(summary.debrief);
          if (summary && summary.minutes > 0) setMinutes(summary.minutes);
        } catch {
          // A failed poll is indistinguishable from a slow one to the learner,
          // and both are answered by the same fallback below. Surfacing a
          // network error over the top of a finished conversation would be
          // noise about something they cannot act on.
        } finally {
          // Counted whether or not it succeeded, so a server that is down
          // cannot hold the screen on a spinner indefinitely.
          if (!cancelled) setAttempts((n) => n + 1);
        }
      })();
      // The first attempt is immediate — the analysis is usually already
      // written by the time this screen mounts — and only the retry waits.
    }, attempts === 0 ? 0 : DEBRIEF_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sessionId, debrief, transcriptLost, attempts]);

  // Marked as a state setter dependency-free constant: the handoff cannot
  // change under this screen, so it is read once.
  useEffect(() => {
    if (handoff) {
      setSavedWords(handoff.savedWords);
      setTranscriptLost(handoff.transcriptLost);
    }
  }, [handoff]);

  const view = debriefView({ sessionId, debrief, transcript, attempts, transcriptLost });

  const done = useCallback(() => router.replace('/(app)/tutor'), [router]);

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Heading level={1} accessibilityRole="header">
            {view.kind === 'ready' ? 'How that went' : 'That conversation'}
          </Heading>
          {minutes > 0 ? (
            <Caption tone="tertiary">
              {minutes} minute{minutes === 1 ? '' : 's'} of speaking
            </Caption>
          ) : null}

          {view.kind === 'loading' ? (
            <View style={styles.waiting}>
              <ActivityIndicator color={c.primary} />
              <Body tone="secondary" style={styles.centered} accessibilityLiveRegion="polite">
                Writing up your notes…
              </Body>
            </View>
          ) : null}

          {view.kind === 'ready' ? (
            <DebriefBody debrief={view.debrief} savedWords={savedWords} />
          ) : null}

          {view.kind === 'transcript_only' ? (
            <View style={styles.section}>
              {/* Honest about what is missing, and still worth the screen: the
                  conversation itself is the thing they just did. */}
              <Body tone="secondary">
                {transcriptLost
                  ? 'Your notes could not be written for this conversation. Here is what you said.'
                  : 'Your notes are still being written. Here is what you said in the meantime.'}
              </Body>
              <View style={styles.transcript}>
                <LiveTranscript transcript={{ turns: view.transcript }} />
              </View>
            </View>
          ) : null}

          {view.kind === 'unavailable' ? (
            <Body tone="secondary" style={styles.section}>
              There are no notes for this conversation. Nothing was lost from your reviews — start
              another call whenever you are ready.
            </Body>
          ) : null}

          {view.kind === 'missing' ? (
            <Body tone="secondary" style={styles.section}>
              We could not tell which conversation this was. Your last call is always on the tutor
              screen.
            </Body>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          {/* No trailing chevron: Done is terminal, it does not go onward. */}
          <SlabButton label="Done" onPress={done} arrow={false} />
        </View>
      </SafeAreaView>
    </View>
  );
}

/**
 * The analysis itself.
 *
 * Split out so the fade below wraps one subtree rather than the whole screen —
 * the header and the Done button are there from the first frame and must not
 * animate in underneath a learner who is already reaching for them.
 */
function DebriefBody({ debrief, savedWords }: { debrief: TutorDebrief; savedWords: string[] }) {
  const { c } = useUi2Theme();
  const { shouldReduce, durationOr0 } = useMotion();
  const opacity = useRef(new Animated.Value(shouldReduce ? 1 : 0)).current;

  useEffect(() => {
    // The one animation on this screen, and it is earned: this content arrives
    // after a wait, so appearing rather than blinking into place is the
    // difference between "it finished" and "the screen changed". Gated, and at
    // zero duration it is a single frame at full opacity — not a no-op that
    // leaves the content invisible.
    Animated.timing(opacity, {
      toValue: 1,
      duration: durationOr0('medium'),
      useNativeDriver: true,
    }).start();
  }, [opacity, durationOr0]);

  const patterns = debrief.patterns.slice(0, MAX_SHOWN_PATTERNS);
  const reachFor = debrief.reachFor.slice(0, MAX_SHOWN_PHRASES);

  return (
    <Animated.View style={{ opacity }}>
      {/* ── What worked. First, and deliberately: the analyser is told to
          quote something the learner actually said, and a debrief that opens
          with mistakes is one they stop opening. ── */}
      {debrief.highlight ? (
        <SlabCard tint="green" style={[styles.card, styles.leadCard]}>
          <Caption tone="primary">What worked</Caption>
          <Body style={styles.cardBody}>{debrief.highlight}</Body>
        </SlabCard>
      ) : null}

      {patterns.length > 0 ? (
        <View style={styles.section}>
          <Caption tone="tertiary">Habits worth fixing</Caption>
          {patterns.map((pattern, i) => (
            <SlabCard key={`${pattern.label}-${i}`} style={styles.card}>
              <Body weight="semibold">{pattern.label}</Body>
              {pattern.why ? (
                <Body size="sm" tone="secondary" style={styles.cardBody}>
                  {pattern.why}
                </Body>
              ) : null}

              {/* Target language, set apart from the explanation around it.
                  Never colour alone — the label and the face carry it too. */}
              {pattern.theirs ? (
                <View style={styles.pair}>
                  <Caption tone="tertiary" size="sm">
                    You said
                  </Caption>
                  <Body style={styles.target} accessibilityLabel={`You said: ${pattern.theirs}`}>
                    {pattern.theirs}
                  </Body>
                </View>
              ) : null}
              {pattern.better ? (
                <View style={styles.pair}>
                  <Caption tone="tertiary" size="sm">
                    Better
                  </Caption>
                  {/* `onTint` rather than green: UI 2.0's green is a fill
                      token and green words on a white card are 2.2:1, so the
                      corrected phrase would be the least readable line on the
                      screen for anyone on a light phone. The "Better" caption
                      and the mono face were always the real cues. */}
                  <Body
                    style={[styles.target, { color: c.onTint }]}
                    accessibilityLabel={`Better: ${pattern.better}`}
                  >
                    {pattern.better}
                  </Body>
                </View>
              ) : null}
            </SlabCard>
          ))}
        </View>
      ) : null}

      {reachFor.length > 0 ? (
        <View style={styles.section}>
          <Caption tone="tertiary">Reach for these next time</Caption>
          {reachFor.map((phrase, i) => (
            <SlabCard key={`${phrase.phrase}-${i}`} style={styles.card}>
              <Body style={styles.target}>{phrase.phrase}</Body>
              {phrase.meaning ? (
                <Body size="sm" tone="secondary" style={styles.cardBody}>
                  {phrase.meaning}
                </Body>
              ) : null}
              {phrase.when ? (
                <Caption tone="tertiary" style={styles.cardBody}>
                  {phrase.when}
                </Caption>
              ) : null}
            </SlabCard>
          ))}
        </View>
      ) : null}

      {debrief.nextTime ? (
        <SlabCard tint="primary" style={[styles.card, styles.leadCard]}>
          <Caption tone="accent">Next time</Caption>
          <Body style={styles.cardBody}>{debrief.nextTime}</Body>
        </SlabCard>
      ) : null}

      {/* The server wrote these into the review queue during the call. Not
          telling the learner would mean cards appearing in tomorrow's reviews
          from a conversation they were never told fed them. */}
      {savedWords.length > 0 ? (
        <Caption tone="tertiary" style={styles.saved}>
          {savedWords.length} word{savedWords.length === 1 ? '' : 's'} added to your reviews:{' '}
          {savedWords.join(', ')}
        </Caption>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  section: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  card: {
    padding: spacing.md,
    marginTop: spacing.xs,
    gap: spacing.xxs,
  },
  /** The two cards that open and close the debrief stand off from the run of
   *  pattern cards between them. */
  leadCard: {
    marginTop: spacing.md,
  },
  cardBody: {
    marginTop: spacing.xxs,
  },
  pair: {
    marginTop: spacing.xs,
  },
  /** Target language. The mono face is the app's existing signal for "this is
   *  the language being learned, read it as text" — see DESIGN.md. */
  target: {
    fontFamily: typography.family.mono,
    marginTop: spacing.xxs,
  },
  transcript: {
    height: 320,
    marginTop: spacing.xs,
  },
  waiting: {
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  centered: {
    textAlign: 'center',
  },
  saved: {
    marginTop: spacing.md,
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingBottom: floatingTabBarSpace(),
    paddingTop: spacing.xs,
  },
});
