import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import { useAuth } from './useAuth';
import { useAppStore } from '../stores/useAppStore';
import { useVoiceTurn } from './useVoiceTurn';
import { useAudioInterruptions } from './useAudioInterruptions';
import { setAudioSessionMode } from '../lib/audio-session';
import { getTextToSpeech, transcribeAudio } from '../lib/ai';
import {
  fetchDueReviewItemsWithCardsStrict,
  upsertReviewItem,
  insertReviewLogIdempotent,
  insertHandsFreeSession,
  finalizeHandsFreeSession,
} from '../lib/supabase-queries';
import { calculateNextReview, sortReviewQueue } from '../lib/srs';
import { enqueue, isNetworkError, newClientLogId } from '../lib/offline-queue';
import { getCachedTts, putCachedTts, pruneTtsCache, ttsCacheKey } from '../lib/tts-cache';
import { feedbackPhrase, announcePhrase, summaryPhrase } from '../lib/handsfree-phrases';
import { classifyUtterance } from '../lib/handsfree-commands';
import { evaluateHandsFreeAnswer, sttConfidence } from '../lib/handsfree-grading';
import { HANDSFREE_VAD } from '../lib/vad';
import { HANDSFREE_DEFAULTS } from '../config/app';
import {
  createHandsFreeSession,
  elapsedMs,
  handsFreeReduce,
  prefetchWindow,
  currentItem,
  type EndReason,
  type HandsFreeConfig,
  type HandsFreeEvent,
  type HandsFreeQueueItem,
  type HandsFreeSessionState,
} from '../lib/handsfree-session';
import type { ReviewItem } from '../types';

/**
 * Binds the hands-free session engine to audio, network and persistence.
 *
 * This is the ONLY impure part of hands-free mode, and it is deliberately
 * stupid. Every decision — what to play, when a turn ends, whether an answer
 * counts, when the session is over — was already made by a pure module that is
 * tested. What is left here is I/O and sequencing.
 *
 * If you are about to add an `if` to this file, check first whether it is a
 * decision. Decisions belong in lib/handsfree-session.ts, where they can be
 * verified without a device.
 */

export interface UseHandsFreeSessionOptions {
  targetDurationMs: number;
  onEnded?: (summary: { attempted: number; correct: number; reason: EndReason }) => void;
}

export interface UseHandsFreeSessionReturn {
  state: HandsFreeSessionState;
  /** The single line the eyes-free screen shows. */
  statusLine: string;
  preparing: boolean;
  error: string | null;
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  repeat: () => void;
  skip: () => void;
  end: (reason?: EndReason) => Promise<void>;
}

const VOICE_RATE = 1;

function statusFor(state: HandsFreeSessionState): string {
  switch (state.phase) {
    case 'idle':
      return 'Ready';
    case 'announcing':
    case 'prompting':
      return `Card ${state.index + 1}`;
    case 'earcon':
    case 'listening':
      return 'Listening';
    case 'feedback':
    case 'retry_feedback':
      return 'Checking';
    case 'paused':
      return 'Paused';
    case 'summarizing':
      return 'Finishing up';
    case 'ended':
      return 'Session complete';
    default:
      return '';
  }
}

export function useHandsFreeSession(
  opts: UseHandsFreeSessionOptions,
): UseHandsFreeSessionReturn {
  const { user } = useAuth();
  const profile = useAppStore((s) => s.profile);

  const config: HandsFreeConfig = useMemo(
    () => ({
      targetDurationMs: opts.targetDurationMs,
      vad: HANDSFREE_VAD,
      repeatOnFail: true,
      maxAttemptsPerCard: HANDSFREE_DEFAULTS.maxAttemptsPerCard,
      resumeGraceMs: HANDSFREE_DEFAULTS.resumeGraceMs,
      budgetSafetyFactor: 1,
    }),
    [opts.targetDurationMs],
  );

  const [state, dispatch] = useReducer(
    handsFreeReduce,
    config,
    (c) => createHandsFreeSession(c, Date.now()),
  );
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const soundRef = useRef<Audio.Sound | null>(null);
  const sessionRowRef = useRef<string | null>(null);
  const listenStartedAtRef = useRef<number>(0);
  const cachedKeysRef = useRef<Set<string>>(new Set());
  // Mirrors state for callbacks that must not close over a stale render.
  const stateRef = useRef(state);
  stateRef.current = state;

  const nativeLanguage = profile?.nativeLanguage ?? 'en';
  const targetLanguage = profile?.targetLanguage ?? 'es';

  // ── Audio helpers ──────────────────────────────────────────────────────

  const resolveAudio = useCallback(
    async (text: string, lang: string): Promise<string | null> => {
      const key = ttsCacheKey(text, lang, 'default', VOICE_RATE);
      const cached = getCachedTts(key);
      if (cached) return cached;
      const base64 = await getTextToSpeech(text, lang, user?.id);
      const stored = putCachedTts(key, base64);
      cachedKeysRef.current.add(key);
      // Fall back to a data URI if the disk write failed — playing from memory
      // is worse than playing from a file, but far better than silence.
      return stored ?? `data:audio/mpeg;base64,${base64}`;
    },
    [user],
  );

  const playAudio = useCallback(async (uri: string): Promise<void> => {
    await setAudioSessionMode('handsfree-play');
    if (soundRef.current) {
      await soundRef.current.unloadAsync().catch(() => undefined);
      soundRef.current = null;
    }
    const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
    soundRef.current = sound;

    await new Promise<void>((resolve) => {
      sound.setOnPlaybackStatusUpdate((status) => {
        if ('didJustFinish' in status && status.didJustFinish) resolve();
      });
    });
  }, []);

  // ── The mic turn ───────────────────────────────────────────────────────

  const handleTurnEnd = useCallback(
    async (result: { uri: string | null; durationMs: number; stopReason: string }) => {
      const now = Date.now();
      const item = currentItem(stateRef.current);
      if (!item) return;

      if (!result.uri || result.stopReason !== 'silence_after_speech') {
        dispatch({
          type: 'LISTEN_ABORTED',
          now,
          reason:
            result.stopReason === 'max_window' ||
            result.stopReason === 'no_speech' ||
            result.stopReason === 'too_short'
              ? result.stopReason
              : 'no_speech',
        });
        return;
      }

      try {
        const { File } = await import('expo-file-system');
        const base64 = await new File(result.uri).base64();
        const transcription = await transcribeAudio(base64, targetLanguage);

        // A spoken control beats an answer only when the card is not itself
        // teaching that word — classifyUtterance owns that rule.
        const classified = classifyUtterance(
          transcription.text,
          nativeLanguage,
          item.expectedText,
          item.acceptedVariants,
        );
        if (classified.kind === 'command') {
          dispatch({ type: 'COMMAND', now, command: classified.command });
          return;
        }

        // Whisper's own confidence, now that `transcribe` returns it. These
        // were hardcoded null, which made sttConfidence return NEUTRAL for
        // every turn and left the low-confidence gate below inert — a
        // misheard answer went straight into the SM-2 schedule. They stay
        // nullable: an older deployment of the function reports neither, and
        // null still means "no signal", not "no confidence".
        const confidence = sttConfidence({
          noSpeechProb: transcription.noSpeechProb,
          avgLogprob: transcription.avgLogprob,
          transcript: transcription.text,
          speechDurationMs: result.durationMs,
        });

        const evaluation = evaluateHandsFreeAnswer({
          transcript: transcription.text,
          expectedText: item.expectedText,
          acceptedVariants: item.acceptedVariants,
          targetWord: item.targetWord,
          responseTimeMs: now - listenStartedAtRef.current,
          endpointerLagMs: HANDSFREE_VAD.silenceMs,
          confidence,
        });

        if (evaluation.kind === 'low_confidence') {
          dispatch({ type: 'LISTEN_ABORTED', now, reason: 'low_confidence' });
          return;
        }

        dispatch({
          type: 'ANSWER',
          now,
          commitId: newClientLogId(),
          rating: evaluation.rating,
          transcript: transcription.text,
          wasCorrect: evaluation.wasCorrect,
          responseTimeMs: now - listenStartedAtRef.current,
          phraseKey: evaluation.phraseKey,
        });
      } catch (err) {
        console.warn('[handsfree] turn evaluation failed:', err);
        // Recoverable: skip this card rather than ending a drive.
        dispatch({ type: 'STEP_FAILED', now, stage: 'stt', recoverable: true });
      }
    },
    [nativeLanguage, targetLanguage],
  );

  const { startTurn, abortTurn } = useVoiceTurn({
    vadConfig: HANDSFREE_VAD,
    background: true,
    onTurnEnd: handleTurnEnd,
    onError: (err) => {
      console.warn('[handsfree] mic error:', err);
      dispatch({ type: 'STEP_FAILED', now: Date.now(), stage: 'stt', recoverable: true });
    },
  });

  // ── Interruptions ──────────────────────────────────────────────────────

  const sessionActive = state.phase !== 'idle' && state.phase !== 'ended';

  useAudioInterruptions(sessionActive, {
    onPause: (reason) => dispatch({ type: 'PAUSE', now: Date.now(), reason }),
    onResume: () => dispatch({ type: 'RESUME', now: Date.now() }),
    // Network loss is not a pause: the session runs off pre-fetched audio
    // precisely so a tunnel does not stop it.
    onNetworkChange: () => undefined,
  });

  // A pause nobody comes back from must not hold the audio route forever.
  useEffect(() => {
    if (state.phase !== 'paused') return;
    const timer = setInterval(() => dispatch({ type: 'TICK', now: Date.now() }), 5000);
    return () => clearInterval(timer);
  }, [state.phase]);

  // ── Step executor ──────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    const step = state.step;

    async function perform() {
      const now = () => Date.now();
      try {
        switch (step.kind) {
          case 'announce':
          case 'summary': {
            const text =
              step.kind === 'announce'
                ? announcePhrase(state.index + 1, state.queue.length, nativeLanguage)
                : summaryPhrase(state.itemsAttempted, state.itemsCorrect, nativeLanguage);
            const uri = await resolveAudio(text, nativeLanguage);
            if (cancelled || !uri) return;
            await playAudio(uri);
            if (!cancelled) dispatch({ type: 'STEP_DONE', now: now() });
            return;
          }
          case 'prompt': {
            const uri = await resolveAudio(step.text, step.lang);
            if (cancelled || !uri) return;
            await playAudio(uri);
            if (!cancelled) dispatch({ type: 'STEP_DONE', now: now() });
            return;
          }
          case 'feedback': {
            const text = feedbackPhrase(step.phraseKey, nativeLanguage, step.text || undefined);
            const uri = await resolveAudio(text, nativeLanguage);
            if (cancelled || !uri) return;
            await playAudio(uri);
            if (!cancelled) dispatch({ type: 'STEP_DONE', now: now() });
            return;
          }
          case 'earcon': {
            // No bundled tone yet; the reducer only needs to know the beat
            // passed. Advancing immediately keeps the loop moving rather than
            // waiting on audio that does not exist.
            dispatch({ type: 'STEP_DONE', now: now() });
            return;
          }
          case 'listen': {
            listenStartedAtRef.current = now();
            await startTurn();
            return;
          }
          default:
            return;
        }
      } catch (err) {
        if (cancelled) return;
        console.warn('[handsfree] step failed:', err);
        dispatch({ type: 'STEP_FAILED', now: Date.now(), stage: 'tts', recoverable: true });
      }
    }

    void perform();
    return () => {
      cancelled = true;
    };
    // Only the step identity should re-trigger playback. Including the whole
    // state would replay the current clip on every unrelated update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step]);

  // ── Rolling prefetch ───────────────────────────────────────────────────

  // Keyed on the card index and queue length only. Depending on the whole
  // state would re-run this on every phase change — several times per card —
  // doing synchronous cache lookups for audio that is already there.
  const queueLength = state.queue.length;
  const cardIndex = state.index;

  useEffect(() => {
    if (!sessionActive) return;
    const window = prefetchWindow(stateRef.current);
    let cancelled = false;

    void (async () => {
      for (const cardId of window) {
        if (cancelled) return;
        const item = stateRef.current.queue.find((q) => q.cardId === cardId);
        if (!item) continue;
        const key = ttsCacheKey(item.promptText, item.promptLang, 'default', VOICE_RATE);
        if (getCachedTts(key)) continue;
        try {
          await resolveAudio(item.promptText, item.promptLang);
        } catch {
          // Prefetch is best-effort; the step executor retries on demand.
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cardIndex, queueLength, sessionActive, resolveAudio]);

  // ── Commit drain ───────────────────────────────────────────────────────

  /** Re-entry guard: the effect re-runs as soon as the reducer clears. */
  const drainingRef = useRef(false);

  useEffect(() => {
    if (state.outbox.length === 0) return;
    if (drainingRef.current) return;
    drainingRef.current = true;

    const commits = [...state.outbox];
    // Clear BEFORE writing, not after. The write path below has its own
    // durability (it enqueues on network failure), so a commit does not need to
    // stay in the outbox to survive — whereas leaving it there while the effect
    // is keyed on the outbox is what caused every commit to be replayed on
    // every subsequent answer.
    dispatch({
      type: 'COMMITS_DRAINED',
      now: Date.now(),
      commitIds: commits.map((c) => c.commitId),
    });

    void (async () => {
      for (const commit of commits) {
        const reviewItem: ReviewItem = {
          id: commit.reviewItemId,
          userId: user?.id ?? '',
          cardId: commit.cardId,
          easeFactor: 2.5,
          interval: 0,
          repetitions: 0,
          nextDue: new Date().toISOString(),
          lastReviewedAt: null,
          status: 'review',
        };
        const next = calculateNextReview(reviewItem, commit.rating);
        const reviewedAt = new Date().toISOString();

        const itemPayload = {
          ...reviewItem,
          easeFactor: next.easeFactor,
          interval: next.interval,
          repetitions: next.repetitions,
          nextDue: next.nextDue,
          lastReviewedAt: reviewedAt,
          status: next.status,
        };
        const logPayload = {
          userId: user?.id ?? '',
          cardId: commit.cardId,
          reviewItemId: commit.reviewItemId,
          rating: commit.rating,
          responseTimeMs: commit.responseTimeMs,
          userAnswer: commit.transcript,
          wasCorrect: commit.wasCorrect,
          reviewedAt,
          clientLogId: commit.commitId,
        };

        // Same write path as the on-screen review queue, including the offline
        // fallback. A commute must not lose reviews to a tunnel.
        try {
          await upsertReviewItem(itemPayload);
        } catch (err) {
          if (!isNetworkError(err) || !user) throw err;
          await enqueue(user.id, { type: 'review-upsert', payload: itemPayload });
        }
        try {
          await insertReviewLogIdempotent(logPayload);
        } catch (err) {
          if (!isNetworkError(err) || !user) throw err;
          await enqueue(user.id, { type: 'review-log', payload: logPayload });
        }
      }
    })()
      .catch((err) => console.warn('[handsfree] commit drain failed:', err))
      .finally(() => {
        drainingRef.current = false;
      });
    // Keyed on the LENGTH, not the array: the reducer clears the outbox, so
    // keying on identity would re-enter immediately on the resulting state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.outbox.length]);

  // ── Lifecycle ──────────────────────────────────────────────────────────

  const start = useCallback(async () => {
    if (!user) return;
    setPreparing(true);
    setError(null);
    try {
      pruneTtsCache();

      const budget = Math.min(
        HANDSFREE_DEFAULTS.maxQueueItems,
        Math.ceil(opts.targetDurationMs / 14_000) * 1.3,
      );
      // Strict: a network failure here must not present as "all caught up"
      // and waste the learner's commute.
      const due = await fetchDueReviewItemsWithCardsStrict(user.id, Math.ceil(budget));

      const ordered = sortReviewQueue(due.map((d) => d.item));
      const byId = new Map(due.map((d) => [d.item.id, d.card]));

      const queue: HandsFreeQueueItem[] = ordered
        .map((reviewItem): HandsFreeQueueItem | null => {
          const card = byId.get(reviewItem.id);
          // Skip cards with nothing speakable — a silent prompt is a dead turn
          // the learner cannot diagnose without looking at the screen.
          if (!card || !card.targetText) return null;
          return {
            cardId: card.id,
            reviewItemId: reviewItem.id,
            // The learner hears their own language and produces the target.
            promptText: card.nativeText || card.targetText,
            expectedText: card.targetText,
            acceptedVariants: [],
            targetWord: card.targetText,
            promptLang: card.language ?? targetLanguage,
          };
        })
        .filter((q): q is HandsFreeQueueItem => q !== null);

      // Pre-warm so the first minutes survive a dead zone.
      for (const item of queue.slice(0, HANDSFREE_DEFAULTS.prewarmCount)) {
        try {
          await resolveAudio(item.promptText, item.promptLang);
        } catch {
          // Non-fatal — the step executor retries on demand.
        }
      }

      try {
        sessionRowRef.current = await insertHandsFreeSession({
          userId: user.id,
          plannedDurationMs: opts.targetDurationMs,
        });
      } catch (err) {
        // Analytics must never block a session.
        console.warn('[handsfree] could not open session row:', err);
      }

      dispatch({ type: 'START', now: Date.now(), queue });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not start your hands-free session',
      );
    } finally {
      setPreparing(false);
    }
  }, [user, opts.targetDurationMs, targetLanguage, resolveAudio]);

  const end = useCallback(
    async (reason: EndReason = 'user_ended') => {
      dispatch({ type: 'END', now: Date.now(), reason });
      await abortTurn();
      if (soundRef.current) {
        await soundRef.current.unloadAsync().catch(() => undefined);
        soundRef.current = null;
      }
      await setAudioSessionMode('idle');

      const snapshot = stateRef.current;
      if (sessionRowRef.current) {
        try {
          await finalizeHandsFreeSession(sessionRowRef.current, {
            endedAt: new Date().toISOString(),
            actualDurationMs: elapsedMs(snapshot),
            itemsAttempted: snapshot.itemsAttempted,
            itemsCorrect: snapshot.itemsCorrect,
            endedReason: reason,
          });
        } catch (err) {
          console.warn('[handsfree] could not finalize session row:', err);
        }
        sessionRowRef.current = null;
      }

      opts.onEnded?.({
        attempted: snapshot.itemsAttempted,
        correct: snapshot.itemsCorrect,
        reason,
      });
    },
    [abortTurn, opts],
  );

  // Teardown is non-negotiable: a leaked Recording blocks every subsequent
  // recording app-wide, and a held audio session keeps the route.
  useEffect(() => {
    return () => {
      void abortTurn();
      if (soundRef.current) {
        void soundRef.current.unloadAsync().catch(() => undefined);
        soundRef.current = null;
      }
      void setAudioSessionMode('idle');
    };
  }, [abortTurn]);

  const dispatchEvent = useCallback((event: HandsFreeEvent) => dispatch(event), []);

  return {
    state,
    statusLine: statusFor(state),
    preparing,
    error,
    start,
    pause: () => dispatchEvent({ type: 'PAUSE', now: Date.now(), reason: 'user' }),
    resume: () => dispatchEvent({ type: 'RESUME', now: Date.now() }),
    repeat: () => dispatchEvent({ type: 'COMMAND', now: Date.now(), command: 'repeat' }),
    skip: () => dispatchEvent({ type: 'COMMAND', now: Date.now(), command: 'skip' }),
    end,
  };
}
