import { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, Pressable, FlatList, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeBack } from '../../../hooks/useSafeBack';
import { useAuth } from '../../../hooks/useAuth';
import { useAppStore, effectiveTier } from '../../../stores/useAppStore';
import { useOnboardingChecklist } from '../../../hooks/useOnboardingChecklist';
import { useActiveTime } from '../../../hooks/useActiveTime';
import {
  sendChatMessage,
  streamChatMessage,
  getSpeechUri,
  VoiceError,
  ChatStreamUnavailableError,
  CHAT_STREAMING_ENABLED,
  type AIChatRequest,
  type AIChatResponse,
} from '../../../lib/ai';
import { createSentenceStream } from '../../../lib/sentence-stream';
import { createSpeechQueue, type SpeechQueue } from '../../../lib/speech-queue';
import { showLimitAlert } from '../../../lib/limit-messaging';
import { CEFR_BAND_BY_LEVEL } from '../../../lib/cefr-proficiency';
import { cefrLabel, cefrAccessibilityLabel } from '../../../lib/cefr-labels';
import { ChatBubble } from '../../../components/chat/ChatBubble';
import { ScenarioPicker, scenarioIdentity } from '../../../components/chat/ScenarioPicker';
import { ChatInput } from '../../../components/chat/ChatInput';
import type { HandsFreeState } from '../../../components/chat/ChatInput';
import { TypingIndicator } from '../../../components/chat/TypingIndicator';
import AssignmentTimer from '../../../components/school/AssignmentTimer';
import { useAssignmentTimer } from '../../../hooks/useAssignmentTimer';
import type { ConversationMessage, Assignment, AssignmentSubmission, LanguageCode, ProficiencyLevel } from '../../../types';
import { Ionicons } from '@expo/vector-icons';
import { getOrCreateChatSession, listChatSessions, saveChatMessage, loadChatMessages, fetchStudentAssignments, submitAssignment, upsertDailyStats } from '../../../lib/supabase-queries';
import { getTargetLanguage } from '../../../lib/language';
import { setAudioSessionMode, playbackModeFor } from '../../../lib/audio-session';
import { saveErrorCopy } from '../../../lib/error-copy';
import {
  DEFAULT_VOICE_GENDER,
  loadVoiceGender,
  saveVoiceGender,
  type VoiceGender,
} from '../../../lib/voice-preference';
import { SCENARIO_META, SCENARIO_ORDER, type ScenarioKey } from '../../../types/scenarios';
import { SCHOOL_ENABLED, SUPPORTED_LANGUAGES } from '../../../config/app';
// `colors` is deliberately NOT imported: it is the fixed DARK palette, and a
// screen that reads it stays dark whatever the phone is set to. `radii` and
// `spacing` are plain scheme-independent numbers and carry over unchanged.
import { radii, spacing } from '../../../config/theme';
import { Body, Caption } from '../../../components/ui2/Ui2Text';
import { SlabCard } from '../../../components/ui2/SlabCard';
import { useUi2Theme } from '../../../hooks/useUi2Theme';
import { useAiConsent } from '../../../hooks/useAiConsent';
import { Chip } from '../../../components/ui2/Chip';
import { useScreenView } from '../../../hooks/useScreenView';
import { Mascot } from '../../../components/mascot/Mascot';

/**
 * The level line in the header status row.
 *
 * It used to read "Live · A2" and stop there — the argument being that the code
 * is international where "Nivel"/"Niveau"/"Livello" would need localising 12
 * ways. True, and beside the point: "A2" is not international, it is unknown.
 * The can-do line carries the meaning in one language-neutral clause, so the
 * row states what the tutor is pitching at rather than a code for it.
 */
// Was a fourth private copy of the ladder; now derived. See
// CEFR_BAND_BY_LEVEL in lib/cefr-proficiency.ts.
const CEFR_FOR_LEVEL: Record<ProficiencyLevel, string> = CEFR_BAND_BY_LEVEL;

/**
 * Scenario metadata (label/icon/description) is imported from
 * `types/scenarios.ts`. The actual Claude system prompt per built-in scenario
 * lives server-side only in `supabase/functions/_shared/scenarios.ts` — the
 * mobile app just sends the `scenarioKey` to the Edge Function.
 *
 * Teacher-authored custom scenarios don't have a server-side prompt, so they
 * carry `customContext` (a free-form system context string from the teacher)
 * which is sent as the `topic` field instead.
 */
interface Scenario {
  /** Set for built-in scenarios; null for teacher custom scenarios. */
  key: ScenarioKey | null;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
  /** Free-form context for teacher custom scenarios; empty for built-ins. */
  customContext?: string;
}

const SCENARIOS: Scenario[] = SCENARIO_ORDER.map((key) => {
  const meta = SCENARIO_META[key];
  return {
    key: meta.key,
    label: meta.label,
    icon: meta.icon,
    description: meta.description,
  };
});

/**
 * Replace a message by id, or append it if it is not in the list yet.
 *
 * A streamed reply is written into the transcript before it is finished, so the
 * same id is updated many times and then replaced one last time by the real
 * message from the `done` frame — which is the only place the correction and
 * the audio URL exist.
 */
function upsertMessage(
  list: ConversationMessage[],
  msg: ConversationMessage,
): ConversationMessage[] {
  const index = list.findIndex((m) => m.id === msg.id);
  if (index < 0) return [...list, msg];
  const next = list.slice();
  next[index] = msg;
  return next;
}

export default function ChatScreen() {
  const { c } = useUi2Theme();
  useScreenView('chat');
  const { profile } = useAppStore();
  const targetLanguage = getTargetLanguage(profile);

  // Profile not loaded yet — the target language is unknown, so don't
  // default to any language. Mirrors the assignment-loading state below.
  if (!targetLanguage) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <View className="flex-1 items-center justify-center">
          <Text style={{ color: c.muted }}>Loading...</Text>
        </View>
      </View>
    );
  }

  return <ChatSession targetLanguage={targetLanguage} />;
}

function ChatSession({ targetLanguage }: { targetLanguage: LanguageCode }) {
  const { c } = useUi2Theme();
  const { user } = useAuth();
  const { profile, subscription, entitledTier, roles } = useAppStore();
  const { markItem: markOnboardingItem } = useOnboardingChecklist();
  const { ensureConsent, consentSheet } = useAiConsent(user?.id);
  const router = useRouter();
  const goBack = useSafeBack('/(app)');
  const params = useLocalSearchParams<{ assignmentId?: string; chatSessionId?: string }>();
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);

  // Wall-clock in the conversation itself, not the scenario picker. This writes
  // `minutes_practiced` ONLY — `speaking_minutes` is already written per voice
  // turn below, from the turn's own measured duration, which is a better number
  // than a screen clock can produce; adding to it here would count the same
  // speech twice. See hooks/useActiveTime.ts for why the session is not
  // attributed to `writing_minutes` either.
  useActiveTime({ kind: 'chat', enabled: !!selectedScenario });

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  /**
   * Native-language glosses of assistant replies, keyed by message id.
   *
   * Held here rather than on ConversationMessage because it is deliberately
   * NOT persisted: `chat_messages` stores what was said, and a gloss is a
   * display aid we get free with the turn that produced it. A reloaded
   * transcript therefore has none, and ChatBubble falls back to the `translate`
   * function for those — the same path every message took before.
   */
  const [glosses, setGlosses] = useState<Record<string, string>>({});
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Assignment mode state
  const [assignmentMode, setAssignmentMode] = useState(false);
  const [currentAssignment, setCurrentAssignment] = useState<(Assignment & { submission?: AssignmentSubmission }) | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const assignmentTimer = useAssignmentTimer(currentAssignment?.minDurationMinutes ?? 15);

  // Tutor voice preference (device-local; see lib/voice-preference.ts).
  const [voiceGender, setVoiceGender] = useState<VoiceGender>(DEFAULT_VOICE_GENDER);
  useEffect(() => {
    loadVoiceGender().then(setVoiceGender).catch(() => { /* keep the default */ });
  }, []);

  // Hands-free state
  const [handsFreeActive, setHandsFreeActive] = useState(false);
  const [handsFreeState, setHandsFreeState] = useState<HandsFreeState>('IDLE');
  const [shouldStartListening, setShouldStartListening] = useState(false);

  // Live sessions run the same stopwatch assignments use, so the header chip has
  // something to show outside assignment mode. `start()` no-ops when running.
  const startTimer = assignmentTimer.start;
  useEffect(() => {
    if (handsFreeActive) startTimer();
  }, [handsFreeActive, startTimer]);

  const chatSessionIdRef = useRef<string | null>(null);
  /** Did the tutor's last turn ask the learner to fix something themselves?
   *  A ref rather than state: nothing renders from it, and it must be current
   *  when the next send fires rather than after a re-render. */
  const repairOutstandingRef = useRef(false);
  // Track the current ElevenLabs TTS sound for cleanup on error/unmount
  const ttsSoundRef = useRef<Audio.Sound | null>(null);
  /** The sentence queue speaking the current streamed reply, if any. */
  const speechQueueRef = useRef<SpeechQueue | null>(null);
  /** Settles the promise the queue is awaiting for the sentence now playing.
   *  Held so `stopSpeaking` can release it — see the comment there. */
  const playbackResolveRef = useRef<(() => void) | null>(null);

  const level = profile?.level ?? 'beginner';
  const languageName = SUPPORTED_LANGUAGES.find((l) => l.code === targetLanguage)?.name ?? targetLanguage.toUpperCase();

  // Which scenes already have a saved conversation, for the picker's
  // "picks up where you left off" line. Read-only: getOrCreateChatSession
  // would CREATE a row per scene just by looking.
  const [resumable, setResumable] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    listChatSessions(user.id, 50)
      .then((sessions) => {
        if (cancelled) return;
        setResumable(new Set(sessions.filter((sess) => sess.targetLanguage === targetLanguage).map((sess) => sess.scenarioKey)));
      })
      .catch(() => {
        // The hint is a nicety; a failed lookup just reads as new conversations.
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, targetLanguage]);

  // Load assignment data if assignmentId param present (school feature)
  useEffect(() => {
    if (SCHOOL_ENABLED && params.assignmentId && user?.id) {
      loadAssignmentData(params.assignmentId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.assignmentId, user?.id]);

  async function loadAssignmentData(assignmentId: string) {
    if (!user?.id) return;
    try {
      const all = await fetchStudentAssignments(user.id);
      const found = all.find((a) => a.id === assignmentId);
      if (!found) return;

      setCurrentAssignment(found);
      setAssignmentMode(true);

      // Resolve scenario from assignment config
      let scenario: Scenario;
      if (found.customScenario) {
        scenario = {
          key: null,
          label: found.customScenario.label,
          icon: 'chatbubbles',
          description: found.customScenario.description,
          customContext: found.customScenario.systemContext,
        };
      } else if (found.scenarioKey) {
        // Try to match by built-in key, then by label (legacy data).
        const byKey = SCENARIOS.find((s) => s.key === found.scenarioKey);
        const byLabel = byKey ?? SCENARIOS.find((s) => s.label === found.scenarioKey);
        scenario = byLabel ?? {
          key: null,
          label: found.scenarioKey,
          icon: 'chatbubbles',
          description: '',
          customContext: '',
        };
      } else {
        scenario = SCENARIOS.find((s) => s.key === 'free_chat') ?? SCENARIOS[SCENARIOS.length - 1];
      }

      // If continuing with existing chat session, load it
      if (params.chatSessionId) {
        chatSessionIdRef.current = params.chatSessionId;
        const history = await loadChatMessages(params.chatSessionId);
        if (history.length > 0) {
          setMessages(history);
        }
        setSelectedScenario(scenario);
        assignmentTimer.start();
      } else {
        // Start fresh via startChat
        startChat(scenario, false);
        assignmentTimer.start();
      }
    } catch (err) {
      console.error('Failed to load assignment data:', err);
    }
  }

  const handleSubmitAssignment = async () => {
    if (!currentAssignment || submitting) return;

    if (!assignmentTimer.isMinimumMet) {
      Alert.alert(
        'Minimum Not Met',
        `You need at least ${currentAssignment.minDurationMinutes} minutes of conversation. Current: ${assignmentTimer.formattedElapsed}`,
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Submit Assignment?',
      `Time spent: ${assignmentTimer.formattedElapsed}\nMessages: ${messages.filter((m) => m.role === 'user').length}\n\nOnce submitted, you cannot make changes.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            setSubmitting(true);
            try {
              await submitAssignment(currentAssignment.id);
              Alert.alert('Submitted!', 'Your assignment has been submitted successfully.', [
                { text: 'OK', onPress: () => goBack() },
              ]);
            } catch (err) {
              console.error('Failed to submit assignment:', err);
              const { title, message } = saveErrorCopy(err, 'your assignment');
              Alert.alert(title, `${message}\n\nYour conversation is still here.`);
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const handleAssignmentBack = () => {
    if (assignmentMode && !assignmentTimer.isMinimumMet) {
      Alert.alert(
        'Leave Assignment?',
        `You haven't met the ${currentAssignment?.minDurationMinutes ?? 15}-minute requirement. Your progress will be saved.`,
        [
          { text: 'Stay', style: 'cancel' },
          {
            text: 'Leave',
            onPress: () => {
              assignmentTimer.pause();
              goBack();
            },
          },
        ]
      );
    } else {
      assignmentTimer.pause();
      goBack();
    }
  };

  /** Load persisted chat history for a scenario, or start fresh. */
  const loadPersistedHistory = useCallback(async (
    userId: string,
    scenarioKey: string,
    fallbackFirstMessage: ConversationMessage
  ) => {
    try {
      const session = await getOrCreateChatSession(userId, scenarioKey, targetLanguage, level);
      chatSessionIdRef.current = session.id;
      const history = await loadChatMessages(session.id);
      if (history.length > 0) {
        setMessages(history);
      } else {
        setMessages([fallbackFirstMessage]);
        // Persist the greeting
        saveChatMessage(session.id, fallbackFirstMessage).catch(console.error);
      }
    } catch (err) {
      console.error('Failed to load chat history:', err);
      setMessages([fallbackFirstMessage]);
    }
  }, [targetLanguage, level]);

  /** Persist a message to the current session (fire-and-forget). */
  const persistMessage = useCallback((msg: ConversationMessage) => {
    const sessionId = chatSessionIdRef.current;
    if (!sessionId) return;
    saveChatMessage(sessionId, msg).catch(console.error);
  }, []);

  // Clean up TTS on unmount. The queue has to be cancelled too, or a reply
  // that is still being streamed keeps synthesising and playing sentences into
  // a screen that no longer exists.
  useEffect(() => {
    return () => {
      speechQueueRef.current?.cancel();
      speechQueueRef.current = null;
      ttsSoundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  /** Cut off any in-flight TTS — leaving live mode shouldn't leave a voice talking. */
  const stopSpeaking = useCallback(() => {
    // The queue goes first. With sentence-queued playback there is usually more
    // audio lined up behind the sound that is currently out, so unloading only
    // that one would silence the tutor for half a second and then let the next
    // sentence start — which is not what "stop" means to anyone.
    speechQueueRef.current?.cancel();
    speechQueueRef.current = null;
    // Release whoever is awaiting the current sentence. The queue sequences on
    // that promise, and unloading the sound below detaches the status callback
    // that would otherwise have settled it, so without this the pump would sit
    // on a promise that can never resolve.
    playbackResolveRef.current?.();
    playbackResolveRef.current = null;

    const sound = ttsSoundRef.current;
    if (!sound) return;
    ttsSoundRef.current = null;
    sound.setOnPlaybackStatusUpdate(null);
    sound.unloadAsync().catch(() => {});
  }, []);

  /**
   * Play one URI, resolving when it has finished.
   *
   * The queue in lib/speech-queue.ts starts the next sentence when this
   * settles, so it must settle on EVERY exit: finished normally, cut off by
   * `stopSpeaking`, or failed to load. A promise that never settles here is a
   * hands-free loop whose microphone never reopens.
   */
  const playUri = useCallback(async (uri: string) => {
    const { sound } = await Audio.Sound.createAsync({ uri });
    ttsSoundRef.current = sound;
    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (playbackResolveRef.current === finish) playbackResolveRef.current = null;
        sound.setOnPlaybackStatusUpdate(null);
        sound.unloadAsync().catch(() => {});
        if (ttsSoundRef.current === sound) ttsSoundRef.current = null;
        resolve();
      };
      playbackResolveRef.current = finish;
      sound.setOnPlaybackStatusUpdate((status) => {
        // `!isLoaded` is the sound being unloaded out from under us (barge-in,
        // leaving the screen); `didJustFinish` is the ordinary end. Either way
        // this sentence is over and the next one may start.
        if (!status.isLoaded || status.didJustFinish) finish();
      });
      sound.playAsync().catch(finish);
    });
  }, []);

  /**
   * Open a sentence queue for one streamed reply.
   *
   * `onDrained` is the whole reason this is a queue and not a loop: in
   * hands-free mode the microphone reopens when playback ends, and with several
   * sentences per turn "ends" means the LAST one. Reopening after the first
   * would have the learner answering a tutor that is still talking, and — with
   * no echo cancellation anywhere in this app (see lib/audio-session.ts) — the
   * recogniser would hear the tutor's remaining sentences as the learner's
   * answer. `close()` at the end of the stream is what arms this.
   */
  const startSpeechQueue = useCallback((handsFree: boolean): SpeechQueue => {
    const queue = createSpeechQueue({
      synthesize: (sentence) => getSpeechUri(sentence, targetLanguage, user?.id, { voiceGender }),
      play: playUri,
      onSpeakingStarted: () => {
        if (handsFree) setHandsFreeState('TTS_PLAYING');
      },
      onError: (err, sentence) => {
        // One sentence lost is a gap in the audio. The queue keeps going, so
        // the turn still ends and the loop still pivots.
        console.warn('[chat] sentence playback failed:', sentence, err);
      },
      onDrained: () => {
        if (speechQueueRef.current === queue) speechQueueRef.current = null;
        if (handsFree) setShouldStartListening(true);
      },
    });
    speechQueueRef.current = queue;
    return queue;
  }, [targetLanguage, user?.id, voiceGender, playUri]);

  /**
   * Barge-in: stop the tutor and hand the turn straight back.
   *
   * The mic cannot simply stay open through playback — expo-av has no echo
   * cancellation, so it would hear the tutor and interrupt itself, and
   * lib/audio-session.ts records what mixing record and play has already cost
   * this app on iOS. A tap does the same job safely: the learner who has heard
   * enough stops waiting, which is most of what barge-in is actually for.
   *
   * The playback-finished handler is detached by `stopSpeaking`, so the loop's
   * normal pivot cannot also fire and open a second microphone.
   */
  const interruptAndListen = useCallback(() => {
    stopSpeaking();
    setHandsFreeState('LISTENING');
    setShouldStartListening(true);
  }, [stopSpeaking]);

  // Auto-play TTS for assistant messages in voice mode. In hands-free this is
  // the pivot of the loop: playback finishing is what re-opens the mic, so every
  // exit path from here must either set TTS_PLAYING → shouldStartListening or
  // hand the turn back some other way, or the conversation stalls silently.
  const speakReply = useCallback(async (text: string, isHandsFree = false) => {
    // Unload any previously playing TTS sound before creating a new one
    if (ttsSoundRef.current) {
      await ttsSoundRef.current.unloadAsync().catch(() => {});
      ttsSoundRef.current = null;
    }

    let sound: Audio.Sound | null = null;
    try {
      if (isHandsFree) {
        setHandsFreeState('TTS_PLAYING');
      }

      // A playable URI, not bytes. A signed URL starts playing while the rest
      // of the file is still arriving; the base64 data URI it replaced could
      // not make a sound until the whole reply had transferred and been
      // decoded. `getSpeechUri` still returns a data: URI when the server
      // cannot sign one, so this path degrades to the old behaviour rather
      // than failing.
      const uri = await getSpeechUri(text, targetLanguage, user?.id, { voiceGender });

      await setAudioSessionMode(playbackModeFor(isHandsFree));
      const result = await Audio.Sound.createAsync({ uri });
      sound = result.sound;
      ttsSoundRef.current = sound;
      await sound.playAsync();

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound?.unloadAsync().catch(() => {});
          if (ttsSoundRef.current === sound) {
            ttsSoundRef.current = null;
          }
          // After TTS finishes in hands-free mode, signal ChatInput to restart listening
          if (isHandsFree) {
            setShouldStartListening(true);
          }
        }
      });
    } catch (err) {
      // Clean up sound if it was created before the error
      if (sound) {
        sound.unloadAsync().catch(() => {});
        if (ttsSoundRef.current === sound) {
          ttsSoundRef.current = null;
        }
      }
      console.error('Auto-speak failed:', err);
      if (isHandsFree) {
        // Don't break the loop on TTS error -- restart listening
        setShouldStartListening(true);
      } else {
        const message = err instanceof VoiceError
          ? err.code === 'DAILY_LIMIT'
            ? "You've reached your daily voice limit. Upgrade your plan for more."
            : err.code === 'NOT_CONFIGURED'
              ? 'Voice features are not yet configured. Please try again later.'
              : 'Voice features are temporarily unavailable. You can continue chatting with text.'
          : 'Voice features are temporarily unavailable. You can continue chatting with text.';
        Alert.alert('Voice Unavailable', message, [{ text: 'OK' }]);
      }
    }
  }, [targetLanguage, user?.id, voiceGender]);

  /** Switch tutor voice. Cuts off the current line so the next thing the
   *  learner hears is the voice they just chose, not the one they rejected. */
  const handleVoiceGenderChange = useCallback((gender: VoiceGender) => {
    setVoiceGender(gender);
    stopSpeaking();
    saveVoiceGender(gender).catch(console.error);
  }, [stopSpeaking]);

  const startChat = (scenario: Scenario, liveVoice = false) => {
    setSelectedScenario(scenario);
    // A new conversation inherits nothing. Carrying a repair flag across
    // scenarios would have the tutor react to an attempt the learner made in
    // a different conversation, possibly days ago.
    repairOutstandingRef.current = false;

    // Greeting string is UI only — the real Claude system prompt comes from
    // the server-side scenario module keyed by scenario.key.
    const greeting = scenario.key === 'free_chat' || !scenario.key
      ? `Great! Let's have a free conversation. Start by saying something in ${targetLanguage.toUpperCase()}, and I'll help you along the way!`
      : `Great! Let's practice "${scenario.label}". ${scenario.description} Start by saying something in ${targetLanguage.toUpperCase()}, and I'll help you along the way!`;

    const firstMessage: ConversationMessage = {
      id: '0',
      role: 'assistant',
      content: greeting,
      audioUrl: null,
      correction: null,
      timestamp: new Date().toISOString(),
    };

    // Load persisted history or start fresh. Key sessions by the stable
    // scenario.key so renaming/localizing a label doesn't orphan history;
    // fall back to label only for custom (teacher) scenarios with no key.
    if (user?.id) {
      loadPersistedHistory(user.id, scenario.key ?? scenario.label, firstMessage);
    } else {
      setMessages([firstMessage]);
    }

    // If user chose "Live voice", open the loop by speaking the greeting; the
    // mic opens when that finishes. Seed the state as TTS_PLAYING *before*
    // activating hands-free — ChatInput starts recording the moment it sees
    // handsFreeMode with state IDLE, which would otherwise record the greeting.
    if (liveVoice) {
      setVoiceMode(true);
      setHandsFreeState('TTS_PLAYING');
      setHandsFreeActive(true);
      speakReply(greeting, true);
    } else if (voiceMode && !handsFreeActive) {
      speakReply(greeting, false);
    }
  };

  const handleSend = async (
    messageText?: string,
    spokenLanguage?: string | null,
    voiceTurn?: { confidence: number; durationSeconds: number },
  ) => {
    // Guard against non-string callers (e.g. Pressable's GestureResponderEvent).
    const candidate = typeof messageText === 'string' ? messageText : input;
    const text = candidate.trim();
    if (!text || sending) return;

    // Explicit consent before anything the learner wrote reaches Anthropic
    // (Apple 5.1.2(i)). Already-consented resolves immediately, so this is a
    // first-message cost, not a per-message one. Declining aborts the send and
    // leaves the draft in the composer.
    if (!(await ensureConsent('text'))) {
      if (handsFreeActive) setHandsFreeState('IDLE');
      return;
    }

    // Update hands-free state to AI_RESPONDING
    if (handsFreeActive) {
      setHandsFreeState('AI_RESPONDING');
    }

    const userMsg: ConversationMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      audioUrl: null,
      correction: null,
      timestamp: new Date().toISOString(),
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setSending(true);
    // NOT persisted yet. This used to save here, so a turn the server refused
    // (over quota, rate limited) was still written to chat_messages: the
    // learner reloaded into their own message with no reply, forever, and it
    // was re-sent as history on the next successful turn — paying tokens to
    // replay a message the model never saw. It is persisted on success below.

    // Scroll to bottom to show typing indicator
    setTimeout(() => flatListRef.current?.scrollToEnd(), 100);

    try {
      // Built-in scenarios resolve to a rich server-side prompt via scenarioKey.
      // Teacher custom scenarios (and any scenario without a key) fall back to
      // the free-form `topic` field.
      const scenarioKey = selectedScenario?.key ?? undefined;
      const topicPayload = scenarioKey
        ? undefined
        : selectedScenario?.customContext || selectedScenario?.label || undefined;

      // Context windowing: send only the last ~12 turns to avoid unbounded token usage
      const MAX_CONTEXT_MESSAGES = 24;
      const contextMessages = newMessages.length > MAX_CONTEXT_MESSAGES
        ? newMessages.slice(newMessages.length - MAX_CONTEXT_MESSAGES)
        : newMessages;

      const requestPayload: AIChatRequest = {
        userId: user?.id ?? '',
        messages: contextMessages.map((m) => ({ role: m.role, content: m.content })),
        targetLanguage,
        nativeLanguage: profile?.nativeLanguage,
        level,
        scenarioKey: scenarioKey ?? undefined,
        topic: topicPayload,
        // Only worth sending when it contradicts the target — the tutor only
        // needs to know that a switch happened, not that nothing happened.
        spokenLanguage:
          spokenLanguage && spokenLanguage !== targetLanguage ? spokenLanguage : undefined,
        // A spoken turn is evidence about speaking; a typed one about written
        // production. The server keeps them apart — composing a sentence with
        // a keyboard and time to think is an easier task than saying it, and
        // pooling them would let a learner type their way to a speaking level.
        modality: voiceTurn ? 'speaking' : 'writing',
        recognizerConfidence: voiceTurn?.confidence,
        // Carried, not computed. Whether the last turn left a repair
        // outstanding is the server's call — it depends on the level's
        // correction policy — and this is how the tutor knows to react to the
        // learner's attempt instead of asking them to try again.
        previousTurnRequestedRepair: repairOutstandingRef.current,
      };

      const assistantId = (Date.now() + 1).toString();
      // Fixed once. A streamed draft is re-rendered on every chunk, and a
      // timestamp that moved with it would make ChatBubble look like a
      // different message each time.
      const assistantTimestamp = new Date().toISOString();

      // ─── The streamed turn, and the way back from it ──────────────────
      //
      // The reply is consumed sentence by sentence so the tutor can start
      // speaking sentence one while the model is still writing sentence three.
      // Every part of that is best-effort: the stream may fail to open, break
      // mid-flight, or reach a deployment that has never heard of `stream:
      // true`. In all three cases the turn is finished by the ordinary
      // non-streaming call and the learner never finds out.
      //
      // What is deliberately NOT retried is a refusal. A daily-limit or
      // rate-limit rejection means the model was never called and would refuse
      // identically a second time, so `streamChatMessage` throws those in the
      // same message format `sendChatMessage` does and they fall straight
      // through to the handling below.
      let queue: SpeechQueue | null = null;
      let sentenceCount = 0;
      let sawFallback = false;
      let response: AIChatResponse;

      if (CHAT_STREAMING_ENABLED) {
        const sentences = createSentenceStream();
        if (voiceMode) {
          await setAudioSessionMode(playbackModeFor(handsFreeActive)).catch(() => {});
          queue = startSpeechQueue(handsFreeActive);
        }
        try {
          response = await streamChatMessage(requestPayload, {
            onChunk: (chunk) => {
              const ready = sentences.push(chunk);
              const soFar = sentences.text();
              setMessages((prev) =>
                upsertMessage(prev, {
                  id: assistantId,
                  role: 'assistant',
                  content: soFar,
                  audioUrl: null,
                  // The correction only exists in the `done` frame. A draft
                  // carries none rather than a wrong one.
                  correction: null,
                  timestamp: assistantTimestamp,
                }),
              );
              for (const sentence of ready) {
                queue?.enqueue(sentence);
                sentenceCount++;
              }
            },
            onFallback: () => {
              // The server abandoned its own reply on a safety failure. What is
              // on screen and in the queue is void: stop speaking it mid-word
              // rather than finishing a sentence the server just withdrew. The
              // canned reply is spoken whole further down.
              sawFallback = true;
              stopSpeaking();
              queue = null;
            },
          });
          // The model's last sentence usually arrives with no trailing
          // whitespace, so the splitter is still holding it — without this
          // flush the learner never hears the end of the turn.
          if (queue && !sawFallback) {
            for (const sentence of sentences.flush()) {
              queue.enqueue(sentence);
              sentenceCount++;
            }
          }
        } catch (err) {
          // Undo the half-finished turn before deciding anything: the draft
          // bubble is not a reply, and the queue may be mid-sentence.
          stopSpeaking();
          queue = null;
          sentenceCount = 0;
          sawFallback = false;
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));

          if (!(err instanceof ChatStreamUnavailableError)) throw err;

          // Nothing was decided, so the turn is still winnable. If audio had
          // already started, the learner hears the reply again from the top —
          // a repeat is a far better outcome than a turn that ends in silence.
          console.warn('[chat] streaming unavailable, completing normally:', err.message);
          response = await sendChatMessage(requestPayload);
        }
      } else {
        response = await sendChatMessage(requestPayload);
      }

      repairOutstandingRef.current = response.requestedRepair === true;

      const assistantMsg: ConversationMessage = {
        id: assistantId,
        role: 'assistant',
        content: response.reply,
        audioUrl: response.audioUrl,
        correction: response.correction,
        timestamp: assistantTimestamp,
      };
      // Replaces the streaming draft wholesale, so the transcript and history
      // both get the server's final text plus the correction, which only ever
      // arrives with `done`.
      setMessages((prev) => upsertMessage(prev, assistantMsg));
      // Only when the server actually sent one. An older deployment, or the
      // safety fallback reply, returns null — and a null here is what routes
      // Translate back through the `translate` function.
      const gloss = response.gloss;
      if (gloss) {
        setGlosses((prev) => ({ ...prev, [assistantMsg.id]: gloss }));
      }
      // The learner's turn is saved here, not at send time, so history only
      // ever contains turns that actually happened. Order matters: the user
      // message must land before the reply.
      persistMessage(userMsg);
      persistMessage(assistantMsg);

      // Mark onboarding checklist item on first successful chat
      markOnboardingItem('aiConversation').catch(console.error);

      if (voiceMode && queue && sentenceCount > 0 && !sawFallback) {
        // Already speaking. `close()` is what lets the queue's drain callback
        // fire once the LAST sentence finishes — which in hands-free is what
        // reopens the microphone. Calling speakReply here instead would play
        // the whole reply a second time on top of the sentences.
        queue.close();
      } else if (voiceMode) {
        // Nothing streamed into the queue: the non-streaming fallback, a reply
        // that arrived without chunks, or a safety fallback that voided what
        // had been queued. Speak it whole, exactly as every turn did before.
        queue?.cancel();
        speakReply(response.reply, handsFreeActive);
      } else if (handsFreeActive) {
        // Hands-free with TTS off still has to hand the turn back.
        setShouldStartListening(true);
      }
    } catch (err) {
      console.error('[chat] sendChatMessage failed:', err);
      const detail = err instanceof Error ? err.message : String(err);

      // Daily limit reached → convert into an upgrade prompt at the moment of
      // highest intent, instead of showing a confusing error bubble.
      // These two mean the turn never reached the model. Take the message
      // back out of the transcript and hand the learner their text again —
      // leaving it on screen claims something was sent that was not.
      const undeliverable =
        detail.includes('DAILY_TEXT_LIMIT_REACHED') || detail.includes('RATE_LIMITED');
      if (undeliverable) {
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
        setInput(text);
      }

      if (detail.includes('DAILY_TEXT_LIMIT_REACHED')) {
        // A subscriber who has spent today's allowance. A free-tier learner
        // never gets here — the picker turns them back before a scenario is
        // chosen, because "you've used all your messages" would be false for
        // someone who was never given any.
        //
        // Below the top tier this is an upgrade prompt; on it, the honest
        // reset time instead. See lib/limit-messaging.ts — the rule lives
        // there so it cannot drift between features.
        // effectiveTier, not subscription.tier: a school-entitled learner can
        // be effectively vip with no subscription row, and upselling them
        // would be wrong.
        showLimitAlert('messages', effectiveTier(subscription, entitledTier), () =>
          router.push('/(app)/profile/subscription'),
        );
      } else if (detail.includes('RATE_LIMITED')) {
        Alert.alert('Slow down a moment', 'You’re sending messages very quickly. Please try again in a few seconds.');
      } else {
        // A real attempt that failed downstream: the turn stays on screen, so
        // it has to reach history too, or a reload silently drops it.
        persistMessage(userMsg);
        setMessages((prev) => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Sorry, I had trouble responding. Please try again.',
          audioUrl: null,
          correction: null,
          timestamp: new Date().toISOString(),
        }]);
      }
      // If hands-free, restart listening even after error
      if (handsFreeActive) {
        setShouldStartListening(true);
      }
    } finally {
      setSending(false);
    }
  };

  const handleVoiceMessage = async (
    text: string,
    spokenLanguage: string | null,
    turn: { confidence: number; durationSeconds: number },
  ) => {
    // Log the speech itself, separately from the turn's score.
    // `daily_stats.speaking_minutes` feeds assessSpeaking and the four-strands
    // balance on the profile, and nothing in the app has ever written it — so
    // both have read a permanent zero since they shipped.
    if (turn.durationSeconds > 0) {
      upsertDailyStats(user?.id ?? '', { speakingMinutes: turn.durationSeconds / 60 }).catch(
        (err) => console.warn('[chat] speaking_minutes write failed (non-fatal):', err),
      );
    }
    await handleSend(text, spokenLanguage, turn);
  };

  const toggleVoiceMode = () => {
    if (handsFreeActive) {
      // Turn off hands-free when switching voice mode off
      setHandsFreeActive(false);
      setHandsFreeState('IDLE');
    }
    stopSpeaking();
    setVoiceMode((prev) => !prev);
  };

  const toggleHandsFree = () => {
    if (handsFreeActive) {
      stopSpeaking();
      setHandsFreeActive(false);
      setHandsFreeState('IDLE');
      setShouldStartListening(false);
    } else {
      // IDLE is ChatInput's cue to open the mic, so entering here goes straight
      // to listening rather than replaying a greeting mid-conversation.
      setHandsFreeState('IDLE');
      setHandsFreeActive(true);
      setVoiceMode(true);
    }
  };

  const handleHandsFreeStateChange = useCallback((state: HandsFreeState) => {
    setHandsFreeState(state);
  }, []);

  const handleListeningStarted = useCallback(() => {
    setShouldStartListening(false);
  }, []);

  // Skip scenario picker while assignment is loading
  if (params.assignmentId && !selectedScenario) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <View className="flex-1 items-center justify-center">
          <Text style={{ color: c.muted }}>Loading assignment...</Text>
        </View>
      </View>
    );
  }

  // ─── Free tier: the tutor is the paid part ───────────────────────────
  // The free plan's `dailyTextMessages` and `dailyVoiceMinutes` are both 0
  // (lib/plans.ts), so the server would refuse the very first message. Saying
  // so HERE, before a scenario is chosen, is the honest version: letting a
  // learner pick a scenario, type a sentence and then be told "you've used all
  // your messages for today" is a lie — they have used none, and never had any.
  //
  // This is an upsell, not a gate. The tier read is for copy; the enforcement
  // is the server's zeros, which hold whether or not this screen renders.
  // Classroom students skip it: their allowance comes from the org contract,
  // not from a personal subscription.
  const tier = effectiveTier(subscription, entitledTier);
  const schoolExempt = SCHOOL_ENABLED && (roles.includes('student') || roles.includes('teacher'));
  if (tier === 'starter' && !schoolExempt && !assignmentMode) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <SafeAreaView className="flex-1" edges={['top']}>
          <View className="flex-1 px-6 justify-center">
            <View className="w-14 h-14 rounded-full items-center justify-center mb-5" style={{ backgroundColor: c.primaryTint }}>
              <Ionicons name="chatbubbles-outline" size={28} color={c.primary} />
            </View>
            <Text className="text-[28px] font-bold mb-2" style={{ color: c.ink }} accessibilityRole="header">
              The AI tutor is part of a plan
            </Text>
            <Text className="text-base mb-6" style={{ color: c.muted }}>
              Conversations and voice practice are the parts of Fluenci that cost real money to
              run, so they sit behind a subscription. Everything else — lessons, reviews, reading
              and the daily news — stays free.
            </Text>
            <Pressable
              className="rounded-[14px] py-4 items-center"
              onPress={() => router.push('/(app)/plans')}
              accessibilityRole="button"
              accessibilityLabel="See plans"
              style={{ backgroundColor: c.primary, minHeight: 44, justifyContent: 'center' }}
            >
              <Text className="text-base font-semibold" style={{ color: c.onPrimary }}>See plans</Text>
            </Pressable>
            <Pressable
              className="py-3 items-center mt-1"
              onPress={() => router.push('/(app)/learn')}
              accessibilityRole="button"
              accessibilityLabel="Go to lessons instead"
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <Text className="text-sm" style={{ color: c.muted }}>Keep learning for free</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // Scenario picker
  if (!selectedScenario) {
    // Direction G1 "Gallery" (canvas "AI Chat · picker", 2026-09-08): tiles,
    // a sheet per scene, one Continue. Text mode with the mic ready — the
    // spoken-reply and hands-free toggles are inside the chat, so the old
    // "Live Voice" shortcut is not needed here.
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <SafeAreaView className="flex-1" edges={['top']}>
          <ScenarioPicker
            scenarios={SCENARIOS}
            languageName={languageName}
            levelLine={cefrLabel(CEFR_FOR_LEVEL[level])}
            levelBand={CEFR_FOR_LEVEL[level]}
            levelAccessibilityLabel={cefrAccessibilityLabel(CEFR_FOR_LEVEL[level])}
            resumable={resumable}
            onStart={(picked) => {
              const scenario = SCENARIOS.find((sc) => scenarioIdentity(sc) === scenarioIdentity(picked));
              if (scenario) startChat(scenario, false);
            }}
          />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
    <SafeAreaView className="flex-1" edges={['top']}>
      {/* Assignment Banner */}
      {assignmentMode && currentAssignment && (
        <SlabCard style={{ marginHorizontal: 12, marginTop: 4, marginBottom: 4 }}>
          <View className="px-4 py-2 flex-row items-center">
            <Ionicons name="school-outline" size={18} color={c.primary} />
            <Text className="text-sm font-semibold ml-2 flex-1" style={{ color: c.ink }} numberOfLines={1}>
              Assignment: {currentAssignment.title}
            </Text>
            {currentAssignment.dueAt && (
              <Text className="text-xs ml-2" style={{ color: c.idle }}>
                Due {new Date(currentAssignment.dueAt).toLocaleDateString()}
              </Text>
            )}
          </View>
        </SlabCard>
      )}

      {/* Assignment Timer Overlay */}
      {assignmentMode && currentAssignment && (
        <AssignmentTimer
          elapsedSeconds={assignmentTimer.elapsedSeconds}
          requiredMinutes={currentAssignment.minDurationMinutes}
        />
      )}

      {/* Header — deck screen 08: chevron · mascot · title/status stack · chip */}
      <View
        className="flex-row items-center px-4 py-3 border-b"
        style={{ borderColor: c.cardBorder, gap: spacing.sm }}
      >
        <Pressable
          onPress={() => {
            stopSpeaking();
            if (assignmentMode) {
              handleAssignmentBack();
              return;
            }
            setSelectedScenario(null);
            setMessages([]);
            setVoiceMode(false);
            setHandsFreeActive(false);
            setHandsFreeState('IDLE');
            setShouldStartListening(false);
            chatSessionIdRef.current = null;
            repairOutstandingRef.current = false;
          }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color={c.idle} />
        </Pressable>

        {/* Sol sits in the header as the tutor's face: thinking while a reply
            is on its way, listening while the mic is open, idle otherwise. */}
        <Mascot
          state={sending ? 'thinking' : handsFreeActive && handsFreeState === 'LISTENING' ? 'listening' : 'idle'}
          size={44}
        />

        <View className="flex-1">
          <Body weight="extrabold" numberOfLines={1}>
            {selectedScenario.label}
          </Body>
          <View className="flex-row items-center" style={{ gap: spacing.xxs }}>
            {handsFreeActive && (
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: radii.pill,
                  backgroundColor: c.green,
                }}
              />
            )}
            <Caption
              size="sm"
              numberOfLines={2}
              accessibilityLabel={`${handsFreeActive ? 'Live. ' : ''}${cefrAccessibilityLabel(
                CEFR_FOR_LEVEL[level]
              )}`}
            >
              {handsFreeActive ? 'Live · ' : ''}
              {cefrLabel(CEFR_FOR_LEVEL[level])}
            </Caption>
          </View>
        </View>

        {/* Elapsed clock. useAssignmentTimer is a plain stopwatch despite the
            name — assignments read isMinimumMet, live sessions just show this. */}
        {assignmentTimer.running && (
          <Chip label={assignmentTimer.formattedElapsed} variant="primary" />
        )}

        {/* Submit Assignment Button */}
        {assignmentMode && assignmentTimer.isMinimumMet && (
          <Pressable
            onPress={handleSubmitAssignment}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Submit assignment"
            className="min-h-9 py-1.5 px-3 rounded-full items-center justify-center flex-row" style={{ backgroundColor: c.green }}
          >
            <Ionicons name="checkmark-circle-outline" size={16} color={c.onPrimary} />
            <Text className="text-xs font-semibold ml-1.5" style={{ color: c.onPrimary }}>
              {submitting ? 'Submitting...' : 'Submit'}
            </Text>
          </Pressable>
        )}

        {/* Hands-free toggle. Collapses to icon-only once live, because the status
            row above already reads "Live" — that buys back the width the deck's
            mascot + status stack needs. Keeps its label while off, where it is
            the only thing advertising the feature. */}
        <Pressable
          onPress={toggleHandsFree}
          accessibilityRole="button"
          accessibilityLabel={handsFreeActive ? 'End live voice conversation' : 'Start live voice conversation'}
          accessibilityHint="Real-time bidirectional voice conversation with AI tutor"
          className={`min-h-9 py-1.5 rounded-full items-center justify-center flex-row ${
            handsFreeActive ? 'w-9' : 'px-3'
          }`}
          style={{ backgroundColor: handsFreeActive ? c.green : c.card }}
        >
          <Ionicons
            name={handsFreeActive ? 'mic' : 'mic-outline'}
            size={16}
            color={handsFreeActive ? c.onPrimary : c.idle}
          />
          {!handsFreeActive && (
            <Text className="text-xs font-sans-semibold ml-1.5" style={{ color: c.idle }}>
              Live Voice
            </Text>
          )}
        </Pressable>

        {/* Voice mode toggle (hidden when hands-free is active) */}
        {!handsFreeActive && (
          <Pressable
            onPress={toggleVoiceMode}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={voiceMode ? 'Switch to text mode' : 'Switch to voice mode'}
            className="w-9 h-9 rounded-full items-center justify-center"
            style={{ backgroundColor: voiceMode ? c.primary : c.card }}
          >
            <Ionicons name={voiceMode ? 'mic' : 'mic-outline'} size={20} color={voiceMode ? c.onPrimary : c.onTint} />
          </Pressable>
        )}
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          renderItem={({ item }) => (
            <ChatBubble
              message={item}
              targetLanguage={targetLanguage}
              userId={user?.id}
              cefrLevel={CEFR_FOR_LEVEL[level]}
              nativeLanguage={profile?.nativeLanguage}
              voiceGender={voiceGender}
              gloss={glosses[item.id]}
            />
          )}
          ListFooterComponent={sending ? <TypingIndicator /> : null}
        />

        <ChatInput
          value={input}
          onChangeText={setInput}
          onSend={handleSend}
          sending={sending}
          voiceMode={voiceMode}
          onVoiceMessage={handleVoiceMessage}
          targetLanguage={targetLanguage}
          handsFreeMode={handsFreeActive}
          handsFreeState={handsFreeState}
          onHandsFreeStateChange={handleHandsFreeStateChange}
          shouldStartListening={shouldStartListening}
          onListeningStarted={handleListeningStarted}
          voiceGender={voiceGender}
          onVoiceGenderChange={handleVoiceGenderChange}
          onBeforeRecord={() => ensureConsent('voice')}
          onInterruptPlayback={interruptAndListen}
          cefrLevel={CEFR_FOR_LEVEL[level]}
        />
        {consentSheet}
      </KeyboardAvoidingView>
    </SafeAreaView>
    </View>
  );
}
