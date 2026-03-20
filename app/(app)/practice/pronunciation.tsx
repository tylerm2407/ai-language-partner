import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../../hooks/useAuth';
import { useProfile } from '../../../hooks/useProfile';
import { useSpeakingPractice } from '../../../hooks/useSpeakingPractice';
import { useAIUsage } from '../../../hooks/useAIUsage';
import { PronunciationRecorder } from '../../../components/speaking/PronunciationRecorder';
import { PronunciationScoreView } from '../../../components/speaking/PronunciationScoreView';
import { AIUsageMeter } from '../../../components/ui/AIUsageMeter';
import { trackEvent } from '../../../lib/analytics';
import type { LanguageCode } from '../../../types';

const SAMPLE_SENTENCES: Record<string, string[]> = {
  es: [
    'Hola, me llamo Fluenci. Estoy aprendiendo a hablar.',
    'Buenos días, ¿cómo estás hoy?',
    'Me gustaría un café con leche, por favor.',
    'El tiempo está muy bonito esta mañana.',
    '¿Puedes decirme dónde está la estación de tren?',
  ],
  fr: [
    'Bonjour, je m\'appelle Fluenci. J\'apprends à parler.',
    'Comment allez-vous aujourd\'hui?',
    'Je voudrais un café au lait, s\'il vous plaît.',
    'Le temps est très beau ce matin.',
    'Pouvez-vous me dire où se trouve la gare?',
  ],
  de: [
    'Hallo, ich heiße Fluenci. Ich lerne zu sprechen.',
    'Wie geht es Ihnen heute?',
    'Ich möchte einen Milchkaffee, bitte.',
    'Das Wetter ist heute sehr schön.',
    'Können Sie mir sagen, wo der Bahnhof ist?',
  ],
  ja: [
    'こんにちは、フルエンシーです。話すことを学んでいます。',
    '今日はお元気ですか？',
    'カフェラテをお願いします。',
    '今朝はとてもいい天気ですね。',
    '駅はどこですか？',
  ],
  zh: [
    '你好，我叫 Fluenci。我正在学习说话。',
    '你今天怎么样？',
    '请给我一杯拿铁咖啡。',
    '今天早上天气很好。',
    '请问火车站在哪里？',
  ],
  it: [
    'Ciao, mi chiamo Fluenci. Sto imparando a parlare.',
    'Come stai oggi?',
    'Vorrei un caffè latte, per favore.',
    'Il tempo è molto bello questa mattina.',
    'Puoi dirmi dove si trova la stazione?',
  ],
};

const DEFAULT_SENTENCES = [
  'Hello, my name is Fluenci. I am learning to speak.',
  'How are you doing today?',
  'I would like a coffee with milk, please.',
  'The weather is very nice this morning.',
  'Can you tell me where the train station is?',
];

export default function PronunciationPracticeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ readingId?: string; text?: string; lessonId?: string }>();
  const { user } = useAuth();
  const { profile } = useProfile();

  const userId = user?.id ?? '';
  const language = (profile?.targetLanguage ?? 'es') as LanguageCode;

  const { scoring, result, scoreError, scorePronunciation } = useSpeakingPractice(userId, language);
  const { usage, isFeatureAllowed } = useAIUsage(userId);

  const sentences = SAMPLE_SENTENCES[language] ?? DEFAULT_SENTENCES;

  const [targetText, setTargetText] = useState(
    params.text ?? sentences[0]
  );
  const [customText, setCustomText] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);

  const handleRecordingComplete = useCallback(async (audioBase64: string) => {
    trackEvent('recording_submitted', { language, attemptCount: attemptCount + 1 });
    await scorePronunciation({
      audioBase64,
      expectedText: targetText,
      readingId: params.readingId,
      lessonId: params.lessonId,
    });
    setAttemptCount((c) => c + 1);
  }, [scorePronunciation, targetText, params.readingId, params.lessonId, language, attemptCount]);

  const handleTryAgain = useCallback(() => {
    // Reset result by choosing same text again — hook clears on next score call
    // We force a re-render by toggling attemptCount
    trackEvent('pronunciation_retry', { language });
  }, [language]);

  const handleNextSentence = useCallback(() => {
    const currentIndex = sentences.indexOf(targetText);
    const nextIndex = (currentIndex + 1) % sentences.length;
    setTargetText(sentences[nextIndex]);
    setAttemptCount(0);
  }, [targetText, sentences]);

  const handleSetCustomText = useCallback(() => {
    if (customText.trim()) {
      setTargetText(customText.trim());
      setShowCustomInput(false);
      setCustomText('');
      setAttemptCount(0);
    }
  }, [customText]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Navigation */}
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.navTitle}>Pronunciation Practice</Text>
        <View style={styles.spacer} />
      </View>

      {/* AI Usage */}
      {usage && (
        <View style={styles.usageContainer}>
          <AIUsageMeter
            label="Pronunciation Feedback"
            used={usage.usageSummary.find((u) => u.feature === 'pronunciation_feedback')?.requestCount ?? 0}
            limit={usage.usageSummary.find((u) => u.feature === 'pronunciation_feedback')?.limit ?? 0}
          />
        </View>
      )}

      {/* Main Content */}
      {result ? (
        <View style={styles.flex}>
          <PronunciationScoreView result={result} />
          <View style={styles.actionBar}>
            <Pressable
              style={styles.secondaryButton}
              onPress={handleNextSentence}
              accessibilityRole="button"
              accessibilityLabel="Try a different sentence"
            >
              <Text style={styles.secondaryButtonText}>Next Sentence</Text>
            </Pressable>
            <Pressable
              style={styles.primaryButton}
              onPress={() => router.back()}
              accessibilityRole="button"
            >
              <Text style={styles.primaryButtonText}>Done</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent}>
          {/* Sentence Picker */}
          {!params.text && (
            <View style={styles.sentencePicker}>
              <Text style={styles.pickerLabel}>Choose a sentence to practice:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sentenceChips}>
                {sentences.map((s, i) => (
                  <Pressable
                    key={i}
                    style={[styles.sentenceChip, targetText === s && styles.sentenceChipActive]}
                    onPress={() => { setTargetText(s); setAttemptCount(0); }}
                    accessibilityRole="button"
                    accessibilityLabel={`Sentence ${i + 1}`}
                  >
                    <Text
                      style={[styles.sentenceChipText, targetText === s && styles.sentenceChipTextActive]}
                      numberOfLines={1}
                    >
                      {s.substring(0, 30)}{s.length > 30 ? '...' : ''}
                    </Text>
                  </Pressable>
                ))}
                <Pressable
                  style={[styles.sentenceChip, styles.customChip]}
                  onPress={() => setShowCustomInput(!showCustomInput)}
                  accessibilityRole="button"
                  accessibilityLabel="Enter custom text"
                >
                  <Text style={styles.customChipText}>+ Custom</Text>
                </Pressable>
              </ScrollView>

              {showCustomInput && (
                <View style={styles.customInputRow}>
                  <TextInput
                    style={styles.customInput}
                    value={customText}
                    onChangeText={setCustomText}
                    placeholder="Type your own sentence..."
                    placeholderTextColor="#9CA3AF"
                    multiline
                    accessibilityLabel="Custom sentence input"
                  />
                  <Pressable
                    style={[styles.customSubmit, !customText.trim() && styles.customSubmitDisabled]}
                    onPress={handleSetCustomText}
                    disabled={!customText.trim()}
                    accessibilityRole="button"
                  >
                    <Text style={styles.customSubmitText}>Use</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          <PronunciationRecorder
            targetText={targetText}
            onRecordingComplete={handleRecordingComplete}
            scoring={scoring}
            disabled={!isFeatureAllowed('pronunciation_feedback')}
          />

          {scoreError && (
            <Text style={styles.error}>{scoreError}</Text>
          )}
          {!isFeatureAllowed('pronunciation_feedback') && (
            <View style={styles.quotaWarning}>
              <Text style={styles.quotaText}>
                You've reached your pronunciation feedback quota. Upgrade to continue.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
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
  navTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  spacer: {
    width: 60,
  },
  usageContainer: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  sentencePicker: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  sentenceChips: {
    gap: 8,
    paddingBottom: 8,
  },
  sentenceChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    minHeight: 44,
    justifyContent: 'center',
    maxWidth: 200,
  },
  sentenceChipActive: {
    backgroundColor: '#6366F1',
  },
  sentenceChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  sentenceChipTextActive: {
    color: '#FFFFFF',
  },
  customChip: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderStyle: 'dashed',
  },
  customChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366F1',
  },
  customInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  customInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1F2937',
    minHeight: 44,
  },
  customSubmit: {
    backgroundColor: '#6366F1',
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
    minHeight: 44,
  },
  customSubmitDisabled: {
    opacity: 0.5,
  },
  customSubmitText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  actionBar: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 50,
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 50,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
  },
  error: {
    color: '#EF4444',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
    marginTop: 12,
  },
  quotaWarning: {
    margin: 20,
    padding: 16,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
  },
  quotaText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});
