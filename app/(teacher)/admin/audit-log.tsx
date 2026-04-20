import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GradientBackground } from '../../../components/ui/GradientBackground';
import { GlassSurface } from '../../../components/ui/GlassSurface';
import { useSchoolStore } from '../../../stores/useSchoolStore';
import { fetchAuditLogs } from '../../../lib/supabase-queries';

interface AuditEntry {
  id: string;
  createdAt: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  ipAddress: string | null;
}

const FILTER_OPTIONS = ['All', 'create', 'update', 'delete', 'grant'] as const;

function formatTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

const ACTION_COLORS: Record<string, string> = {
  create: '#22C55E',
  update: '#38BDF8',
  delete: '#EF4444',
  grant: '#A855F7',
  read: '#94A3B8',
};

export default function AuditLogScreen() {
  const router = useRouter();
  const { organization } = useSchoolStore();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('All');

  const load = useCallback(async () => {
    if (!organization?.id) return;
    try {
      const opts: { action?: string; limit?: number } = { limit: 100 };
      if (filter !== 'All') opts.action = filter;
      const logs = await fetchAuditLogs(organization.id, opts);
      setEntries(logs);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    }
  }, [organization?.id, filter]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <GradientBackground>
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-1 px-4 pt-2">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="flex-row items-center mb-4"
          >
            <Ionicons name="chevron-back" size={24} color="#38BDF8" />
            <Text className="text-base text-primary ml-1" style={{ fontFamily: 'Inter_600SemiBold' }}>Back</Text>
          </Pressable>

          <Text
            className="text-[28px] text-text-primary mb-4"
            style={{ fontFamily: 'Inter_700Bold' }}
            accessibilityRole="header"
          >
            Audit Log
          </Text>

          {/* Filter Chips */}
          <View className="flex-row mb-4" style={{ gap: 8 }}>
            {FILTER_OPTIONS.map((opt) => (
              <Pressable
                key={opt}
                onPress={() => setFilter(opt)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: filter === opt ? 'rgba(56, 189, 248, 0.2)' : 'rgba(30, 35, 50, 0.6)',
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: filter === opt }}
              >
                <Text
                  style={{
                    color: filter === opt ? '#38BDF8' : '#94A3B8',
                    fontSize: 13,
                    fontFamily: 'Inter_600SemiBold',
                  }}
                >
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          {loading ? (
            <ActivityIndicator color="#38BDF8" size="large" style={{ marginTop: 32 }} />
          ) : (
            <FlatList
              data={entries}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 100 }}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#38BDF8" />
              }
              renderItem={({ item }) => (
                <GlassSurface style={{ marginBottom: 8 }} innerStyle={{ padding: 12 }}>
                  <View className="flex-row items-center justify-between mb-1">
                    <View className="flex-row items-center" style={{ gap: 8 }}>
                      <View
                        style={{
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 4,
                          backgroundColor: `${ACTION_COLORS[item.action] ?? '#94A3B8'}20`,
                        }}
                      >
                        <Text style={{ color: ACTION_COLORS[item.action] ?? '#94A3B8', fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>
                          {item.action.toUpperCase()}
                        </Text>
                      </View>
                      <Text className="text-xs text-text-secondary" style={{ fontFamily: 'Inter_500Medium' }}>
                        {item.actorRole}
                      </Text>
                    </View>
                    <Text className="text-xs text-text-secondary" style={{ fontFamily: 'Inter_400Regular' }}>
                      {formatTimestamp(item.createdAt)}
                    </Text>
                  </View>
                  <Text className="text-sm text-text-primary" style={{ fontFamily: 'Inter_400Regular' }}>
                    {item.resourceType}{item.resourceId ? ` (${item.resourceId.slice(0, 8)}...)` : ''}
                  </Text>
                  {item.ipAddress && (
                    <Text className="text-xs text-text-secondary mt-1" style={{ fontFamily: 'Inter_400Regular' }}>
                      IP: {item.ipAddress}
                    </Text>
                  )}
                </GlassSurface>
              )}
              ListEmptyComponent={
                <View className="items-center mt-8">
                  <Ionicons name="document-text-outline" size={48} color="#64748B" />
                  <Text className="text-base text-text-secondary mt-3" style={{ fontFamily: 'Inter_500Medium' }}>
                    No audit entries found
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
}
