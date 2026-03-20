import { useState, useCallback } from 'react';
import type { WritingPrompt, WritingSubmission, CEFRLevel, LanguageCode } from '../types';
import { fetchWritingPrompts, fetchWritingPromptById, fetchWritingSubmissions } from '../lib/supabase-queries';
import { submitWritingForFeedback, type WritingFeedbackResponse } from '../lib/ai';

export function useWritingPrompts(courseId: string) {
  const [prompts, setPrompts] = useState<WritingPrompt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPrompts = useCallback(async (filters?: { level?: CEFRLevel; type?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWritingPrompts({
        courseId,
        ...filters,
      });
      setPrompts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load prompts');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  return { prompts, loading, error, loadPrompts };
}

export function useWritingSubmission(userId: string, language: LanguageCode) {
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<WritingFeedbackResponse | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submitWriting = useCallback(async (params: {
    text: string;
    level: string;
    promptId?: string;
    courseId?: string;
  }) => {
    setSubmitting(true);
    setSubmitError(null);
    setFeedback(null);
    try {
      const result = await submitWritingForFeedback({
        userId,
        text: params.text,
        language,
        level: params.level,
        promptId: params.promptId,
        courseId: params.courseId,
      });
      setFeedback(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Submission failed';
      setSubmitError(message);
      return null;
    } finally {
      setSubmitting(false);
    }
  }, [userId, language]);

  return { submitting, feedback, submitError, submitWriting };
}

export function useWritingHistory(userId: string) {
  const [submissions, setSubmissions] = useState<WritingSubmission[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchWritingSubmissions(userId);
      setSubmissions(data);
    } catch {
      // Silently handle — history is non-critical
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return { submissions, loading, loadHistory };
}
