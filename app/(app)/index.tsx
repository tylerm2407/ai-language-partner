import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useProfile } from '../../hooks/useProfile';
import { useDailyStats } from '../../hooks/useDailyStats';
import { useReviewQueue } from '../../hooks/useReviewQueue';
import { ProgressBar } from '../../components/ui/ProgressBar';

export default function HomeScreen() {
  const router = useRouter();
  const { profile, isLoading: profileLoading } = useProfile();
  const { today, isLoading: statsLoading } = useDailyStats();
  const { dueCount, isLoading: reviewLoading } = useReviewQueue();

  const isLoading = profileLoading || statsLoading || reviewLoading;

  const streak = profile?.streak ?? 0;
  const totalXp = profile?.totalXp ?? 0;
  const dailyGoal = profile?.dailyGoalMinutes ?? 10;
  const minutesToday = today?.minutesPracticed ?? 0;
  const dailyProgress = dailyGoal > 0 ? Math.min(1, minutesToday / dailyGoal) : 0;
  const xpToday = today?.xpEarned ?? 0;

  // Greeting based on time of day
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const displayName = profile?.displayName || 'Learner';

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6366F1" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {/* Greeting */}
        <Text
          style={{ fontSize: 28, fontWeight: '700', marginBottom: 4 }}
          accessibilityRole="header"
        >
          {greeting}, {displayName}!
        </Text>
        {profile?.targetLanguage && (
          <Text style={{ fontSize: 15, color: '#666', marginBottom: 20 }}>
            Learning {profile.targetLanguage.toUpperCase()}
          </Text>
        )}

        {/* Daily Goal Progress */}
        <View
          style={{
            backgroundColor: '#F9FAFB',
            borderRadius: 20,
            padding: 20,
            marginBottom: 16,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: '600' }}>Daily Goal</Text>
            <Text style={{ fontSize: 14, color: '#666' }}>
              {Math.round(minutesToday)}/{dailyGoal} min
            </Text>
          </View>
          <ProgressBar progress={dailyProgress} color={dailyProgress >= 1 ? '#22C55E' : '#6366F1'} />
          {dailyProgress >= 1 && (
            <Text style={{ fontSize: 13, color: '#22C55E', fontWeight: '600', marginTop: 6 }}>
              Goal reached! Keep going for bonus XP.
            </Text>
          )}
        </View>

        {/* Stats Row */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-around',
            marginBottom: 24,
            backgroundColor: '#F9FAFB',
            borderRadius: 20,
            padding: 20,
          }}
        >
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 28, fontWeight: '700', color: '#F59E0B' }}>{streak}</Text>
            <Text style={{ fontSize: 13, color: '#666' }}>Day Streak</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 28, fontWeight: '700', color: '#EF4444' }}>{dueCount}</Text>
            <Text style={{ fontSize: 13, color: '#666' }}>Cards Due</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 28, fontWeight: '700', color: '#6366F1' }}>{xpToday}</Text>
            <Text style={{ fontSize: 13, color: '#666' }}>XP Today</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 28, fontWeight: '700', color: '#22C55E' }}>{totalXp}</Text>
            <Text style={{ fontSize: 13, color: '#666' }}>Total XP</Text>
          </View>
        </View>

        {/* Quick Actions */}
        {dueCount > 0 && (
          <Pressable
            onPress={() => router.push('/(app)/review')}
            style={{
              backgroundColor: '#6366F1',
              padding: 20,
              borderRadius: 16,
              marginBottom: 12,
            }}
            accessibilityRole="button"
            accessibilityLabel={`Review ${dueCount} cards`}
          >
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>
              Review Cards
            </Text>
            <Text style={{ color: '#E0E7FF', fontSize: 14, marginTop: 4 }}>
              {dueCount} card{dueCount !== 1 ? 's' : ''} waiting for review
            </Text>
          </Pressable>
        )}

        <Pressable
          onPress={() => router.push('/(app)/learn')}
          style={{
            backgroundColor: '#F3F4F6',
            padding: 20,
            borderRadius: 16,
            marginBottom: 12,
          }}
          accessibilityRole="button"
          accessibilityLabel="Continue learning"
        >
          <Text style={{ fontSize: 18, fontWeight: '600' }}>Continue Learning</Text>
          <Text style={{ color: '#666', fontSize: 14, marginTop: 4 }}>
            Pick up where you left off
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/(app)/practice')}
          style={{
            backgroundColor: '#F3F4F6',
            padding: 20,
            borderRadius: 16,
            marginBottom: 12,
          }}
          accessibilityRole="button"
          accessibilityLabel="Practice speaking"
        >
          <Text style={{ fontSize: 18, fontWeight: '600' }}>AI Practice</Text>
          <Text style={{ color: '#666', fontSize: 14, marginTop: 4 }}>
            Have a conversation in your target language
          </Text>
        </Pressable>

        {/* Weekly Activity */}
        {today && (
          <View
            style={{
              backgroundColor: '#F9FAFB',
              borderRadius: 20,
              padding: 20,
              marginTop: 8,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12 }}>Today's Activity</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontSize: 14, color: '#666' }}>Lessons completed</Text>
              <Text style={{ fontSize: 14, fontWeight: '600' }}>{today.lessonsCompleted}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontSize: 14, color: '#666' }}>Cards reviewed</Text>
              <Text style={{ fontSize: 14, fontWeight: '600' }}>{today.cardsReviewed}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontSize: 14, color: '#666' }}>Speaking practice</Text>
              <Text style={{ fontSize: 14, fontWeight: '600' }}>{Math.round(today.speakingMinutes)} min</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 14, color: '#666' }}>Accuracy</Text>
              <Text style={{ fontSize: 14, fontWeight: '600' }}>{Math.round(today.accuracy * 100)}%</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
