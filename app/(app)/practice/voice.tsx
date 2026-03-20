import { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useVoiceSession } from '../../../hooks/useVoiceSession';
import { useProfile } from '../../../hooks/useProfile';
import { VoiceSelector } from '../../../components/practice/VoiceSelector';
import { PERSONALITY_LIST } from '../../../config/personalities';
import { trackEvent } from '../../../lib/analytics';
import type { AIPersonalityId, LanguageCode, ProficiencyLevel } from '../../../types';

const VOICE_TOPICS = [
  'Daily Routine',
  'Ordering Food',
  'Asking for Directions',
  'At the Store',
  'Meeting Someone New',
  'Travel Plans',
  'Free Conversation',
];

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function VoiceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { profile } = useProfile();
  const {
    state,
    elapsedSeconds,
    transcript,
    corrections,
    vocabulary,
    xpEarned,
    error,
    startSession,
    endSession,
  } = useVoiceSession();

  const targetLanguage = (profile?.targetLanguage ?? 'es') as LanguageCode;
  const level = (profile?.level ?? 'beginner') as ProficiencyLevel;

  // Personality selection — default to profile preference
  const [selectedPersonality, setSelectedPersonality] = useState<AIPersonalityId>(
    (profile?.voicePreference ?? 'sofia') as AIPersonalityId
  );

  // Scenario from route params (when navigating from scenarios screen)
  const scenarioId = params.scenarioId as string | undefined;
  const scenarioTitle = params.scenarioTitle as string | undefined;

  // Pulsing animation for the center circle
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.6);

  const startPulse = () => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 800 }),
        withTiming(0.4, { duration: 800 }),
      ),
      -1,
    );
  };

  const stopPulse = () => {
    pulseScale.value = withTiming(1, { duration: 300 });
    pulseOpacity.value = withTiming(0.6, { duration: 300 });
  };

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const getCircleColor = () => {
    switch (state) {
      case 'listening': return '#3B82F6'; // blue
      case 'ai-speaking': return '#8B5CF6'; // purple
      case 'connecting': return '#F59E0B'; // amber
      default: return '#9CA3AF'; // gray
    }
  };

  const getStateLabel = () => {
    switch (state) {
      case 'idle': return 'Tap a topic to start';
      case 'connecting': return 'Connecting...';
      case 'listening': return 'Listening...';
      case 'ai-speaking': return 'AI is speaking...';
      case 'ended': return 'Session ended';
      case 'error': return 'Connection error';
      default: return '';
    }
  };

  const handleStart = async (topic: string) => {
    trackEvent('voice_practice_started', { topic, targetLanguage, level });
    startPulse();
    await startSession(topic, selectedPersonality, scenarioId);
  };

  const handleEnd = async () => {
    stopPulse();
    trackEvent('voice_practice_ended', {
      durationSeconds: elapsedSeconds,
      transcriptLength: transcript.length,
    });
    await endSession();
    // Navigate to review screen
    router.replace('/(app)/practice/review');
  };

  // ─── Topic Selection ──────────────────────────────────────────

  if (state === 'idle' || state === 'error') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ padding: 20 }}>
          <Pressable
            onPress={() => router.back()}
            style={{ marginBottom: 16 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={{ fontSize: 16, color: '#6366F1' }}>Back</Text>
          </Pressable>
          <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: 4 }} accessibilityRole="header">
            Voice Practice
          </Text>
          <Text style={{ fontSize: 15, color: '#666', marginBottom: 24 }}>
            Have a real-time voice conversation with an AI tutor in {targetLanguage.toUpperCase()}.
          </Text>

          {error && (
            <View style={{ backgroundColor: '#FEE2E2', padding: 14, borderRadius: 12, marginBottom: 16 }}>
              <Text style={{ color: '#DC2626', fontSize: 14 }}>{error}</Text>
            </View>
          )}
        </View>

        {/* AI Voice Selector */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#374151', paddingHorizontal: 20, marginBottom: 8 }}>
            AI Voice
          </Text>
          <VoiceSelector
            personalities={PERSONALITY_LIST}
            currentId={selectedPersonality}
            onSelect={(id) => setSelectedPersonality(id)}
            isUpdating={false}
          />
        </View>

        {/* Scenario context if navigated from scenarios screen */}
        {scenarioTitle && (
          <View style={{ marginHorizontal: 20, marginBottom: 16, backgroundColor: '#FFF7ED', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#FED7AA' }}>
            <Text style={{ fontSize: 13, color: '#9A3412', fontWeight: '600' }}>Scenario</Text>
            <Text style={{ fontSize: 15, color: '#EA580C', marginTop: 2 }}>{scenarioTitle}</Text>
          </View>
        )}

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          {scenarioTitle && (
            <Pressable
              onPress={() => handleStart(scenarioTitle)}
              style={{
                backgroundColor: '#EEF2FF',
                padding: 18,
                borderRadius: 14,
                marginBottom: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderWidth: 1,
                borderColor: '#C7D2FE',
              }}
              accessibilityRole="button"
              accessibilityLabel={`Start scenario: ${scenarioTitle}`}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                  <Text style={{ fontSize: 16, color: '#fff' }}>🎭</Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#312E81' }}>Start Scenario</Text>
              </View>
              <Text style={{ fontSize: 18, color: '#6366F1' }}>{'>'}</Text>
            </Pressable>
          )}
          {VOICE_TOPICS.map((topic) => (
            <Pressable
              key={topic}
              onPress={() => handleStart(topic)}
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
              accessibilityLabel={`Voice practice topic: ${topic}`}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: '#EEF2FF',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 14,
                  }}
                >
                  <Text style={{ fontSize: 16 }}>🎙</Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: '500' }}>{topic}</Text>
              </View>
              <Text style={{ fontSize: 18, color: '#C7D2FE' }}>{'>'}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Post-session: navigate to review (handled in handleEnd)

  // ─── Active Voice Session ─────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Top Bar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: 16,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{
              backgroundColor: '#EEF2FF',
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 8,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#6366F1' }}>
              {targetLanguage.toUpperCase()}
            </Text>
          </View>
          <Text style={{ fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
            {formatTime(elapsedSeconds)}
          </Text>
        </View>

        <Pressable
          onPress={handleEnd}
          style={{
            backgroundColor: '#FEE2E2',
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 12,
          }}
          accessibilityRole="button"
          accessibilityLabel="End voice session"
        >
          <Text style={{ color: '#DC2626', fontWeight: '600', fontSize: 15 }}>End</Text>
        </Pressable>
      </View>

      {/* Center: Pulsing Circle */}
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        {state === 'connecting' ? (
          <ActivityIndicator size="large" color="#6366F1" />
        ) : (
          <Animated.View
            style={[
              {
                width: 180,
                height: 180,
                borderRadius: 90,
                backgroundColor: getCircleColor(),
                justifyContent: 'center',
                alignItems: 'center',
              },
              pulseStyle,
            ]}
          >
            <Text style={{ fontSize: 40 }}>🎙</Text>
          </Animated.View>
        )}
        <Text style={{ fontSize: 17, color: '#666', marginTop: 24, fontWeight: '500' }}>
          {getStateLabel()}
        </Text>
      </View>

      {/* Bottom: Recent Transcript */}
      {transcript.length > 0 && (
        <View
          style={{
            paddingHorizontal: 20,
            paddingBottom: 20,
            maxHeight: 140,
          }}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            {transcript.slice(-3).map((entry) => (
              <View key={entry.id} style={{ marginBottom: 6 }}>
                <Text style={{ fontSize: 12, color: '#999', fontWeight: '600' }}>
                  {entry.speaker === 'user' ? 'You' : 'AI'}
                </Text>
                <Text style={{ fontSize: 14, color: '#374151' }} numberOfLines={2}>
                  {entry.text}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
}
