/**
 * The live call.
 *
 * A full-screen route pushed from the lobby, with the session already minted —
 * this screen never asks for consent, never asks for the microphone and never
 * mints a token. By the time it renders, all three have happened. What it owns
 * is the twelve minutes in between, and exactly one hard rule:
 *
 *   THERE IS NO PATH OUT OF THIS SCREEN THAT IS A BLANK SCREEN.
 *
 * Every way a call can stop — the learner ending it, the budget running out,
 * the network dying, a permission that was revoked from under us, a safety
 * stop — resolves through `destinationForEnd` to a debrief, the lobby, or an
 * error with a retry. That function is total over `TutorEndReason`, so a new
 * reason added to the state machine is a compile error rather than a learner
 * staring at nothing (CLAUDE.md §5).
 *
 * ── THE BUDGET IS NEVER A HARD CUT HERE ──
 *
 * This screen reads `assessTutorBudget` for one purpose: to render a quiet
 * line saying time is short. It does not end the call, and it must not start
 * to. Ending is the session state machine's job, driven from the grant it was
 * given, and it winds the tutor down with a closing cue first so the
 * conversation finishes like a conversation. A screen that also enforced the
 * ceiling would be a second, dumber timer racing the first — and the way that
 * race is lost is the tutor being cut off mid-sentence, which is the exact
 * failure `lib/handsfree-budget.ts`'s header was written about.
 *
 * ── CHANGING CORRECTION MODE MID-CALL DOES NOT RECONNECT ──
 *
 * The toggle in the header calls `setCorrectionMode` on the hook and nothing
 * else. The mode is a control token pushed into the live session, not part of
 * the handshake; tearing down WebRTC to change it would drop the conversation
 * to change how it is corrected. The choice is also written back to storage so
 * the next call starts the way this one ended.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../../hooks/useAuth';
import { useScreenView } from '../../../hooks/useScreenView';
import { useRealtimeTutor } from '../../../hooks/useRealtimeTutor';
import { useAppStore, effectiveTier } from '../../../stores/useAppStore';
import { CallControls } from '../../../components/tutor/CallControls';
import { CallStatusRing } from '../../../components/tutor/CallStatusRing';
import { CorrectionModeToggle } from '../../../components/tutor/CorrectionModeToggle';
import { LiveTranscript } from '../../../components/tutor/LiveTranscript';
import { SlabButton } from '../../../components/ui2/SlabButton';
import { Ui2InlineError } from '../../../components/ui2/Ui2InlineError';
import { Body, Caption, Heading } from '../../../components/ui2/Ui2Text';
import { useUi2Theme } from '../../../hooks/useUi2Theme';
import { endTutorSession, asTutorDebrief } from '../../../lib/tutor-api';
import { personaById } from '../../../lib/tutor-personas';
import { saveCorrectionMode, type CorrectionMode } from '../../../lib/tutor-storage';
import { assessTutorBudget } from '../../../lib/tutor-budget';
import { clearCallHandoff, peekCallHandoff } from '../../../lib/tutor-call-handoff';
import { stashDebrief } from '../../../lib/tutor-debrief-handoff';
import {
  callBudgetNotice,
  callClockAccessibilityLabel,
  debriefHref,
  destinationForEnd,
  formatCallClock,
  type TutorCallDestination,
} from '../../../lib/tutor-screen-flow';
import { wireEndReason } from '../../../lib/tutor-end-reason';
import type { TutorEndReason } from '../../../lib/realtime-session';
// `colors` is deliberately NOT imported: it is the fixed DARK palette, and a
// screen that reads it stays dark whatever the phone is set to. `radii` and
// `spacing` are plain scheme-independent numbers and carry over unchanged.
import { radii, spacing } from '../../../config/theme';

export default function TutorCallScreen() {
  // Unconditional and first: this screen has four early returns below it, so
  // the hook has to run before any of them or the hook order changes with the
  // call's state.
  const { c } = useUi2Theme();
  const router = useRouter();
  const { user } = useAuth();
  const { subscription, entitledTier } = useAppStore();
  const tier = effectiveTier(subscription, entitledTier);
  useScreenView('tutor_call', { tier });

  /**
   * Read once, on the first render, and held.
   *
   * `peekCallHandoff` is non-destructive, but reading it into state pins the
   * session for this screen's lifetime — a lobby that stashed a NEW session
   * while this one was still winding down must not swap the credential under a
   * call in progress.
   */
  const [session] = useState(peekCallHandoff);

  const tutor = useRealtimeTutor();
  const { phase, transcript, muted, remainingMs, endReason } = tutor;

  const [mode, setMode] = useState<CorrectionMode | null>(session?.correctionMode ?? null);
  const [terminal, setTerminal] = useState<TutorCallDestination | null>(null);
  const [closing, setClosing] = useState(false);

  /** Terminal handling runs exactly once. `phase` can re-render after `ended`. */
  const settledRef = useRef(false);

  const persona = personaById(session?.personaId ?? null);
  // Already milliseconds: lib/tutor-api.ts converts the server's seconds once,
  // in its parser, and never passes seconds upward.
  const grantedMs = session?.grantedMs ?? 0;

  const sessionIdRef = useRef<string | null>(null);
  sessionIdRef.current = session?.sessionId ?? null;

  // ── Connect ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    void tutor.start(session);
    // Deliberately mount-only. `tutor.start` is not a stable identity and a
    // dependency on it would re-dial the call on every render; the session is
    // pinned in state above and cannot change under us.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // ── The one exit ─────────────────────────────────────────────────────
  const settle = useCallback(
    async (reason: TutorEndReason) => {
      const sessionId = session?.sessionId ?? null;
      const hadConversation = transcript.turns.length > 0;
      const destination = destinationForEnd({ reason, sessionId, hadConversation });

      setClosing(true);
      try {
        // Called for EVERY terminal state, including the ones that render an
        // error. The server refunds the unused part of the grant here; a
        // session left unended is settled by the reaper to its last heartbeat
        // instead, which costs the learner minutes they did not spend.
        if (sessionId) {
          const result = await endTutorSession({ sessionId, endReason: wireEndReason(reason) });
          stashDebrief({
            sessionId,
            debrief: asTutorDebrief(result.debrief),
            savedWords: result.savedWords,
            minutes: result.minutesSpoken,
            transcriptLost: result.transcriptLost,
            transcript: transcript.turns,
          });
        }
      } catch {
        // A failed end is not worth blocking the learner's exit over. The
        // debrief screen re-reads from the server anyway, and the reaper
        // settles the money if this request never landed.
      } finally {
        // The client secret has done its job. Holding a spent credential in
        // memory has no upside.
        clearCallHandoff();
        setClosing(false);
      }

      if (destination.kind === 'debrief') {
        // `replace`, not `push`: the call is over, and a back gesture from the
        // debrief must not return to a dead call screen.
        router.replace(debriefHref(destination.sessionId));
      } else if (destination.kind === 'lobby') {
        router.back();
      } else {
        setTerminal(destination);
      }
    },
    [router, session, transcript.turns],
  );

  useEffect(() => {
    if (phase !== 'ended' || settledRef.current) return;
    settledRef.current = true;
    // `ended` is the single terminal phase and it always carries a reason. A
    // missing one is a bug upstream rather than a reason to hang here, so it
    // is treated as a server error — which routes somewhere real.
    void settle(endReason ?? 'server_error');
  }, [phase, endReason, settle]);

  /**
   * The learner left without ending the call.
   *
   * The iOS swipe-back gesture is deliberately still enabled here — the
   * mobile-UI rules say not to disable it without a real need, and "the user
   * might leave" is not one.
   *
   * This settles the SERVER only. `useRealtimeTutor` has its own unmount
   * cleanup that closes the peer connection, stops the tracks and releases the
   * audio session, so calling `end()` here too would be dead weight — and a
   * `setState` into a component that is already gone. Teardown is idempotent
   * and the two cleanups may run in either order; nothing here depends on
   * which fires first.
   *
   * What it is NOT redundant with is the money. The hook's cleanup is guarded
   * on `phase !== 'idle'`, so a screen unmounted before `start()` has
   * dispatched — a fast swipe-back on a cold mount — tears down nothing,
   * because there is nothing to tear down. But the session row already exists:
   * the lobby minted it before navigating. That window is exactly what this
   * covers, which is why it is gated only on our own latch and never on any
   * hook state.
   *
   * Mount-only, reading through refs: a cleanup depending on `transcript`
   * would re-run on every delta and settle the call it exists to protect.
   */
  useEffect(() => {
    return () => {
      if (settledRef.current) return;
      settledRef.current = true;
      const id = sessionIdRef.current;
      if (id) {
        // Fire and forget — the screen is already gone. Failing here costs a
        // reaper sweep, not the learner's minutes.
        void endTutorSession({ sessionId: id, endReason: wireEndReason('user_ended') }).catch(
          () => undefined,
        );
      }
      clearCallHandoff();
    };
  }, []);

  const handleCorrectionMode = useCallback(
    (next: CorrectionMode) => {
      setMode(next);
      // No reconnect. See the file header.
      tutor.setCorrectionMode(next);
      if (user) void saveCorrectionMode(user.id, next);
    },
    [tutor, user],
  );

  const handleEnd = useCallback(() => {
    // Returns void, not a Promise. The reducer moves to `ended` and the
    // terminal effect above picks it up from there; this does not settle the
    // session itself, so there is nothing to await.
    tutor.end();
  }, [tutor]);

  // ── No session: a cold deep link, or a restored route ────────────────
  // There is no way to reconstruct a client secret and it would have expired
  // regardless, so the only honest answer is to send them back to start
  // properly. Never a blank screen.
  if (!session) {
    return (
      <View style={[styles.flex, { backgroundColor: c.bg }]}>
        <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
          <View style={styles.centered}>
            <Heading level={2} accessibilityRole="header">
              This call has ended
            </Heading>
            <Body tone="secondary" style={styles.centeredBody}>
              Start a new one from the tutor screen whenever you are ready.
            </Body>
            <SlabButton
              label="Back to the tutor"
              onPress={() => router.replace('/(app)/tutor')}
              style={styles.primaryButton}
            />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ── Terminal error ───────────────────────────────────────────────────
  if (terminal !== null && terminal.kind === 'error') {
    return (
      <View style={[styles.flex, { backgroundColor: c.bg }]}>
        <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
          <View style={styles.centered}>
            {terminal.retry ? (
              <Ui2InlineError copy={terminal.copy} onRetry={() => router.replace('/(app)/tutor')} retryLabel="Try again" />
            ) : (
              <>
                <Heading level={2} accessibilityRole="header">
                  {terminal.copy.title}
                </Heading>
                <Body tone="secondary" style={styles.centeredBody}>
                  {terminal.copy.message}
                </Body>
              </>
            )}

            {/* There is no TURN relay in this build. For a learner on a
                carrier that blocks live calls, "try again" will fail forever
                and the text tutor is the thing that actually works. */}
            {terminal.offerTextChat ? (
              <SlabButton
                label="Use text chat instead"
                onPress={() => router.replace('/(app)/chat')}
                accessibilityHint="Opens the text tutor, which works on any connection."
                style={styles.primaryButton}
              />
            ) : null}

            <Pressable
              style={styles.tertiaryButton}
              onPress={() => router.replace('/(app)/tutor')}
              accessibilityRole="button"
              accessibilityLabel="Back to the tutor"
            >
              <Body size="sm" tone="secondary">
                Back to the tutor
              </Body>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ── Winding up ───────────────────────────────────────────────────────
  if (closing) {
    return (
      <View style={[styles.flex, { backgroundColor: c.bg }]}>
        <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
          <View style={styles.centered}>
            <ActivityIndicator color={c.primary} />
            <Body tone="secondary" style={styles.centeredBody} accessibilityLiveRegion="polite">
              Writing up your notes…
            </Body>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ── The call ─────────────────────────────────────────────────────────
  // `elapsedMs` is reconstructed rather than measured, and that is safe here
  // for a specific reason worth writing down: `assessTutorBudget` uses it only
  // as `granted - elapsed`, so the subtraction round-trips exactly and the
  // verdict's `remainingMs` is identical to the hook's, whichever ceiling is
  // actually biting. The hook reports `min(grant, maxSession) - live`, so the
  // reconstructed elapsed over-reports once a call exceeds the 15-minute
  // wall-clock cap — but nothing downstream reads it. Do not start reading it.
  const budget = assessTutorBudget({ grantedMs, elapsedMs: grantedMs - remainingMs, tier });
  const notice = callBudgetNotice(budget);

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      {/* `bottom` as well as `top`: FloatingTabBar hides itself on this route
          (FULL_SCREEN_ROUTES), so nothing else is reserving the home
          indicator's space. */}
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Body weight="semibold" numberOfLines={1} style={styles.headerName}>
              {persona?.name ?? 'Your tutor'}
            </Body>

            <View style={styles.headerActions}>
              <Caption
                tone="tertiary"
                accessibilityLabel={callClockAccessibilityLabel(remainingMs)}
                accessibilityLiveRegion="none"
              >
                {formatCallClock(remainingMs)}
              </Caption>

              <Pressable
                onPress={tutor.toggleMute}
                style={[
                  styles.iconButton,
                  { backgroundColor: muted ? c.pinkTint : c.card },
                ]}
                accessibilityRole="button"
                accessibilityLabel={muted ? 'Unmute your microphone' : 'Mute your microphone'}
                accessibilityState={{ selected: muted }}
              >
                <Ionicons
                  name={muted ? 'mic-off' : 'mic'}
                  size={18}
                  color={muted ? c.error : c.muted}
                />
              </Pressable>
            </View>
          </View>

          <CorrectionModeToggle mode={mode} onChange={handleCorrectionMode} compact />

          {/* Quiet, and it stays for the rest of the call once it appears —
              assessTutorBudget latches it so the warning cannot vanish just as
              it starts to matter. */}
          {notice ? (
            <Caption tone="secondary" style={styles.notice} accessibilityLiveRegion="polite">
              {notice}
            </Caption>
          ) : null}
        </View>

        <View style={styles.ring}>
          <CallStatusRing
            phase={phase}
            portraitId={persona?.portraitId ?? ''}
            name={persona?.name ?? 'Your tutor'}
          />
        </View>

        {/* Always visible. A learner who mishears a word in a language they are
            still learning has no way back to it otherwise. */}
        <View style={styles.transcript}>
          <LiveTranscript transcript={transcript} />
        </View>

        <CallControls
          muted={muted}
          onToggleMute={tutor.toggleMute}
          onEnd={handleEnd}
          onSendText={tutor.sendText}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  centeredBody: {
    textAlign: 'center',
  },
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
  },
  headerName: {
    flexShrink: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconButton: {
    // 44pt: the HIG minimum, and this one is pressed mid-conversation.
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: {
    textAlign: 'center',
  },
  ring: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  transcript: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  primaryButton: {
    marginTop: spacing.xs,
  },
  tertiaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
