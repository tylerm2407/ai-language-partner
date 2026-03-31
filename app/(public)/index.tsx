import { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function WelcomeScreen() {
  const router = useRouter();

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoTranslateY = useRef(new Animated.Value(20)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;
  const buttonsTranslateY = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(logoTranslateY, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.delay(300),
      Animated.timing(subtitleOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.delay(600),
      Animated.parallel([
        Animated.timing(buttonsOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(buttonsTranslateY, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-dark">
      <View className="flex-1 items-center justify-center px-8">
        <Animated.View style={{ opacity: logoOpacity, transform: [{ translateY: logoTranslateY }] }}>
          <Text className="text-5xl font-bold text-primary mb-2" accessibilityRole="header">Fluenci</Text>
        </Animated.View>

        <Animated.View style={{ opacity: subtitleOpacity }}>
          <Text className="text-lg text-text-secondary text-center mb-12">
            Learn languages with AI-powered lessons and conversations
          </Text>
        </Animated.View>

        <Animated.View style={{ opacity: buttonsOpacity, transform: [{ translateY: buttonsTranslateY }], width: '100%' }}>
          <Pressable
            className="w-full bg-primary py-4 rounded-[14px] items-center mb-4"
            onPress={() => router.push('/(public)/auth')}
            accessibilityRole="button"
            accessibilityLabel="Get started"
          >
            <Text className="text-white text-lg font-semibold">Get Started</Text>
          </Pressable>

          <Pressable
            className="w-full bg-dark-card-alt py-4 rounded-[14px] items-center"
            onPress={() => router.push('/(public)/auth')}
            accessibilityRole="button"
            accessibilityLabel="Sign in"
          >
            <Text className="text-text-primary text-lg font-semibold">I already have an account</Text>
          </Pressable>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
