import { useState, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { VoiceSelector } from '../../../components/practice/VoiceSelector';
import { PERSONALITY_LIST } from '../../../config/personalities';
import { useProfile } from '../../../hooks/useProfile';
import { updateVoicePreference } from '../../../lib/supabase-queries';
import { trackEvent } from '../../../lib/analytics';
import type { AIPersonalityId } from '../../../types';

export default function VoicesScreen() {
  const router = useRouter();
  const { profile, refresh: refreshProfile } = useProfile();
  const [isUpdating, setIsUpdating] = useState(false);

  const currentId = (profile?.voicePreference ?? 'sofia') as AIPersonalityId;

  const handleSelect = useCallback(
    async (id: AIPersonalityId) => {
      if (id === currentId || !profile?.userId) return;
      setIsUpdating(true);
      try {
        await updateVoicePreference(profile.userId, id);
        trackEvent('personality_changed', { personalityId: id });
        await refreshProfile();
      } catch {
        // Silent fail — the UI will stay on current selection
      } finally {
        setIsUpdating(false);
      }
    },
    [currentId, profile?.userId, refreshProfile]
  );

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
          AI Voices
        </Text>
        <Text style={{ fontSize: 15, color: '#666', marginBottom: 24 }}>
          Choose your AI language tutor personality.
        </Text>
      </View>

      <VoiceSelector
        personalities={PERSONALITY_LIST}
        currentId={currentId}
        onSelect={handleSelect}
        isUpdating={isUpdating}
      />

      {/* Personality Details */}
      <View style={{ padding: 20, flex: 1 }}>
        {PERSONALITY_LIST.map((p) => (
          <View
            key={p.id}
            style={{
              backgroundColor: p.id === currentId ? '#EEF2FF' : '#F9FAFB',
              padding: 16,
              borderRadius: 14,
              marginBottom: 10,
              borderWidth: p.id === currentId ? 2 : 1,
              borderColor: p.id === currentId ? '#6366F1' : '#E5E7EB',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 24, marginRight: 10 }}>{p.avatar}</Text>
              <Text style={{ fontSize: 17, fontWeight: '600' }}>{p.name}</Text>
              {p.id === currentId && (
                <View
                  style={{
                    marginLeft: 8,
                    backgroundColor: '#6366F1',
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 6,
                  }}
                >
                  <Text style={{ fontSize: 11, color: '#fff', fontWeight: '600' }}>Active</Text>
                </View>
              )}
            </View>
            <Text style={{ fontSize: 14, color: '#6B7280', lineHeight: 20 }}>{p.description}</Text>
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}
