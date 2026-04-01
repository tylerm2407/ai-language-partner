import { useState, useRef, useEffect, useCallback } from 'react';
import { View, TextInput, Pressable, ActivityIndicator, Text, Alert, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { File } from 'expo-file-system/next';

export type HandsFreeState = 'IDLE' | 'CONNECTING' | 'LISTENING' | 'PROCESSING' | 'AI_RESPONDING' | 'TTS_PLAYING';

interface ChatInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  sending: boolean;
  voiceMode?: boolean;
  onVoiceMessage?: (text: string) => void;
  targetLanguage?: string;
  /** When true, enables continuous hands-free conversation loop. */
  handsFreeMode?: boolean;
  /** Current state of the hands-free loop, controlled by parent. */
  handsFreeState?: HandsFreeState;
  /** Callback when hands-free state changes from within this component. */
  onHandsFreeStateChange?: (state: HandsFreeState) => void;
  /** Signal from parent to start listening (e.g. after TTS finishes). */
  shouldStartListening?: boolean;
  /** Acknowledge that listening has started so parent can reset the signal. */
  onListeningStarted?: () => void;
  /** When true, Gemini Live handles all audio — ChatInput is display-only in hands-free mode. */
  geminiLiveActive?: boolean;
}

const SILENCE_THRESHOLD_DB = -35;
const SILENCE_DURATION_MS = 1500;
const METERING_INTERVAL_MS = 200;

/** Read an audio file as base64 string. */
async function readAudioAsBase64(uri: string): Promise<string> {
  const file = new File(uri);
  const base64 = file.base64();
  return base64;
}

export function ChatInput({
  value,
  onChangeText,
  onSend,
  sending,
  voiceMode = false,
  onVoiceMessage,
  targetLanguage = 'en',
  handsFreeMode = false,
  handsFreeState = 'IDLE',
  onHandsFreeStateChange,
  shouldStartListening = false,
  onListeningStarted,
  geminiLiveActive = false,
}: ChatInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showTextFallback, setShowTextFallback] = useState(false);
  const [tooShortMessage, setTooShortMessage] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingStartTimeRef = useRef<number>(0);

  // Hands-free silence detection state
  const hasDetectedSpeechRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isStoppingRef = useRef(false);

  // Pulsing animation for hands-free listening indicator
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (handsFreeMode && handsFreeState === 'LISTENING' && isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [handsFreeMode, handsFreeState, isRecording, pulseAnim]);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  /** Start recording with optional metering for silence detection. */
  const startRecording = async (withSilenceDetection = false) => {
    if (isStoppingRef.current) return;
    try {
      // Clean up any stale recording before creating a new one
      // expo-av only allows one Recording prepared at a time
      if (recordingRef.current) {
        try {
          await recordingRef.current.stopAndUnloadAsync();
        } catch {
          // Already stopped/unloaded — safe to ignore
        }
        recordingRef.current = null;
      }

      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: withSilenceDetection,
      });

      const recordingOptions = {
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: withSilenceDetection,
      };

      const { recording } = await Audio.Recording.createAsync(recordingOptions);
      recordingRef.current = recording;
      recordingStartTimeRef.current = Date.now();
      setIsRecording(true);
      hasDetectedSpeechRef.current = false;
      clearSilenceTimer();

      if (withSilenceDetection) {
        onHandsFreeStateChange?.('LISTENING');
        recording.setProgressUpdateInterval(METERING_INTERVAL_MS);
        recording.setOnRecordingStatusUpdate((status) => {
          if (!status.isRecording || isStoppingRef.current) return;
          const metering = status.metering ?? -160;

          if (metering > SILENCE_THRESHOLD_DB) {
            // Speech detected
            hasDetectedSpeechRef.current = true;
            clearSilenceTimer();
          } else if (hasDetectedSpeechRef.current) {
            // Silence after speech -- start the silence countdown
            if (!silenceTimerRef.current) {
              silenceTimerRef.current = setTimeout(() => {
                stopHandsFreeRecording();
              }, SILENCE_DURATION_MS);
            }
          }
        });
      }
    } catch (err) {
      console.error('Failed to start recording:', err);
      setIsRecording(false);
    }
  };

  /** Stop recording in hands-free mode: transcribe and auto-send. */
  const stopHandsFreeRecording = async () => {
    if (isStoppingRef.current || !recordingRef.current) return;
    isStoppingRef.current = true;
    clearSilenceTimer();

    try {
      setIsRecording(false);
      onHandsFreeStateChange?.('PROCESSING');

      const rec = recordingRef.current;
      recordingRef.current = null;
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      if (uri && onVoiceMessage) {
        setIsTranscribing(true);
        try {
          const base64Audio = await readAudioAsBase64(uri);
          const { transcribeAudio } = await import('../../lib/ai');
          const transcribed = await transcribeAudio(base64Audio, targetLanguage);
          if (transcribed.trim()) {
            onVoiceMessage(transcribed.trim());
          } else {
            // No speech detected, restart listening
            onHandsFreeStateChange?.('LISTENING');
            isStoppingRef.current = false;
            startRecording(true);
            return;
          }
        } catch (err) {
          console.error('Hands-free transcription failed:', err);
          // On error, restart listening instead of breaking the loop
          onHandsFreeStateChange?.('LISTENING');
          isStoppingRef.current = false;
          startRecording(true);
          return;
        } finally {
          setIsTranscribing(false);
        }
      }
    } catch (err) {
      console.error('Failed to stop hands-free recording:', err);
      onHandsFreeStateChange?.('LISTENING');
    }
    isStoppingRef.current = false;
  };

  /** Standard hold-to-talk stop recording. */
  const stopRecording = async () => {
    if (!recordingRef.current) return;

    try {
      setIsRecording(false);
      const rec = recordingRef.current;
      recordingRef.current = null; // Null ref BEFORE async work to prevent races
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      // Check minimum recording duration to avoid Whisper errors on quick taps
      const recordingDuration = Date.now() - recordingStartTimeRef.current;
      if (recordingDuration < 500) {
        setTooShortMessage('Hold the mic a bit longer');
        setTimeout(() => setTooShortMessage(null), 2000);
        return;
      }

      if (uri && onVoiceMessage) {
        setIsTranscribing(true);
        try {
          const base64Audio = await readAudioAsBase64(uri);
          const { transcribeAudio } = await import('../../lib/ai');
          const transcribed = await transcribeAudio(base64Audio, targetLanguage);
          if (transcribed.trim()) {
            onVoiceMessage(transcribed.trim());
          }
        } catch (err) {
          console.error('Transcription failed:', err);
          const { VoiceError } = await import('../../lib/ai');
          const message = err instanceof VoiceError
            ? err.code === 'DAILY_LIMIT'
              ? "You've reached your daily voice limit. Upgrade your plan for more."
              : err.code === 'NOT_CONFIGURED'
                ? 'Voice features are not yet configured. Please try again later.'
                : "I couldn't catch that. Try holding the mic button longer while speaking."
            : "I couldn't catch that. Try holding the mic button longer while speaking.";
          Alert.alert('Voice', message, [{ text: 'OK' }]);
        } finally {
          setIsTranscribing(false);
        }
      }
    } catch (err) {
      console.error('Failed to stop recording:', err);
    }
  };

  // Auto-start listening when parent signals (e.g. after TTS finishes)
  // Skip when Gemini Live is active — it handles audio internally.
  useEffect(() => {
    if (geminiLiveActive) return;
    if (handsFreeMode && shouldStartListening && !isRecording && !isStoppingRef.current) {
      onListeningStarted?.();
      startRecording(true);
    }
  }, [handsFreeMode, shouldStartListening, geminiLiveActive]);

  // Start listening when hands-free mode is first activated (legacy path)
  // Skip when Gemini Live is active — parent manages the session.
  useEffect(() => {
    if (geminiLiveActive) return;
    if (handsFreeMode && handsFreeState === 'IDLE' && !isRecording && !sending) {
      startRecording(true);
    }
    // Cleanup on unmount or mode deactivation
    return () => {
      clearSilenceTimer();
      if (!handsFreeMode && recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
        setIsRecording(false);
        isStoppingRef.current = false;
      }
    };
  }, [handsFreeMode, geminiLiveActive]);

  // Hands-free mode UI
  if (handsFreeMode) {
    const statusText = (() => {
      switch (handsFreeState) {
        case 'CONNECTING': return 'Connecting...';
        case 'LISTENING': return geminiLiveActive ? 'Listening...' : (isRecording ? 'Listening...' : 'Starting...');
        case 'PROCESSING': return 'Transcribing...';
        case 'AI_RESPONDING': return geminiLiveActive ? 'Speaking...' : 'Thinking...';
        case 'TTS_PLAYING': return 'Speaking...';
        default: return geminiLiveActive ? 'Connecting...' : 'Starting...';
      }
    })();

    const statusColor = (() => {
      switch (handsFreeState) {
        case 'CONNECTING': return '#FBBF24';
        case 'LISTENING': return '#34D399';
        case 'PROCESSING': return '#FBBF24';
        case 'AI_RESPONDING': return '#38BDF8';
        case 'TTS_PLAYING': return '#38BDF8';
        default: return '#94A3B8';
      }
    })();

    return (
      <View className="items-center px-4 py-6 border-t border-dark-border bg-dark">
        {/* Pulsing mic indicator */}
        <Animated.View
          style={{ transform: [{ scale: pulseAnim }] }}
          className={`w-20 h-20 rounded-full items-center justify-center ${
            handsFreeState === 'LISTENING' && isRecording ? 'bg-success' : 'bg-dark-card'
          }`}
        >
          <Ionicons
            name={handsFreeState === 'LISTENING' ? 'mic' : handsFreeState === 'TTS_PLAYING' ? 'volume-high' : 'ellipsis-horizontal'}
            size={36}
            color={statusColor}
          />
        </Animated.View>

        <Text style={{ color: statusColor }} className="text-sm font-sans-semibold mt-3">
          {statusText}
        </Text>

        <Text className="text-xs text-text-tertiary mt-1">
          {geminiLiveActive ? 'Gemini Live voice active' : 'Hands-free mode active'}
        </Text>
      </View>
    );
  }

  // Voice mode UI (hold-to-talk, unchanged)
  if (voiceMode && !showTextFallback) {
    return (
      <View className="items-center px-4 py-4 border-t border-dark-border bg-dark">
        {/* Switch to keyboard */}
        <View className="flex-row w-full justify-end mb-3">
          <Pressable
            onPress={() => setShowTextFallback(true)}
            accessibilityRole="button"
            accessibilityLabel="Switch to keyboard"
            className="w-8 h-8 rounded-full bg-dark-card items-center justify-center"
          >
            <Ionicons name="keypad-outline" size={18} color="#7DD3FC" />
          </Pressable>
        </View>

        {/* Large mic button */}
        <Pressable
          onPressIn={() => startRecording(false)}
          onPressOut={stopRecording}
          accessibilityRole="button"
          accessibilityLabel={isRecording ? 'Release to stop recording' : 'Hold to record'}
          className={`w-20 h-20 rounded-full items-center justify-center ${
            isRecording ? 'bg-error-dark' : 'bg-primary'
          }`}
          style={isRecording ? { transform: [{ scale: 1.1 }] } : undefined}
        >
          {sending ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Ionicons name={isRecording ? 'mic' : 'mic-outline'} size={36} color="white" />
          )}
        </Pressable>

        <Text className={`text-xs mt-2 ${tooShortMessage ? 'text-warning' : 'text-text-secondary'}`}>
          {tooShortMessage ?? (isTranscribing ? 'Transcribing...' : isRecording ? 'Listening...' : 'Hold to talk')}
        </Text>
      </View>
    );
  }

  // Text mode UI (also used as fallback in voice mode)
  return (
    <View className="flex-row items-end px-4 py-3 border-t border-dark-border bg-dark">
      {/* Show mic icon to switch back to voice mode if in voice fallback */}
      {voiceMode && showTextFallback && (
        <Pressable
          onPress={() => setShowTextFallback(false)}
          accessibilityRole="button"
          accessibilityLabel="Switch to voice mode"
          className="w-11 h-11 items-center justify-center mr-2"
        >
          <Ionicons name="mic-outline" size={22} color="#7DD3FC" />
        </Pressable>
      )}

      <TextInput
        className="flex-1 border-2 border-dark-border bg-dark-card-alt rounded-[14px] px-4 py-3 text-base text-text-primary mr-3 max-h-24 font-sans"
        placeholder="Type your message..."
        placeholderTextColor="#64748B"
        value={value}
        onChangeText={onChangeText}
        multiline
        accessibilityLabel="Message input"
        accessibilityHint="Type a message to send"
      />
      <Pressable
        className={`w-11 h-11 rounded-[22px] items-center justify-center ${value.trim() ? 'bg-primary' : 'bg-primary-light'}`}
        onPress={onSend}
        disabled={!value.trim() || sending}
        accessibilityRole="button"
        accessibilityLabel="Send message"
      >
        {sending ? (
          <ActivityIndicator color="white" size="small" />
        ) : (
          <Ionicons name="send" size={18} color="white" />
        )}
      </Pressable>
    </View>
  );
}
