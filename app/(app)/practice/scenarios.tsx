import { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useProfile } from '../../../hooks/useProfile';
import { ScenarioSelector } from '../../../components/practice/ScenarioSelector';
import { fetchScenarios } from '../../../lib/supabase-queries';
import { trackEvent } from '../../../lib/analytics';
import type { Scenario, LanguageCode } from '../../../types';

export default function ScenariosScreen() {
  const router = useRouter();
  const { profile } = useProfile();
  const targetLanguage = (profile?.targetLanguage ?? 'es') as LanguageCode;

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadScenarios = useCallback(
    async (category?: string) => {
      setIsLoading(true);
      try {
        const data = await fetchScenarios(targetLanguage, category);
        setScenarios(data);
      } catch {
        setScenarios([]);
      } finally {
        setIsLoading(false);
      }
    },
    [targetLanguage]
  );

  useEffect(() => {
    loadScenarios();
  }, [loadScenarios]);

  const handleSelect = (scenario: Scenario) => {
    trackEvent('scenario_selected', {
      scenarioId: scenario.id,
      title: scenario.title,
      category: scenario.category,
    });
    // Navigate to voice practice with scenario context
    router.push({
      pathname: '/(app)/practice/voice',
      params: { scenarioId: scenario.id, scenarioTitle: scenario.title },
    });
  };

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
          Scenarios
        </Text>
        <Text style={{ fontSize: 15, color: '#666', marginBottom: 20 }}>
          Practice real-world conversations in {targetLanguage.toUpperCase()}.
        </Text>
      </View>

      <ScenarioSelector
        scenarios={scenarios}
        isLoading={isLoading}
        onSelect={handleSelect}
        onFilterCategory={(cat) => loadScenarios(cat)}
      />
    </SafeAreaView>
  );
}
