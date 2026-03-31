import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GradientBorderCard } from '../ui/GradientBorderCard';
import type { DailyNewsArticle } from '../../types';

interface DailyNewsCardProps {
  article: DailyNewsArticle | null;
  isLoading: boolean;
  onPress: () => void;
}

export function DailyNewsCard({ article, isLoading, onPress }: DailyNewsCardProps) {
  if (!isLoading && !article) {
    return null;
  }

  return (
    <GradientBorderCard style={{ marginBottom: 24 }}>
      <Pressable
        className="p-5 flex-row items-center"
        onPress={onPress}
        disabled={isLoading || !article}
        accessibilityRole="button"
        accessibilityLabel="Today's News"
      >
        <View className="w-11 h-11 rounded-full bg-dark-card-alt items-center justify-center mr-4">
          <Ionicons name="newspaper-outline" size={22} color="#38BDF8" />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-primary mb-1">Today&apos;s News</Text>
          {isLoading ? (
            <View>
              <View className="h-4 bg-dark-card-alt rounded w-3/4 mb-1" />
              <View className="h-3 bg-dark-card-alt rounded w-1/2" />
            </View>
          ) : (
            <Text className="text-base text-text-primary" numberOfLines={2}>
              {article?.title}
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#7DD3FC" />
      </Pressable>
    </GradientBorderCard>
  );
}
