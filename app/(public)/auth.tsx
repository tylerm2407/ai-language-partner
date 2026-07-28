import { useEffect, useState } from 'react';
import { View, Text, TextInput, Alert, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/avatar/Avatar';
import { LEVEL_LABELS } from '../../components/onboarding/PlacementTest';
import { loadPendingOnboarding, type PendingOnboarding } from '../../lib/pending-onboarding';
import { SUPPORTED_LANGUAGES } from '../../config/app';
import { colors } from '../../config/theme';

type AuthMode = 'sign_in' | 'sign_up' | 'forgot_password';

export default function AuthScreen() {
  const { signInWithEmail, signUpWithEmail, resetPassword } = useAuth();
  const [mode, setMode] = useState<AuthMode>('sign_in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<PendingOnboarding | null>(null);

  // A learner arriving from the pre-auth onboarding flow already has a
  // placement result and an avatar. Show them what is at stake and default to
  // sign-up, so this screen reads as saving their work rather than as a gate
  // (DESIGN.md §UX Psychology Principles #3 and #4).
  useEffect(() => {
    let cancelled = false;
    loadPendingOnboarding()
      .then((draft) => {
        if (cancelled || !draft?.completedAt) return;
        setPending(draft);
        setMode('sign_up');
      })
      .catch((err) => console.error('loadPendingOnboarding failed on auth screen:', err));
    return () => {
      cancelled = true;
    };
  }, []);

  const pendingLanguage = pending?.targetLanguage
    ? SUPPORTED_LANGUAGES.find((l) => l.code === pending.targetLanguage)?.name
    : null;

  const handleSubmit = async () => {
    if (!email.trim()) return;

    if (mode === 'forgot_password') {
      setLoading(true);
      try {
        await resetPassword(email.trim());
        Alert.alert('Check your email', 'We sent you a password reset link.');
        setMode('sign_in');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Something went wrong';
        Alert.alert('Error', message);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!password || password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'sign_in') {
        await signInWithEmail(email.trim(), password);
      } else {
        await signUpWithEmail(email.trim(), password);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const showPendingSummary = !!pending && mode === 'sign_up';

  const title =
    mode === 'sign_in'
      ? 'Sign In'
      : mode === 'sign_up'
      ? showPendingSummary
        ? 'Save your progress'
        : 'Create Account'
      : 'Reset Password';
  const subtitle = mode === 'forgot_password'
    ? "Enter your email and we'll send you a reset link"
    : mode === 'sign_up'
    ? showPendingSummary
      ? 'Add an email so your level and profile are waiting on every device.'
      : 'Start your language learning journey'
    : 'Welcome back to Fluenci';

  return (
    <SafeAreaView className="flex-1 bg-dark">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <View className="flex-1 justify-center px-8">
        <Text className="text-3xl font-bold text-text-primary mb-2" accessibilityRole="header">
          {title}
        </Text>
        <Text className="text-base text-text-secondary mb-8">
          {subtitle}
        </Text>

        {showPendingSummary && (
          <View className="bg-dark-card rounded-2xl p-4 mb-6 flex-row items-center">
            <Avatar config={pending?.avatarConfig ?? undefined} size="medium" expression="happy" />
            <View className="flex-1 ml-4">
              {pending?.displayName ? (
                <Text className="text-lg font-semibold text-text-primary mb-1">
                  {pending.displayName}
                </Text>
              ) : null}
              {pendingLanguage ? (
                <Text className="text-sm text-text-secondary">{pendingLanguage}</Text>
              ) : null}
              {pending?.placement ? (
                <Text className="text-sm text-primary font-semibold mt-1">
                  {LEVEL_LABELS[pending.placement.suggestedLevel]} ·{' '}
                  {pending.placement.correctCount}/{pending.placement.totalCount} on your placement
                </Text>
              ) : null}
            </View>
          </View>
        )}

        <TextInput
          className="border-2 border-input-border rounded-[14px] px-4 py-3 text-base text-text-primary mb-4"
          placeholder="you@example.com"
          placeholderTextColor={colors.text.quaternary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          accessibilityLabel="Email address"
        />

        {mode !== 'forgot_password' && (
          <TextInput
            className="border-2 border-input-border rounded-[14px] px-4 py-3 text-base text-text-primary mb-4"
            placeholder="Password (min 6 characters)"
            placeholderTextColor={colors.text.quaternary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
            accessibilityLabel="Password"
          />
        )}

        <Button
          label={
            mode === 'forgot_password'
              ? 'Send Reset Link'
              : mode === 'sign_up'
              ? showPendingSummary
                ? 'Save my progress'
                : 'Create Account'
              : 'Sign In'
          }
          onPress={handleSubmit}
          disabled={!email.trim() || (mode !== 'forgot_password' && !password)}
          loading={loading}
        />

        {mode === 'sign_in' && (
          <Pressable
            onPress={() => setMode('forgot_password')}
            className="mt-4 items-center"
            accessibilityRole="button"
            accessibilityLabel="Forgot password"
          >
            <Text className="text-sm text-primary">Forgot password?</Text>
          </Pressable>
        )}

        <View className="mt-6 items-center">
          {mode === 'sign_in' ? (
            <Pressable onPress={() => setMode('sign_up')} accessibilityRole="button">
              <Text className="text-sm text-text-secondary">
                Don't have an account? <Text className="text-primary font-semibold">Sign Up</Text>
              </Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => setMode('sign_in')} accessibilityRole="button">
              <Text className="text-sm text-text-secondary">
                Already have an account? <Text className="text-primary font-semibold">Sign In</Text>
              </Text>
            </Pressable>
          )}
        </View>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
