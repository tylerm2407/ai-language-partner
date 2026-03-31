import { useState } from 'react';
import { View, Text, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Ionicons } from '@expo/vector-icons';

export default function AuthScreen() {
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email.trim() || !password) return;
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmail(email.trim(), password);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-dark">
      <View className="flex-1 justify-center px-8">
        <Text className="text-3xl font-bold text-text-primary mb-2" accessibilityRole="header">
          Welcome to Fluenci
        </Text>
        <Text className="text-base text-text-secondary mb-8">
          Sign in or create an account
        </Text>

        <TextInput
          className="border-2 border-input-border rounded-[14px] px-4 py-3 text-base text-text-primary mb-4"
          placeholder="you@example.com"
          placeholderTextColor="#64748B"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          accessibilityLabel="Email address"
        />

        <TextInput
          className="border-2 border-input-border rounded-[14px] px-4 py-3 text-base text-text-primary mb-4"
          placeholder="Password (min 6 characters)"
          placeholderTextColor="#64748B"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="password"
          accessibilityLabel="Password"
        />

        <Button
          label="Continue"
          onPress={handleSignIn}
          disabled={!email.trim() || !password}
          loading={loading}
        />
      </View>
    </SafeAreaView>
  );
}
