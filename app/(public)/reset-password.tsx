import { useState } from 'react';
import { View, Text, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { GradientBackground } from '../../components/ui/GradientBackground';
import { colors } from '../../config/theme';

export default function ResetPasswordScreen() {
  const { session, updatePassword } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await updatePassword(password);
      Alert.alert('Password updated', 'You are now signed in with your new password.', [
        { text: 'Continue', onPress: () => router.replace('/(app)') },
      ]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  // No recovery session — the link was expired, already used, or opened
  // without going through the email. Send the user back for a fresh link.
  if (!session) {
    return (
      <GradientBackground>
        <SafeAreaView className="flex-1">
        <View className="flex-1 justify-center px-8">
          <Text className="text-3xl font-bold text-text-primary mb-2" accessibilityRole="header">
            Link Expired
          </Text>
          <Text className="text-base text-text-secondary mb-8">
            This password reset link is invalid or has expired. Request a new one from the sign-in
            screen.
          </Text>
          <Button
            label="Back to Sign In"
            onPress={() => router.replace('/(public)/auth')}
          />
        </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <SafeAreaView className="flex-1">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-1 justify-center px-8">
          <Text className="text-3xl font-bold text-text-primary mb-2" accessibilityRole="header">
            Set New Password
          </Text>
          <Text className="text-base text-text-secondary mb-8">
            Choose a new password for your account
          </Text>

          <TextInput
            className="border-2 border-input-border rounded-[14px] px-4 py-3 text-base text-text-primary mb-4"
            placeholder="New password (min 6 characters)"
            placeholderTextColor={colors.text.quaternary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            accessibilityLabel="New password"
          />

          <TextInput
            className="border-2 border-input-border rounded-[14px] px-4 py-3 text-base text-text-primary mb-4"
            placeholder="Confirm new password"
            placeholderTextColor={colors.text.quaternary}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            accessibilityLabel="Confirm new password"
          />

          <Button
            label="Update Password"
            onPress={handleSubmit}
            disabled={!password || !confirm}
            loading={loading}
          />
        </View>
      </KeyboardAvoidingView>
      </SafeAreaView>
    </GradientBackground>
  );
}
