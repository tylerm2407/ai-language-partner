import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassSurface } from '../ui/GlassSurface';
import type { DailyNewsArticle } from '../../types';

interface DailyNewsCardProps {
  article: DailyNewsArticle | null;
  isLoading: boolean;
  error: string | null;
  hasRead?: boolean;
  onPress: () => void;
}

export function DailyNewsCard({ article, isLoading, error, hasRead = false, onPress }: DailyNewsCardProps) {
  // Loading state: skeleton
  if (isLoading) {
    return (
      <GlassSurface style={{ marginBottom: 24 }}>
        <View className="p-5 flex-row items-center">
          <View className="w-11 h-11 rounded-full bg-dark-card-alt items-center justify-center mr-4">
            <Ionicons name="newspaper-outline" size={22} color="#38BDF8" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-primary mb-1">Today&apos;s News</Text>
            <View className="h-4 bg-dark-card-alt rounded w-3/4 mb-1" />
            <View className="h-3 bg-dark-card-alt rounded w-1/2" />
          </View>
        </View>
      </GlassSurface>
    );
  }

  // No article: cron hasn't fired yet, or failed. Calm placeholder — never
  // a scary "Error" or "Generate" CTA.
  if (!article) {
    return (
      <GlassSurface style={{ marginBottom: 24 }}>
        <View className="p-5 flex-row items-center">
          <View className="w-11 h-11 rounded-full bg-dark-card-alt items-center justify-center mr-4">
            <Ionicons name="newspaper-outline" size={22} color="#38BDF8" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-primary mb-1">Today&apos;s News</Text>
            <Text className="text-sm text-text-secondary" numberOfLines={2}>
              {error ?? 'On its way — check back shortly.'}
            </Text>
          </View>
        </View>
      </GlassSurface>
    );
  }

  // Article exists: show it
  return (
    <GlassSurface style={{ marginBottom: 24 }}>
      <Pressable
        className="p-5 flex-row items-center"
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={hasRead ? "Today's News, already read" : "Today's News"}
      >
        <View className="w-11 h-11 rounded-full bg-dark-card-alt items-center justify-center mr-4">
          <Ionicons name="newspaper-outline" size={22} color="#38BDF8" />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center mb-1">
            <Text className="text-sm font-semibold text-primary">Today&apos;s News</Text>
            {hasRead && (
              <View className="ml-2 flex-row items-center bg-success-bg/40 rounded-full px-2 py-0.5">
                <Ionicons name="checkmark-circle" size={12} color="#22C55E" />
                <Text className="text-[11px] font-semibold text-success ml-1">Read</Text>
              </View>
            )}
          </View>
          <Text className="text-base text-text-primary" numberOfLines={2}>
            {article.title}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#7DD3FC" />
      </Pressable>
    </GlassSurface>
  );
}
