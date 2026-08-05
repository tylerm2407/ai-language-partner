import { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../hooks/useAuth';
import { useAppStore } from '../../../stores/useAppStore';
import { LessonRunner } from '../../../components/lesson/LessonRunner';
import { fetchDrillExercises } from '../../../lib/supabase-queries';
import { getTargetLanguage } from '../../../lib/language';
import type { Exercise } from '../../../types';
import { GlowLayer } from '../../../components/ui/GlowBackground';
import { colors } from '../../../config/theme';

/**
 * Top-mistakes drill: a focused 3-exercise mini-lesson built from the
 * user's weak spots. Falls back to a friendly no-match state if we can't
 * find matching exercises (e.g. when the `short_label` comes from an
 * ai-chat correction but no exercise tags it yet).
 */
export default function DrillScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ shortLabel?: string; errorType?: string }>();
  const { user } = useAuth();
  const profile = useAppStore((s) => s.profile);

  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [loading, setLoading] = useState(true);

  const shortLabel = Array.isArray(params.shortLabel) ? params.shortLabel[0] : params.shortLabel ?? '';
  const errorType = Array.isArray(params.errorType) ? params.errorType[0] : params.errorType ?? 'other';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDrillExercises({
        shortLabel,
        errorType,
        limit: 3,
      });
      setExercises(data);
    } catch (err) {
      console.warn('[drill] fetch failed:', err);
      setExercises([]);
    } finally {
      setLoading(false);
    }
  }, [shortLabel, errorType]);

  useEffect(() => {
    load();
  }, [load]);

  const targetLanguage = getTargetLanguage(profile);
  const cefrLevel = profile?.level ?? undefined;

  // Also wait for the profile: the drill grades in the user's target
  // language, so never fall back to a default while it loads.
  if (loading || !targetLanguage) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.base, justifyContent: 'center', alignItems: 'center' }}>
        <GlowLayer drift={false} />
        <ActivityIndicator size="large" color="#818CF8" />
        <Text style={{ color: '#94A3B8', marginTop: 12 }}>Finding targeted exercises…</Text>
      </SafeAreaView>
    );
  }

  if (!user?.id || !exercises || exercises.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.base }}>
        <GlowLayer drift={false} />
        <View style={{ padding: 20, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable
            onPress={() => router.back()}
            style={{ padding: 8, marginRight: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={24} color="#94A3B8" />
          </Pressable>
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#F1F5F9' }} accessibilityRole="header">
            Drill
          </Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Ionicons name="construct-outline" size={48} color="#94A3B8" />
          <Text style={{ color: '#F1F5F9', fontSize: 18, fontWeight: '600', marginTop: 12, textAlign: 'center' }}>
            No targeted exercises yet
          </Text>
          <Text style={{ color: '#94A3B8', fontSize: 14, marginTop: 4, textAlign: 'center' }}>
            We couldn't find exercises tagged with "{shortLabel}". Come back
            later — the library updates regularly.
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={{
              marginTop: 20,
              backgroundColor: colors.action.primaryFill,
              paddingHorizontal: 32,
              paddingVertical: 12,
              borderRadius: 12,
            }}
            accessibilityRole="button"
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Back to Review</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // We intentionally pass a short-lived lessonTitle/xpReward; the drill is
  // a standalone lesson in the UX sense and we don't log completion to
  // lesson_completions (it's not an official lesson).
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface.base }}>
      <GlowLayer drift={false} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <LessonRunner
        exercises={exercises}
        lessonTitle={`Drill: ${shortLabel}`}
        xpReward={10}
        userId={user.id}
        targetLanguage={targetLanguage}
        cefrLevel={cefrLevel}
        onComplete={() => router.back()}
        onExit={() => router.back()}
        isUnlimitedHearts
      />
      </KeyboardAvoidingView>
    </View>
  );
}
