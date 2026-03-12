import { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../hooks/useAuth';
import { useProfile } from '../../../hooks/useProfile';
import { useDailyStats } from '../../../hooks/useDailyStats';
import { SUPPORTED_LANGUAGES, DIFFICULTY_LEVELS } from '../../../config/app';
import type { LanguageCode, ProficiencyLevel } from '../../../types';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { profile, isLoading, updateProfile } = useProfile();
  const { today, weekStats } = useDailyStats();
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [showLevelPicker, setShowLevelPicker] = useState(false);
  const [showGoalPicker, setShowGoalPicker] = useState(false);

  const handleLanguageChange = async (code: LanguageCode) => {
    try {
      await updateProfile({ targetLanguage: code });
      setShowLanguagePicker(false);
    } catch {
      Alert.alert('Error', 'Failed to update language');
    }
  };

  const handleLevelChange = async (level: ProficiencyLevel) => {
    try {
      await updateProfile({ level });
      setShowLevelPicker(false);
    } catch {
      Alert.alert('Error', 'Failed to update level');
    }
  };

  const handleGoalChange = async (minutes: number) => {
    try {
      await updateProfile({ dailyGoalMinutes: minutes });
      setShowGoalPicker(false);
    } catch {
      Alert.alert('Error', 'Failed to update goal');
    }
  };

  const currentLanguage = SUPPORTED_LANGUAGES.find((l) => l.code === profile?.targetLanguage);
  const currentLevel = DIFFICULTY_LEVELS.find((l) => l.key === profile?.level);

  // Calculate week totals
  const weekXp = weekStats.reduce((sum, s) => sum + s.xpEarned, 0);
  const weekMinutes = weekStats.reduce((sum, s) => sum + s.minutesPracticed, 0);
  const weekCards = weekStats.reduce((sum, s) => sum + s.cardsReviewed, 0);

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6366F1" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: 20 }} accessibilityRole="header">
          Profile
        </Text>

        {/* User Info */}
        <View style={{ backgroundColor: '#F9FAFB', padding: 20, borderRadius: 16, marginBottom: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: '600' }}>
            {profile?.displayName || user?.email || 'Learner'}
          </Text>
          <Text style={{ fontSize: 14, color: '#666', marginTop: 4 }}>
            {user?.email}
          </Text>
          <View style={{ flexDirection: 'row', marginTop: 12, gap: 16 }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#F59E0B' }}>
                {profile?.streak ?? 0}
              </Text>
              <Text style={{ fontSize: 12, color: '#666' }}>Streak</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#6366F1' }}>
                {profile?.totalXp ?? 0}
              </Text>
              <Text style={{ fontSize: 12, color: '#666' }}>Total XP</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#22C55E' }}>
                {profile?.longestStreak ?? 0}
              </Text>
              <Text style={{ fontSize: 12, color: '#666' }}>Best Streak</Text>
            </View>
          </View>
        </View>

        {/* Weekly Summary */}
        <View style={{ backgroundColor: '#F9FAFB', padding: 20, borderRadius: 16, marginBottom: 20 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12 }}>This Week</Text>
          <Row label="XP earned" value={`${weekXp}`} />
          <Row label="Minutes practiced" value={`${Math.round(weekMinutes)}`} />
          <Row label="Cards reviewed" value={`${weekCards}`} />
          <Row label="Days active" value={`${weekStats.length}/7`} />
        </View>

        {/* Settings */}
        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12, marginTop: 8 }}>Settings</Text>

        {/* Target Language */}
        <Pressable
          onPress={() => setShowLanguagePicker(!showLanguagePicker)}
          style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' }}
          accessibilityRole="button"
        >
          <Text style={{ fontSize: 16 }}>Target Language</Text>
          <Text style={{ fontSize: 16, color: '#6366F1', fontWeight: '500' }}>
            {currentLanguage ? `${currentLanguage.flag} ${currentLanguage.name}` : 'Not set'}
          </Text>
        </Pressable>

        {showLanguagePicker && (
          <View style={{ backgroundColor: '#F9FAFB', borderRadius: 12, marginVertical: 8, padding: 8 }}>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <Pressable
                key={lang.code}
                onPress={() => handleLanguageChange(lang.code)}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: lang.code === profile?.targetLanguage ? '#E0E7FF' : 'transparent',
                }}
                accessibilityRole="button"
                accessibilityLabel={lang.name}
              >
                <Text style={{ fontSize: 16 }}>{lang.flag} {lang.name}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Proficiency Level */}
        <Pressable
          onPress={() => setShowLevelPicker(!showLevelPicker)}
          style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' }}
          accessibilityRole="button"
        >
          <Text style={{ fontSize: 16 }}>Level</Text>
          <Text style={{ fontSize: 16, color: '#6366F1', fontWeight: '500' }}>
            {currentLevel?.label ?? 'Not set'}
          </Text>
        </Pressable>

        {showLevelPicker && (
          <View style={{ backgroundColor: '#F9FAFB', borderRadius: 12, marginVertical: 8, padding: 8 }}>
            {DIFFICULTY_LEVELS.map((lvl) => (
              <Pressable
                key={lvl.key}
                onPress={() => handleLevelChange(lvl.key as ProficiencyLevel)}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: lvl.key === profile?.level ? '#E0E7FF' : 'transparent',
                }}
                accessibilityRole="button"
              >
                <Text style={{ fontSize: 16, fontWeight: '500' }}>{lvl.label}</Text>
                <Text style={{ fontSize: 13, color: '#666' }}>{lvl.description}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Daily Goal */}
        <Pressable
          onPress={() => setShowGoalPicker(!showGoalPicker)}
          style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' }}
          accessibilityRole="button"
        >
          <Text style={{ fontSize: 16 }}>Daily Goal</Text>
          <Text style={{ fontSize: 16, color: '#6366F1', fontWeight: '500' }}>
            {profile?.dailyGoalMinutes ?? 10} minutes
          </Text>
        </Pressable>

        {showGoalPicker && (
          <View style={{ backgroundColor: '#F9FAFB', borderRadius: 12, marginVertical: 8, padding: 8 }}>
            {[5, 10, 15, 20, 30].map((mins) => (
              <Pressable
                key={mins}
                onPress={() => handleGoalChange(mins)}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: mins === profile?.dailyGoalMinutes ? '#E0E7FF' : 'transparent',
                }}
                accessibilityRole="button"
              >
                <Text style={{ fontSize: 16 }}>{mins} minutes / day</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Sign Out */}
        <Pressable
          onPress={() => {
            Alert.alert('Sign Out', 'Are you sure?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign Out', style: 'destructive', onPress: signOut },
            ]);
          }}
          style={{ marginTop: 32, paddingVertical: 16, alignItems: 'center' }}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Text style={{ fontSize: 16, color: '#EF4444', fontWeight: '600' }}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
      <Text style={{ fontSize: 14, color: '#666' }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}
