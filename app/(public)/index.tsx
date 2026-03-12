import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Landing / onboarding screen.
 * First screen users see before signing in.
 */
export default function LandingScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text
          style={{ fontSize: 36, fontWeight: '700', marginBottom: 8 }}
          accessibilityRole="header"
        >
          languageAI
        </Text>
        <Text
          style={{ fontSize: 18, color: '#666', textAlign: 'center', marginBottom: 48 }}
        >
          Learn any language with AI-powered conversations and spaced repetition.
        </Text>

        <Pressable
          onPress={() => router.push('/(public)/auth')}
          style={{
            backgroundColor: '#6366F1',
            paddingHorizontal: 32,
            paddingVertical: 16,
            borderRadius: 12,
            minWidth: 200,
            alignItems: 'center',
          }}
          accessibilityRole="button"
          accessibilityLabel="Get started"
        >
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>
            Get Started
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
