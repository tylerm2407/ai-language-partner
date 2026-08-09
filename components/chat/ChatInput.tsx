import { useState, useRef, useEffect, useCallback } from 'react';
import { View, TextInput, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { File } from 'expo-file-system/next';
import { colors, spacing } from '../../config/theme';
import { setAudioSessionMode, recordingModeFor } from '../../lib/audio-session';
import { LiveComposer } from './LiveComposer';
import type { VoiceGender } from '../../lib/voice-preference';

export type HandsFreeState = 'IDLE' | 'CONNECTING' | 'LISTENING' | 'PROCESSING' | 'AI_RESPONDING' | 'TTS_PLAYING';

interface ChatInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  sending: boolean;
  voiceMode?: boolean;
  /** `spokenLanguage` is what Whisper detected, which may differ from the
   *  target language when the learner code-switches. */
  onVoiceMessage?: (text: string, spokenLanguage: string | null) => void;
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
  /** Tutor voice preference — surfaced as a switch in the hands-free composer. */
  voiceGender?: VoiceGender;
  onVoiceGenderChange?: (gender: VoiceGender) => void;
}

const SILENCE_THRESHOLD_DB = -35;
const SILENCE_DURATION_MS = 1500;
const METERING_INTERVAL_MS = 200;

/** Read an audio file as base64 string. */
async function readAudioAsBase64(uri: string): Promise<string> {
  const file = new File(uri);
  const base64 = await file.base64();
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
  voiceGender,
  onVoiceGenderChange,
}: ChatInputProps) {
  const insets = useSafeAreaInsets();
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showTextFallback, setShowTextFallback] = useState(false);
  const [tooShortMessage, setTooShortMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [meterLevel, setMeterLevel] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingStartTimeRef = useRef<number>(0);

  // Hands-free silence detection state
  const hasDetectedSpeechRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isStoppingRef = useRef(false);

  // Serialize recording lifecycle: prevents concurrent starts (the two
  // hands-free useEffects can both fire on mount) and makes sure any in-flight
  // unload completes before the next createAsync — expo-av only allows one
  // Recording object prepared at a time and will throw otherwise.
  const isStartingRef = useRef(false);
  const unloadPromiseRef = useRef<Promise<void> | null>(null);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  /** Start recording with optional metering for silence detection. */
  const startRecording = async (withSilenceDetection = false) => {
    if (isStoppingRef.current || isStartingRef.current) return;
    // If a prior recording is already alive, don't stack another one on top.
    if (recordingRef.current) return;
    isStartingRef.current = true;
    try {
      // Wait for any fire-and-forget unload from a previous cycle/unmount.
      if (unloadPromiseRef.current) {
        try { await unloadPromiseRef.current; } catch { /* ignore */ }
        unloadPromiseRef.current = null;
      }

      // Belt-and-suspenders: stop+unload any stale recording we still hold.
      if (recordingRef.current) {
        const stale: Audio.Recording = recordingRef.current;
        recordingRef.current = null;
        try {
          await stale.stopAndUnloadAsync();
        } catch {
          // Already stopped/unloaded — safe to ignore
        }
      }

      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) return;

      await setAudioSessionMode(recordingModeFor(withSilenceDetection));

      const recordingOptions = {
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      };

      const { recording } = await Audio.Recording.createAsync(recordingOptions);
      recordingRef.current = recording;
      recordingStartTimeRef.current = Date.now();
      setIsRecording(true);
      hasDetectedSpeechRef.current = false;
      clearSilenceTimer();

      // Always set up metering display
      recording.setProgressUpdateInterval(METERING_INTERVAL_MS);
      if (!withSilenceDetection) {
        recording.setOnRecordingStatusUpdate((status) => {
          if (!status.isRecording) return;
          const metering = status.metering ?? -160;
          // Normalize from dB (-160 to 0) to 0-1 range
          const normalized = Math.max(0, Math.min(1, (metering + 60) / 60));
          setMeterLevel(normalized);
        });
      }

      if (withSilenceDetection) {
        onHandsFreeStateChange?.('LISTENING');
        recording.setOnRecordingStatusUpdate((status) => {
          if (!status.isRecording || isStoppingRef.current) return;
          const metering = status.metering ?? -160;
          const normalized = Math.max(0, Math.min(1, (metering + 60) / 60));
          setMeterLevel(normalized);

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
      // Tear down any half-created native recording so the next start works.
      if (recordingRef.current) {
        const failed: Audio.Recording = recordingRef.current;
        recordingRef.current = null;
        try { await failed.stopAndUnloadAsync(); } catch { /* ignore */ }
      }
      // Never leave the session in a recording mode after a failed start —
      // on iOS that keeps the mic held and routes playback to the earpiece.
      await setAudioSessionMode('idle');
    } finally {
      isStartingRef.current = false;
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

      await setAudioSessionMode('handsfree-play');

      if (uri && onVoiceMessage) {
        setIsTranscribing(true);
        try {
          const base64Audio = await readAudioAsBase64(uri);
          const { transcribeAudio } = await import('../../lib/ai');
          const transcribed = await transcribeAudio(base64Audio, targetLanguage);
          if (transcribed.text.trim()) {
            onVoiceMessage(transcribed.text.trim(), transcribed.language);
          } else {
            // No speech detected, restart listening
            onHandsFreeStateChange?.('LISTENING');
            isStoppingRef.current = false;
            startRecording(true);
            return;
          }
        } catch (err) {
          console.error('Hands-free transcription failed:', err);
          const { VoiceError } = await import('../../lib/ai');
          const msg = err instanceof VoiceError
            ? err.code === 'DAILY_LIMIT'
              ? "Daily voice limit reached"
              : 'Voice temporarily unavailable'
            : "Couldn't catch that — listening again...";
          setErrorMessage(msg);
          setTimeout(() => setErrorMessage(null), 3000);
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
      // The stop threw, so the mode change above may never have run. Release
      // the mic; the next startRecording re-enters handsfree-record.
      await setAudioSessionMode('handsfree-play');
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

      await setAudioSessionMode('playback');

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
          if (transcribed.text.trim()) {
            onVoiceMessage(transcribed.text.trim(), transcribed.language);
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
      await setAudioSessionMode('idle');
    }
  };

  // Auto-start listening when parent signals (e.g. after TTS finishes)
  useEffect(() => {
    if (handsFreeMode && shouldStartListening && !isRecording && !isStoppingRef.current) {
      onListeningStarted?.();
      startRecording(true);
    }
  }, [handsFreeMode, shouldStartListening]);

  // Start listening when hands-free mode is first activated.
  useEffect(() => {
    if (handsFreeMode && handsFreeState === 'IDLE' && !isRecording && !sending) {
      startRecording(true);
    }
    // Always tear down on unmount / deps change — a leaked native Recording
    // will block the next createAsync with "Only one Recording...".
    return () => {
      clearSilenceTimer();
      if (recordingRef.current) {
        const toUnload: Audio.Recording = recordingRef.current;
        recordingRef.current = null;
        // Record the unload promise so the next startRecording awaits it.
        unloadPromiseRef.current = toUnload
          .stopAndUnloadAsync()
          .catch(() => { /* ignore */ })
          .then(() => { /* normalize to Promise<void> */ });
        // We were holding the mic when this unmounted — hand the session back.
        setAudioSessionMode('idle').catch(() => { /* logged inside */ });
      }
      setIsRecording(false);
      isStoppingRef.current = false;
    };
  }, [handsFreeMode]);

  // Hands-free mode UI
  if (handsFreeMode) {
    const statusText = (() => {
      switch (handsFreeState) {
        case 'CONNECTING': return 'Connecting...';
        case 'LISTENING': return isRecording ? 'Listening...' : 'Starting...';
        case 'PROCESSING': return 'Transcribing...';
        case 'AI_RESPONDING': return 'Thinking...';
        case 'TTS_PLAYING': return 'Speaking...';
        default: return 'Starting...';
      }
    })();

    const statusColor = (() => {
      switch (handsFreeState) {
        case 'CONNECTING': return colors.warning.light;
        case 'LISTENING': return colors.success.base;
        case 'PROCESSING': return colors.warning.light;
        case 'AI_RESPONDING': return colors.league.diamond;
        case 'TTS_PLAYING': return colors.league.diamond;
        default: return colors.text.tertiary;
      }
    })();

    // No keypad affordance here: exiting live is the header's "Live" toggle, and
    // ChatInput has no callback to end the hands-free loop from inside.
    return (
      <LiveComposer
        meterLevel={meterLevel}
        live={handsFreeState === 'LISTENING' && isRecording}
        micIcon={
          handsFreeState === 'LISTENING'
            ? 'mic'
            : handsFreeState === 'TTS_PLAYING'
              ? 'volume-high'
              : 'ellipsis-horizontal'
        }
        micColor={handsFreeState === 'LISTENING' ? colors.success.base : colors.action.primaryFill}
        micAccessibilityLabel={`Live voice: ${statusText}`}
        statusText={statusText}
        statusColor={statusColor}
        errorMessage={errorMessage}
        bottomPadding={spacing.lg + insets.bottom + 60}
        voiceGender={voiceGender}
        onVoiceGenderChange={onVoiceGenderChange}
      />
    );
  }

  // Voice mode UI (hold-to-talk) — same composer card, press-and-hold mic.
  if (voiceMode && !showTextFallback) {
    return (
      <LiveComposer
        meterLevel={meterLevel}
        live={isRecording}
        micIcon={isRecording ? 'mic' : 'mic-outline'}
        micColor={isRecording ? colors.success.base : colors.action.primaryFill}
        micAccessibilityLabel={isRecording ? 'Release to stop recording' : 'Hold to record'}
        statusText={
          tooShortMessage ??
          (isTranscribing ? 'Transcribing…' : isRecording ? 'Listening…' : 'Hold to talk')
        }
        statusColor={
          tooShortMessage
            ? colors.warning.light
            : isRecording
              ? colors.success.base
              : colors.text.secondary
        }
        busy={sending}
        onMicPressIn={() => startRecording(false)}
        onMicPressOut={stopRecording}
        onKeypad={() => setShowTextFallback(true)}
        bottomPadding={spacing.md + insets.bottom + 60}
      />
    );
  }

  // Text mode UI (also used as fallback in voice mode)
  return (
    <View className="flex-row items-end px-4 py-3 border-t border-dark-border bg-dark" style={{ paddingBottom: 12 + insets.bottom + 60 }}>
      {/* Show mic icon to switch back to voice mode if in voice fallback */}
      {voiceMode && showTextFallback && (
        <Pressable
          onPress={() => setShowTextFallback(false)}
          accessibilityRole="button"
          accessibilityLabel="Switch to voice mode"
          className="w-11 h-11 items-center justify-center mr-2"
        >
          <Ionicons name="mic-outline" size={22} color={colors.correctionChip.grammar.text} />
        </Pressable>
      )}

      <TextInput
        className="flex-1 border-2 border-dark-border bg-dark-card-alt rounded-[14px] px-4 py-3 text-base text-text-primary mr-3 max-h-24 font-sans"
        placeholder="Type your message..."
        placeholderTextColor={colors.text.quaternary}
        value={value}
        onChangeText={onChangeText}
        multiline
        accessibilityLabel="Message input"
        accessibilityHint="Type a message to send"
      />
      <Pressable
        className={`w-11 h-11 rounded-[22px] items-center justify-center ${value.trim() ? 'bg-primary' : 'bg-primary-light'}`}
        onPress={() => onSend()}
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
