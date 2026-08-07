import { useCallback, useEffect, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import { setAudioSessionMode } from '../lib/audio-session';
import {
  createVadState,
  feedVadSample,
  type VadConfig,
  type VadState,
  type VadStopReason,
} from '../lib/vad';

/**
 * One microphone turn: open, listen, decide when the learner stopped, close.
 *
 * Returns a recording URI rather than a transcript. Transcription, command
 * detection and grading all belong to the caller, which is what lets the
 * hands-free session apply its own confidence policy without duplicating the
 * chat one.
 *
 * WHY THIS IS A SEPARATE MODULE AND NOT AN EXTRACTION
 * `components/chat/ChatInput.tsx` contains a working voice loop, and the plan
 * was to lift it out so both surfaces shared one implementation. That file is
 * under active development in a parallel workstream, and rewiring it while it
 * moves risks breaking live chat to save a duplicate. So the loop is rebuilt
 * here for hands-free only. The concurrency guards below are copied
 * deliberately and near-verbatim — they encode a real bug (expo-av permits
 * exactly one prepared Recording, and a leaked one breaks recording app-wide)
 * that is not worth re-discovering.
 *
 * The endpointing is NOT copied: chat uses a fixed -35 dB threshold with no
 * upper bound on turn length, which fails in a moving car. That logic lives in
 * lib/vad.ts and is tested.
 */

export interface VoiceTurnResult {
  uri: string | null;
  durationMs: number;
  stopReason: VadStopReason | 'manual';
  noiseFloorDb: number | null;
}

export interface VoiceTurnOptions {
  vadConfig: VadConfig;
  /** Selects the background-capable audio session modes. */
  background: boolean;
  onLevel?: (normalized0to1: number) => void;
  onTurnEnd: (result: VoiceTurnResult) => void | Promise<void>;
  onError: (err: unknown) => void;
}

export interface UseVoiceTurnReturn {
  listening: boolean;
  startTurn: () => Promise<void>;
  stopTurn: (reason?: 'manual') => Promise<void>;
  /** Idempotent teardown. Safe from unmount and from an interruption. */
  abortTurn: () => Promise<void>;
}

export function useVoiceTurn(opts: VoiceTurnOptions): UseVoiceTurnReturn {
  const [listening, setListening] = useState(false);

  const recordingRef = useRef<Audio.Recording | null>(null);
  // Serialise the recording lifecycle. Two starts can race (an interruption
  // resuming while the step executor also fires), and expo-av throws if a
  // second Recording is prepared before the first is unloaded.
  const isStartingRef = useRef(false);
  const isStoppingRef = useRef(false);
  const unloadPromiseRef = useRef<Promise<void> | null>(null);

  const vadRef = useRef<VadState | null>(null);
  const startedAtRef = useRef(0);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  /**
   * Stop the turn and report it. `reason` distinguishes a decision made by the
   * endpointer from a caller-forced stop.
   */
  const finish = useCallback(
    async (reason: VadStopReason | 'manual', report: boolean) => {
      if (isStoppingRef.current) return;
      const recording = recordingRef.current;
      if (!recording) return;

      isStoppingRef.current = true;
      recordingRef.current = null; // null BEFORE async work, to prevent races

      let uri: string | null = null;
      try {
        await recording.stopAndUnloadAsync();
        uri = recording.getURI();
      } catch (err) {
        optsRef.current.onError(err);
      } finally {
        isStoppingRef.current = false;
        setListening(false);
        // Hand the session back so playback is not routed to the earpiece.
        await setAudioSessionMode(optsRef.current.background ? 'handsfree-play' : 'idle');
      }

      if (report) {
        const vad = vadRef.current;
        await optsRef.current.onTurnEnd({
          uri,
          durationMs: Date.now() - startedAtRef.current,
          stopReason: reason,
          noiseFloorDb: vad?.noiseFloorDb ?? null,
        });
      }
    },
    [],
  );

  const startTurn = useCallback(async () => {
    if (isStartingRef.current || isStoppingRef.current || recordingRef.current) return;
    isStartingRef.current = true;

    try {
      // Wait out any fire-and-forget unload from a previous cycle.
      if (unloadPromiseRef.current) {
        try {
          await unloadPromiseRef.current;
        } catch {
          /* already dead */
        }
        unloadPromiseRef.current = null;
      }

      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        optsRef.current.onError(new Error('Microphone permission denied'));
        return;
      }

      await setAudioSessionMode(
        optsRef.current.background ? 'handsfree-record' : 'record',
      );

      const { recording } = await Audio.Recording.createAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        // Without this, status.metering is undefined and the endpointer is
        // blind — the turn would only ever end at the max window.
        isMeteringEnabled: true,
      });

      recordingRef.current = recording;
      startedAtRef.current = Date.now();
      vadRef.current = createVadState(optsRef.current.vadConfig);
      setListening(true);

      // Sample often enough that the silence window has resolution, but not so
      // often that it costs battery over a 20-minute session.
      recording.setProgressUpdateInterval(200);
      recording.setOnRecordingStatusUpdate((status) => {
        if (!status.isRecording || isStoppingRef.current) return;

        const metering = status.metering ?? -160;
        optsRef.current.onLevel?.(Math.max(0, Math.min(1, (metering + 60) / 60)));

        const current = vadRef.current;
        if (!current) return;

        const elapsed = Date.now() - startedAtRef.current;
        const { state: nextVad, decision } = feedVadSample(current, elapsed, metering);
        vadRef.current = nextVad;

        if (decision.kind === 'stop') {
          void finish(decision.reason, true);
        }
      });
    } catch (err) {
      optsRef.current.onError(err);
      setListening(false);
    } finally {
      isStartingRef.current = false;
    }
  }, [finish]);

  const stopTurn = useCallback(
    async (reason: 'manual' = 'manual') => {
      await finish(reason, true);
    },
    [finish],
  );

  /** Teardown without reporting — the caller is abandoning the turn. */
  const abortTurn = useCallback(async () => {
    await finish('manual', false);
  }, [finish]);

  // A leaked Recording breaks every subsequent recording in the app, so
  // unmount must always tear down even if the consumer forgot.
  useEffect(() => {
    return () => {
      const recording = recordingRef.current;
      if (recording) {
        recordingRef.current = null;
        unloadPromiseRef.current = recording
          .stopAndUnloadAsync()
          .then(() => undefined)
          .catch(() => undefined);
      }
      void setAudioSessionMode('idle');
    };
  }, []);

  return { listening, startTurn, stopTurn, abortTurn };
}
