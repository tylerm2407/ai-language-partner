import { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';

/**
 * Auth screen: magic link sign-in via Supabase.
 */
export default function AuthScreen() {
  const { signInWithMagicLink } = useAuth();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setIsSubmitting(true);

    const { error } = await signInWithMagicLink(email.trim());

    setIsSubmitting(false);
    if (error) {
      Alert.alert('Error', error);
    } else {
      setSent(true);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <Text
          style={{ fontSize: 28, fontWeight: '700', marginBottom: 8 }}
          accessibilityRole="header"
        >
          Sign In
        </Text>
        <Text style={{ fontSize: 16, color: '#666', marginBottom: 32 }}>
          We'll send you a magic link to sign in — no password needed.
        </Text>

        {sent ? (
          <View
            style={{
              backgroundColor: '#F0FDF4',
              padding: 16,
              borderRadius: 12,
            }}
          >
            <Text style={{ fontSize: 16, color: '#166534' }}>
              Check your email for a sign-in link.
            </Text>
          </View>
        ) : (
          <>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              accessibilityLabel="Email address"
              style={{
                borderWidth: 1,
                borderColor: '#D1D5DB',
                borderRadius: 12,
                padding: 16,
                fontSize: 16,
                marginBottom: 16,
              }}
            />

            <Pressable
              onPress={handleSubmit}
              disabled={isSubmitting || !email.trim()}
              style={{
                backgroundColor: email.trim() ? '#6366F1' : '#C7D2FE',
                paddingVertical: 16,
                borderRadius: 12,
                alignItems: 'center',
              }}
              accessibilityRole="button"
              accessibilityLabel="Send magic link"
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>
                  Send Magic Link
                </Text>
              )}
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
