import { useState, useRef, useCallback } from 'react';
import { View, Text, Pressable, FlatList, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { useAuth } from '../../../hooks/useAuth';
import { useAppStore } from '../../../stores/useAppStore';
import { useOnboardingChecklist } from '../../../hooks/useOnboardingChecklist';
import { sendChatMessage, getTextToSpeech, analyzeConversationTurn, VoiceError } from '../../../lib/ai';
import { useGeminiLive } from '../../../hooks/useGeminiLive';
import { ChatBubble } from '../../../components/chat/ChatBubble';
import { ChatInput } from '../../../components/chat/ChatInput';
import type { HandsFreeState } from '../../../components/chat/ChatInput';
import { TypingIndicator } from '../../../components/chat/TypingIndicator';
import { GradientBackground } from '../../../components/ui/GradientBackground';
import { GradientBorderCard } from '../../../components/ui/GradientBorderCard';
import type { ConversationMessage } from '../../../types';
import { Ionicons } from '@expo/vector-icons';

interface Scenario {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
  systemContext: string;
}

const SCENARIOS: Scenario[] = [
  {
    label: 'Ordering at a Restaurant',
    icon: 'restaurant',
    description: 'Practice ordering food, asking about menu items, expressing preferences and allergies.',
    systemContext:
      'The student is practicing ordering at a restaurant. Simulate being a waiter. Present menu items, ask about preferences, handle allergy questions, suggest specials, and confirm the order. Use realistic restaurant dialogue.',
  },
  {
    label: 'Job Interview Practice',
    icon: 'briefcase',
    description: 'Introduce yourself, answer common interview questions, discuss experience.',
    systemContext:
      'The student is practicing for a job interview. Simulate being an interviewer. Ask them to introduce themselves, discuss their experience, strengths, weaknesses, and why they want the job. Give realistic follow-up questions.',
  },
  {
    label: 'Asking for Directions',
    icon: 'navigate',
    description: 'Navigate to a destination, understand landmarks, give and receive directions.',
    systemContext:
      'The student is practicing asking for and understanding directions. Simulate being a helpful local. Use landmarks, street names, left/right/straight instructions, and distance estimates. Confirm they understood.',
  },
  {
    label: 'Shopping',
    icon: 'cart',
    description: 'Ask about sizes, colors, prices, and make purchases.',
    systemContext:
      'The student is practicing shopping in a store. Simulate being a shop assistant. Discuss sizes, colors, prices, availability, payment methods, and returns. Use realistic retail dialogue.',
  },
  {
    label: 'Making Friends',
    icon: 'people',
    description: 'Talk about hobbies, interests, and make plans together.',
    systemContext:
      'The student is practicing casual socializing. Simulate being a friendly new acquaintance. Discuss hobbies, interests, weekend plans, favorite music/movies, and suggest meeting up. Keep it natural and warm.',
  },
  {
    label: "Doctor / Pharmacy Visit",
    icon: 'medkit',
    description: 'Describe symptoms, understand medical advice, buy medication.',
    systemContext:
      'The student is practicing a visit to a doctor or pharmacy. Simulate being a doctor or pharmacist. Ask about symptoms, duration, severity, medical history, and explain treatment or medication instructions clearly.',
  },
  {
    label: 'Phone Call',
    icon: 'call',
    description: 'Book appointments, make reservations, handle phone etiquette.',
    systemContext:
      'The student is practicing making a phone call. Simulate being a receptionist or booking agent. Practice greetings, stating the reason for calling, scheduling appointments, confirming details, and polite phone etiquette.',
  },
  {
    label: 'Airport / Hotel',
    icon: 'bed',
    description: 'Check in, ask about amenities, handle travel situations.',
    systemContext:
      'The student is practicing at an airport or hotel. Simulate being check-in staff. Practice checking in, asking about amenities, room service, flight information, baggage, and resolving common travel issues.',
  },
  {
    label: 'Free Chat',
    icon: 'chatbubble',
    description: 'Open conversation on any topic you choose.',
    systemContext: '',
  },
];

export default function ChatScreen() {
  const { user } = useAuth();
  const { profile } = useAppStore();
  const { markItem: markOnboardingItem } = useOnboardingChecklist();
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Hands-free state
  const [handsFreeActive, setHandsFreeActive] = useState(false);
  const [handsFreeState, setHandsFreeState] = useState<HandsFreeState>('IDLE');
  const [shouldStartListening, setShouldStartListening] = useState(false);

  const targetLanguage = profile?.targetLanguage ?? 'es';
  const level = profile?.level ?? 'beginner';

  // Gemini Live voice session for hands-free mode
  const geminiLive = useGeminiLive({
    targetLanguage,
    level,
    topic: selectedScenario?.systemContext || selectedScenario?.label,
    onTranscript: useCallback((userText: string, aiText: string) => {
      // Add user message to chat UI
      if (userText) {
        const userMsg: ConversationMessage = {
          id: Date.now().toString(),
          role: 'user',
          content: userText,
          audioUrl: null,
          correction: null,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, userMsg]);
      }

      // Add AI message to chat UI
      if (aiText) {
        const aiMsg: ConversationMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: aiText,
          audioUrl: null,
          correction: null,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, aiMsg]);

        // Async: analyze turn for corrections (non-blocking)
        if (userText) {
          analyzeConversationTurn(userText, aiText, targetLanguage, level).then((analysis) => {
            if (analysis.correction) {
              // Update the last assistant message with the correction
              setMessages((prev) => {
                const updated = [...prev];
                const lastAssistant = [...updated].reverse().find((m) => m.role === 'assistant');
                if (lastAssistant) {
                  lastAssistant.correction = analysis.correction;
                }
                return [...updated];
              });
            }
          });
        }
      }

      setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
    }, [targetLanguage, level]),
    onError: useCallback((error: Error) => {
      console.error('Gemini Live error:', error);
      Alert.alert(
        'Voice Session Error',
        'The voice session encountered an error. You can try again or switch to text mode.',
        [{ text: 'OK' }]
      );
    }, []),
  });

  const isGeminiLiveActive = geminiLive.state !== 'DISCONNECTED';

  // Map Gemini Live state to HandsFreeState for ChatInput display
  const geminiLiveHandsFreeState: HandsFreeState = (() => {
    switch (geminiLive.state) {
      case 'CONNECTING': return 'CONNECTING';
      case 'CONNECTED': return 'CONNECTING';
      case 'LISTENING': return 'LISTENING';
      case 'AI_SPEAKING': return 'AI_RESPONDING';
      default: return 'IDLE';
    }
  })();

  // Auto-play ElevenLabs TTS for assistant messages in voice mode
  const speakWithElevenLabs = useCallback(async (text: string, isHandsFree = false) => {
    try {
      if (isHandsFree) {
        setHandsFreeState('TTS_PLAYING');
      }

      const base64 = await getTextToSpeech(text, targetLanguage, user?.id);
      const dataUri = `data:audio/mpeg;base64,${base64}`;

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: isHandsFree,
      });
      const { sound } = await Audio.Sound.createAsync({ uri: dataUri });
      await sound.playAsync();

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
          // After TTS finishes in hands-free mode, signal ChatInput to restart listening
          if (isHandsFree) {
            setShouldStartListening(true);
          }
        }
      });
    } catch (err) {
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
  }, [targetLanguage, user?.id]);

  const startChat = (scenario: Scenario) => {
    setSelectedScenario(scenario);
    const greeting = scenario.systemContext
      ? `Great! Let's practice "${scenario.label}". ${scenario.description} Start by saying something in ${targetLanguage.toUpperCase()}, and I'll help you along the way!`
      : `Great! Let's have a free conversation. Start by saying something in ${targetLanguage.toUpperCase()}, and I'll help you along the way!`;

    const firstMessage: ConversationMessage = {
      id: '0',
      role: 'assistant',
      content: greeting,
      audioUrl: null,
      correction: null,
      timestamp: new Date().toISOString(),
    };
    setMessages([firstMessage]);

    // In hands-free mode, Gemini Live handles TTS — only use ElevenLabs for hold-to-talk voice mode
    if (voiceMode && !handsFreeActive) {
      speakWithElevenLabs(greeting, false);
    }
  };

  const handleSend = async (messageText?: string) => {
    const text = (messageText ?? input).trim();
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

    // Scroll to bottom to show typing indicator
    setTimeout(() => flatListRef.current?.scrollToEnd(), 100);

    try {
      const topicPayload = selectedScenario?.systemContext
        ? selectedScenario.systemContext
        : selectedScenario?.label ?? undefined;

      const response = await sendChatMessage({
        userId: user?.id ?? '',
        messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        targetLanguage,
        level,
        topic: topicPayload,
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

      // Mark onboarding checklist item on first successful chat
      markOnboardingItem('aiConversation').catch(console.error);

      // Auto-speak in hold-to-talk voice mode (ElevenLabs TTS)
      // In hands-free mode, Gemini Live handles TTS natively
      if (voiceMode && !isGeminiLiveActive) {
        speakWithElevenLabs(response.reply, handsFreeActive);
      }
    } catch {
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I had trouble responding. Please try again.',
        audioUrl: null,
        correction: null,
        timestamp: new Date().toISOString(),
      }]);
      // If hands-free, restart listening even after error
      if (handsFreeActive) {
        setShouldStartListening(true);
      }
    } finally {
      setSending(false);
    }
  };

  const handleVoiceMessage = async (text: string) => {
    await handleSend(text);
  };

  const toggleVoiceMode = () => {
    if (handsFreeActive) {
      // Turn off hands-free when switching voice mode off
      setHandsFreeActive(false);
      setHandsFreeState('IDLE');
    }
    setVoiceMode((prev) => !prev);
  };

  const toggleHandsFree = async () => {
    if (handsFreeActive) {
      // Deactivate hands-free — disconnect Gemini Live
      await geminiLive.endSession();
      setHandsFreeActive(false);
      setHandsFreeState('IDLE');
      setShouldStartListening(false);
    } else {
      // Gemini Live hands-free is deferred — not supported in Expo Go
      Alert.alert(
        'Coming Soon',
        'Hands-free voice mode is coming soon! Use hold-to-talk for now.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleHandsFreeStateChange = useCallback((state: HandsFreeState) => {
    setHandsFreeState(state);
  }, []);

  const handleListeningStarted = useCallback(() => {
    setShouldStartListening(false);
  }, []);

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
              <GradientBorderCard style={{ marginBottom: 12 }}>
                <Pressable
                  className="p-5 flex-row items-center"
                  onPress={() => startChat(scenario)}
                  accessibilityRole="button"
                  accessibilityLabel={scenario.label}
                >
                  <View className="w-10 h-10 rounded-full bg-primary/15 items-center justify-center">
                    <Ionicons name={scenario.icon} size={22} color="#A855F7" />
                  </View>
                  <View className="ml-4 flex-1">
                    <Text className="text-base font-semibold text-text-primary">{scenario.label}</Text>
                    <Text className="text-sm text-text-secondary mt-0.5" numberOfLines={2}>
                      {scenario.description}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#7DD3FC" />
                </Pressable>
              </GradientBorderCard>
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
    <View className="flex-1">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-dark-border">
        <Pressable
          onPress={async () => {
            if (isGeminiLiveActive) await geminiLive.endSession();
            setSelectedScenario(null);
            setMessages([]);
            setVoiceMode(false);
            setHandsFreeActive(false);
            setHandsFreeState('IDLE');
            setShouldStartListening(false);
          }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color="#F1F5F9" />
        </Pressable>
        <Text className="text-lg font-semibold text-text-primary ml-3 flex-1" numberOfLines={1}>
          {selectedScenario.label}
        </Text>

        {/* Hands-free toggle */}
        <Pressable
          onPress={toggleHandsFree}
          accessibilityRole="button"
          accessibilityLabel={handsFreeActive ? 'Disable hands-free mode' : 'Hands-free mode coming soon'}
          className={`h-9 px-3 rounded-full items-center justify-center flex-row mr-2 ${
            handsFreeActive ? 'bg-success' : 'bg-dark-card opacity-50'
          }`}
        >
          <Ionicons
            name="car-outline"
            size={16}
            color={handsFreeActive ? '#FFFFFF' : '#64748B'}
          />
          <Text
            className={`text-xs font-sans-semibold ml-1.5 ${
              handsFreeActive ? 'text-white' : 'text-text-tertiary'
            }`}
          >
            {handsFreeActive ? 'Hands-Free' : 'Coming Soon'}
          </Text>
        </Pressable>

        {/* Voice mode toggle (hidden when hands-free is active) */}
        {!handsFreeActive && (
          <Pressable
            onPress={toggleVoiceMode}
            accessibilityRole="button"
            accessibilityLabel={voiceMode ? 'Switch to text mode' : 'Switch to voice mode'}
            className={`w-9 h-9 rounded-full items-center justify-center ${voiceMode ? 'bg-primary' : 'bg-dark-card'}`}
          >
            <Ionicons name={voiceMode ? 'mic' : 'mic-outline'} size={20} color={voiceMode ? '#FFFFFF' : '#C4B5FD'} />
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
            <ChatBubble message={item} targetLanguage={targetLanguage} userId={user?.id} />
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
          handsFreeState={isGeminiLiveActive ? geminiLiveHandsFreeState : handsFreeState}
          onHandsFreeStateChange={handleHandsFreeStateChange}
          shouldStartListening={shouldStartListening}
          onListeningStarted={handleListeningStarted}
          geminiLiveActive={isGeminiLiveActive}
        />
      </KeyboardAvoidingView>
    </View>
    </GradientBackground>
  );
}
