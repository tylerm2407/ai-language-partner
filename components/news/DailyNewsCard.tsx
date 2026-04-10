import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassSurface } from '../ui/GlassSurface';
import type { DailyNewsArticle } from '../../types';

interface DailyNewsCardProps {
  article: DailyNewsArticle | null;
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;
  onPress: () => void;
  onGenerate: () => void;
}

export function DailyNewsCard({ article, isLoading, isGenerating, error, onPress, onGenerate }: DailyNewsCardProps) {
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

  // Generating state: spinner
  if (isGenerating) {
    return (
      <GlassSurface style={{ marginBottom: 24 }}>
        <View className="p-5 flex-row items-center">
          <View className="w-11 h-11 rounded-full bg-dark-card-alt items-center justify-center mr-4">
            <ActivityIndicator size="small" color="#38BDF8" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-primary mb-1">Today&apos;s News</Text>
            <Text className="text-sm text-text-secondary">Generating your article...</Text>
          </View>
        </View>
      </GlassSurface>
    );
  }

  // No article: generate CTA (with optional error)
  if (!article) {
    return (
      <GlassSurface style={{ marginBottom: 24 }}>
        <Pressable
          className="p-5 flex-row items-center"
          onPress={onGenerate}
          disabled={isGenerating}
          accessibilityRole="button"
          accessibilityLabel="Generate today's news article"
        >
          <View className="w-11 h-11 rounded-full bg-dark-card-alt items-center justify-center mr-4">
            <Ionicons name="newspaper-outline" size={22} color="#38BDF8" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-primary mb-1">Today&apos;s News</Text>
            {error ? (
              <Text className="text-sm text-red-400" numberOfLines={2}>{error}</Text>
            ) : (
              <Text className="text-sm text-text-secondary">
                Get a daily article at your level
              </Text>
            )}
          </View>
          <View className="bg-primary/20 rounded-full px-3 py-1.5">
            <Text className="text-xs font-semibold text-primary">{error ? 'Retry' : 'Generate'}</Text>
          </View>
        </Pressable>
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
        accessibilityLabel="Today's News"
      >
        <View className="w-11 h-11 rounded-full bg-dark-card-alt items-center justify-center mr-4">
          <Ionicons name="newspaper-outline" size={22} color="#38BDF8" />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-primary mb-1">Today&apos;s News</Text>
          <Text className="text-base text-text-primary" numberOfLines={2}>
            {article.title}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#7DD3FC" />
      </Pressable>
    </GlassSurface>
  );
}
