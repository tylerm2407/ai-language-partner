/**
 * useMissionProgress — everything the Situations picker needs to draw the
 * mission ladder, in one read.
 *
 * Four independent lookups, settled together rather than awaited in turn:
 * the per-stage progress rows, the open (unfinished) attempts, the recent
 * chat sessions (only to learn whether Free Chat has a conversation to pick
 * up — this replaces the `resumable` effect the chat screen used to own),
 * and the goal track, whose `scenarios` decide the tile order.
 *
 * ── WHAT A FAILURE IS ALLOWED TO DO ──
 *
 * Not all four matter equally, so they do not fail equally:
 *
 * - Progress or open attempts failing sets `error` — the learner would
 *   otherwise see every scene at "Mission 1" and could start a fresh attempt
 *   over one they had half finished. The picker shows the error with a
 *   retry and keeps its tiles tappable; whatever DID load is kept.
 * - The goal track failing is silent. It only orders the tiles, and a
 *   picker that hides its scenes because the ordering hint was unreachable
 *   would be the wrong trade. `goalScenes` keeps whatever it last had
 *   (initially `[]`, the existing order).
 * - The sessions read failing is silent for the same reason it always was:
 *   the resume hint is a nicety, and a failed lookup reads as "new
 *   conversation".
 *
 * Nothing is fetched without a user id. Results are keyed to the request
 * that asked for them, so a language switch mid-flight cannot land the old
 * language's ladder on the new language's tiles.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadErrorCopy } from '../lib/error-copy';
import {
  currentStage,
  highestUnlockedStage,
  missionCta,
  missionFor,
  stageDots,
  type MissionCta,
  type StageDot,
} from '../lib/missions';
import {
  fetchGoalTrack,
  fetchMissionProgress,
  fetchOpenMissionAttempts,
  listChatSessions,
  type ChatSession,
  type MissionProgressRow,
  type OpenMissionAttempt,
} from '../lib/supabase-queries';
import type { GoalTrack, LanguageCode } from '../types';
import { MISSION_META, MISSION_STAGE_COUNT, type MissionMeta } from '../types/missions';

export interface SceneProgress {
  /** 1..5 — see `highestUnlockedStage`. 5 means the ladder is done. */
  highestUnlocked: number;
  /** The scene's best accuracy across every stage attempted, or null. */
  bestAccuracy: number | null;
}

export interface SceneOpenAttempt {
  stage: number;
  sessionId: string;
  objectivesMet: string[];
}

export interface MissionProgressState {
  /** Only scenes with at least one progress row appear here. */
  progress: Map<string, SceneProgress>;
  /** At most one per scene — the newest, if several are somehow open. */
  openAttempts: Map<string, SceneOpenAttempt>;
  /** A saved Free Chat conversation in this language exists. */
  freeChatResumable: boolean;
  /** The goal track's ranked scenes, or `[]` (existing order). */
  goalScenes: string[];
  loading: boolean;
  /** One user-facing sentence when progress or attempts could not be read. */
  error: string | null;
  refresh: () => Promise<void>;
}

/** What one picker tile and its sheet draw for a mission scene. */
export interface PickerMissionState {
  /** null until progress has loaded — draw no dots then. */
  dots: StageDot[] | null;
  cta: MissionCta;
  /** Stage the one button acts on (open attempt's stage, else currentStage). Null for free_chat / ladder done. */
  stage: number | null;
  mission: MissionMeta | null;
  /** From an open attempt; [] otherwise. */
  objectivesMet: string[];
  bestAccuracy: number | null;
}

/**
 * One picker entry per mission scene, from what this hook read. A scene
 * with no progress row is at stage 1. `loading` withholds the dots (the tile
 * shows none) but the sheet still works: the button acts on the stage the
 * rows so far imply, which before the first read is stage 1. Free Chat gets
 * no entry — it has no ladder — so the picker gives it the sheet it had.
 */
export function buildPickerMissions(input: {
  progress: ReadonlyMap<string, SceneProgress>;
  openAttempts: ReadonlyMap<string, SceneOpenAttempt>;
  paid: boolean;
  loading?: boolean;
}): Map<string, PickerMissionState> {
  const out = new Map<string, PickerMissionState>();
  for (const scene of Object.keys(MISSION_META)) {
    const progress = input.progress.get(scene);
    const highestUnlocked = progress?.highestUnlocked ?? 1;
    const open = input.openAttempts.get(scene);
    const cta = missionCta({ scenarioKey: scene, paid: input.paid, highestUnlocked, hasOpenAttempt: open !== undefined });
    const stage = open?.stage ?? currentStage(highestUnlocked);
    out.set(scene, {
      dots: input.loading ? null : stageDots(highestUnlocked),
      cta,
      stage,
      // A finished ladder still shows mission 4 — that is what "play again" replays.
      mission: missionFor(scene, stage ?? MISSION_STAGE_COUNT),
      objectivesMet: open ? [...open.objectivesMet] : [],
      bestAccuracy: progress?.bestAccuracy ?? null,
    });
  }
  return out;
}

/** How many sessions to scan for a Free Chat conversation. Matches the count the chat screen used. */
const SESSION_SCAN_LIMIT = 50;

/** The per-scene view of the progress rows. Pure so it is asserted directly. */
export function progressByScene(rows: readonly MissionProgressRow[]): Map<string, SceneProgress> {
  const out = new Map<string, SceneProgress>();
  for (const row of rows) {
    const existing = out.get(row.scenarioKey);
    const scored = [existing?.bestAccuracy ?? null, row.bestAccuracy].filter((v): v is number => v !== null);
    out.set(row.scenarioKey, {
      highestUnlocked: existing?.highestUnlocked ?? highestUnlockedStage(rows, row.scenarioKey),
      bestAccuracy: scored.length > 0 ? Math.max(...scored) : null,
    });
  }
  return out;
}

/**
 * One open attempt per scene, the newest winning. Only one is expected —
 * the server finishes an attempt before another can start — but the picker
 * must not be the place that finds out otherwise.
 */
export function newestOpenAttemptByScene(attempts: readonly OpenMissionAttempt[]): Map<string, SceneOpenAttempt> {
  const newest = new Map<string, OpenMissionAttempt>();
  for (const attempt of attempts) {
    const current = newest.get(attempt.scenarioKey);
    if (!current || Date.parse(attempt.startedAt) > Date.parse(current.startedAt)) {
      newest.set(attempt.scenarioKey, attempt);
    }
  }
  const out = new Map<string, SceneOpenAttempt>();
  for (const [scene, attempt] of newest) {
    out.set(scene, { stage: attempt.stage, sessionId: attempt.chatSessionId, objectivesMet: [...attempt.objectivesMet] });
  }
  return out;
}

/**
 * Whether Free Chat has a conversation to resume. `missionStage === null` is
 * load-bearing: mission attempts are their own rows on the same table, and a
 * finished attempt on `free_chat` (there are none today, but the column
 * allows it) must never read as a free conversation.
 */
export function hasFreeChatSession(sessions: readonly ChatSession[], targetLanguage: string): boolean {
  return sessions.some(
    (s) => s.scenarioKey === 'free_chat' && s.missionStage === null && s.targetLanguage === targetLanguage,
  );
}

function goalScenesOf(track: GoalTrack | null): string[] {
  return track ? [...track.scenarios] : [];
}

type Loaded = Omit<MissionProgressState, 'refresh'>;

const EMPTY: Loaded = {
  progress: new Map(),
  openAttempts: new Map(),
  freeChatResumable: false,
  goalScenes: [],
  loading: false,
  error: null,
};

export function useMissionProgress(userId: string | undefined, targetLanguage: string): MissionProgressState {
  const [state, setState] = useState<Loaded>(() => ({ ...EMPTY, loading: userId !== undefined }));
  /** The request whose answer is still wanted. Bumped on every load and on unmount. */
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const request = ++requestRef.current;
    if (!userId) {
      setState(EMPTY);
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const [progressRes, attemptsRes, sessionsRes, goalRes] = await Promise.allSettled([
      fetchMissionProgress(userId, targetLanguage),
      fetchOpenMissionAttempts(userId, targetLanguage),
      // Language-scoped: the scan window is bounded, so an unfiltered page of
      // another language's sessions could hide the resumable one here.
      listChatSessions(userId, SESSION_SCAN_LIMIT, targetLanguage),
      // The hook takes the language as a plain string (it is also the chat
      // scenario key's partner); the query wants the narrowed code.
      fetchGoalTrack(userId, targetLanguage as LanguageCode),
    ]);
    if (request !== requestRef.current) return;

    const failed = [progressRes, attemptsRes].find(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );

    setState((prev) => ({
      progress: progressRes.status === 'fulfilled' ? progressByScene(progressRes.value) : prev.progress,
      openAttempts:
        attemptsRes.status === 'fulfilled' ? newestOpenAttemptByScene(attemptsRes.value) : prev.openAttempts,
      freeChatResumable:
        sessionsRes.status === 'fulfilled'
          ? hasFreeChatSession(sessionsRes.value, targetLanguage)
          : prev.freeChatResumable,
      goalScenes: goalRes.status === 'fulfilled' ? goalScenesOf(goalRes.value) : prev.goalScenes,
      loading: false,
      error: failed ? loadErrorCopy(failed.reason, 'your mission progress').message : null,
    }));
  }, [userId, targetLanguage]);

  useEffect(() => {
    void load();
    return () => {
      // Orphan any answer still in flight; the next load owns the state.
      requestRef.current += 1;
    };
  }, [load]);

  return { ...state, refresh: load };
}
