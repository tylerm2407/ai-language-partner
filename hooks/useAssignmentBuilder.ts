import { useState, useCallback } from 'react';
import { createAssignment } from '../lib/supabase-queries';
import type { Assignment, LanguageCode, ProficiencyLevel } from '../types';

export interface AssignmentFormState {
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

  const saveDraft = useCallback(
    async (overrides?: Partial<AssignmentFormState>): Promise<Assignment | null> => {
      const merged = { ...form, ...overrides };
      if (!merged.classroomId) {
        setError('Classroom is required');
        return null;
      }
      setLoading(true);
      setError(null);
      try {
        const assignment = await createAssignment({
          classroomId: merged.classroomId,
          title: merged.title || 'Untitled Assignment',
          description: merged.description,
          status: 'draft',
          scenarioKey: merged.scenarioKey,
          customScenario: merged.customScenario,
          targetLanguage: merged.targetLanguage,
          level: merged.level,
          minDurationMinutes: merged.minDurationMinutes,
          mode: merged.mode,
          vocabularyFocus: merged.vocabularyFocus,
          grammarFocus: merged.grammarFocus,
          instructions: merged.instructions,
          dueAt: merged.dueAt,
          lateSubmissionAllowed: merged.lateSubmissionAllowed,
          maxPoints: merged.maxPoints,
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
    },
    [form]
  );

  const publish = useCallback(
    async (overrides?: Partial<AssignmentFormState>): Promise<Assignment | null> => {
      const merged = { ...form, ...overrides };
      if (!merged.classroomId) {
        setError('Classroom is required');
        return null;
      }
      if (!merged.title.trim()) {
        setError('Title is required');
        return null;
      }
      setLoading(true);
      setError(null);
      try {
        const assignment = await createAssignment({
          classroomId: merged.classroomId,
          title: merged.title,
          description: merged.description,
          status: 'published',
          scenarioKey: merged.scenarioKey,
          customScenario: merged.customScenario,
          targetLanguage: merged.targetLanguage,
          level: merged.level,
          minDurationMinutes: merged.minDurationMinutes,
          mode: merged.mode,
          vocabularyFocus: merged.vocabularyFocus,
          grammarFocus: merged.grammarFocus,
          instructions: merged.instructions,
          dueAt: merged.dueAt,
          lateSubmissionAllowed: merged.lateSubmissionAllowed,
          maxPoints: merged.maxPoints,
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
    },
    [form]
  );

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
