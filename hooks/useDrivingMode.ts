import { useState, useCallback, useEffect } from 'react';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useVoiceSession } from './useVoiceSession';
import type { DrivingModeState, TranscriptEntry, VoiceCorrection, VocabItem } from '../types';

interface UseDrivingModeReturn {
  drivingState: DrivingModeState;
  lastAIMessage: TranscriptEntry | null;
  elapsedSeconds: number;
  transcript: TranscriptEntry[];
  corrections: VoiceCorrection[];
  vocabulary: VocabItem[];
  xpEarned: number;
  error: string | null;
  startDriving: (topic: string) => Promise<void>;
  stopDriving: () => Promise<void>;
}

export function useDrivingMode(): UseDrivingModeReturn {
  const voice = useVoiceSession();
  const [drivingState, setDrivingState] = useState<DrivingModeState>('topic-select');

  // Derive last AI message from transcript
  const lastAIMessage =
    voice.transcript
      .filter((entry) => entry.speaker === 'ai')
      .at(-1) ?? null;

  // Sync driving state with voice session state
  useEffect(() => {
    if (voice.state === 'ended' && drivingState === 'active') {
      setDrivingState('ended');
      deactivateKeepAwake();
    }
  }, [voice.state, drivingState]);

  const startDriving = useCallback(
    async (topic: string) => {
      try {
        await activateKeepAwakeAsync();
        setDrivingState('active');
        await voice.startSession(topic);
      } catch {
        setDrivingState('topic-select');
        deactivateKeepAwake();
      }
    },
    [voice]
  );

  const stopDriving = useCallback(async () => {
    setDrivingState('ended');
    deactivateKeepAwake();
    await voice.endSession();
  }, [voice]);

  return {
    drivingState,
    lastAIMessage,
    elapsedSeconds: voice.elapsedSeconds,
    transcript: voice.transcript,
    corrections: voice.corrections,
    vocabulary: voice.vocabulary,
    xpEarned: voice.xpEarned,
    error: voice.error,
    startDriving,
    stopDriving,
  };
}
