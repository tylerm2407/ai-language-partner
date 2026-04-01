import { useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';
import { useAppStore } from '../stores/useAppStore';
import { updateOnboardingChecklist } from '../lib/supabase-queries';
import type { OnboardingChecklist } from '../types';

type ChecklistKey = 'chooseLanguage' | 'placementTest' | 'firstLesson' | 'aiConversation' | 'dailyReminder';

const CHECKLIST_ITEMS: { key: ChecklistKey; label: string; icon: string; route: string | null }[] = [
  { key: 'chooseLanguage', label: 'Choose your language', icon: 'globe-outline', route: null },
  { key: 'placementTest', label: 'Complete placement test', icon: 'school-outline', route: null },
  { key: 'firstLesson', label: 'Finish your first lesson', icon: 'book-outline', route: '/learn' },
  { key: 'aiConversation', label: 'Try AI conversation', icon: 'chatbubbles-outline', route: '/chat' },
  { key: 'dailyReminder', label: 'Set daily reminder', icon: 'notifications-outline', route: null },
];

export function useOnboardingChecklist() {
  const { user } = useAuth();
  const { profile, setProfile } = useAppStore();

  const checklist = profile?.onboardingChecklist ?? null;

  // Auto-detect chooseLanguage from profile
  const effectiveChecklist = useMemo((): OnboardingChecklist | null => {
    if (!checklist) return null;
    return {
      ...checklist,
      chooseLanguage: checklist.chooseLanguage || !!profile?.targetLanguage,
    };
  }, [checklist, profile?.targetLanguage]);

  // Auto-dismiss for existing users who already have activity
  const shouldAutoDismiss = useMemo(() => {
    if (!profile || !effectiveChecklist) return false;
    if (effectiveChecklist.dismissed) return false;
    // If user has XP but all items are false (except auto-detected ones), they're an existing user
    return profile.totalXp > 0 &&
      !effectiveChecklist.firstLesson &&
      !effectiveChecklist.aiConversation &&
      !effectiveChecklist.dailyReminder;
  }, [profile, effectiveChecklist]);

  const isVisible = useMemo(() => {
    if (!effectiveChecklist) return false;
    if (effectiveChecklist.dismissed) return false;
    if (shouldAutoDismiss) return false;
    return true;
  }, [effectiveChecklist, shouldAutoDismiss]);

  const completedCount = useMemo(() => {
    if (!effectiveChecklist) return 0;
    return CHECKLIST_ITEMS.filter((item) => effectiveChecklist[item.key]).length;
  }, [effectiveChecklist]);

  const totalCount = CHECKLIST_ITEMS.length;

  const allComplete = completedCount === totalCount;

  const progress = totalCount > 0 ? completedCount / totalCount : 0;

  const collapsed = effectiveChecklist?.collapsed ?? false;

  const persistChecklist = useCallback(async (updated: OnboardingChecklist) => {
    if (!user || !profile) return;
    // Optimistic update
    setProfile({ ...profile, onboardingChecklist: updated });
    try {
      await updateOnboardingChecklist(user.id, updated);
    } catch (err) {
      console.error('Failed to persist onboarding checklist:', err);
      // Revert on failure
      setProfile(profile);
    }
  }, [user, profile, setProfile]);

  const markItem = useCallback(async (key: ChecklistKey) => {
    if (!effectiveChecklist || effectiveChecklist[key]) return;
    const updated: OnboardingChecklist = { ...effectiveChecklist, [key]: true };

    // Check if all items are now complete
    const newCompletedCount = CHECKLIST_ITEMS.filter((item) => updated[item.key]).length;
    if (newCompletedCount === totalCount) {
      updated.completedAt = new Date().toISOString();
    }

    await persistChecklist(updated);
  }, [effectiveChecklist, persistChecklist, totalCount]);

  const toggleCollapsed = useCallback(async () => {
    if (!effectiveChecklist) return;
    await persistChecklist({ ...effectiveChecklist, collapsed: !effectiveChecklist.collapsed });
  }, [effectiveChecklist, persistChecklist]);

  const dismiss = useCallback(async () => {
    if (!effectiveChecklist) return;
    await persistChecklist({ ...effectiveChecklist, dismissed: true });
  }, [effectiveChecklist, persistChecklist]);

  const items = CHECKLIST_ITEMS.map((item) => ({
    ...item,
    completed: effectiveChecklist?.[item.key] ?? false,
  }));

  return {
    isVisible,
    items,
    checklist: effectiveChecklist,
    completedCount,
    totalCount,
    allComplete,
    progress,
    collapsed,
    markItem,
    toggleCollapsed,
    dismiss,
  };
}
