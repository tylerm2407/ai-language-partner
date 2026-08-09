import { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, Pressable, FlatList, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../../hooks/useAuth';
import { useAppStore } from '../../../stores/useAppStore';
import { useOnboardingChecklist } from '../../../hooks/useOnboardingChecklist';
import { sendChatMessage, getTextToSpeech, VoiceError } from '../../../lib/ai';
import { ChatBubble } from '../../../components/chat/ChatBubble';
import { ChatInput } from '../../../components/chat/ChatInput';
import type { HandsFreeState } from '../../../components/chat/ChatInput';
import { TypingIndicator } from '../../../components/chat/TypingIndicator';
import { GradientBackground } from '../../../components/ui/GradientBackground';
import { GlassSurface } from '../../../components/ui/GlassSurface';
import AssignmentTimer from '../../../components/school/AssignmentTimer';
import { useAssignmentTimer } from '../../../hooks/useAssignmentTimer';
import type { ConversationMessage, Assignment, AssignmentSubmission, LanguageCode, ProficiencyLevel } from '../../../types';
import { Ionicons } from '@expo/vector-icons';
import { getOrCreateChatSession, saveChatMessage, loadChatMessages, fetchStudentAssignments, submitAssignment } from '../../../lib/supabase-queries';
import { getTargetLanguage } from '../../../lib/language';
import { setAudioSessionMode, playbackModeFor } from '../../../lib/audio-session';
import {
  DEFAULT_VOICE_GENDER,
  loadVoiceGender,
  saveVoiceGender,
  type VoiceGender,
} from '../../../lib/voice-preference';
import { SCENARIO_META, SCENARIO_ORDER, type ScenarioKey } from '../../../types/scenarios';
import { SCHOOL_ENABLED } from '../../../config/app';
import { colors, radii, spacing } from '../../../config/theme';
import { Body, Caption } from '../../../components/ui/Text';
import { Chip } from '../../../components/ui/Chip';

/**
 * CEFR code for the header status row. The deck reads "Nivel A2", but "Nivel" is
 * Spanish and the target language varies — the bare CEFR code is international,
 * so the row reads "Live · A2" instead of localising the noun 12 ways.
 */
const CEFR_FOR_LEVEL: Record<ProficiencyLevel, string> = {
  beginner: 'A1',
  elementary: 'A2',
  intermediate: 'B1',
  upper_intermediate: 'B2',
  advanced: 'C1',
};

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

export default function ChatScreen() {
  const { profile } = useAppStore();
  const targetLanguage = getTargetLanguage(profile);

  // Profile not loaded yet — the target language is unknown, so don't
  // default to any language. Mirrors the assignment-loading state below.
  if (!targetLanguage) {
    return (
      <GradientBackground>
        <View className="flex-1 items-center justify-center">
          <Text className="text-text-secondary">Loading...</Text>
        </View>
      </GradientBackground>
    );
  }

  return <ChatSession targetLanguage={targetLanguage} />;
}

function ChatSession({ targetLanguage }: { targetLanguage: LanguageCode }) {
  const { user } = useAuth();
  const { profile } = useAppStore();
  const { markItem: markOnboardingItem } = useOnboardingChecklist();
  const router = useRouter();
  const params = useLocalSearchParams<{ assignmentId?: string; chatSessionId?: string }>();
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
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
  // Track the current ElevenLabs TTS sound for cleanup on error/unmount
  const ttsSoundRef = useRef<Audio.Sound | null>(null);

  const level = profile?.level ?? 'beginner';

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
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (err) {
              console.error('Failed to submit assignment:', err);
              Alert.alert('Error', 'Failed to submit. Please try again.');
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
              router.back();
            },
          },
        ]
      );
    } else {
      assignmentTimer.pause();
      router.back();
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

  // Clean up TTS sound on unmount
  useEffect(() => {
    return () => {
      ttsSoundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  /** Cut off any in-flight TTS — leaving live mode shouldn't leave a voice talking. */
  const stopSpeaking = useCallback(() => {
    const sound = ttsSoundRef.current;
    if (!sound) return;
    ttsSoundRef.current = null;
    sound.setOnPlaybackStatusUpdate(null);
    sound.unloadAsync().catch(() => {});
  }, []);

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

      const base64 = await getTextToSpeech(text, targetLanguage, user?.id, { voiceGender });
      const dataUri = `data:audio/mpeg;base64,${base64}`;

      await setAudioSessionMode(playbackModeFor(isHandsFree));
      const result = await Audio.Sound.createAsync({ uri: dataUri });
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

  const handleSend = async (messageText?: string, spokenLanguage?: string | null) => {
    // Guard against non-string callers (e.g. Pressable's GestureResponderEvent).
    const candidate = typeof messageText === 'string' ? messageText : input;
    const text = candidate.trim();
    if (!text || sending) return;

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
    persistMessage(userMsg);

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

      const response = await sendChatMessage({
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
      });

      const assistantMsg: ConversationMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.reply,
        audioUrl: response.audioUrl,
        correction: response.correction,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      persistMessage(assistantMsg);

      // Mark onboarding checklist item on first successful chat
      markOnboardingItem('aiConversation').catch(console.error);

      if (voiceMode) {
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
      if (detail.includes('DAILY_TEXT_LIMIT_REACHED')) {
        Alert.alert(
          'Daily limit reached',
          "You've used all your messages for today. Upgrade your plan for more daily conversations.",
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'See plans', onPress: () => router.push('/(app)/profile/subscription') },
          ]
        );
      } else if (detail.includes('RATE_LIMITED')) {
        Alert.alert('Slow down a moment', 'You’re sending messages very quickly. Please try again in a few seconds.');
      } else {
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

  const handleVoiceMessage = async (text: string, spokenLanguage: string | null) => {
    await handleSend(text, spokenLanguage);
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
      <GradientBackground>
        <View className="flex-1 items-center justify-center">
          <Text className="text-text-secondary">Loading assignment...</Text>
        </View>
      </GradientBackground>
    );
  }

  // Scenario picker
  if (!selectedScenario) {
    return (
      <GradientBackground>
      <View className="flex-1">
        <View className="flex-1 px-4 pt-2">
          <Text className="text-[28px] font-bold text-text-primary mb-2">AI Chat</Text>
          <Text className="text-base text-text-secondary mb-6">
            Choose a scenario to practice {targetLanguage.toUpperCase()} conversation
          </Text>
          <FlatList
            data={SCENARIOS}
            keyExtractor={(item) => item.label}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            renderItem={({ item: scenario }) => (
              <GlassSurface style={{ marginBottom: 12 }}>
                <View className="p-5">
                  <View className="flex-row items-center mb-3">
                    <View className="w-10 h-10 rounded-full bg-primary/15 items-center justify-center">
                      <Ionicons name={scenario.icon} size={22} color={colors.premium.base} />
                    </View>
                    <View className="ml-4 flex-1">
                      <Text className="text-base font-semibold text-text-primary">{scenario.label}</Text>
                      <Text className="text-sm text-text-secondary mt-0.5">
                        {scenario.description}
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row" style={{ gap: 10 }}>
                    <Pressable
                      className="flex-1 bg-primary rounded-[14px] py-3 items-center flex-row justify-center"
                      onPress={() => startChat(scenario, false)}
                      accessibilityRole="button"
                      accessibilityLabel={`Text chat: ${scenario.label}`}
                    >
                      <Ionicons name="chatbubble-outline" size={16} color={colors.text.onPrimary} />
                      <Text className="text-sm font-semibold text-white ml-2">Text Chat</Text>
                    </Pressable>
                    <Pressable
                      className="flex-1 bg-success rounded-[14px] py-3 items-center flex-row justify-center"
                      onPress={() => startChat(scenario, true)}
                      accessibilityRole="button"
                      accessibilityLabel={`Live voice: ${scenario.label}`}
                      accessibilityHint="Start a real-time voice conversation"
                    >
                      <Ionicons name="mic" size={16} color={colors.text.onPrimary} />
                      <Text className="text-sm font-semibold text-white ml-2">Live Voice</Text>
                    </Pressable>
                  </View>
                </View>
              </GlassSurface>
            )}
          />
        </View>
      </View>
      </GradientBackground>
    );
  }

  // Chat interface
  return (
    <GradientBackground>
    <SafeAreaView className="flex-1" edges={['top']}>
      {/* Assignment Banner */}
      {assignmentMode && currentAssignment && (
        <GlassSurface style={{ marginHorizontal: 12, marginTop: 4, marginBottom: 4 }}>
          <View className="px-4 py-2 flex-row items-center">
            <Ionicons name="school-outline" size={18} color={colors.premium.base} />
            <Text className="text-sm text-text-primary font-semibold ml-2 flex-1" numberOfLines={1}>
              Assignment: {currentAssignment.title}
            </Text>
            {currentAssignment.dueAt && (
              <Text className="text-xs text-text-tertiary ml-2">
                Due {new Date(currentAssignment.dueAt).toLocaleDateString()}
              </Text>
            )}
          </View>
        </GlassSurface>
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
        className="flex-row items-center px-4 py-3 border-b border-dark-border"
        style={{ gap: spacing.sm }}
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
          }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text.tertiary} />
        </Pressable>

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
                  backgroundColor: colors.success.base,
                }}
              />
            )}
            <Caption size="sm">
              {handsFreeActive ? 'Live · ' : ''}
              {CEFR_FOR_LEVEL[level]}
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
            className="min-h-9 py-1.5 px-3 rounded-full items-center justify-center flex-row bg-success"
          >
            <Ionicons name="checkmark-circle-outline" size={16} color={colors.text.onPrimary} />
            <Text className="text-xs font-semibold text-white ml-1.5">
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
            handsFreeActive ? 'w-9 bg-success' : 'px-3 bg-dark-card'
          }`}
        >
          <Ionicons
            name={handsFreeActive ? 'mic' : 'mic-outline'}
            size={16}
            color={handsFreeActive ? colors.text.onPrimary : colors.text.quaternary}
          />
          {!handsFreeActive && (
            <Text className="text-xs font-sans-semibold ml-1.5 text-text-tertiary">
              Live Voice
            </Text>
          )}
        </Pressable>

        {/* Voice mode toggle (hidden when hands-free is active) */}
        {!handsFreeActive && (
          <Pressable
            onPress={toggleVoiceMode}
            accessibilityRole="button"
            accessibilityLabel={voiceMode ? 'Switch to text mode' : 'Switch to voice mode'}
            className={`w-9 h-9 rounded-full items-center justify-center ${voiceMode ? 'bg-primary' : 'bg-dark-card'}`}
          >
            <Ionicons name={voiceMode ? 'mic' : 'mic-outline'} size={20} color={voiceMode ? colors.text.onPrimary : colors.indigo[300]} />
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
              nativeLanguage={profile?.nativeLanguage}
              voiceGender={voiceGender}
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
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
    </GradientBackground>
  );
}
