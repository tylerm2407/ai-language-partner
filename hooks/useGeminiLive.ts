import { useState, useRef, useCallback, useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Audio } from 'expo-av';
import { GeminiLiveSession, GeminiLiveState } from '../lib/gemini-live';
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

  /**
   * Start a Gemini Live voice session.
   * 1. Checks limits via voice-session-token (HTTP)
   * 2. Connects to voice-proxy (WebSocket) which handles Gemini setup server-side
   */
  const startSession = useCallback(async () => {
    if (isConnecting || state !== 'DISCONNECTED') return;
    setIsConnecting(true);

    try {
      // Check limits via voice-session-token
      const { data, error } = await supabase.functions.invoke('voice-session-token', {
        body: { targetLanguage, level, topic },
      });

      if (error) throw new Error(`Voice session error: ${error.message}`);

      const { remainingMinutes: remaining } = data as { remainingMinutes: number };
      setRemainingMinutes(remaining);

      // Build the proxy WebSocket URL with session params
      // The proxy builds the system prompt and Gemini setup message server-side
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('No auth session');

      const params = new URLSearchParams({
        token: accessToken,
        lang: targetLanguage,
        level,
        ...(topic ? { topic } : {}),
      });
      const proxyUrl = `${supabaseUrl.replace('https://', 'wss://')}/functions/v1/voice-proxy?${params.toString()}`;

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
            if (err.message === 'SESSION_LIMIT') {
              // Auto-reconnect on Gemini's 15-min session cap
              console.log('[useGeminiLive] Session limit reached, reconnecting...');
              sessionRef.current?.disconnect();
              sessionRef.current = null;
              setState('DISCONNECTED');
              // Small delay then reconnect
              setTimeout(() => startSession(), 1000);
              return;
            }
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
  }, [isConnecting, state, targetLanguage, level, topic, onTranscript, onError]);

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

  // Auto-end session when app goes to background
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'background' && sessionRef.current) {
        endSession();
      }
    };
    const subscription = AppState.addEventListener('change', handleAppState);
    return () => subscription.remove();
  }, [endSession]);

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
