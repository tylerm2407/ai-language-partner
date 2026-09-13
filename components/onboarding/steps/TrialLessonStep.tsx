/**
 * The bundled micro lesson, run OUTSIDE the form chrome: full-bleed, with the
 * runner's own progress bar and no onboarding step header. Two progress
 * indicators on one screen measure different things and read as a bug.
 *
 * `userId` is deliberately empty. Every persistence path in LessonRunner —
 * the resume snapshot, the SRS warm-up, review-item writes — is guarded on
 * it, so the run touches neither the network nor storage. Nothing here is
 * lost by not being saved: the result the learner cares about is the score,
 * and that rides into the account on the pending draft.
 */
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUi2Theme } from '../../../hooks/useUi2Theme';
import type { Exercise, LanguageCode } from '../../../types';
import { LessonRunner, type LessonResult } from '../../lesson/LessonRunner';
import { TRIAL_LESSON_ID, TRIAL_LESSON_XP } from '../topic-packs';

export function TrialLessonStep({
  exercises,
  languageName,
  targetLanguage,
  onComplete,
  onExit,
}: {
  exercises: Exercise[];
  languageName: string;
  targetLanguage: LanguageCode;
  onComplete: (result: LessonResult) => void;
  onExit: () => void;
}) {
  const { c } = useUi2Theme();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <LessonRunner
            exercises={exercises}
            lessonId={TRIAL_LESSON_ID}
            lessonTitle={`${languageName} · Your first words`}
            xpReward={TRIAL_LESSON_XP}
            userId=""
            targetLanguage={targetLanguage}
            onComplete={onComplete}
            onExit={onExit}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
