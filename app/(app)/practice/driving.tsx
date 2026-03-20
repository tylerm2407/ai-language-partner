import { useEffect } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useVoiceSession } from '../../../hooks/useVoiceSession';
import { useProfile } from '../../../hooks/useProfile';
import { DrivingModeUI } from '../../../components/practice/DrivingModeUI';
import { trackEvent } from '../../../lib/analytics';
import type { LanguageCode, ProficiencyLevel } from '../../../types';

const DRIVING_TOPICS = [
  'Free Conversation',
  'Daily Routine',
  'Travel Plans',
  'Ordering Food',
  'Meeting Someone New',
  'Hobbies & Interests',
  'Weather & Seasons',
];

export default function DrivingModeScreen() {
  const router = useRouter();
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

  // Keep screen awake during driving mode
  useEffect(() => {
    if (state === 'listening' || state === 'ai-speaking' || state === 'connecting') {
      activateKeepAwakeAsync('driving-mode');
    }
    return () => {
      deactivateKeepAwake('driving-mode');
    };
  }, [state]);

  const lastAIMessage = (() => {
    for (let i = transcript.length - 1; i >= 0; i--) {
      if (transcript[i].speaker === 'ai') return transcript[i].text;
    }
    return null;
  })();

  const handleStart = async (topic: string) => {
    trackEvent('driving_mode_started', { topic, targetLanguage, level });
    await startSession(topic, profile?.voicePreference);
  };

  const handleStop = async () => {
    trackEvent('driving_mode_ended', { durationSeconds: elapsedSeconds });
    await endSession();
    // Navigate to review screen with session data
    router.replace({
      pathname: '/(app)/practice/review',
      params: { source: 'driving' },
    });
  };

  // Active driving session — show minimal UI
  if (state === 'connecting' || state === 'listening' || state === 'ai-speaking') {
    return (
      <DrivingModeUI
        state={state}
        elapsedSeconds={elapsedSeconds}
        lastAIMessage={lastAIMessage}
        onStop={handleStop}
      />
    );
  }

  // Topic selection
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#111827' }}>
      <View style={{ padding: 24 }}>
        <Pressable
          onPress={() => router.back()}
          style={{ marginBottom: 20 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={{ fontSize: 16, color: '#818CF8' }}>Back</Text>
        </Pressable>
        <Text style={{ fontSize: 32, fontWeight: '700', color: '#fff', marginBottom: 4 }} accessibilityRole="header">
          Driving Mode
        </Text>
        <Text style={{ fontSize: 16, color: '#9CA3AF', marginBottom: 8 }}>
          Hands-free voice practice in {targetLanguage.toUpperCase()}.
        </Text>
        <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 24 }}>
          Large UI, works with screen locked. Perfect for driving or walking.
        </Text>

        {error && (
          <View style={{ backgroundColor: 'rgba(239,68,68,0.15)', padding: 14, borderRadius: 12, marginBottom: 16 }}>
            <Text style={{ color: '#FCA5A5', fontSize: 14 }}>{error}</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
        {DRIVING_TOPICS.map((topic) => (
          <Pressable
            key={topic}
            onPress={() => handleStart(topic)}
            style={{
              backgroundColor: 'rgba(255,255,255,0.08)',
              padding: 22,
              borderRadius: 16,
              marginBottom: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
            accessibilityRole="button"
            accessibilityLabel={`Start driving practice: ${topic}`}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: 'rgba(99,102,241,0.2)',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 16,
                }}
              >
                <Text style={{ fontSize: 22 }}>🎙</Text>
              </View>
              <Text style={{ fontSize: 18, fontWeight: '500', color: '#E5E7EB' }}>{topic}</Text>
            </View>
            <Text style={{ fontSize: 20, color: '#4B5563' }}>{'>'}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
