import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useProfile } from '../../../hooks/useProfile';
import { usePracticeSession } from '../../../hooks/usePracticeSession';
import { useAudioPlayer } from '../../../hooks/useAudioPlayer';
import { AudioPlayButton } from '../../../components/audio/AudioPlayButton';
import { GradientBackground } from '../../../components/ui/GradientBackground';
import { GradientBorderCard } from '../../../components/ui/GradientBorderCard';
import { trackEvent } from '../../../lib/analytics';
import type { ConversationMessage, LanguageCode, ProficiencyLevel } from '../../../types';

const TOPICS: { label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'Daily Routine', icon: 'sunny' },
  { label: 'Ordering Food', icon: 'restaurant' },
  { label: 'Asking for Directions', icon: 'navigate' },
  { label: 'At the Store', icon: 'cart' },
  { label: 'Meeting Someone New', icon: 'people' },
  { label: 'Travel Plans', icon: 'airplane' },
  { label: 'Hobbies & Interests', icon: 'football' },
  { label: 'Weather & Seasons', icon: 'cloud' },
  { label: 'Family & Friends', icon: 'heart' },
  { label: 'Free Conversation', icon: 'chatbubble' },
];

export default function PracticeScreen() {
  const router = useRouter();
  const { profile } = useProfile();
  const {
    messages,
    sending,
    sessionId,
    startSession,
    sendMessage,
    endSession,
  } = usePracticeSession();

  const [input, setInput] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // ElevenLabs auto-play: play each new assistant message at most once. The
  // hook is asynchronously patched with `audioUrl` by usePracticeSession once
  // TTS completes, which triggers the effect below.
  const { play, cleanup: cleanupAudio } = useAudioPlayer();
  const playedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const next = [...messages]
      .reverse()
      .find((m) => m.role === 'assistant' && m.audioUrl && !playedIdsRef.current.has(m.id));
    if (next?.audioUrl) {
      playedIdsRef.current.add(next.id);
      play(next.audioUrl).catch((err) => {
        console.warn('[practice] autoplay failed:', err);
      });
    }
  }, [messages, play]);

  useEffect(() => {
    return () => {
      cleanupAudio().catch(() => { /* ignore */ });
    };
  }, [cleanupAudio]);

  const targetLanguage = (profile?.targetLanguage ?? 'es') as LanguageCode;
  const level = (profile?.level ?? 'beginner') as ProficiencyLevel;

  const isSending = sending;
  const isLoading = starting;

  const handleStartSession = async (topic: string) => {
    setStarting(true);
    try {
      trackEvent('practice_started', { topic, targetLanguage, level });
      await startSession(topic, targetLanguage, level);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start session');
    } finally {
      setStarting(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isSending) return;
    const text = input.trim();
    setInput('');
    await sendMessage(text, targetLanguage, level);
  };

  const handleEnd = async () => {
    trackEvent('practice_ended', {
      messageCount: messages.length,
    });
    await endSession();
  };

  // ─── Topic Selection (no active session) ──────────────────────

  if (!sessionId) {
    return (
      <GradientBackground>
        <SafeAreaView className="flex-1">
          <View className="flex-1 px-4 pt-4">
            <Text className="text-[28px] font-bold text-text-primary mb-1" accessibilityRole="header">
              AI Practice
            </Text>
            <Text className="text-base text-text-secondary mb-6">
              Choose a topic to practice {targetLanguage.toUpperCase()} conversation.
            </Text>

            <FlatList
              data={TOPICS}
              keyExtractor={(item) => item.label}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 100 }}
              renderItem={({ item }) => (
                <GradientBorderCard style={{ marginBottom: 12 }}>
                  <Pressable
                    onPress={() => handleStartSession(item.label)}
                    disabled={isLoading}
                    className="p-5 flex-row items-center"
                    accessibilityRole="button"
                    accessibilityLabel={`Practice topic: ${item.label}`}
                  >
                    <View className="w-10 h-10 rounded-full bg-primary/15 items-center justify-center">
                      <Ionicons name={item.icon} size={22} color="#A855F7" />
                    </View>
                    <View className="ml-4 flex-1">
                      <Text className="text-base font-semibold text-text-primary">{item.label}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#7DD3FC" />
                  </Pressable>
                </GradientBorderCard>
              )}
            />
          </View>

          {isLoading && (
            <View className="absolute inset-0 justify-center items-center" style={{ backgroundColor: 'rgba(12,15,20,0.8)' }}>
              <ActivityIndicator size="large" color="#38BDF8" />
              <Text className="text-text-secondary mt-3">Starting session...</Text>
            </View>
          )}
        </SafeAreaView>
      </GradientBackground>
    );
  }

  // ─── Active Conversation ──────────────────────────────────────

  return (
    <GradientBackground>
      <SafeAreaView className="flex-1" edges={['top']}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={90}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-dark-border">
            <View>
              <Text className="text-lg font-bold text-text-primary" accessibilityRole="header">
                AI Conversation
              </Text>
              <Text className="text-[13px] text-text-secondary">
                {targetLanguage.toUpperCase()} | {level}
              </Text>
            </View>
            <Pressable
              onPress={handleEnd}
              className="bg-error-bg px-4 py-2 rounded-[10px]"
              accessibilityRole="button"
              accessibilityLabel="End conversation"
            >
              <Text className="text-error font-semibold text-sm">End</Text>
            </Pressable>
          </View>

          {/* Messages */}
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, flexGrow: 1 }}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
            renderItem={({ item }) => (
              <View
                className={`mb-2 max-w-[82%] ${item.role === 'user' ? 'self-end' : 'self-start'}`}
              >
                <View
                  className={`p-[14px] ${
                    item.role === 'user'
                      ? 'bg-primary rounded-[18px] rounded-br-[4px]'
                      : 'bg-dark-card rounded-[18px] rounded-bl-[4px]'
                  }`}
                >
                  <Text
                    className={`text-base ${
                      item.role === 'user' ? 'text-white' : 'text-text-primary'
                    }`}
                    style={{ lineHeight: 22 }}
                  >
                    {item.content}
                  </Text>

                  {item.correction && (
                    <View
                      className="mt-2 pt-2"
                      style={{
                        borderTopWidth: 0.5,
                        borderTopColor:
                          item.role === 'user' ? 'rgba(255,255,255,0.3)' : '#252A35',
                      }}
                    >
                      <Text
                        className={`text-sm italic ${
                          item.role === 'user' ? 'text-error-light' : 'text-error'
                        }`}
                      >
                        Correction: {item.correction}
                      </Text>
                    </View>
                  )}

                  {item.audioUrl && item.role === 'assistant' && (
                    <View className="mt-2">
                      <AudioPlayButton audioUrl={item.audioUrl} size={32} />
                    </View>
                  )}
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View className="flex-1 justify-center items-center">
                <Text className="text-base text-text-tertiary">Start the conversation!</Text>
              </View>
            }
          />

          {/* Typing indicator */}
          {isSending && (
            <View className="px-5 pb-1">
              <Text className="text-[13px] text-text-tertiary italic">AI is typing...</Text>
            </View>
          )}

          {/* Input */}
          <View className="flex-row items-end px-4 py-3 border-t border-dark-border">
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Type a message..."
              placeholderTextColor="#64748B"
              multiline
              maxLength={500}
              className="flex-1 border-2 border-dark-border bg-dark-card-alt rounded-[14px] px-4 py-3 text-base text-text-primary mr-3 max-h-24"
              accessibilityLabel="Message input"
              returnKeyType="send"
              blurOnSubmit
              onSubmitEditing={handleSend}
            />
            <Pressable
              onPress={handleSend}
              disabled={!input.trim() || isSending}
              className={`w-11 h-11 rounded-[22px] justify-center items-center ${
                input.trim() && !isSending ? 'bg-primary' : 'bg-primary-light'
              }`}
              accessibilityRole="button"
              accessibilityLabel="Send message"
            >
              {isSending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="send" size={18} color="#fff" />
              )}
            </Pressable>
          </View>

          {error && (
            <Text className="text-[13px] text-error text-center pb-2">
              {error}
            </Text>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GradientBackground>
  );
}
