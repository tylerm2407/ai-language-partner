import { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useSafeBack } from '../../../hooks/useSafeBack';
import { Ionicons } from '@expo/vector-icons';
import { haptic } from '../../../lib/haptics';
import { useAuth } from '../../../hooks/useAuth';
import { useAppStore } from '../../../stores/useAppStore';
import { fetchDailyNews, fetchNewsReadStatus, markNewsAsRead } from '../../../lib/supabase-queries';
import { SlabCard } from '../../../components/ui2/SlabCard';
import { SlabButton } from '../../../components/ui2/SlabButton';
import { Body, Caption, Heading } from '../../../components/ui2/Ui2Text';
import { levelToNewsTier } from '../../../config/app';
import { getTargetLanguage } from '../../../lib/language';
import { loadErrorCopy, type ErrorCopy } from '../../../lib/error-copy';
import type { DailyNewsArticle, VocabularyHighlight } from '../../../types';
// `colors` is deliberately NOT imported: it is the fixed DARK palette, and a
// screen that reads it stays dark whatever the phone is set to. `spacing` is a
// set of plain scheme-independent numbers and carries over unchanged.
import { spacing } from '../../../config/theme';
import { useUi2Theme } from '../../../hooks/useUi2Theme';
import { ArticleAudioPlayer } from '../../../components/news/ArticleAudioPlayer';
import { useScreenView } from '../../../hooks/useScreenView';

export default function NewsReaderScreen() {
  const { c } = useUi2Theme();
  useScreenView('news');
  const { date } = useLocalSearchParams<{ date: string }>();
  const goBack = useSafeBack('/(app)');
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
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaView className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-4 py-3">
          <Pressable
            onPress={() => goBack()}
            hitSlop={8}
            className="w-10 h-10 items-center justify-center rounded-full"
            style={{ backgroundColor: c.card }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color={c.ink} />
          </Pressable>
          <Body size="lg" weight="extrabold" style={{ marginLeft: spacing.sm, flex: 1 }}>
            Daily News
          </Body>
          {readAt && (
            <View
              className="flex-row items-center rounded-full px-3 py-1"
              style={{ backgroundColor: c.greenTint }}
            >
              <Ionicons name="checkmark-circle" size={14} color={c.green} />
              <Body size="sm" weight="bold" style={{ marginLeft: spacing.xxs }}>
                Read
              </Body>
            </View>
          )}
        </View>

        <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 120 }}>
          {isLoading ? (
            <View className="mt-8">
              <View className="h-8 rounded w-3/4 mb-4" style={{ backgroundColor: c.card }} />
              <View className="h-4 rounded w-full mb-2" style={{ backgroundColor: c.card }} />
              <View className="h-4 rounded w-full mb-2" style={{ backgroundColor: c.card }} />
              <View className="h-4 rounded w-5/6 mb-2" style={{ backgroundColor: c.card }} />
            </View>
          ) : error ? (
            <View className="mt-8 items-center">
              <Ionicons name="cloud-offline-outline" size={48} color={c.idle} />
              <Body weight="bold" style={{ marginTop: spacing.md, textAlign: 'center' }}>
                {error.title}
              </Body>
              <Body size="sm" tone="secondary" style={{ marginTop: spacing.xs, textAlign: 'center' }}>
                {error.message}
              </Body>
              <View className="mt-6 self-stretch">
                <SlabButton
                  label="Try again"
                  onPress={loadArticle}
                  arrow={false}
                  accessibilityHint="Try loading today's article again"
                />
              </View>
            </View>
          ) : !article ? (
            <View className="mt-8 items-center">
              <Ionicons name="newspaper-outline" size={48} color={c.idle} />
              <Body tone="secondary" style={{ marginTop: spacing.md, textAlign: 'center' }}>
                No article available for this date yet.
              </Body>
              <Body size="sm" tone="tertiary" style={{ marginTop: spacing.xs, textAlign: 'center' }}>
                Today&apos;s article publishes around 5 AM Eastern.
              </Body>
            </View>
          ) : (
            <View className="mt-4">
              {/* Title */}
              <Heading level={2} style={{ marginBottom: spacing.xs }}>
                {article.title}
              </Heading>
              {article.titleTranslation && (
                <Body tone="secondary" style={{ marginBottom: spacing.md }}>
                  {article.titleTranslation}
                </Body>
              )}

              {/* Summary */}
              <Body size="sm" tone="accent" style={{ marginBottom: spacing.lg }}>
                {article.summary}
              </Body>

              {/* Listen. Sits between the summary and the body because that is
                  where a reader decides whether to read this or hear it. */}
              <ArticleAudioPlayer article={article} />

              {/* Content */}
              <Body style={{ lineHeight: 28, marginBottom: spacing.lg }}>
                {article.content}
              </Body>

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
                      color={c.onTint}
                    />
                    <Body weight="bold" tone="accent" style={{ marginLeft: spacing.xs }}>
                      {showTranslation ? 'Hide Translation' : 'Show Translation'}
                    </Body>
                  </Pressable>
                  {showTranslation && (
                    <SlabCard>
                      <Body tone="secondary" style={{ lineHeight: 28 }}>
                        {article.contentTranslation}
                      </Body>
                    </SlabCard>
                  )}
                </View>
              )}

              {/* Vocabulary Highlights */}
              {article.vocabularyHighlights.length > 0 && (
                <View className="mb-8">
                  <Heading level={3} style={{ marginBottom: spacing.md }}>
                    Vocabulary
                  </Heading>
                  {article.vocabularyHighlights.map((item: VocabularyHighlight, index: number) => (
                    <SlabCard
                      key={`${item.word}-${index}`}
                      style={{ marginBottom: 10, padding: 14 }}
                    >
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1">
                          <Body weight="bold">
                            {item.word}
                          </Body>
                          <Body size="sm" tone="secondary" style={{ marginTop: spacing.xxs }}>
                            {item.translation}
                          </Body>
                        </View>
                        {item.partOfSpeech && (
                          <View
                            className="rounded-full px-3 py-1"
                            style={{ backgroundColor: c.primaryTint }}
                          >
                            <Caption tone="accent">
                              {item.partOfSpeech}
                            </Caption>
                          </View>
                        )}
                      </View>
                    </SlabCard>
                  ))}
                </View>
              )}

              {/* Mark as read CTA — hidden after it's been read once. */}
              {!readAt && (
                <View className="mt-2">
                  <SlabButton
                    label={isMarking ? 'Saving…' : 'Mark as read'}
                    onPress={handleMarkAsRead}
                    disabled={isMarking}
                    arrow={false}
                    accessibilityHint="Mark today's article as read"
                  />
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
