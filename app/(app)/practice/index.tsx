import { useState } from 'react';
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
import { useProfile } from '../../../hooks/useProfile';
import { usePracticeSession } from '../../../hooks/usePracticeSession';
import { AudioPlayButton } from '../../../components/audio/AudioPlayButton';
import { trackEvent } from '../../../lib/analytics';
import type { ConversationMessage, LanguageCode, ProficiencyLevel } from '../../../types';

const TOPICS = [
  'Daily Routine',
  'Ordering Food',
  'Asking for Directions',
  'At the Store',
  'Meeting Someone New',
  'Travel Plans',
  'Hobbies & Interests',
  'Weather & Seasons',
  'Family & Friends',
  'Free Conversation',
];

export default function PracticeScreen() {
  const router = useRouter();
  const { profile } = useProfile();
  const {
    messages,
    isSending,
    isLoading,
    error,
    sessionId,
    startSession,
    sendMessage,
    endSession,
  } = usePracticeSession();

  const [input, setInput] = useState('');

  const targetLanguage = (profile?.targetLanguage ?? 'es') as LanguageCode;
  const level = (profile?.level ?? 'beginner') as ProficiencyLevel;

  const handleStartSession = async (topic: string) => {
    trackEvent('practice_started', { topic, targetLanguage, level });
    await startSession(topic, targetLanguage, level);
  };

  const handleSend = async () => {
    if (!input.trim() || isSending) return;
    const text = input.trim();
    setInput('');
    await sendMessage(text);
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
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: 4 }} accessibilityRole="header">
            AI Practice
          </Text>
          <Text style={{ fontSize: 15, color: '#666', marginBottom: 24 }}>
            Choose a topic to practice {targetLanguage.toUpperCase()} conversation.
          </Text>
        </View>

        <FlatList
          data={TOPICS}
          keyExtractor={(item) => item}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleStartSession(item)}
              disabled={isLoading}
              style={{
                backgroundColor: '#F9FAFB',
                padding: 18,
                borderRadius: 14,
                marginBottom: 10,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
              accessibilityRole="button"
              accessibilityLabel={`Practice topic: ${item}`}
            >
              <Text style={{ fontSize: 16, fontWeight: '500' }}>{item}</Text>
              <Text style={{ fontSize: 18, color: '#C7D2FE' }}>{'>'}</Text>
            </Pressable>
          )}
        />

        {isLoading && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.8)' }}>
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={{ marginTop: 12, color: '#666' }}>Starting session...</Text>
          </View>
        )}
      </SafeAreaView>
    );
  }

  // ─── Active Conversation ──────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 16,
            borderBottomWidth: 0.5,
            borderBottomColor: '#E5E7EB',
          }}
        >
          <View>
            <Text style={{ fontSize: 18, fontWeight: '700' }} accessibilityRole="header">
              AI Conversation
            </Text>
            <Text style={{ fontSize: 13, color: '#666' }}>
              {targetLanguage.toUpperCase()} | {level}
            </Text>
          </View>
          <Pressable
            onPress={handleEnd}
            style={{
              backgroundColor: '#FEE2E2',
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 10,
            }}
            accessibilityRole="button"
            accessibilityLabel="End conversation"
          >
            <Text style={{ color: '#DC2626', fontWeight: '600', fontSize: 14 }}>End</Text>
          </Pressable>
        </View>

        {/* Messages */}
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          renderItem={({ item }) => (
            <View
              style={{
                alignSelf: item.role === 'user' ? 'flex-end' : 'flex-start',
                backgroundColor: item.role === 'user' ? '#6366F1' : '#F3F4F6',
                padding: 14,
                borderRadius: 18,
                borderBottomRightRadius: item.role === 'user' ? 4 : 18,
                borderBottomLeftRadius: item.role === 'user' ? 18 : 4,
                marginBottom: 8,
                maxWidth: '82%',
              }}
            >
              <Text
                style={{
                  color: item.role === 'user' ? '#fff' : '#111',
                  fontSize: 16,
                  lineHeight: 22,
                }}
              >
                {item.content}
              </Text>

              {item.correction && (
                <View
                  style={{
                    marginTop: 8,
                    paddingTop: 8,
                    borderTopWidth: 0.5,
                    borderTopColor: item.role === 'user' ? 'rgba(255,255,255,0.3)' : '#D1D5DB',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      color: item.role === 'user' ? '#FCA5A5' : '#DC2626',
                      fontStyle: 'italic',
                    }}
                  >
                    Correction: {item.correction}
                  </Text>
                </View>
              )}

              {item.audioUrl && item.role === 'assistant' && (
                <View style={{ marginTop: 8 }}>
                  <AudioPlayButton audioUrl={item.audioUrl} size={32} />
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 16, color: '#999' }}>Start the conversation!</Text>
            </View>
          }
        />

        {/* Typing indicator */}
        {isSending && (
          <View style={{ paddingHorizontal: 20, paddingBottom: 4 }}>
            <Text style={{ fontSize: 13, color: '#999', fontStyle: 'italic' }}>AI is typing...</Text>
          </View>
        )}

        {/* Input */}
        <View
          style={{
            flexDirection: 'row',
            padding: 12,
            borderTopWidth: 0.5,
            borderTopColor: '#E5E7EB',
            alignItems: 'flex-end',
          }}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Type a message..."
            multiline
            maxLength={500}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: '#D1D5DB',
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 10,
              fontSize: 16,
              marginRight: 8,
              maxHeight: 100,
            }}
            accessibilityLabel="Message input"
            returnKeyType="send"
            blurOnSubmit
            onSubmitEditing={handleSend}
          />
          <Pressable
            onPress={handleSend}
            disabled={!input.trim() || isSending}
            style={{
              backgroundColor: input.trim() && !isSending ? '#6366F1' : '#C7D2FE',
              width: 44,
              height: 44,
              borderRadius: 22,
              justifyContent: 'center',
              alignItems: 'center',
            }}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            {isSending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 18 }}>{'>'}</Text>
            )}
          </Pressable>
        </View>

        {error && (
          <Text style={{ fontSize: 13, color: '#EF4444', textAlign: 'center', paddingBottom: 8 }}>
            {error}
          </Text>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
