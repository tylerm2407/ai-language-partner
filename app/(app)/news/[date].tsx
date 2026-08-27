import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { haptic } from '../../../lib/haptics';
import { useAuth } from '../../../hooks/useAuth';
import { useAppStore } from '../../../stores/useAppStore';
import { fetchDailyNews, fetchNewsReadStatus, markNewsAsRead } from '../../../lib/supabase-queries';
import { GradientBackground } from '../../../components/ui/GradientBackground';
import { GradientBorderCard } from '../../../components/ui/GradientBorderCard';
import { TactileButton } from '../../../components/ui/TactileButton';
import { levelToNewsTier } from '../../../config/app';
import { getTargetLanguage } from '../../../lib/language';
import { loadErrorCopy, type ErrorCopy } from '../../../lib/error-copy';
import type { DailyNewsArticle, VocabularyHighlight } from '../../../types';
import { colors } from '../../../config/theme';
import { ArticleAudioPlayer } from '../../../components/news/ArticleAudioPlayer';

export default function NewsReaderScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { profile } = useAppStore();
  const [article, setArticle] = useState<DailyNewsArticle | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showTranslation, setShowTranslation] = useState<boolean>(false);
  const [readAt, setReadAt] = useState<string | null>(null);
  const [isMarking, setIsMarking] = useState<boolean>(false);
  const [error, setError] = useState<ErrorCopy | null>(null);

  const targetLanguage = getTargetLanguage(profile);
  const tier = levelToNewsTier(profile?.level ?? 'intermediate');

  const loadArticle = useCallback(async () => {
    // Wait until the profile has loaded — never fetch news in a defaulted
    // language. The skeleton stays up until the effect re-runs.
    if (!user?.id || !date || !targetLanguage) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchDailyNews(targetLanguage, tier, date);
      setArticle(data);
      if (data) {
        const existing = await fetchNewsReadStatus(user.id, data.id).catch(() => null);
        setReadAt(existing);
      }
    } catch (err) {
      // "No article today" and "the fetch failed" are different facts and used
      // to render as the same empty state, which reads as an app with no
      // content rather than a request that needs retrying.
      setError(loadErrorCopy(err, "today's article"));
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, date, targetLanguage, tier]);

  useEffect(() => {
    loadArticle();
  }, [loadArticle]);

  const handleMarkAsRead = useCallback(async () => {
    if (!article || isMarking || readAt) return;
    setIsMarking(true);
    try {
      const stamp = await markNewsAsRead(article.id);
      setReadAt(stamp);
      haptic('complete');
    } catch {
      // Non-fatal — button returns to enabled state
    } finally {
      setIsMarking(false);
    }
  }, [article, isMarking, readAt]);

  return (
    <GradientBackground>
      <SafeAreaView className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-4 py-3">
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            className="w-10 h-10 items-center justify-center rounded-full bg-dark-card"
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color={colors.text.primary} />
          </Pressable>
          <Text className="text-lg font-semibold text-text-primary ml-3 flex-1">
            Daily News
          </Text>
          {readAt && (
            <View className="flex-row items-center bg-success-bg/40 rounded-full px-3 py-1">
              <Ionicons name="checkmark-circle" size={14} color={colors.success.base} />
              <Text className="text-xs font-semibold text-success ml-1">Read</Text>
            </View>
          )}
        </View>

        <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 120 }}>
          {isLoading ? (
            <View className="mt-8">
              <View className="h-8 bg-dark-card rounded w-3/4 mb-4" />
              <View className="h-4 bg-dark-card rounded w-full mb-2" />
              <View className="h-4 bg-dark-card rounded w-full mb-2" />
              <View className="h-4 bg-dark-card rounded w-5/6 mb-2" />
            </View>
          ) : error ? (
            <View className="mt-8 items-center">
              <Ionicons name="cloud-offline-outline" size={48} color={colors.text.quaternary} />
              <Text className="text-text-primary text-base font-semibold mt-4 text-center">
                {error.title}
              </Text>
              <Text className="text-text-secondary text-sm mt-2 text-center">
                {error.message}
              </Text>
              <View className="mt-6 self-stretch">
                <TactileButton
                  label="Try again"
                  onPress={loadArticle}
                  accessibilityLabel="Try loading today's article again"
                />
              </View>
            </View>
          ) : !article ? (
            <View className="mt-8 items-center">
              <Ionicons name="newspaper-outline" size={48} color={colors.text.quaternary} />
              <Text className="text-text-secondary text-base mt-4 text-center">
                No article available for this date yet.
              </Text>
              <Text className="text-text-tertiary text-sm mt-2 text-center">
                Today&apos;s article publishes around 5 AM Eastern.
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

              {/* Listen. Sits between the summary and the body because that is
                  where a reader decides whether to read this or hear it. */}
              <ArticleAudioPlayer article={article} />

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
                      color={colors.league.diamond}
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

              {/* Mark as read CTA — hidden after it's been read once. */}
              {!readAt && (
                <View className="mt-2">
                  <TactileButton
                    label={isMarking ? 'Saving…' : 'Mark as read'}
                    onPress={handleMarkAsRead}
                    disabled={isMarking}
                    accessibilityLabel="Mark today's article as read"
                  />
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}
