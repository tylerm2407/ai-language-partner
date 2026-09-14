/**
 * The learner's onboarding answers as React state, plus the two views of them
 * the screen needs: the serialisable draft that goes to AsyncStorage, and the
 * inverse (`applyPending`) that restores a saved draft into state.
 *
 * This hook holds no flow control — which step is showing, whether a flush is
 * running — only the answers. Keeping the answer state together means the
 * draft memo and the restore function can never drift apart: every field that
 * is saved is a field that is restored, in one file.
 */
import { useCallback, useMemo, useState } from 'react';
import type { LessonResult } from '../lesson/LessonRunner';
import { DEFAULT_DAILY_GOAL_MINUTES } from '../../lib/active-time';
import { placementOptionsFor, type PlacementChoice } from '../../lib/course-placement';
import {
  DEFAULT_NOTIFICATION_PREFS,
  validateNotificationPrefs,
  type NotificationPrefs,
} from '../../lib/notification-prefs';
import type {
  PendingOnboarding,
  PendingOnboardingDraft,
  TrialLessonResult,
} from '../../lib/pending-onboarding';
import type { StashedAvatarPhoto } from '../../lib/onboarding-avatar-photo';
import type { LanguageCode, ProficiencyLevel } from '../../types';
import type { TopicKey } from './topic-packs';
import { DEFAULT_LANGUAGE, DEFAULT_LEVEL } from './steps/config';

export function useOnboardingAnswers() {
  const [startedAt, setStartedAt] = useState<number | undefined>(undefined);
  // Tracked in state rather than hardcoded in `draft`, so the screen's
  // background persist effect can never overwrite the flag that marks the
  // draft ready to flush.
  const [completedAt, setCompletedAt] = useState<string | null>(null);

  const [targetLanguage, setTargetLanguage] = useState<LanguageCode>(DEFAULT_LANGUAGE);
  const [idealL2Self, setIdealL2Self] = useState<string>('');
  // Null until a chip is tapped or the free text gives one away. Stays null
  // when neither happens — the trial falls back to `travel`, but the draft and
  // the analytics event keep the honest absence (./trial-topic.ts).
  const [topic, setTopic] = useState<TopicKey | null>(null);
  const [level, setLevel] = useState<ProficiencyLevel>(DEFAULT_LEVEL);
  // Where the lessons start relative to the declared level. `start` is the
  // smart default; the course step only exists for levels with a band below
  // them, so a beginner never sees it (`placementOptions` is empty).
  const [courseChoice, setCourseChoice] = useState<PlacementChoice>('start');
  const placementOptions = placementOptionsFor(level);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>(
    DEFAULT_NOTIFICATION_PREFS,
  );
  const [trial, setTrial] = useState<TrialLessonResult | null>(null);
  const [displayName, setDisplayName] = useState<string>('');
  const [avatarPresetId, setAvatarPresetId] = useState<string | null>(null);
  // A photo parked on disk for generation after sign-up; see
  // lib/onboarding-avatar-photo.ts. One of preset or photo, never both.
  const [avatarPhoto, setAvatarPhoto] = useState<StashedAvatarPhoto | null>(null);
  const [dailyGoal, setDailyGoal] = useState<number>(DEFAULT_DAILY_GOAL_MINUTES);

  const draft: PendingOnboardingDraft = useMemo(
    () => ({
      targetLanguage,
      idealL2Self: idealL2Self.trim() ? idealL2Self.trim() : null,
      topic,
      level,
      courseChoice,
      trial,
      displayName: displayName.trim() ? displayName.trim() : null,
      avatarPresetId,
      avatarPhoto,
      dailyGoalMinutes: dailyGoal,
      notificationPrefs,
      completedAt,
    }),
    [
      targetLanguage,
      idealL2Self,
      topic,
      level,
      courseChoice,
      trial,
      displayName,
      avatarPresetId,
      avatarPhoto,
      dailyGoal,
      notificationPrefs,
      completedAt,
    ],
  );

  const applyPending = useCallback((pending: PendingOnboarding) => {
    setStartedAt(pending.startedAt);
    setCompletedAt(pending.completedAt);
    if (pending.targetLanguage) setTargetLanguage(pending.targetLanguage);
    if (pending.idealL2Self) setIdealL2Self(pending.idealL2Self);
    if (pending.topic) setTopic(pending.topic);
    if (pending.level) setLevel(pending.level);
    if (pending.courseChoice) setCourseChoice(pending.courseChoice);
    // Validated on the way in, not trusted: a draft written by an older build
    // has no prefs at all, and one written by a newer one could carry a kind
    // this build does not know. `validateNotificationPrefs` repairs field by
    // field, so a partial blob keeps whatever the learner actually set.
    if (pending.notificationPrefs) {
      setNotificationPrefs(validateNotificationPrefs(pending.notificationPrefs));
    }
    if (pending.trial) setTrial(pending.trial);
    if (pending.displayName) setDisplayName(pending.displayName);
    if (pending.avatarPresetId) setAvatarPresetId(pending.avatarPresetId);
    if (pending.avatarPhoto) setAvatarPhoto(pending.avatarPhoto);
    if (pending.dailyGoalMinutes) setDailyGoal(pending.dailyGoalMinutes);
  }, []);

  /**
   * Record the trial result. It rides into the account on the pending draft:
   * nothing about this run exists server-side, because there is no account to
   * attach it to yet.
   */
  const recordTrial = useCallback((result: LessonResult) => {
    setTrial({
      xpEarned: result.xpEarned,
      correctCount: result.correctCount,
      totalCount: result.totalExercises,
      completedAt: new Date().toISOString(),
    });
  }, []);

  return {
    startedAt,
    completedAt,
    setCompletedAt,
    targetLanguage,
    setTargetLanguage,
    idealL2Self,
    setIdealL2Self,
    topic,
    setTopic,
    level,
    setLevel,
    courseChoice,
    setCourseChoice,
    placementOptions,
    notificationPrefs,
    setNotificationPrefs,
    trial,
    recordTrial,
    displayName,
    setDisplayName,
    avatarPresetId,
    setAvatarPresetId,
    avatarPhoto,
    setAvatarPhoto,
    dailyGoal,
    setDailyGoal,
    draft,
    applyPending,
  };
}
