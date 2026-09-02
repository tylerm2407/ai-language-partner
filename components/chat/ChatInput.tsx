import { useState, useRef, useEffect, useCallback } from 'react';
import { View, TextInput, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { File } from 'expo-file-system/next';
import { colors, spacing } from '../../config/theme';
import { setAudioSessionMode, recordingModeFor } from '../../lib/audio-session';
import { chatVadForLevel, createVadState, feedVadSample, type VadState } from '../../lib/vad';
import { LiveComposer } from './LiveComposer';
import type { VoiceGender } from '../../lib/voice-preference';
import { CHAT_MIN_CONFIDENCE, sttConfidence } from '../../lib/handsfree-grading';
import type { Transcription } from '../../lib/ai';

export type HandsFreeState = 'IDLE' | 'CONNECTING' | 'LISTENING' | 'PROCESSING' | 'AI_RESPONDING' | 'TTS_PLAYING';

interface ChatInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  sending: boolean;
  voiceMode?: boolean;
  /** `spokenLanguage` is what Whisper detected, which may differ from the
   *  target language when the learner code-switches. `confidence` is
   *  `sttConfidence` for the turn, 0-1 — the server uses it to decide whether
   *  the turn is clear enough to measure and how well it came across. */
  onVoiceMessage?: (
    text: string,
    spokenLanguage: string | null,
    turn: { confidence: number; durationSeconds: number },
  ) => void;
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
  /**
   * Gate run before the microphone is touched. Resolve false to abort silently
   * — used for the third-party AI consent sheet, which must appear before the
   * OS permission prompt rather than after it.
   */
  onBeforeRecord?: () => Promise<boolean>;
  /**
   * Cut the tutor off mid-sentence and hand the turn straight back.
   *
   * The microphone is closed while the tutor is speaking — expo-av gives no
   * echo cancellation, so a live mic during playback would hear the tutor and
   * interrupt itself, and lib/audio-session.ts documents what mixing record and
   * play has cost this app before. A tap is the safe form of barge-in: the
   * learner gets to stop a reply they have already understood without waiting
   * it out, which is the thing that actually makes a conversation feel like one.
   */
  onInterruptPlayback?: () => void;
  /** The learner's CEFR band. Sets how long the endpointer waits before
   *  deciding a turn is over — a beginner assembling a clause pauses far
   *  longer than an advanced speaker. See `chatVadForLevel`. */
  cefrLevel?: string | null;
}

// Endpointing now comes from lib/vad.ts, which calibrates a noise floor from
// the first fraction of a second and thresholds against THAT, rather than
// against a fixed level. The constants this replaced were
// `SILENCE_THRESHOLD_DB = -35` and `SILENCE_DURATION_MS = 1500`, and they had
// two failure modes: in a car or a cafe the ambient level sits permanently
// above -35 dB, so the silence timer was cleared on every sample and the turn
// never ended; and there was no maximum listen window to catch it. The wait
// itself is now a function of the learner's level — see chatVadForLevel.
const METERING_INTERVAL_MS = 200;

/** Read an audio file as base64 string. */
async function readAudioAsBase64(uri: string): Promise<string> {
  const file = new File(uri);
  const base64 = await file.base64();
  return base64;
}

/**
 * Did Whisper actually hear the learner?
 *
 * A turn below the floor is re-asked instead of sent. Guessing is the worse
 * failure: the tutor answers a sentence the learner never said, and the
 * correction banner then explains a "mistake" invented by the recognizer.
 * Whisper reports no confidence at all on some payloads, in which case
 * `sttConfidence` returns a neutral value and the turn goes through — the
 * behaviour before the signal existed.
 */
function turnConfidence(transcribed: Transcription, speechDurationMs: number): number {
  return sttConfidence({
    noSpeechProb: transcribed.noSpeechProb,
    avgLogprob: transcribed.avgLogprob,
    transcript: transcribed.text,
    speechDurationMs,
  });
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
  onBeforeRecord,
  onInterruptPlayback,
  cefrLevel,
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

  // Hands-free endpointing state. One VAD state machine per turn, created at
  // the moment recording starts and discarded when it stops.
  const vadStateRef = useRef<VadState | null>(null);
  const isStoppingRef = useRef(false);

  // Serialize recording lifecycle: prevents concurrent starts (the two
  // hands-free useEffects can both fire on mount) and makes sure any in-flight
  // unload completes before the next createAsync — expo-av only allows one
  // Recording object prepared at a time and will throw otherwise.
  const isStartingRef = useRef(false);
  const unloadPromiseRef = useRef<Promise<void> | null>(null);

  /** Discard this turn's endpointer. Cheap, and idempotent — a stale VAD state
   *  left alive would keep judging samples from the next turn against the last
   *  turn's noise floor. */
  const clearVadState = useCallback(() => {
    vadStateRef.current = null;
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

      // Third-party AI consent comes BEFORE the OS permission prompt: Google's
      // prominent-disclosure rule requires the disclosure immediately before
      // the request, and Apple 5.1.2(i) wants explicit permission before audio
      // leaves the device for OpenAI. Declining stops here — text chat is
      // unaffected, which 5.1.1(ii) requires.
      if (onBeforeRecord && !(await onBeforeRecord())) return;

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
      clearVadState();

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
        // One shared endpointer, driven by elapsed time rather than a timer.
        // `feedVadSample` owns the whole decision — calibrate a noise floor,
        // threshold against it, and report why the turn ended — and it is the
        // same tested state machine the hands-free review session runs.
        vadStateRef.current = createVadState(chatVadForLevel(cefrLevel));
        const startedAt = Date.now();
        recording.setOnRecordingStatusUpdate((status) => {
          if (!status.isRecording || isStoppingRef.current) return;
          const metering = status.metering ?? -160;
          setMeterLevel(Math.max(0, Math.min(1, (metering + 60) / 60)));

          const vad = vadStateRef.current;
          if (!vad) return;
          // The state is immutable — the next one must be stored, or every
          // sample would be judged against a state that never advanced past
          // calibration.
          const { state: nextVad, decision } = feedVadSample(
            vad,
            Date.now() - startedAt,
            metering,
          );
          vadStateRef.current = nextVad;
          if (decision.kind === 'stop') {
            // `no_speech` and `too_short` mean nothing worth sending was
            // captured. stopHandsFreeRecording already treats an empty or
            // unclear transcript as "listen again", so both funnel through the
            // same path rather than needing their own.
            stopHandsFreeRecording();
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
    clearVadState();

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
          const durationMs = (transcribed.durationSeconds ?? 0) * 1000;
          const confidence = turnConfidence(transcribed, durationMs);
          if (transcribed.text.trim() && confidence >= CHAT_MIN_CONFIDENCE) {
            onVoiceMessage(transcribed.text.trim(), transcribed.language, {
              confidence,
              durationSeconds: transcribed.durationSeconds ?? 0,
            });
          } else {
            // Nothing heard, or nothing heard *clearly*. Both restart the loop
            // rather than sending: a low-confidence turn reaching the tutor
            // produces a reply to a sentence the learner never said.
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
          const durationMs = (transcribed.durationSeconds ?? 0) * 1000;
          const confidence = turnConfidence(transcribed, durationMs);
          if (!transcribed.text.trim()) {
            setTooShortMessage("I didn't catch that — try again?");
            setTimeout(() => setTooShortMessage(null), 2500);
          } else if (confidence < CHAT_MIN_CONFIDENCE) {
            // Heard something, but not well enough to answer. Saying so beats
            // sending it: the alternative is a tutor reply to a misheard
            // sentence, plus a grammar correction for a word never spoken.
            setTooShortMessage("I didn't quite catch that — once more?");
            setTimeout(() => setTooShortMessage(null), 2500);
          } else {
            onVoiceMessage(transcribed.text.trim(), transcribed.language, {
              confidence,
              durationSeconds: transcribed.durationSeconds ?? 0,
            });
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
      clearVadState();
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
        case 'TTS_PLAYING': return onInterruptPlayback ? 'Speaking… tap to jump in' : 'Speaking...';
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
        micAccessibilityLabel={
          handsFreeState === 'TTS_PLAYING' && onInterruptPlayback
            ? 'Tap to interrupt and speak'
            : `Live voice: ${statusText}`
        }
        // Only while the tutor is speaking. In every other state the loop owns
        // the mic, and a tap would race it.
        onMicPress={
          handsFreeState === 'TTS_PLAYING' && onInterruptPlayback
            ? onInterruptPlayback
            : undefined
        }
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
        // The learner is typing the language they are LEARNING, on a keyboard
        // set to the language they already speak. iOS then "corrects" their
        // attempt into English: typing "Quisiera el menu" produces "Whiskers
        // el menu", which is then sent to the tutor and corrected as the
        // learner's own error. They get marked wrong for a word they spelled
        // right, and the correction teaches them nothing.
        //
        // Autocorrect has to be off for the same reason a spellchecker is off
        // in a spelling test: the input IS the thing being assessed.
        autoCorrect={false}
        spellCheck={false}
        autoCapitalize="sentences"
        accessibilityLabel="Message input"
        accessibilityHint="Type a message to send"
      />
      <Pressable
        className={`w-11 h-11 rounded-[22px] items-center justify-center bg-primary ${value.trim() ? '' : 'opacity-60'}`}
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
