import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSafeBack } from '../../../hooks/useSafeBack';
import { Ionicons } from '@expo/vector-icons';
import { SlabCard } from '../../../components/ui2/SlabCard';
import { useSchoolStore } from '../../../stores/useSchoolStore';
import { fetchAuditLogs } from '../../../lib/supabase-queries';
// `colors` is deliberately not imported: it is the fixed DARK palette. Colour
// comes from useUi2Theme(); only the scheme-independent types come from here.
import type { Ui2Palette } from '../../../config/theme';
import { useUi2Theme } from '../../../hooks/useUi2Theme';
import { Ui2InlineError } from '../../../components/ui2/Ui2InlineError';
import { loadErrorCopy, type ErrorCopy } from '../../../lib/error-copy';

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

/**
 * Per-action colour, as a palette lookup rather than the old fixed hex map —
 * the pill has to stay legible in both schemes, and `read`/unknown actions
 * share the muted default the old `?? '#94A3B8'` fallback gave them.
 */
const actionTone = (c: Ui2Palette, action: string): { fg: string; bg: string } => {
  switch (action) {
    case 'create':
      return { fg: c.green, bg: c.greenTint };
    case 'update':
      return { fg: c.primary, bg: c.primaryTint };
    case 'delete':
      return { fg: c.error, bg: c.pinkTint };
    case 'grant':
      return { fg: c.pink, bg: c.pinkTint };
    default:
      return { fg: c.idle, bg: c.surface2 };
  }
};

export default function AuditLogScreen() {
  const { c } = useUi2Theme();
  const goBack = useSafeBack('/(teacher)');
  const { organization } = useSchoolStore();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('All');
  const [error, setError] = useState<ErrorCopy | null>(null);

  const load = useCallback(async () => {
    if (!organization?.id) return;
    setError(null);
    try {
      const opts: { action?: string; limit?: number } = { limit: 100 };
      if (filter !== 'All') opts.action = filter;
      const logs = await fetchAuditLogs(organization.id, opts);
      setEntries(logs);
    } catch (err) {
      // An empty audit log and an unreachable one are very different claims to
      // make to an administrator.
      console.error('Failed to load audit logs:', err);
      setError(loadErrorCopy(err, 'the audit log'));
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
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-1 px-4 pt-2">
          <Pressable
            onPress={() => goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="flex-row items-center mb-4"
          >
            <Ionicons name="chevron-back" size={24} color={c.primary} />
            <Text className="text-base ml-1" style={{ fontFamily: 'Nunito_600SemiBold', color: c.primary }}>Back</Text>
          </Pressable>

          <Text
            className="text-[28px] mb-4"
            style={{ fontFamily: 'Nunito_800ExtraBold', color: c.ink }}
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
                  backgroundColor: filter === opt ? c.primaryTint : c.surface2,
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: filter === opt }}
              >
                <Text
                  style={{
                    color: filter === opt ? c.onTint : c.muted,
                    fontSize: 13,
                    fontFamily: 'Nunito_600SemiBold',
                  }}
                >
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          {loading ? (
            <ActivityIndicator color={c.primary} size="large" style={{ marginTop: 32 }} />
          ) : error ? (
            <Ui2InlineError copy={error} onRetry={load} />
          ) : (
            <FlatList
              data={entries}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 100 }}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={c.primary} />
              }
              renderItem={({ item }) => (
                <SlabCard style={{ marginBottom: 8, padding: 12 }}>
                  <View className="flex-row items-center justify-between mb-1">
                    <View className="flex-row items-center" style={{ gap: 8 }}>
                      <View
                        style={{
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 4,
                          backgroundColor: actionTone(c, item.action).bg,
                        }}
                      >
                        <Text style={{ color: actionTone(c, item.action).fg, fontSize: 11, fontFamily: 'Nunito_600SemiBold' }}>
                          {item.action.toUpperCase()}
                        </Text>
                      </View>
                      <Text className="text-xs" style={{ fontFamily: 'Nunito_500Medium', color: c.muted }}>
                        {item.actorRole}
                      </Text>
                    </View>
                    <Text className="text-xs" style={{ fontFamily: 'Nunito_400Regular', color: c.muted }}>
                      {formatTimestamp(item.createdAt)}
                    </Text>
                  </View>
                  <Text className="text-sm" style={{ fontFamily: 'Nunito_400Regular', color: c.ink }}>
                    {item.resourceType}{item.resourceId ? ` (${item.resourceId.slice(0, 8)}...)` : ''}
                  </Text>
                  {item.ipAddress && (
                    <Text className="text-xs mt-1" style={{ fontFamily: 'Nunito_400Regular', color: c.muted }}>
                      IP: {item.ipAddress}
                    </Text>
                  )}
                </SlabCard>
              )}
              ListEmptyComponent={
                <View className="items-center mt-8">
                  <Ionicons name="document-text-outline" size={48} color={c.idle} />
                  <Text className="text-base mt-3" style={{ fontFamily: 'Nunito_500Medium', color: c.muted }}>
                    No audit entries found
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
