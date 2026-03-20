import { useCallback, useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track, RemoteTrack, RemoteTrackPublication } from 'livekit-client';
import { requestVoiceToken } from '../lib/ai';
import {
  createVoiceSession,
  updateVoiceSession,
} from '../lib/supabase-queries';
import { incrementDailyUsage } from '../lib/supabase-queries';
import { useAuth } from './useAuth';
import { useProfile } from './useProfile';
import type {
  VoiceSessionState,
  TranscriptEntry,
  VoiceCorrection,
  VocabItem,
} from '../types';

interface UseVoiceSessionReturn {
  state: VoiceSessionState;
  elapsedSeconds: number;
  remainingMinutes: number;
  transcript: TranscriptEntry[];
  corrections: VoiceCorrection[];
  vocabulary: VocabItem[];
  xpEarned: number;
  error: string | null;
  startSession: (topic: string, personalityId?: string, scenarioId?: string) => Promise<void>;
  endSession: () => Promise<void>;
}

export function useVoiceSession(): UseVoiceSessionReturn {
  const { user } = useAuth();
  const { profile } = useProfile();

  const [state, setState] = useState<VoiceSessionState>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [remainingMinutes, setRemainingMinutes] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [corrections, setCorrections] = useState<VoiceCorrection[]>([]);
  const [vocabulary, setVocabulary] = useState<VocabItem[]>([]);
  const [xpEarned, setXpEarned] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const roomRef = useRef<Room | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const roomNameRef = useRef<string | null>(null);
  const startTimeRef = useRef<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
    };
  }, []);

  const startSession = useCallback(
    async (topic: string, personalityId?: string, scenarioId?: string) => {
      if (!user?.id) {
        setError('You must be signed in to use voice practice.');
        return;
      }

      try {
        setError(null);
        setState('connecting');
        setElapsedSeconds(0);
        setTranscript([]);
        setCorrections([]);
        setVocabulary([]);
        setXpEarned(0);

        // Request LiveKit token from edge function
        const { token, roomName, serverUrl } = await requestVoiceToken(user.id, {
          language: profile?.targetLanguage,
          level: profile?.level,
          nativeLanguage: profile?.nativeLanguage,
          topic,
          personalityId,
          scenarioId,
        });

        roomNameRef.current = roomName;
        startTimeRef.current = new Date().toISOString();

        // Create a voice session record in the database
        const session = await createVoiceSession({
          userId: user.id,
          roomName,
          topic,
          targetLanguage: profile?.targetLanguage ?? 'es',
          level: profile?.level ?? 'beginner',
        });
        sessionIdRef.current = session.id;

        // Connect to LiveKit room
        const room = new Room();
        roomRef.current = room;

        // Listen for remote audio tracks (AI agent's audio)
        room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication: RemoteTrackPublication) => {
          if (track.kind === Track.Kind.Audio) {
            // Attach audio track to play through speaker
            const element = track.attach();
            document.body.appendChild(element);
          }
        });

        // Listen for AI speaking state
        room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
          const aiSpeaking = speakers.some((s) => !s.isLocal);
          const userSpeaking = speakers.some((s) => s.isLocal);

          if (aiSpeaking) {
            setState('ai-speaking');
          } else if (userSpeaking) {
            setState('listening');
          } else {
            setState('listening');
          }
        });

        // Listen for data channel messages (transcript, corrections, vocab from Python agent)
        room.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
          try {
            const decoder = new TextDecoder();
            const message = JSON.parse(decoder.decode(payload));

            if (message.type === 'transcript') {
              setTranscript((prev) => [
                ...prev,
                {
                  id: `t-${Date.now()}`,
                  speaker: message.speaker,
                  text: message.text,
                  timestamp: message.timestamp ?? new Date().toISOString(),
                },
              ]);
            } else if (message.type === 'correction') {
              setCorrections((prev) => [
                ...prev,
                {
                  original: message.original,
                  corrected: message.corrected,
                  explanation: message.explanation,
                },
              ]);
            } else if (message.type === 'vocabulary') {
              setVocabulary((prev) => [
                ...prev,
                {
                  word: message.word,
                  translation: message.translation,
                  context: message.context,
                },
              ]);
            } else if (message.type === 'session_summary') {
              setXpEarned(message.xpEarned ?? 0);
            }
          } catch {
            // Ignore malformed data messages
          }
        });

        room.on(RoomEvent.Disconnected, () => {
          setState('ended');
          if (timerRef.current) clearInterval(timerRef.current);
        });

        // Connect to the room
        await room.connect(serverUrl, token);

        // Publish local microphone track
        await room.localParticipant.setMicrophoneEnabled(true);

        setState('listening');

        // Start elapsed time timer
        timerRef.current = setInterval(() => {
          setElapsedSeconds((prev) => prev + 1);
        }, 1000);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to start voice session';

        // Handle quota exceeded
        if (message.includes('DAILY_VOICE_LIMIT_REACHED') || message.includes('daily voice practice limit')) {
          setError('You\'ve reached your daily voice practice limit. Upgrade your plan for more minutes.');
        } else {
          setError(message);
        }

        setState('error');
      }
    },
    [user?.id, profile]
  );

  const endSession = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Disconnect from LiveKit room
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }

    setState('ended');

    // Update voice session in database
    if (sessionIdRef.current && user?.id) {
      const durationSeconds = elapsedSeconds;
      const durationMinutes = Math.ceil(durationSeconds / 60);

      try {
        await updateVoiceSession(sessionIdRef.current, {
          durationSeconds,
          transcript,
          corrections,
          vocabulary,
          xpEarned,
          endedAt: new Date().toISOString(),
        });

        // Increment daily voice usage
        await incrementDailyUsage(user.id, {
          voiceMinutesDelta: durationMinutes,
        });
      } catch {
        // Non-critical — session data may be incomplete but don't block the user
      }
    }
  }, [user?.id, elapsedSeconds, transcript, corrections, vocabulary, xpEarned]);

  return {
    state,
    elapsedSeconds,
    remainingMinutes,
    transcript,
    corrections,
    vocabulary,
    xpEarned,
    error,
    startSession,
    endSession,
  };
}
