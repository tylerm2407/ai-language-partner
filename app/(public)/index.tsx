import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ui2Screen } from '../../components/ui2/Ui2Screen';
import { SlabButton } from '../../components/ui2/SlabButton';
import { MascotSol } from '../../components/ui2/MascotSol';
import { RotatingGreeting } from '../../components/auth/RotatingGreeting';
import { useMotion } from '../../hooks/useMotion';
import { useUi2Theme } from '../../hooks/useUi2Theme';

/**
 * Welcome — the first screen of UI 2.0. Sol idles, the headline and subline
 * fade up in sequence, then the two actions. No progress bar: nothing has
 * been answered yet.
 */
export default function WelcomeScreen() {
  const router = useRouter();
  const { shouldReduce } = useMotion();
  const { c, type } = useUi2Theme();
  const enter = (i: number) => (shouldReduce ? undefined : FadeInDown.delay(120 + i * 120).duration(420));

  return (
    <Ui2Screen
      fixed
      footer={
        <>
          {/* Straight into onboarding — no account required. The sign-up gate
              comes after the learner has a lesson and an avatar of their own
              (DESIGN.md §UX Psychology Principles #3 and #4). */}
          <SlabButton label="Get started" onPress={() => router.push('/(public)/onboarding')} />
          <SlabButton
            label="I already have an account"
            variant="ghost"
            onPress={() => router.push('/(public)/auth')}
            accessibilityHint="Sign in"
          />
        </>
      }
    >
      <View style={styles.body}>
        <MascotSol size={150} />
        <Animated.View entering={enter(0)} style={styles.block}>
          <Text
            accessibilityRole="header"
            style={{ fontFamily: type.heading, fontSize: 40, lineHeight: 44, letterSpacing: -0.8, color: c.ink, textAlign: 'center' }}
          >
            Speak it,{'\n'}don&apos;t just{'\n'}study it.
          </Text>
        </Animated.View>
        <Animated.View entering={enter(1)} style={styles.block}>
          <Text style={{ fontFamily: type.ui, fontSize: 16, lineHeight: 23, color: c.muted, textAlign: 'center', maxWidth: 300 }}>
            Short daily sessions, real conversations with an AI tutor, and a level you can actually
            measure.
          </Text>
        </Animated.View>
        <Animated.View entering={enter(2)} style={styles.greeting}>
          {/* Shared with the auth hero (components/auth/RotatingGreeting) so
              the two screens cannot drift apart. */}
          <RotatingGreeting size={18} color={c.idle} />
        </Animated.View>
      </View>
    </Ui2Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22, paddingHorizontal: 28 },
  block: { alignItems: 'center' },
  greeting: { height: 32, justifyContent: 'center' },
});
