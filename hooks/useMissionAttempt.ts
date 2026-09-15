/**
 * One mission attempt, as the chat screen sees it.
 *
 * The server owns the attempt (`chat_mission_attempts`, migration 126): it
 * creates the row on the first turn, keeps the running union of objectives
 * met, and scores the attempt on the Finish turn. This hook holds only what
 * the screen needs to render — which mission is running, which objectives
 * the server has ticked, which of those are new this turn — and the two
 * pieces of request plumbing every mission turn needs: the fields to add to
 * the ai-chat payload, and the Finish call itself.
 *
 * `met` is the SERVER's union, merged through `mergeObjectivesMet` so an id
 * the mission does not have can never tick. The client never decides an
 * objective was met; it only draws what it was told.
 *
 * Finish is deliberately non-streaming. The Finish turn returns the whole
 * debrief inline (`missionResult`), which has no sentence-by-sentence shape
 * to stream, and `sendChatMessage` is the one path whose error format the
 * refusal check below can rely on.
 */

import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { sendChatMessage, type AIChatRequest, type AIChatResponse, type MissionResult } from '../lib/ai';
import { trackEvent } from '../lib/analytics';
import { clearChatDebriefHandoff, stashChatDebrief } from '../lib/chat-debrief-handoff';
import { mergeObjectivesMet, missionFor } from '../lib/missions';
import type { MissionMeta } from '../types/missions';

export interface ActiveMission {
  scenarioKey: string;
  stage: number;
  /** The `chat_sessions` row the attempt lives in. */
  sessionId: string;
  meta: MissionMeta;
  /** Target language, carried for analytics only. */
  language?: string;
}

export interface BeginMissionInput {
  scenarioKey: string;
  stage: number;
  sessionId: string;
  source: 'new' | 'resume';
  /** Seeds the checklist when resuming an open attempt. */
  objectivesMet?: readonly string[];
  /** Target language code, for `mission_started`. */
  language?: string;
}

/** The mission fields a request carries. Spread into the ai-chat payload. */
export type MissionPayloadFields = Pick<AIChatRequest, 'chatSessionId' | 'missionStage'>;

export type FinishOutcome =
  | { status: 'done'; result: MissionResult }
  /** The server refused the turn (quota, rate limit). The mission stays open. */
  | { status: 'refused' }
  | { status: 'failed'; message: string };

export interface FinishOptions {
  /** Builds the full ai-chat request from the existing history. `extra` is
   *  the session id, the stage and `finish: true`; the caller must spread it. */
  buildPayload: (extra: MissionPayloadFields & { finish: true }) => AIChatRequest;
  /** Put the tutor's send-off into the transcript. Awaited before the result
   *  is handed on, so the debrief never opens over a half-written screen. */
  onReply: (reply: string) => Promise<void>;
}

export interface MissionAttempt {
  /** Null while no mission is running. */
  mission: ActiveMission | null;
  /** Objective ids the server has confirmed, in the mission's order. */
  met: string[];
  /** The ids that became met on the most recent turn. Empty between turns
   *  that tick nothing. */
  lastTicked: string[];
  finishing: boolean;
  begin: (input: BeginMissionInput) => void;
  applyTurn: (response: AIChatResponse) => void;
  /** `fallbackSessionId` is the plain chat session when no mission is running
   *  — every ai-chat request carries `chatSessionId`, mission or not. */
  requestPayloadFields: (fallbackSessionId?: string | null) => MissionPayloadFields;
  finish: (opts: FinishOptions) => Promise<FinishOutcome>;
  /** Forget the attempt on this device. No network: the server row stays
   *  open and the attempt is resumable from the picker. */
  leave: () => void;
}

/**
 * Ask before scoring an incomplete attempt. Runs `onConfirm` straight away
 * when every objective is already met — there is nothing to warn about.
 */
export function confirmFinish(done: number, total: number, onConfirm: () => void): void {
  if (done >= total) {
    onConfirm();
    return;
  }
  Alert.alert(
    'Finish anyway?',
    `You have ${done} of ${total} objectives. Finishing now scores what you have said so far.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Finish', onPress: onConfirm },
    ],
  );
}

function isRefusal(message: string): boolean {
  return (
    message.includes('[DAILY_TEXT_LIMIT_REACHED]') ||
    message.includes('[RATE_LIMITED]') ||
    /^429\b/.test(message)
  );
}

export function useMissionAttempt(): MissionAttempt {
  const [mission, setMission] = useState<ActiveMission | null>(null);
  const [met, setMet] = useState<string[]>([]);
  const [lastTicked, setLastTicked] = useState<string[]>([]);
  const [finishing, setFinishing] = useState(false);
  // Refs mirror the state so the async handlers that call into this hook
  // (a send that started a render ago) read the current attempt, not the one
  // their closure captured.
  const missionRef = useRef<ActiveMission | null>(null);
  const metRef = useRef<string[]>([]);

  const leave = useCallback(() => {
    missionRef.current = null;
    metRef.current = [];
    setMission(null);
    setMet([]);
    setLastTicked([]);
  }, []);

  const begin = useCallback((input: BeginMissionInput) => {
    const meta = missionFor(input.scenarioKey, input.stage);
    if (!meta) {
      throw new Error(`No mission for ${input.scenarioKey} stage ${input.stage}`);
    }
    clearChatDebriefHandoff();
    const valid = meta.objectives.map((o) => o.id);
    const seeded = mergeObjectivesMet([], input.objectivesMet ?? [], valid).next;
    const next: ActiveMission = {
      scenarioKey: input.scenarioKey,
      stage: input.stage,
      sessionId: input.sessionId,
      meta,
      language: input.language,
    };
    missionRef.current = next;
    metRef.current = seeded;
    setMission(next);
    setMet(seeded);
    // A resumed checklist is not "newly met" — nothing should buzz or announce.
    setLastTicked([]);
    trackEvent('mission_started', {
      contentId: input.scenarioKey,
      step: input.stage,
      source: input.source,
      language: input.language,
      band: meta.band,
    });
  }, []);

  const applyTurn = useCallback((response: AIChatResponse) => {
    const current = missionRef.current;
    if (!current || !response.mission) return;
    const valid = current.meta.objectives.map((o) => o.id);
    const merged = mergeObjectivesMet(metRef.current, response.mission.objectivesMet, valid);
    metRef.current = merged.next;
    setMet(merged.next);
    setLastTicked(merged.newlyMet);
  }, []);

  const requestPayloadFields = useCallback((fallbackSessionId?: string | null): MissionPayloadFields => {
    const current = missionRef.current;
    if (current) return { chatSessionId: current.sessionId, missionStage: current.stage };
    return { chatSessionId: fallbackSessionId ?? undefined };
  }, []);

  const finish = useCallback(async (opts: FinishOptions): Promise<FinishOutcome> => {
    const current = missionRef.current;
    if (!current) return { status: 'failed', message: 'No mission is running.' };
    setFinishing(true);
    try {
      const payload = opts.buildPayload({
        chatSessionId: current.sessionId,
        missionStage: current.stage,
        finish: true,
      });
      const response = await sendChatMessage(payload);
      await opts.onReply(response.reply);
      const result = response.missionResult ?? null;
      if (!result) {
        return { status: 'failed', message: 'The mission was not scored.' };
      }
      stashChatDebrief({ sessionId: current.sessionId, result });
      trackEvent('mission_finished', {
        contentId: current.scenarioKey,
        step: current.stage,
        outcome: result.passed ? 'passed' : 'failed',
        score: result.accuracy ?? undefined,
        count: result.objectives.filter((o) => o.met).length,
        ok: result.passed,
        language: current.language,
        band: result.band,
      });
      return { status: 'done', result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (isRefusal(message)) {
        // Defensive: the server is designed never to refuse a Finish (it
        // sends a canned send-off instead). If one arrives anyway the
        // attempt stays open and the learner can try again.
        trackEvent('mission_finished', {
          contentId: current.scenarioKey,
          step: current.stage,
          outcome: 'refused',
          ok: false,
          language: current.language,
          band: current.meta.band,
        });
        return { status: 'refused' };
      }
      return { status: 'failed', message };
    } finally {
      setFinishing(false);
    }
  }, []);

  return { mission, met, lastTicked, finishing, begin, applyTurn, requestPayloadFields, finish, leave };
}
