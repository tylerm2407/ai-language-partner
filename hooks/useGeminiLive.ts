import { useState, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import { GeminiLiveSession, GeminiLiveState, GeminiLiveConfig } from '../lib/gemini-live';
import { supabase } from '../lib/supabase';
import type { LanguageCode, ProficiencyLevel } from '../types';

export interface UseGeminiLiveOptions {
  targetLanguage: LanguageCode;
  level: ProficiencyLevel;
  topic?: string;
  onTranscript?: (userText: string, aiText: string) => void;
  onError?: (error: Error) => void;
}

export function useGeminiLive(options: UseGeminiLiveOptions) {
  const { targetLanguage, level, topic = '', onTranscript, onError } = options;

  const [state, setState] = useState<GeminiLiveState>('DISCONNECTED');
  const [remainingMinutes, setRemainingMinutes] = useState<number>(0);
  const [isConnecting, setIsConnecting] = useState(false);
  const sessionRef = useRef<GeminiLiveSession | null>(null);
  const soundQueueRef = useRef<Audio.Sound[]>([]);

  const buildSystemPrompt = useCallback((): string => {
    const levelDescriptions: Record<string, string> = {
      beginner: 'Use very simple vocabulary and short sentences. Speak slowly and clearly.',
      elementary: 'Use basic vocabulary and simple grammar. Keep sentences short.',
      intermediate: 'Use natural conversational language. Introduce some complex grammar.',
      upper_intermediate: 'Use rich vocabulary and complex sentences. Be natural.',
      advanced: 'Speak as a native would. Use idioms and complex structures.',
    };

    const levelGuide = levelDescriptions[level] ?? levelDescriptions.beginner;
    const topicGuide = topic ? `\nSCENARIO CONTEXT: ${topic}` : '';

    return `You are a warm, fun language practice partner helping a student practice ${targetLanguage}. You're like a friend who happens to speak the language natively.

PROFICIENCY LEVEL: ${level}
${levelGuide}
${topicGuide}

CONVERSATION STYLE:
- Respond primarily in ${targetLanguage}
- Keep responses concise (1-3 sentences)
- Ask ONE follow-up question per turn
- If the student makes an error, naturally recast (rephrase correctly) in your reply
- If the student speaks in English, gently encourage them to try in ${targetLanguage}
- Speak at an appropriate speed for a ${level} learner
- Be encouraging without being over-the-top

SAFETY:
- Stay on topic. Do not discuss anything inappropriate.
- Never generate harmful or offensive content.`;
  }, [targetLanguage, level, topic]);

  /**
   * Start a Gemini Live voice session.
   * Fetches a session token from the edge function, then connects.
   */
  const startSession = useCallback(async () => {
    if (isConnecting || state !== 'DISCONNECTED') return;
    setIsConnecting(true);

    try {
      // Get session token from edge function
      const { data, error } = await supabase.functions.invoke('voice-session-token', {
        body: { targetLanguage, level, topic },
      });

      if (error) throw new Error(`Voice session error: ${error.message}`);

      const { remainingMinutes: remaining, voiceConfig } = data as {
        remainingMinutes: number;
        voiceConfig: GeminiLiveConfig;
      };

      setRemainingMinutes(remaining);

      // Build the proxy WebSocket URL (API key stays on server)
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('No auth session');

      const proxyUrl = `${supabaseUrl.replace('https://', 'wss://')}/functions/v1/voice-proxy?token=${encodeURIComponent(accessToken)}`;

      // Configure audio for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      // Create and connect session via server-side proxy
      const session = new GeminiLiveSession();
      sessionRef.current = session;

      session.connect(
        proxyUrl,
        voiceConfig,
        buildSystemPrompt(),
        remaining,
        {
          onStateChange: (newState) => {
            setState(newState);
          },
          onAudioChunk: async (base64Audio) => {
            // Play audio chunk
            try {
              const dataUri = `data:audio/pcm;base64,${base64Audio}`;
              const { sound } = await Audio.Sound.createAsync({ uri: dataUri });
              soundQueueRef.current.push(sound);
              await sound.playAsync();
              sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                  sound.unloadAsync();
                  soundQueueRef.current = soundQueueRef.current.filter((s) => s !== sound);
                }
              });
            } catch (err) {
              console.error('[useGeminiLive] Audio playback error:', err);
            }
          },
          onTranscript: (userText, aiText) => {
            onTranscript?.(userText, aiText);
            // Update remaining minutes
            if (sessionRef.current) {
              setRemainingMinutes(sessionRef.current.getRemainingMinutes());
            }
          },
          onTurnComplete: () => {
            // Transcript already handled
          },
          onError: (err) => {
            console.error('[useGeminiLive] Session error:', err);
            onError?.(err);
          },
        }
      );
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[useGeminiLive] Failed to start session:', error);
      onError?.(error);
      setState('DISCONNECTED');
    } finally {
      setIsConnecting(false);
    }
  }, [isConnecting, state, targetLanguage, level, topic, buildSystemPrompt, onTranscript, onError]);

  /**
   * End the voice session and report usage.
   */
  const endSession = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;

    const elapsedMinutes = session.getElapsedMinutes();
    session.disconnect();
    sessionRef.current = null;
    setState('DISCONNECTED');

    // Clean up any playing sounds
    for (const sound of soundQueueRef.current) {
      try { await sound.unloadAsync(); } catch { /* ignore */ }
    }
    soundQueueRef.current = [];

    // Report usage to backend
    if (elapsedMinutes > 0.1) {
      try {
        const { data } = await supabase.functions.invoke('voice-session-end', {
          body: { durationMinutes: elapsedMinutes },
        });
        if (data?.remainingMinutes !== undefined) {
          setRemainingMinutes(
            typeof data.remainingMinutes === 'number' ? data.remainingMinutes : 60
          );
        }
      } catch (err) {
        console.error('[useGeminiLive] Failed to report usage:', err);
      }
    }
  }, []);

  /**
   * Send audio data to the active session.
   */
  const sendAudio = useCallback((pcmBase64: string) => {
    sessionRef.current?.sendAudio(pcmBase64);
  }, []);

  /**
   * Send text to the active session (fallback).
   */
  const sendText = useCallback((text: string) => {
    sessionRef.current?.sendText(text);
  }, []);

  return {
    state,
    isConnecting,
    remainingMinutes,
    startSession,
    endSession,
    sendAudio,
    sendText,
  };
}
