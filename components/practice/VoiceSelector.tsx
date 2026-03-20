import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import type { AIPersonality, AIPersonalityId } from '../../types';

interface VoiceSelectorProps {
  personalities: AIPersonality[];
  currentId: AIPersonalityId;
  onSelect: (id: AIPersonalityId) => void;
  isUpdating?: boolean;
}

export function VoiceSelector({
  personalities,
  currentId,
  onSelect,
  isUpdating,
}: VoiceSelectorProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 4 }}
    >
      {personalities.map((p) => {
        const isSelected = p.id === currentId;
        return (
          <Pressable
            key={p.id}
            onPress={() => onSelect(p.id)}
            disabled={isUpdating}
            style={{
              width: 140,
              padding: 16,
              borderRadius: 16,
              backgroundColor: isSelected ? '#6366F1' : '#F9FAFB',
              borderWidth: 2,
              borderColor: isSelected ? '#4F46E5' : '#E5E7EB',
              alignItems: 'center',
              opacity: isUpdating ? 0.6 : 1,
            }}
            accessibilityRole="button"
            accessibilityLabel={`Select ${p.name} voice: ${p.description}`}
            accessibilityState={{ selected: isSelected }}
          >
            <Text style={{ fontSize: 32, marginBottom: 8 }}>{p.avatar}</Text>
            <Text
              style={{
                fontSize: 16,
                fontWeight: '700',
                color: isSelected ? '#fff' : '#111827',
                marginBottom: 4,
              }}
            >
              {p.name}
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: isSelected ? '#C7D2FE' : '#6B7280',
                textAlign: 'center',
                lineHeight: 16,
              }}
              numberOfLines={2}
            >
              {p.description}
            </Text>
            {isSelected && (
              <View
                style={{
                  marginTop: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                  borderRadius: 10,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                }}
              >
                <Text style={{ fontSize: 11, color: '#fff', fontWeight: '600' }}>Selected</Text>
              </View>
            )}
          </Pressable>
        );
      })}
      {isUpdating && (
        <View style={{ justifyContent: 'center', paddingLeft: 8 }}>
          <ActivityIndicator size="small" color="#6366F1" />
        </View>
      )}
    </ScrollView>
  );
}
