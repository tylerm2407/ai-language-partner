import { useState } from 'react';
import { View, Text, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { SlabButton } from '../../components/ui2/SlabButton';
// `colors` is deliberately NOT imported: it is the fixed DARK palette, so a
// screen reading it renders dark whatever the phone is set to. `ui2Shape` and
// `ui2Type` hold no scheme and are safe to read directly.
import { ui2Shape, ui2Type } from '../../config/theme';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { authErrorCopy } from '../../lib/auth-errors';

export default function ResetPasswordScreen() {
  const { c } = useUi2Theme();
  const { session, updatePassword } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (password.length < 6) {
      Alert.alert('Password too short', 'Use at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      Alert.alert("Passwords don't match", 'Re-enter the same password in both fields.');
      return;
    }

    setLoading(true);
    try {
      await updatePassword(password);
      Alert.alert('Password updated', 'You are now signed in with your new password.', [
        { text: 'Continue', onPress: () => router.replace('/(app)') },
      ]);
    } catch (err: unknown) {
      const { title, message } = authErrorCopy(err);
      Alert.alert(title, message);
    } finally {
      setLoading(false);
    }
  };

  // No recovery session — the link was expired, already used, or opened
  // without going through the email. Send the user back for a fresh link.
  if (!session) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <SafeAreaView className="flex-1">
        <View className="flex-1 justify-center px-8">
          <Text
            className="text-3xl mb-2"
            style={{ fontFamily: ui2Type.heading, color: c.ink }}
            accessibilityRole="header"
          >
            Link Expired
          </Text>
          <Text className="text-base mb-8" style={{ fontFamily: ui2Type.ui, color: c.muted }}>
            This password reset link is invalid or has expired. Request a new one from the sign-in
            screen.
          </Text>
          <SlabButton
            label="Back to Sign In"
            onPress={() => router.replace('/(public)/auth')}
          />
        </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaView className="flex-1">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-1 justify-center px-8">
          <Text
            className="text-3xl mb-2"
            style={{ fontFamily: ui2Type.heading, color: c.ink }}
            accessibilityRole="header"
          >
            Set New Password
          </Text>
          <Text className="text-base mb-8" style={{ fontFamily: ui2Type.ui, color: c.muted }}>
            Choose a new password for your account
          </Text>

          <TextInput
            className="px-4 py-3 text-base mb-4"
            style={{
              borderWidth: ui2Shape.border,
              borderBottomWidth: ui2Shape.slab,
              borderRadius: ui2Shape.radiusCard,
              backgroundColor: c.card,
              borderColor: c.cardBorder,
              fontFamily: ui2Type.ui,
              color: c.ink,
            }}
            placeholder="New password (min 6 characters)"
            placeholderTextColor={c.idle}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            accessibilityLabel="New password"
          />

          <TextInput
            className="px-4 py-3 text-base mb-4"
            style={{
              borderWidth: ui2Shape.border,
              borderBottomWidth: ui2Shape.slab,
              borderRadius: ui2Shape.radiusCard,
              backgroundColor: c.card,
              borderColor: c.cardBorder,
              fontFamily: ui2Type.ui,
              color: c.ink,
            }}
            placeholder="Confirm new password"
            placeholderTextColor={c.idle}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            accessibilityLabel="Confirm new password"
          />

          <SlabButton
            label="Update Password"
            onPress={handleSubmit}
            disabled={!password || !confirm}
            loading={loading}
          />
        </View>
      </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
