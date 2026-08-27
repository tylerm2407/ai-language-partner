import { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import { haptic } from '../../lib/haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../config/theme';
import { Button } from '../ui/Button';
import { ExerciseChrome } from './ExerciseChrome';
import { MultipleChoice } from './MultipleChoice';
import { TranslationExercise } from './TranslationExercise';
import { FillBlankExercise } from './FillBlankExercise';
import { ListeningExercise } from './ListeningExercise';
import { SpeakingExercise } from './SpeakingExercise';
import { ClozeExercise } from './ClozeExercise';
import { SentenceConstructionExercise } from './SentenceConstructionExercise';
import { ErrorCorrectionExercise } from './ErrorCorrectionExercise';
import { DictationExercise } from './DictationExercise';
import { CollocationMatch } from './CollocationMatch';
import { WordFormExercise } from './WordFormExercise';
import { SentenceTransformExercise } from './SentenceTransformExercise';
import { MiniDialogueExercise } from './MiniDialogueExercise';
import { useAdultMode } from '../../hooks/useAdultMode';
import { CorrectSparkle } from '../animations/CorrectSparkle';
import { WrongShake } from '../animations/WrongShake';
import { CelebrationOverlay } from '../ui/CelebrationOverlay';
import {
  fetchDueReviewItemsWithCards,
  fetchReviewItemsByCardIds,
  upsertReviewItem,
} from '../../lib/supabase-queries';
import { calculateNextReview } from '../../lib/srs';
import { enqueue, isNetworkError } from '../../lib/offline-queue';
import {
  recordLessonSrsResult,
  warmupToExercise,
  WARMUP_MAX_ITEMS,
  WARMUP_FETCH_TIMEOUT_MS,
} from '../../lib/lesson-srs';
import {
  canSkip,
  isLocked,
  isResolved,
  maxAttempts,
  nextStatus,
  type AttemptStatus,
  type AttemptStatusMap,
} from '../../lib/lesson-attempts';
import { summarizeLesson } from '../../lib/lesson-scoring';
import { useLessonAudioPrewarm } from '../../hooks/useLessonAudioPrewarm';
import {
  saveLessonSession,
  loadLessonSession,
  clearLessonSession,
  LESSON_SESSION_TTL_MS,
} from '../../lib/lesson-session-storage';
import {
  scheduleLessonExpiryReminder,
  cancelLessonExpiryReminder,
} from '../../hooks/useNotifications';
import type { Exercise, LanguageCode, ReviewItem, Card } from '../../types';

interface LessonRunnerProps {
  exercises: Exercise[];
  /**
   * Stable lesson id used to persist/resume mid-lesson progress. Omit it
   * (e.g. review drills) to disable session persistence entirely.
   */
  lessonId?: string;
  lessonTitle: string;
  xpReward: number;
  userId: string;
  targetLanguage: LanguageCode;
  /** CEFR level for grammar-rule lookups in per-exercise FeedbackCard. */
  cefrLevel?: string;
  onComplete: (results: LessonResult) => void;
  onExit: () => void;
}

export interface LessonResult {
  totalExercises: number;
  correctCount: number;
  /**
   * Exercises the learner skipped. They left their SRS card
   * untouched so they come back, and are OUT of the accuracy denominator —
   * `accuracy` divides by `scoredCount`, not by `totalExercises`.
   */
  skippedCount: number;
  /** totalExercises - skippedCount. */
  scoredCount: number;
  /**
   * Already skip-aware. Consumers must use this rather than recomputing from
   * correctCount/totalExercises — that recomputation is how the runner and the
   * completion row disagreed about a learner's score in the first place.
   */
  accuracy: number;
  xpEarned: number;
  /**
   * One entry per RESOLVED, non-skipped exercise, so this can legitimately be
   * shorter than `totalExercises`. A second-attempt-correct is recorded here
   * as `correct: false` — it taught, it did not score.
   */
  answers: { exerciseId: string; correct: boolean; answer: string }[];
  /**
   * Wall-clock time from when this lesson session first started — which for a
   * resumed lesson is the ORIGINAL start, since `sessionStartedAtRef` is
   * restored from the snapshot. Stored on the completion row, which used to
   * be hardcoded to 0.
   */
  timeSpentMs: number;
}

export function LessonRunner({
  exercises,
  lessonId,
  lessonTitle,
  xpReward,
  userId,
  targetLanguage,
  cefrLevel,
  onComplete,
  onExit,
}: LessonRunnerProps) {
  const { showXpCelebration } = useAdultMode();
  const [currentIndex, setCurrentIndex] = useState(0);
  // `showResult` survives only as the sparkle/shake trigger. Whether an
  // exercise has been answered is derived from `picks` — a single boolean
  // could not say "this one, the one you just walked back to, is answered".
  const [showResult, setShowResult] = useState(false);
  // Keyed by exercise id, so warm-up ids (`warmup-…`) and lesson ids never
  // collide. This is what makes Previous restore a pick, its option colours
  // and its note.
  const [picks, setPicks] = useState<Record<string, string>>({});
  // Where each exercise stands: unanswered, retrying, correct, recovered,
  // wrong or skipped. Replaces a plain correct/incorrect boolean, which could
  // not express "a second attempt is open" or "this one does not count".
  // Warm-up answers deliberately stay out of `answers` (they must not move
  // lesson accuracy or XP), so the footer's kicker reads from here instead and
  // works in both phases.
  const [statuses, setStatuses] = useState<AttemptStatusMap>({});
  // Attempts spent per exercise. Mirrored in a ref because handleAnswer reads
  // it synchronously: two taps inside one React batch would otherwise both see
  // zero attempts and both count as the first.
  const [attempts, setAttempts] = useState<Record<string, number>>({});
  const attemptsRef = useRef<Record<string, number>>({});
  const [answers, setAnswers] = useState<{ exerciseId: string; correct: boolean; answer: string }[]>([]);
  const [completed, setCompleted] = useState(false);
  /**
   * Double-tap guard for the Finish button.
   *
   * `completed` is state, so two taps dispatched in the same React batch both
   * read `false` and both run the completion path — two `onComplete` calls,
   * which means the lesson is recorded twice and, before the XP key became
   * deterministic, paid twice. A ref is checked synchronously.
   */
  const completingRef = useRef(false);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState<boolean | null>(null);

  // SRS warm-up state. `warmupResolved` gates the lesson: true once the
  // warm-up either loaded (with items or zero) or the fetch timed out.
  const [warmupResolved, setWarmupResolved] = useState(false);
  const [warmupEntries, setWarmupEntries] = useState<Array<{ item: ReviewItem; card: Card }>>([]);
  const [warmupIndex, setWarmupIndex] = useState(0);
  const [warmupPhase, setWarmupPhase] = useState(false);
  const warmupFetchedRef = useRef(false);

  // ── Session resume ────────────────────────────────────────────────────
  // Mid-lesson progress is persisted to AsyncStorage after every answer so
  // backgrounding/kill/crash doesn't restart the lesson. The snapshot is
  // loaded before the warm-up fetch so a resumed session skips silently to
  // the saved exercise (a resumed lesson already had its warm-up).
  const sessionStartedAtRef = useRef(Date.now());
  const resumedRef = useRef(false);
  const restoreAttemptedRef = useRef(false);
  const [restoreChecked, setRestoreChecked] = useState(false);
  // A previous run of this lesson aged out — surfaced once, dismissible.
  const [sessionExpired, setSessionExpired] = useState(false);
  /**
   * The learner has spent today's new-card allowance, so a card in this lesson
   * was answered but not scheduled for review.
   *
   * This has to be visible. It was a bare console.warn while the cap was 20/day
   * and effectively unreachable; now that the cap is what meters the free tier,
   * an invisible skip means a learner quietly stops accumulating review
   * material and cannot tell why. The lesson still runs to the end — the limit
   * is on taking on NEW material, never on practising.
   */
  const [newCardCapReached, setNewCardCapReached] = useState(false);
  // Cards already introduced to SRS this session (cap accounting de-dupe).
  const srsIntroducedRef = useRef<Set<string>>(new Set());
  // Prefetched review items for this lesson's cards, keyed by cardId, so
  // grading continues real SM-2 state instead of re-baselining cards the
  // user has history with. `null` = prefetch pending/failed → fresh-baseline
  // fallback in recordLessonSrsResult (never blocks the lesson).
  const existingReviewItemsRef = useRef<Map<string, ReviewItem> | null>(null);
  const srsPrefetchStartedRef = useRef(false);

  useEffect(() => {
    if (srsPrefetchStartedRef.current || !userId) return;
    srsPrefetchStartedRef.current = true;
    const cardIds = [
      ...new Set(exercises.map((e) => e.cardId).filter((id): id is string => !!id)),
    ];
    if (cardIds.length === 0) {
      existingReviewItemsRef.current = new Map();
      return;
    }
    fetchReviewItemsByCardIds(userId, cardIds)
      .then((items) => {
        existingReviewItemsRef.current = new Map(items.map((it) => [it.cardId, it]));
      })
      .catch((err) => {
        console.warn(
          '[lesson-srs] prefetch of existing review items failed; grading from fresh SM-2 baseline:',
          err,
        );
      });
  }, [userId, exercises]);

  useEffect(() => {
    if (restoreAttemptedRef.current) return;
    restoreAttemptedRef.current = true;
    if (!lessonId || !userId) {
      setRestoreChecked(true);
      return;
    }
    loadLessonSession(userId, lessonId)
      .then(({ snapshot, expired }) => {
        // The day ran out on work they actually did. Say so — restarting a
        // half-finished lesson with no explanation reads as lost progress.
        if (expired) setSessionExpired(true);
        // A snapshot with no answers can still hold real progress — a learner
        // who skipped their way to question five has resolved five exercises
        // and must not be sent back to question one.
        const hasProgress =
          !!snapshot &&
          (snapshot.answers.length > 0 || Object.keys(snapshot.statuses ?? {}).length > 0);
        if (snapshot && hasProgress && exercises.length > 0) {
          resumedRef.current = true;
          sessionStartedAtRef.current = snapshot.startedAt;
          setCurrentIndex(Math.min(snapshot.exerciseIndex, exercises.length - 1));
          setAnswers(snapshot.answers);
          setPicks(snapshot.picks ?? {});
          // Prefer the persisted statuses. Deriving them from `answers` alone
          // cannot distinguish a recovered answer from a plain wrong one, and
          // has no way at all to express a skip — the fallback is only for
          // snapshots written before statuses were recorded.
          setStatuses(
            snapshot.statuses ??
              Object.fromEntries(
                snapshot.answers.map((a) => [a.exerciseId, a.correct ? 'correct' : 'wrong']),
              ),
          );
          // Every restored exercise is already resolved, so it has spent its
          // attempts — a resumed lesson must not hand back a second try on a
          // question that is already graded.
          const spent = Object.fromEntries(
            snapshot.answers.map((a) => [a.exerciseId, 2] as const),
          );
          attemptsRef.current = spent;
          setAttempts(spent);
        }
      })
      .catch((err) => console.warn('[lesson-session] restore failed:', err))
      .finally(() => setRestoreChecked(true));
  }, [userId, lessonId, exercises]);

  useEffect(() => {
    if (!restoreChecked || warmupFetchedRef.current) return;
    warmupFetchedRef.current = true;
    // No account yet (the pre-auth trial lesson) — there is nothing due, and
    // the query would run against `anon` only to be refused. Skip the wait.
    if (!userId) {
      setWarmupResolved(true);
      return;
    }
    if (resumedRef.current) {
      // Resumed mid-lesson: skip the warm-up and drop into the saved spot.
      setWarmupResolved(true);
      return;
    }
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      setWarmupResolved(true);
    }, WARMUP_FETCH_TIMEOUT_MS);
    fetchDueReviewItemsWithCards(userId, WARMUP_MAX_ITEMS)
      .then((entries) => {
        if (timedOut) return;
        clearTimeout(timeout);
        if (entries.length > 0) {
          setWarmupEntries(entries);
          setWarmupPhase(true);
        }
        setWarmupResolved(true);
      })
      .catch(() => {
        clearTimeout(timeout);
        setWarmupResolved(true);
      });
    return () => clearTimeout(timeout);
  }, [userId, restoreChecked]);

  const warmupExercise = warmupEntries[warmupIndex]
    ? warmupToExercise(warmupEntries[warmupIndex])
    : null;
  const currentExercise = warmupPhase ? warmupExercise : exercises[currentIndex];

  // Per-exercise answered state. `showResult` used to stand in for this, but a
  // single boolean cannot describe an exercise you have walked back onto.
  const currentStatus: AttemptStatus = currentExercise
    ? statuses[currentExercise.id] ?? 'unanswered'
    : 'unanswered';
  const locked = isLocked(currentStatus);
  const resolved = isResolved(currentStatus);
  const isRetrying = currentStatus === 'retrying';
  const currentAttempts = currentExercise ? attempts[currentExercise.id] ?? 0 : 0;
  // Null while retrying, so the exercise remounts blank for the second attempt
  // rather than coming back pre-filled with the answer that was just refused.
  const currentPick =
    currentExercise && !isRetrying ? picks[currentExercise.id] ?? null : null;
  /**
   * What the footer's note row is told. `retrying` maps to null so the reveal
   * branch — which keys off this being non-null — stays shut until the second
   * attempt is actually spent.
   */
  const currentCorrect: boolean | null = isRetrying
    ? null
    : resolved && currentStatus !== 'skipped'
      ? currentStatus === 'correct' || currentStatus === 'recovered'
      : null;
  const canSkipCurrent = currentExercise ? canSkip(currentExercise, warmupPhase) : false;
  const exerciseIds = exercises.map((e) => e.id);
  // The progress ticks track exercises the runner is DONE with, which now
  // includes skipped ones — counting `answers` would leave the track stuck.
  const resolvedCount = exerciseIds.filter((id) => isResolved(statuses[id] ?? 'unanswered')).length;

  // Warm the next listening clip while the learner works on this one.
  useLessonAudioPrewarm({
    exercises,
    currentIndex,
    language: targetLanguage,
    userId: userId || undefined,
    enabled: !warmupPhase && !completed,
  });

  const handleAnswer = useCallback(
    (correct: boolean, answer: string) => {
      if (!currentExercise) return;
      const id = currentExercise.id;
      // Read from the ref, not from state: two taps landing in one React batch
      // would both see the state value and both count as the first attempt.
      const attemptsBefore = attemptsRef.current[id] ?? 0;
      const status = nextStatus(
        correct,
        attemptsBefore,
        maxAttempts(currentExercise.type, warmupPhase),
      );

      // Recorded for both phases before the warm-up branch returns: the
      // footer's note row and the Next button read from these, and the
      // warm-up needs them just as much as the lesson does.
      attemptsRef.current = { ...attemptsRef.current, [id]: attemptsBefore + 1 };
      setAttempts(attemptsRef.current);
      setPicks((prev) => ({ ...prev, [id]: answer }));
      setStatuses((prev) => ({ ...prev, [id]: status }));
      if (warmupPhase) {
        // Warm-up answers feed the SRS machinery but do not affect the
        // lesson accuracy/XP aggregates. Intentionally do not penalise
        // on warm-up misses (different pedagogy).
        setShowResult(true);
        setLastAnswerCorrect(correct);
        const entry = warmupEntries[warmupIndex];
        if (entry) {
          // Warm-up items get one attempt (maxAttempts returns 1 for them), so
          // the outcome here is only ever pass or fail — no `recovered` case.
          const rating = correct ? 4 : 2;
          const next = calculateNextReview(entry.item, rating);
          const payload = {
            id: entry.item.id,
            userId: entry.item.userId,
            cardId: entry.item.cardId,
            ...next,
            lastReviewedAt: new Date().toISOString(),
          };
          upsertReviewItem(payload)
            .then((saved) => {
              // Keep the prefetched map current: if this card also backs a
              // main-lesson exercise, its SRS result must chain from the
              // warm-up's advancement, not the stale pre-warm-up state.
              existingReviewItemsRef.current?.set(entry.item.cardId, saved);
            })
            .catch((err) => {
              console.warn('[warmup] upsertReviewItem failed:', err);
              if (isNetworkError(err)) {
                // Network blip: queue the exact failed payload for replay on
                // reconnect, and chain in-session state from the locally
                // computed result (same role as `saved` above).
                enqueue(userId, { type: 'review-upsert', payload }).catch((queueErr) =>
                  console.warn('[warmup] offline enqueue failed:', queueErr),
                );
                existingReviewItemsRef.current?.set(entry.item.cardId, payload);
              }
            });
        }
        return;
      }
      setShowResult(true);
      setLastAnswerCorrect(correct);

      // A second attempt is open. Nothing is scored, nothing is written to
      // SRS moves, and — the whole point — nothing is revealed.
      if (status === 'retrying') return;

      // De-dupe by exerciseId: the second attempt re-invokes this handler for
      // the same exercise, so replace any prior entry instead of appending —
      // otherwise answers.length exceeds exercises.length and accuracy/XP inflate.
      //
      // `recovered` is recorded as correct: false. Getting there on the second
      // try is worth teaching and worth a gentler SRS rating, but it is not
      // worth a point, which is exactly what makes the second try honest.
      const nextAnswers = [
        ...answers.filter((a) => a.exerciseId !== id),
        { exerciseId: id, correct: status === 'correct', answer },
      ];
      setAnswers(nextAnswers);

      // Persist a resume snapshot after every answer so an interrupted
      // lesson picks up where it left off. Fire-and-forget — never blocks
      // the grading UI.
      if (lessonId && userId) {
        saveLessonSession(userId, lessonId, {
          exerciseIndex: currentIndex + 1,
          answers: nextAnswers,
          // Without the picks a resumed lesson would render its answered
          // exercises blank, with Next disabled on work already done.
          picks: { ...picks, [id]: answer },
          // Without the statuses a resumed lesson would re-grade a recovered
          // pick as plain correct, and a skipped exercise would come back as
          // unanswered — silently moving the score on resume.
          statuses: { ...statuses, [id]: status },
          startedAt: sessionStartedAtRef.current,
        }).catch((err) => console.warn('[lesson-session] save failed:', err));
      }

      // Feed the result into SRS — same fire-and-forget pattern as the
      // warm-up above. Exercises without a linked card (e.g. AI free
      // production) are skipped.
      if (currentExercise.cardId) {
        recordLessonSrsResult(
          userId,
          currentExercise.cardId,
          status === 'correct' ? 'correct' : status === 'recovered' ? 'recovered' : 'wrong',
          srsIntroducedRef.current,
          existingReviewItemsRef.current,
        )
          .then((r) => {
            if (r.status === 'skipped' && r.reason === 'cap-reached') {
              setNewCardCapReached(true);
            }
          })
          .catch((err) => console.warn('[lesson-srs] SRS update failed:', err));
      }

      // Being wrong costs nothing. There is no per-exercise currency: free
      // usage is metered by the daily new-card cap, which limits how fast new
      // material is taken on rather than penalising mistakes on material the
      // learner already has.
    },
    [currentExercise, warmupPhase, warmupEntries, warmupIndex, answers, picks, statuses, currentIndex, lessonId, userId]
  );

  /**
   * Give up on the current exercise and see the answer.
   *
   * Without this a learner who has simply gone blank on a typed exercise is
   * stuck: Next is disabled until the exercise resolves, and every typed
   * component refuses to submit an empty string. Resolving as `wrong` is the
   * honest outcome — they did not get it —
   * a second wrong answer would have.
   */
  const handleGiveUp = useCallback(() => {
    if (!currentExercise) return;
    const id = currentExercise.id;
    setStatuses((prev) => ({ ...prev, [id]: 'wrong' }));
    setShowResult(true);
    setLastAnswerCorrect(false);

    const nextAnswers = [
      ...answers.filter((a) => a.exerciseId !== id),
      { exerciseId: id, correct: false, answer: picks[id] ?? '' },
    ];
    setAnswers(nextAnswers);

    if (lessonId && userId) {
      saveLessonSession(userId, lessonId, {
        exerciseIndex: currentIndex + 1,
        answers: nextAnswers,
        picks,
        statuses: { ...statuses, [id]: 'wrong' as AttemptStatus },
        startedAt: sessionStartedAtRef.current,
      }).catch((err) => console.warn('[lesson-session] save failed:', err));
    }

    if (currentExercise.cardId) {
      recordLessonSrsResult(
        userId,
        currentExercise.cardId,
        'wrong',
        srsIntroducedRef.current,
        existingReviewItemsRef.current,
      )
        .then((r) => {
          if (r.status === 'skipped' && r.reason === 'cap-reached') {
            setNewCardCapReached(true);
          }
        })
        .catch((err) => console.warn('[lesson-srs] SRS update failed:', err));
    }
  }, [currentExercise, answers, picks, statuses, lessonId, userId, currentIndex]);

  /**
   * Step back one exercise. Deliberately does NOT clear the answered state —
   * that now lives in `picks`/`statuses`, keyed by exercise id, so the earlier
   * question comes back with its pick, its option colours and its note. Only
   * the animation trigger resets, so walking backwards does not replay a
   * sparkle or a shake.
   */
  const handlePrev = () => {
    setShowResult(false);
    setLastAnswerCorrect(null);
    if (warmupPhase) {
      if (warmupIndex > 0) setWarmupIndex((i) => i - 1);
      return;
    }
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  };

  /**
   * Skip an audio-dependent exercise.
   *
   * Neutral in every direction: out of the accuracy denominator and
   * no SRS write at all, so the card stays due and the question comes back.
   * The learner's headphones being dead is not evidence about their Spanish.
   *
   * Note it does NOT lock the exercise — walking back to it with Previous
   * gives a real, full attempt, because by then the headphones may be working.
   */
  const handleSkip = useCallback((): AttemptStatusMap | null => {
    if (!currentExercise) return null;
    const id = currentExercise.id;
    const nextStatuses: AttemptStatusMap = { ...statuses, [id]: 'skipped' };
    setStatuses(nextStatuses);
    setShowResult(false);
    setLastAnswerCorrect(null);

    if (lessonId && userId) {
      saveLessonSession(userId, lessonId, {
        exerciseIndex: currentIndex + 1,
        answers,
        picks,
        statuses: nextStatuses,
        startedAt: sessionStartedAtRef.current,
      }).catch((err) => console.warn('[lesson-session] save failed:', err));
    }
    // Returned so a caller that advances in the same tick can summarise from
    // the post-skip map rather than the queued-but-unapplied state.
    return nextStatuses;
  }, [currentExercise, statuses, answers, picks, lessonId, userId, currentIndex]);

  /**
   * `statusesOverride` exists for `handleSkipAndAdvance`, which skips and
   * advances in one tick. `setStatuses` is queued, so completing on the LAST
   * exercise summarised the pre-skip map: `lesson_completions.score` recorded
   * 11/12 as a miss while the celebration overlay — which recomputes after the
   * flush — printed "11/11 correct · 1 skipped". That score also feeds the
   * unit's "% MASTERED" figure.
   *
   * A functional `setStatuses` would not have fixed it; the read happens here,
   * not in the setter.
   *
   * Note the arity-0 wrapper at the `onNext` prop below: TactileButton forwards
   * its press event to `onPress`, so passing this function directly would land
   * a GestureResponderEvent in `statusesOverride`.
   */
  const handleNext = (statusesOverride?: AttemptStatusMap) => {
    const effectiveStatuses = statusesOverride ?? statuses;
    if (warmupPhase) {
      if (warmupIndex < warmupEntries.length - 1) {
        setWarmupIndex((i) => i + 1);
        setShowResult(false);
        setLastAnswerCorrect(null);
      } else {
        // Warm-up done — transition into the main lesson.
        setWarmupPhase(false);
        setShowResult(false);
        setLastAnswerCorrect(null);
      }
      return;
    }
    if (currentIndex < exercises.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setShowResult(false);
      setLastAnswerCorrect(null);
    } else {
      if (completingRef.current) return;
      completingRef.current = true;

      // Lesson complete. One summarizeLesson call — the runner, the overlay
      // and the completion row all read the same numbers.
      const allAnswers = [...answers];
      const summary = summarizeLesson(effectiveStatuses, exerciseIds, xpReward);

      // Perfect run gets a Heavy "thump" that lands just before the overlay's
      // Success haptic on mount — creates a signature double-thump only when
      // every exercise was correct. Imperfect runs rely on the overlay's own
      // Success haptic (no double-fire).
      if (summary.perfect) {
        haptic('milestone');
      }

      const result: LessonResult = {
        totalExercises: summary.totalExercises,
        correctCount: summary.correctCount,
        skippedCount: summary.skippedCount,
        scoredCount: summary.scoredCount,
        accuracy: summary.accuracy,
        xpEarned: summary.xpEarned,
        answers: allAnswers,
        timeSpentMs: Math.max(0, Date.now() - sessionStartedAtRef.current),
      };

      // Lesson finished — the resume snapshot is no longer needed, and the
      // "your lesson is about to reset" warning would now be a lie.
      if (lessonId && userId) {
        clearLessonSession(userId, lessonId).catch((err) =>
          console.warn('[lesson-session] clear failed:', err),
        );
        cancelLessonExpiryReminder(lessonId).catch((err) =>
          console.warn('[lesson-session] cancel reminder failed:', err),
        );
      }

      setCompleted(true);
      onComplete(result);
    }
  };

  /**
   * Leaving a lesson part-way KEEPS the resume snapshot — closing a lesson is
   * the main way people leave one, and throwing their answers away for it was
   * the wrong default. The snapshot is written to the device and to Redis and
   * expires one day after the lesson started; miss that window and the lesson
   * restarts from the top.
   *
   * The last write happened when the current exercise was answered, so this
   * flush exists to capture where they actually are — walking back a question
   * and then quitting should resume at that question, not further ahead.
   */
  /**
   * Skip is a navigation verb: one that leaves you staring at the same
   * question reads as broken. Mark it, then move on. Walking back with
   * Previous is how you see the SKIPPED note.
   */
  // Not memoised: handleNext is rebuilt every render by design (it closes over
  // the whole completion path), so a useCallback here would be recreated every
  // render anyway and only add the illusion of stability.
  const handleSkipAndAdvance = () => {
    const skipped = handleSkip();
    handleNext(skipped ?? undefined);
  };

  const handleQuit = () => {
    // `answers.length > 0` is no longer the same as "did any work": a learner
    // can resolve exercises purely by skipping them, and that is still progress
    // worth resuming to.
    const didWork = answers.length > 0 || resolvedCount > 0;
    if (lessonId && userId && didWork) {
      saveLessonSession(userId, lessonId, {
        exerciseIndex: currentIndex,
        answers,
        picks,
        statuses,
        startedAt: sessionStartedAtRef.current,
      }).catch((err) => console.warn('[lesson-session] quit save failed:', err));

      // Walking away is the moment the countdown becomes relevant, so this is
      // where the "finish it today" warning gets armed.
      scheduleLessonExpiryReminder({
        lessonId,
        lessonTitle,
        startedAt: sessionStartedAtRef.current,
        ttlMs: LESSON_SESSION_TTL_MS,
      }).catch((err) => console.warn('[lesson-session] schedule reminder failed:', err));
    }
    onExit();
  };

  if (!warmupResolved) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-text-secondary text-base">Preparing your lesson…</Text>
      </View>
    );
  }

  if (exercises.length === 0 && !warmupPhase) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-text-secondary text-lg text-center mb-4">
          No exercises available for this lesson.
        </Text>
        <Button label="Go Back" onPress={onExit} variant="secondary" />
      </View>
    );
  }

  if (completed) {
    // Same summarizeLesson the result payload used — the overlay used to
    // recompute this and could disagree with the score that was recorded.
    const summary = summarizeLesson(statuses, exerciseIds, xpReward);
    const strong = summary.accuracy >= 0.8;
    const title = summary.perfect ? 'Flawless!' : strong ? 'Nailed it!' : 'Lesson complete';
    const mood = strong ? 'lessonComplete' : 'correct';
    const skippedSuffix = summary.skippedCount > 0 ? ` · ${summary.skippedCount} skipped` : '';
    const scoreLine = `${summary.correctCount}/${summary.scoredCount} correct${skippedSuffix}`;

    return (
      <View style={{ flex: 1 }}>
        <CelebrationOverlay
          visible
          mood={mood}
          title={title}
          subtitle={
            showXpCelebration ? `+${summary.xpEarned} XP · ${scoreLine}` : scoreLine
          }
          ctaLabel="Continue"
          onDismiss={onExit}
        />
      </View>
    );
  }

  return (
    <>
      {/* Expired-session notice. The learner started this lesson, ran out of
          time, and is now back at question one — an unexplained reset looks
          identical to losing progress to a bug. Dismissible; never blocks. */}
      {sessionExpired && (
        <Pressable
          onPress={() => setSessionExpired(false)}
          accessibilityRole="button"
          accessibilityLabel="Dismiss expired lesson notice"
          style={{
            backgroundColor: colors.surface.card,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
          }}
        >
          <Ionicons name="time-outline" size={18} color={colors.text.secondary} />
          <Text
            style={{ flex: 1, color: colors.text.secondary, fontSize: 13 }}
            accessibilityLiveRegion="polite"
          >
            This lesson expired, so it's starting over. Unfinished lessons are saved for a day.
          </Text>
          <Ionicons name="close" size={16} color={colors.text.tertiary} />
        </Pressable>
      )}

      {/* New-card allowance spent. Deliberately NOT a blocker and NOT an
          error: the lesson finishes normally, the answers still score, and the
          only consequence is that a new word waits until tomorrow. Reviews are
          never capped on any tier, which is the part worth saying out loud. */}
      {newCardCapReached && (
        <Pressable
          onPress={() => setNewCardCapReached(false)}
          accessibilityRole="button"
          accessibilityLabel="Dismiss daily new-word limit notice"
          style={{
            backgroundColor: colors.surface.card,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
          }}
        >
          <Ionicons name="school-outline" size={18} color={colors.text.secondary} />
          <Text
            style={{ flex: 1, color: colors.text.secondary, fontSize: 13 }}
            accessibilityLiveRegion="polite"
          >
            That&apos;s today&apos;s new words. Keep going — this lesson still counts, and
            reviewing what you know is always unlimited.
          </Text>
          <Ionicons name="close" size={16} color={colors.text.tertiary} />
        </Pressable>
      )}

      <ExerciseChrome
        lessonTitle={warmupPhase ? 'Quick review' : lessonTitle}
        currentIndex={warmupPhase ? warmupIndex : currentIndex}
        total={warmupPhase ? warmupEntries.length : exercises.length}
        completedCount={warmupPhase ? warmupIndex : resolvedCount}
        counterLabel={
          warmupPhase
            ? `QUICK REVIEW ${warmupIndex + 1} / ${warmupEntries.length}`
            : `QUESTION ${String(currentIndex + 1).padStart(2, '0')}`
        }
        note={currentExercise?.explanation ?? null}
        answeredCorrect={currentCorrect}
        recovered={currentStatus === 'recovered'}
        skipped={currentStatus === 'skipped'}
        retry={isRetrying ? { onGiveUp: handleGiveUp } : null}
        onSkip={canSkipCurrent && !resolved && !isRetrying ? handleSkipAndAdvance : null}
        correctAnswer={currentExercise?.correctAnswer ?? ''}
        canPrev={warmupPhase ? warmupIndex > 0 : currentIndex > 0}
        canNext={resolved}
        isLast={!warmupPhase && currentIndex === exercises.length - 1}
        onExit={handleQuit}
        onPrev={handlePrev}
        onNext={() => handleNext()}
      >
        {/* Both animation wrappers stay mounted and are driven by `trigger`.
            Swapping the wrapper's component type per answer — what this used
            to do — changed the element type at this position, so React tore
            down and rebuilt the exercise underneath it. Typed exercises keep
            their input and grade in local state and lost both the instant
            they were graded. The key remounts the subtree when the exercise
            genuinely changes, and only then. */}
        <CorrectSparkle trigger={showResult && lastAnswerCorrect === true}>
          <WrongShake trigger={showResult && lastAnswerCorrect === false}>
            {/* The attempt count is part of the key on purpose. Bumping it
                remounts the exercise, which re-runs every component's lazy
                useState initialiser against a null pick — so all fourteen of
                them come back blank for a second attempt without a single
                line of per-component retry code. */}
            <View key={currentExercise ? `${currentExercise.id}#${currentAttempts}` : undefined}>
              {currentExercise &&
                renderExercise(
                  currentExercise,
                  handleAnswer,
                  locked,
                  currentPick,
                  userId,
                  targetLanguage,
                  cefrLevel,
                )}
            </View>
          </WrongShake>
        </CorrectSparkle>
      </ExerciseChrome>

    </>
  );
}

function renderExercise(
  exercise: Exercise,
  onAnswer: (correct: boolean, answer: string) => void,
  showResult: boolean,
  selected: string | null,
  userId: string,
  targetLanguage: LanguageCode,
  cefrLevel: string | undefined,
) {
  // Shared props threaded into every exercise so the inner FeedbackCard can
  // look up grammar rules and log to correction_log. `onContinue` is gone:
  // ExerciseChrome's footer owns forward navigation now, and a Continue
  // button inside the card would be a second, competing way to advance.
  //
  // `selected` is the recorded answer for THIS exercise. Every type seeds its
  // own input state from it, so walking back with Previous returns the
  // learner to the answer they gave rather than a blank, locked input sitting
  // under a note that says they got it right.
  const shared = { userId, language: targetLanguage, cefrLevel, selected };

  switch (exercise.type) {
    case 'multiple_choice':
      return (
        <MultipleChoice
          exercise={exercise}
          onAnswer={onAnswer}
          showResult={showResult}
          {...shared}
        />
      );
    case 'translate_to_target':
    case 'translate_to_native':
      return <TranslationExercise exercise={exercise} onAnswer={onAnswer} showResult={showResult} {...shared} />;
    case 'fill_blank':
      return <FillBlankExercise exercise={exercise} onAnswer={onAnswer} showResult={showResult} {...shared} />;
    case 'listening_choice':
    case 'listening_type':
      return <ListeningExercise exercise={exercise} onAnswer={onAnswer} showResult={showResult} {...shared} />;
    case 'speaking':
      return (
        <SpeakingExercise
          exercise={exercise}
          onAnswer={onAnswer}
          showResult={showResult}
          selected={selected}
          userId={userId}
          targetLanguage={targetLanguage}
          cefrLevel={cefrLevel}
        />
      );
    case 'free_production':
      return <TranslationExercise exercise={exercise} onAnswer={onAnswer} showResult={showResult} {...shared} />;
    case 'cloze_deletion':
      return <ClozeExercise exercise={exercise} onAnswer={onAnswer} showResult={showResult} {...shared} />;
    case 'sentence_construction':
      return <SentenceConstructionExercise exercise={exercise} onAnswer={onAnswer} showResult={showResult} {...shared} />;
    case 'error_correction':
      return <ErrorCorrectionExercise exercise={exercise} onAnswer={onAnswer} showResult={showResult} {...shared} />;
    case 'dictation':
      return (
        <DictationExercise
          exercise={exercise}
          onAnswer={onAnswer}
          showResult={showResult}
          selected={selected}
          userId={userId}
          targetLanguage={targetLanguage}
          cefrLevel={cefrLevel}
        />
      );
    case 'collocation_match':
      return <CollocationMatch exercise={exercise} onAnswer={onAnswer} showResult={showResult} {...shared} />;
    case 'word_form':
      return <WordFormExercise exercise={exercise} onAnswer={onAnswer} showResult={showResult} {...shared} />;
    case 'sentence_transformation':
      return <SentenceTransformExercise exercise={exercise} onAnswer={onAnswer} showResult={showResult} {...shared} />;
    case 'mini_dialogue':
      return <MiniDialogueExercise exercise={exercise} onAnswer={onAnswer} showResult={showResult} {...shared} />;
    default:
      return (
        <View className="p-6">
          <Text className="text-text-secondary text-center">
            Unknown exercise type: {exercise.type}
          </Text>
        </View>
      );
  }
}
