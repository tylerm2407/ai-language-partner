import { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../hooks/useAuth';
import { fetchWeeklyTopMistakes } from '../../../lib/supabase-queries';
import type { WeeklyMistakeRow } from '../../../lib/supabase-queries';

const ERROR_TYPE_META: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  grammar: { label: 'Grammar', icon: 'construct-outline', color: '#A78BFA' },
  vocabulary: { label: 'Vocabulary', icon: 'book-outline', color: '#60A5FA' },
  spelling: { label: 'Spelling', icon: 'text-outline', color: '#FBBF24' },
  word_order: { label: 'Word order', icon: 'swap-horizontal-outline', color: '#F472B6' },
  tense: { label: 'Tense', icon: 'time-outline', color: '#34D399' },
  gender: { label: 'Gender', icon: 'female-outline', color: '#F472B6' },
  other: { label: 'Other', icon: 'alert-circle-outline', color: '#94A3B8' },
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0C0F14' }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
        <Pressable
          onPress={() => router.back()}
          style={{ padding: 8, marginRight: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color="#94A3B8" />
        </Pressable>
        <Text
          style={{ fontSize: 22, fontWeight: '700', color: '#F1F5F9' }}
          accessibilityRole="header"
        >
          Top mistakes this week
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 80 }}>
        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#38BDF8" />
          </View>
        ) : error ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <Text style={{ color: '#F87171', fontSize: 14 }}>{error}</Text>
          </View>
        ) : rows.length === 0 ? (
          <View style={{ paddingVertical: 60, alignItems: 'center' }}>
            <Ionicons name="sparkles-outline" size={48} color="#94A3B8" />
            <Text style={{ color: '#F1F5F9', fontSize: 18, fontWeight: '600', marginTop: 12, textAlign: 'center' }}>
              No recurring mistakes this week
            </Text>
            <Text style={{ color: '#94A3B8', fontSize: 14, marginTop: 4, textAlign: 'center' }}>
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
                  backgroundColor: '#151921',
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
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#F1F5F9' }}>
                      {row.shortLabel}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 13, color: '#94A3B8', marginBottom: 12 }}>
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
                    backgroundColor: '#38BDF8',
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
