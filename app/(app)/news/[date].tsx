import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../hooks/useAuth';
import { fetchUserDailyNews } from '../../../lib/supabase-queries';
import { GradientBackground } from '../../../components/ui/GradientBackground';
import { GradientBorderCard } from '../../../components/ui/GradientBorderCard';
import type { DailyNewsArticle, VocabularyHighlight } from '../../../types';

export default function NewsReaderScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [article, setArticle] = useState<DailyNewsArticle | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showTranslation, setShowTranslation] = useState<boolean>(false);

  const loadArticle = useCallback(async () => {
    if (!user?.id || !date) return;
    setIsLoading(true);
    try {
      const data = await fetchUserDailyNews(user.id, date);
      setArticle(data);
    } catch {
      // Silently fail — show empty state
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, date]);

  useEffect(() => {
    loadArticle();
  }, [loadArticle]);

  return (
    <GradientBackground>
      <SafeAreaView className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-4 py-3">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center rounded-full bg-dark-card"
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color="#E2E8F0" />
          </Pressable>
          <Text className="text-lg font-semibold text-text-primary ml-3 flex-1">
            Daily News
          </Text>
        </View>

        <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 100 }}>
          {isLoading ? (
            <View className="mt-8">
              <View className="h-8 bg-dark-card rounded w-3/4 mb-4" />
              <View className="h-4 bg-dark-card rounded w-full mb-2" />
              <View className="h-4 bg-dark-card rounded w-full mb-2" />
              <View className="h-4 bg-dark-card rounded w-5/6 mb-2" />
            </View>
          ) : !article ? (
            <View className="mt-8 items-center">
              <Ionicons name="newspaper-outline" size={48} color="#64748B" />
              <Text className="text-text-secondary text-base mt-4">
                No article available for this date.
              </Text>
            </View>
          ) : (
            <View className="mt-4">
              {/* Title */}
              <Text className="text-2xl font-bold text-text-primary mb-2">
                {article.title}
              </Text>
              {article.titleTranslation && (
                <Text className="text-base text-text-secondary mb-4">
                  {article.titleTranslation}
                </Text>
              )}

              {/* Summary */}
              <Text className="text-sm text-primary mb-6">
                {article.summary}
              </Text>

              {/* Content */}
              <Text className="text-base text-text-primary leading-7 mb-6">
                {article.content}
              </Text>

              {/* Show Translation Toggle */}
              {article.contentTranslation && (
                <View className="mb-6">
                  <Pressable
                    onPress={() => setShowTranslation(!showTranslation)}
                    className="flex-row items-center mb-3"
                    accessibilityRole="button"
                    accessibilityLabel={showTranslation ? 'Hide Translation' : 'Show Translation'}
                  >
                    <Ionicons
                      name={showTranslation ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#38BDF8"
                    />
                    <Text className="text-primary font-semibold ml-2">
                      {showTranslation ? 'Hide Translation' : 'Show Translation'}
                    </Text>
                  </Pressable>
                  {showTranslation && (
                    <GradientBorderCard innerStyle={{ padding: 16 }}>
                      <Text className="text-base text-text-secondary leading-7">
                        {article.contentTranslation}
                      </Text>
                    </GradientBorderCard>
                  )}
                </View>
              )}

              {/* Vocabulary Highlights */}
              {article.vocabularyHighlights.length > 0 && (
                <View className="mb-8">
                  <Text className="text-xl font-bold text-text-primary mb-4">
                    Vocabulary
                  </Text>
                  {article.vocabularyHighlights.map((item: VocabularyHighlight, index: number) => (
                    <GradientBorderCard
                      key={`${item.word}-${index}`}
                      style={{ marginBottom: 10 }}
                      innerStyle={{ padding: 14 }}
                    >
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1">
                          <Text className="text-base font-semibold text-text-primary">
                            {item.word}
                          </Text>
                          <Text className="text-sm text-text-secondary mt-1">
                            {item.translation}
                          </Text>
                        </View>
                        {item.partOfSpeech && (
                          <View className="bg-dark-card-alt rounded-full px-3 py-1">
                            <Text className="text-xs text-primary">
                              {item.partOfSpeech}
                            </Text>
                          </View>
                        )}
                      </View>
                    </GradientBorderCard>
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}
