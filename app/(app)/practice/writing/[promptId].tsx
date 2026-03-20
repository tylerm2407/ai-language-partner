import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { fetchWritingPromptById } from '../../../../lib/supabase-queries';
import { useWritingSubmission } from '../../../../hooks/useWritingPractice';
import { useAIUsage } from '../../../../hooks/useAIUsage';
import { useAuth } from '../../../../hooks/useAuth';
import { useProfile } from '../../../../hooks/useProfile';
import { WritingEditor } from '../../../../components/writing/WritingEditor';
import { WritingFeedbackView } from '../../../../components/writing/WritingFeedbackView';
import { AIUsageMeter } from '../../../../components/ui/AIUsageMeter';
import { CEFRBadge } from '../../../../components/ui/CEFRBadge';
import { trackEvent } from '../../../../lib/analytics';
import type { WritingPrompt, LanguageCode } from '../../../../types';

export default function WritingEditorScreen() {
  const { promptId } = useLocalSearchParams<{ promptId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { profile } = useProfile();
  const userId = user?.id ?? '';
  const language = (profile?.targetLanguage ?? 'es') as LanguageCode;

  const [prompt, setPrompt] = useState<WritingPrompt | null>(null);
  const [text, setText] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);

  const { submitting, feedback, submitError, submitWriting } = useWritingSubmission(userId, language);
  const { usage, refreshUsage, isFeatureAllowed, getUsageRatio } = useAIUsage(userId);

  useEffect(() => {
    if (promptId) {
      fetchWritingPromptById(promptId).then(setPrompt);
    }
  }, [promptId]);

  useEffect(() => {
    if (userId) refreshUsage('writing_feedback');
  }, [userId, refreshUsage]);

  const handleSubmit = async () => {
    if (!text.trim() || !prompt) return;

    const result = await submitWriting({
      text,
      level: prompt.level,
      promptId: prompt.id,
      courseId: prompt.courseId,
    });

    if (result) {
      trackEvent('writing_submitted', { promptId: prompt.id, level: prompt.level, overallScore: result.overallScore });
      setShowFeedback(true);
    }
  };

  if (!prompt) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.loadingText}>Loading prompt...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (showFeedback && feedback) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.nav}>
          <Pressable onPress={() => setShowFeedback(false)} style={styles.backButton} accessibilityRole="button">
            <Text style={styles.backText}>← Edit</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button">
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
        <WritingFeedbackView feedback={feedback} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={styles.nav}>
          <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button">
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
        </View>

        <View style={styles.promptHeader}>
          <CEFRBadge level={prompt.level} size="medium" />
          <Text style={styles.promptTitle}>{prompt.title}</Text>
          <Text style={styles.promptText}>{prompt.promptText}</Text>
          {prompt.sampleOutline && (
            <Text style={styles.outline}>Outline: {prompt.sampleOutline}</Text>
          )}
        </View>

        {/* AI Usage Meter */}
        {usage && (
          <View style={styles.usageContainer}>
            <AIUsageMeter
              label="Writing Feedback"
              used={usage.usageSummary.find((u) => u.feature === 'writing_feedback')?.requestCount ?? 0}
              limit={usage.usageSummary.find((u) => u.feature === 'writing_feedback')?.limit ?? 0}
            />
          </View>
        )}

        {/* Editor */}
        <View style={styles.editorContainer}>
          <WritingEditor
            value={text}
            onChangeText={setText}
            minWords={prompt.minWords}
            maxWords={prompt.maxWords}
            editable={!submitting}
          />
        </View>

        {/* Submit */}
        <View style={styles.submitContainer}>
          {submitError && <Text style={styles.error}>{submitError}</Text>}
          <Pressable
            style={[styles.submitButton, (!text.trim() || submitting || !isFeatureAllowed('writing_feedback')) && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!text.trim() || submitting || !isFeatureAllowed('writing_feedback')}
            accessibilityRole="button"
            accessibilityLabel="Submit for AI feedback"
          >
            <Text style={styles.submitText}>
              {submitting ? 'Analyzing...' : !isFeatureAllowed('writing_feedback') ? 'Quota Reached' : 'Get AI Feedback'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  doneText: {
    fontSize: 16,
    color: '#22C55E',
    fontWeight: '600',
  },
  promptHeader: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  promptTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 8,
    marginBottom: 4,
  },
  promptText: {
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 22,
    marginBottom: 4,
  },
  outline: {
    fontSize: 13,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  usageContainer: {
    paddingHorizontal: 20,
  },
  editorContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  submitContainer: {
    padding: 20,
  },
  error: {
    color: '#EF4444',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  submitButton: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 50,
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
