import { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import type { Scenario, ScenarioCategory, ProficiencyLevel } from '../../types';

const CATEGORY_LABELS: { key: ScenarioCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'Travel', label: 'Travel' },
  { key: 'Social', label: 'Social' },
  { key: 'Professional', label: 'Professional' },
  { key: 'Daily Life', label: 'Daily Life' },
  { key: 'Emergency', label: 'Emergency' },
];

const DIFFICULTY_COLORS: Record<ProficiencyLevel, string> = {
  beginner: '#22C55E',
  elementary: '#84CC16',
  intermediate: '#F59E0B',
  upper_intermediate: '#F97316',
  advanced: '#EF4444',
};

interface ScenarioSelectorProps {
  scenarios: Scenario[];
  isLoading: boolean;
  onSelect: (scenario: Scenario) => void;
  onFilterCategory?: (category: string | undefined) => void;
}

export function ScenarioSelector({
  scenarios,
  isLoading,
  onSelect,
  onFilterCategory,
}: ScenarioSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<ScenarioCategory | 'all'>('all');

  const handleCategoryPress = (key: ScenarioCategory | 'all') => {
    setSelectedCategory(key);
    onFilterCategory?.(key === 'all' ? undefined : key);
  };

  const filtered =
    selectedCategory === 'all'
      ? scenarios
      : scenarios.filter((s) => s.category === selectedCategory);

  return (
    <View style={{ flex: 1 }}>
      {/* Category Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16, gap: 8 }}
      >
        {CATEGORY_LABELS.map(({ key, label }) => (
          <Pressable
            key={key}
            onPress={() => handleCategoryPress(key)}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: selectedCategory === key ? '#6366F1' : '#F3F4F6',
            }}
            accessibilityRole="button"
            accessibilityLabel={`Filter by ${label}`}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: selectedCategory === key ? '#fff' : '#6B7280',
              }}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Scenario Cards */}
      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 }}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 }}>
          <Text style={{ fontSize: 16, color: '#9CA3AF' }}>No scenarios available</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 12 }}>
          {filtered.map((scenario) => (
            <Pressable
              key={scenario.id}
              onPress={() => onSelect(scenario)}
              style={{
                backgroundColor: '#F9FAFB',
                padding: 16,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: '#E5E7EB',
              }}
              accessibilityRole="button"
              accessibilityLabel={`Scenario: ${scenario.title}`}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <Text style={{ fontSize: 17, fontWeight: '600', flex: 1, marginRight: 8 }}>
                  {scenario.title}
                </Text>
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 6,
                    backgroundColor: DIFFICULTY_COLORS[scenario.difficulty] + '20',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: DIFFICULTY_COLORS[scenario.difficulty],
                      textTransform: 'uppercase',
                    }}
                  >
                    {scenario.difficulty.replace('_', ' ')}
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 8 }}>
                {scenario.description}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 12, color: '#9CA3AF' }}>
                  {scenario.targetVocab.length} vocab words
                </Text>
                <Text style={{ fontSize: 12, color: '#D1D5DB' }}>|</Text>
                <Text style={{ fontSize: 12, color: '#9CA3AF' }}>
                  {scenario.category}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
