import { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../hooks/useAuth';
import { fetchWeeklyTopMistakes } from '../../../lib/supabase-queries';
import type { WeeklyMistakeRow } from '../../../lib/supabase-queries';
import { GlowLayer } from '../../../components/ui/GlowBackground';
import { colors } from '../../../config/theme';

const ERROR_TYPE_META: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  grammar: { label: 'Grammar', icon: 'construct-outline', color: '#B497C4' },
  vocabulary: { label: 'Vocabulary', icon: 'book-outline', color: '#86B4CE' },
  spelling: { label: 'Spelling', icon: 'text-outline', color: '#D9913C' },
  word_order: { label: 'Word order', icon: 'swap-horizontal-outline', color: '#E0A5B6' },
  tense: { label: 'Tense', icon: 'time-outline', color: '#4E9F6B' },
  gender: { label: 'Gender', icon: 'female-outline', color: '#E0A5B6' },
  other: { label: 'Other', icon: 'alert-circle-outline', color: '#9C968A' },
};

export default function TopMistakesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [rows, setRows] = useState<WeeklyMistakeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await fetchWeeklyTopMistakes(user.id, 5);
      setRows(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load top mistakes');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.base }}>
      <GlowLayer />
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
        <Pressable
          onPress={() => router.back()}
          style={{ padding: 8, marginRight: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color="#9C968A" />
        </Pressable>
        <Text
          style={{ fontSize: 22, fontWeight: '700', color: '#F2EFE9' }}
          accessibilityRole="header"
        >
          Top mistakes this week
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 80 }}>
        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#E0BE6B" />
          </View>
        ) : error ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <Text style={{ color: '#E39098', fontSize: 14 }}>{error}</Text>
          </View>
        ) : rows.length === 0 ? (
          <View style={{ paddingVertical: 60, alignItems: 'center' }}>
            <Ionicons name="sparkles-outline" size={48} color="#9C968A" />
            <Text style={{ color: '#F2EFE9', fontSize: 18, fontWeight: '600', marginTop: 12, textAlign: 'center' }}>
              No recurring mistakes this week
            </Text>
            <Text style={{ color: '#9C968A', fontSize: 14, marginTop: 4, textAlign: 'center' }}>
              Keep practicing — we'll surface patterns as they appear.
            </Text>
          </View>
        ) : (
          rows.map((row, idx) => {
            const meta = ERROR_TYPE_META[row.errorType] ?? ERROR_TYPE_META.other;
            return (
              <View
                key={`${row.shortLabel}-${row.errorType}-${idx}`}
                style={{
                  backgroundColor: '#1B1A17',
                  borderRadius: 20,
                  padding: 16,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.08)',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <View
                    style={{
                      width: 36, height: 36, borderRadius: 18,
                      backgroundColor: `${meta.color}33`,
                      alignItems: 'center', justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Ionicons name={meta.icon} size={20} color={meta.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: meta.color, textTransform: 'uppercase' }}>
                      {meta.label}
                    </Text>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#F2EFE9' }}>
                      {row.shortLabel}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 13, color: '#9C968A', marginBottom: 12 }}>
                  Made {row.count} {row.count === 1 ? 'time' : 'times'} this week.
                </Text>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/(app)/review/drill',
                      params: {
                        shortLabel: row.shortLabel,
                        errorType: row.errorType,
                      },
                    })
                  }
                  style={{
                    backgroundColor: colors.action.primaryFill,
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: 'center',
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Drill ${row.shortLabel} now`}
                >
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>
                    Drill this now
                  </Text>
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
