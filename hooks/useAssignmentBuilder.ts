import { useState, useCallback } from 'react';
import { createAssignment } from '../lib/supabase-queries';
import type { Assignment, LanguageCode, ProficiencyLevel } from '../types';

interface AssignmentFormState {
  title: string;
  description: string;
  scenarioKey: string | null;
  customScenario: { label: string; description: string; systemContext: string } | null;
  targetLanguage: LanguageCode;
  level: ProficiencyLevel;
  minDurationMinutes: number;
  mode: 'text' | 'voice' | 'either';
  vocabularyFocus: string[];
  grammarFocus: string[];
  instructions: string;
  dueAt: string | null;
  classroomId: string;
  lateSubmissionAllowed: boolean;
  maxPoints: number;
}

const DEFAULT_FORM: AssignmentFormState = {
  title: '',
  description: '',
  scenarioKey: null,
  customScenario: null,
  targetLanguage: 'es',
  level: 'beginner',
  minDurationMinutes: 5,
  mode: 'either',
  vocabularyFocus: [],
  grammarFocus: [],
  instructions: '',
  dueAt: null,
  classroomId: '',
  lateSubmissionAllowed: false,
  maxPoints: 100,
};

export function useAssignmentBuilder(defaults?: Partial<AssignmentFormState>) {
  const [form, setForm] = useState<AssignmentFormState>({ ...DEFAULT_FORM, ...defaults });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateField = useCallback(<K extends keyof AssignmentFormState>(
    field: K,
    value: AssignmentFormState[K]
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const resetForm = useCallback(() => {
    setForm({ ...DEFAULT_FORM, ...defaults });
    setError(null);
  }, [defaults]);

  const saveDraft = useCallback(async (): Promise<Assignment | null> => {
    if (!form.classroomId) {
      setError('Classroom is required');
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const assignment = await createAssignment({
        classroomId: form.classroomId,
        title: form.title || 'Untitled Assignment',
        description: form.description,
        status: 'draft',
        scenarioKey: form.scenarioKey,
        customScenario: form.customScenario,
        targetLanguage: form.targetLanguage,
        level: form.level,
        minDurationMinutes: form.minDurationMinutes,
        mode: form.mode,
        vocabularyFocus: form.vocabularyFocus,
        grammarFocus: form.grammarFocus,
        instructions: form.instructions,
        dueAt: form.dueAt,
        lateSubmissionAllowed: form.lateSubmissionAllowed,
        maxPoints: form.maxPoints,
      });
      return assignment;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save draft';
      setError(message);
      console.error('saveDraft error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [form]);

  const publish = useCallback(async (): Promise<Assignment | null> => {
    if (!form.classroomId) {
      setError('Classroom is required');
      return null;
    }
    if (!form.title.trim()) {
      setError('Title is required');
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const assignment = await createAssignment({
        classroomId: form.classroomId,
        title: form.title,
        description: form.description,
        status: 'published',
        scenarioKey: form.scenarioKey,
        customScenario: form.customScenario,
        targetLanguage: form.targetLanguage,
        level: form.level,
        minDurationMinutes: form.minDurationMinutes,
        mode: form.mode,
        vocabularyFocus: form.vocabularyFocus,
        grammarFocus: form.grammarFocus,
        instructions: form.instructions,
        dueAt: form.dueAt,
        lateSubmissionAllowed: form.lateSubmissionAllowed,
        maxPoints: form.maxPoints,
      });
      return assignment;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to publish assignment';
      setError(message);
      console.error('publish error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [form]);

  return {
    form,
    updateField,
    resetForm,
    saveDraft,
    publish,
    loading,
    error,
  };
}
