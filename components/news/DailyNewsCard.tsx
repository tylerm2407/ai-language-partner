import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SlabCard } from '../ui2/SlabCard';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import type { DailyNewsArticle } from '../../types';

interface DailyNewsCardProps {
  article: DailyNewsArticle | null;
  isLoading: boolean;
  error: string | null;
  hasRead?: boolean;
  onPress: () => void;
}

/**
 * The "Read" pill labels itself in `ink`, not `green`: the tick already carries
 * the colour, and green-on-greenTint falls under 3:1 in the light scheme.
 */
export function DailyNewsCard({ article, isLoading, error, hasRead = false, onPress }: DailyNewsCardProps) {
  const { c } = useUi2Theme();

  // Loading state: skeleton
  if (isLoading) {
    return (
      <SlabCard style={{ marginBottom: 24, padding: 0, overflow: 'hidden' }}>
        <View className="p-5 flex-row items-center">
          <View className="w-11 h-11 rounded-full items-center justify-center mr-4" style={{ backgroundColor: c.primaryTint }}>
            <Ionicons name="newspaper-outline" size={22} color={c.primary} />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold mb-1" style={{ color: c.primary }}>Today&apos;s News</Text>
            <View className="h-4 rounded w-3/4 mb-1" style={{ backgroundColor: c.track }} />
            <View className="h-3 rounded w-1/2" style={{ backgroundColor: c.track }} />
          </View>
        </View>
      </SlabCard>
    );
  }

  // No article: cron hasn't fired yet, or failed. Calm placeholder — never
  // a scary "Error" or "Generate" CTA.
  if (!article) {
    return (
      <SlabCard style={{ marginBottom: 24, padding: 0, overflow: 'hidden' }}>
        <View className="p-5 flex-row items-center">
          <View className="w-11 h-11 rounded-full items-center justify-center mr-4" style={{ backgroundColor: c.primaryTint }}>
            <Ionicons name="newspaper-outline" size={22} color={c.primary} />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold mb-1" style={{ color: c.primary }}>Today&apos;s News</Text>
            <Text className="text-sm" style={{ color: c.muted }} numberOfLines={2}>
              {error ?? 'On its way — check back shortly.'}
            </Text>
          </View>
        </View>
      </SlabCard>
    );
  }

  // Article exists: show it
  return (
    <SlabCard style={{ marginBottom: 24, padding: 0, overflow: 'hidden' }}>
      <Pressable
        className="p-5 flex-row items-center"
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={hasRead ? "Today's News, already read" : "Today's News"}
      >
        <View className="w-11 h-11 rounded-full items-center justify-center mr-4" style={{ backgroundColor: c.primaryTint }}>
          <Ionicons name="newspaper-outline" size={22} color={c.primary} />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center mb-1">
            <Text className="text-sm font-semibold" style={{ color: c.primary }}>Today&apos;s News</Text>
            {hasRead && (
              <View className="ml-2 flex-row items-center rounded-full px-2 py-0.5" style={{ backgroundColor: c.greenTint }}>
                <Ionicons name="checkmark-circle" size={12} color={c.green} />
                <Text className="text-[11px] font-semibold ml-1" style={{ color: c.ink }}>Read</Text>
              </View>
            )}
          </View>
          <Text className="text-base" style={{ color: c.ink }} numberOfLines={2}>
            {article.title}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={c.idle} />
      </Pressable>
    </SlabCard>
  );
}
