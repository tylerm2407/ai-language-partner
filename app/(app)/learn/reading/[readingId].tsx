import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useReadingDetail, useReadingChat } from '../../../../hooks/useReadingLibrary';
import { useAIUsage } from '../../../../hooks/useAIUsage';
import { useAuth } from '../../../../hooks/useAuth';
import { useProfile } from '../../../../hooks/useProfile';
import { ReadingTextView } from '../../../../components/reading/ReadingTextView';
import { ReadingChatSheet } from '../../../../components/reading/ReadingChatSheet';
import { trackEvent } from '../../../../lib/analytics';
import type { LanguageCode } from '../../../../types';

export default function ReadingDetailScreen() {
  const { readingId } = useLocalSearchParams<{ readingId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { reading, audio, loading, error, loadReading } = useReadingDetail();
  const [showChat, setShowChat] = useState(false);

  const userId = user?.id ?? '';
  const language = (profile?.targetLanguage ?? 'es') as LanguageCode;

  const { chatLoading, chatResult, chatError, askAboutReading } = useReadingChat(userId, language);
  const { isFeatureAllowed, refreshUsage } = useAIUsage(userId);

  useEffect(() => {
    if (readingId) loadReading(readingId);
  }, [readingId, loadReading]);

  useEffect(() => {
    if (userId) refreshUsage('chat');
  }, [userId, refreshUsage]);

  const handleAskAI = useCallback((action: 'summarize' | 'define' | 'comprehension_questions') => {
    if (readingId) askAboutReading(readingId, action);
  }, [readingId, askAboutReading]);

  const handleDownload = useCallback((url: string) => {
    Linking.openURL(url);
  }, []);

  if (loading || !reading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.loadingText}>{loading ? 'Loading...' : error ?? 'Reading not found'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Back Button */}
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      </View>

      {/* Reading Text */}
      <ReadingTextView reading={reading} />

      {/* Action Buttons */}
      <View style={styles.actionBar}>
        {reading.downloadUrlPdf && (
          <Pressable style={styles.actionBtn} onPress={() => handleDownload(reading.downloadUrlPdf!)} accessibilityRole="button" accessibilityLabel="Download PDF">
            <Text style={styles.actionBtnText}>PDF</Text>
          </Pressable>
        )}
        {reading.downloadUrlEpub && (
          <Pressable style={styles.actionBtn} onPress={() => handleDownload(reading.downloadUrlEpub!)} accessibilityRole="button" accessibilityLabel="Download EPUB">
            <Text style={styles.actionBtnText}>EPUB</Text>
          </Pressable>
        )}
        <Pressable
          style={styles.actionBtn}
          onPress={() => router.push({ pathname: '/practice/pronunciation', params: { readingId: reading.id, text: reading.text.substring(0, 500) } })}
          accessibilityRole="button"
          accessibilityLabel="Practice speaking"
        >
          <Text style={styles.actionBtnText}>Speak</Text>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, styles.actionBtnPrimary]}
          onPress={() => setShowChat(!showChat)}
          accessibilityRole="button"
          accessibilityLabel="Ask AI about this reading"
        >
          <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>Ask AI</Text>
        </Pressable>
      </View>

      {/* AI Chat Sheet */}
      {showChat && (
        <ReadingChatSheet
          loading={chatLoading}
          result={chatResult}
          error={chatError}
          onAction={handleAskAI}
          isAllowed={isFeatureAllowed('chat')}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 15,
    color: '#9CA3AF',
  },
  nav: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backButton: {
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  backText: {
    fontSize: 16,
    color: '#6366F1',
    fontWeight: '600',
  },
  actionBar: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  actionBtnPrimary: {
    backgroundColor: '#6366F1',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  actionBtnTextPrimary: {
    color: '#FFFFFF',
  },
});
