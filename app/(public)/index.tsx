import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GradientBackground } from '../../components/ui/GradientBackground';

const GREETINGS = [
  { word: 'Hello', lang: 'English' },
  { word: 'Hola', lang: 'Spanish' },
  { word: 'Bonjour', lang: 'French' },
  { word: 'Hallo', lang: 'German' },
  { word: 'こんにちは', lang: 'Japanese' },
  { word: 'Ciao', lang: 'Italian' },
  { word: 'Olá', lang: 'Portuguese' },
  { word: 'Привет', lang: 'Russian' },
  { word: 'مرحبا', lang: 'Arabic' },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const [greetingIndex, setGreetingIndex] = useState(0);

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoTranslateY = useRef(new Animated.Value(20)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const socialOpacity = useRef(new Animated.Value(0)).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;
  const buttonsTranslateY = useRef(new Animated.Value(30)).current;
  const greetingOpacity = useRef(new Animated.Value(1)).current;

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
      Animated.delay(400),
      Animated.timing(socialOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.delay(600),
      Animated.parallel([
        Animated.timing(buttonsOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(buttonsTranslateY, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  // Language cycling
  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(greetingOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setGreetingIndex((prev) => (prev + 1) % GREETINGS.length);
        Animated.timing(greetingOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <GradientBackground>
    <SafeAreaView className="flex-1">
      <View className="flex-1 items-center justify-center px-8">
        <Animated.View style={{ opacity: logoOpacity, transform: [{ translateY: logoTranslateY }], alignItems: 'center' }}>
          <Text
            style={{ fontFamily: 'PlayfairDisplay_700Bold', fontSize: 48 }}
            className="text-primary mb-1"
            accessibilityRole="header"
          >
            Fluenci
          </Text>
          <Animated.View style={{ opacity: greetingOpacity, height: 36, justifyContent: 'center' }}>
            <Text className="text-xl text-text-tertiary text-center">
              {GREETINGS[greetingIndex].word}
            </Text>
          </Animated.View>
        </Animated.View>

        <Animated.View style={{ opacity: subtitleOpacity }}>
          <Text className="text-lg text-text-secondary text-center mb-8">
            Learn languages with AI-powered lessons and conversations
          </Text>
        </Animated.View>

        {/* Social Proof + Value Props */}
        <Animated.View style={{ opacity: socialOpacity, width: '100%', marginBottom: 32 }}>
          <View className="flex-row items-center justify-center mb-4">
            <Ionicons name="people" size={16} color="#7DD3FC" />
            <Text className="text-sm text-text-secondary ml-2">
              Join thousands of learners worldwide
            </Text>
          </View>
          <View className="gap-3">
            <View className="flex-row items-center">
              <Ionicons name="chatbubbles-outline" size={18} color="#A855F7" />
              <Text className="text-sm text-text-tertiary ml-3">AI-powered conversations</Text>
            </View>
            <View className="flex-row items-center">
              <Ionicons name="newspaper-outline" size={18} color="#38BDF8" />
              <Text className="text-sm text-text-tertiary ml-3">Daily news in your target language</Text>
            </View>
            <View className="flex-row items-center">
              <Ionicons name="trending-up-outline" size={18} color="#34D399" />
              <Text className="text-sm text-text-tertiary ml-3">Personalized to your level</Text>
            </View>
          </View>
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
    </GradientBackground>
  );
}
