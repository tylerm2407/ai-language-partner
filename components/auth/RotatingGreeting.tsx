import { useEffect, useRef, useState } from 'react';
import { Text, Animated, Easing } from 'react-native';
import { useMotion } from '../../hooks/useMotion';
import { colors, typography } from '../../config/theme';

/**
 * The rotating multilingual greeting, lifted out of `app/(public)/index.tsx`
 * so the welcome screen and the auth screen share one implementation instead
 * of two drifting copies.
 *
 * `showLanguage` adds the language name beneath the word, rotating in lockstep
 * — the auth screen's hero uses it, the welcome screen does not.
 */

export const GREETINGS = [
  { word: 'Hello', lang: 'English' },
  { word: 'Hola', lang: 'Spanish' },
  { word: 'Bonjour', lang: 'French' },
  { word: 'Ciao', lang: 'Italian' },
  { word: 'Olá', lang: 'Portuguese' },
  { word: 'Hallo', lang: 'German' },
  { word: 'こんにちは', lang: 'Japanese' },
  { word: 'Привет', lang: 'Russian' },
  // Kept from the welcome screen's own list, which had nine entries to the
  // handoff's eight. A refactor that shares the animation must not quietly
  // drop a language.
  { word: 'مرحبا', lang: 'Arabic' },
] as const;

const HOLD_MS = 1800;
const FADE_MS = 320;

interface RotatingGreetingProps {
  /** Font size for the word. 56 for the sign-up hero, 34 for sign-in. */
  size?: number;
  color?: string;
  showLanguage?: boolean;
  align?: 'center' | 'left';
}

export function RotatingGreeting({
  size = 56,
  color = colors.text.primary,
  showLanguage = false,
  align = 'center',
}: RotatingGreetingProps) {
  const { shouldReduce } = useMotion();
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Reduce Motion: hold the first greeting. Cycling text is itself motion,
    // and a silent swap every 1.8s is worse than a stable word.
    if (shouldReduce) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }

    const interval = setInterval(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: FADE_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -12, duration: FADE_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start(() => {
        setIndex((prev) => (prev + 1) % GREETINGS.length);
        translateY.setValue(12);
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: FADE_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(translateY, { toValue: 0, duration: FADE_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]).start();
      });
    }, HOLD_MS);

    return () => clearInterval(interval);
  }, [shouldReduce, opacity, translateY]);

  const current = GREETINGS[index];
  // Japanese glyphs sit taller — trim a little so the line box stays fixed and
  // the layout below never shifts as the word changes.
  const fontSize = current.word.length > 5 && /[^\u0000-\u04FF]/.test(current.word) ? size - 4 : size;

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }], alignItems: align === 'center' ? 'center' : 'flex-start' }}>
      <Text
        accessibilityRole="header"
        style={{
          fontFamily: typography.family.serif,
          fontSize,
          lineHeight: size * 1.32,
          letterSpacing: -1.4,
          color,
        }}
      >
        {current.word}
      </Text>
      {showLanguage && (
        <Text
          style={{
            fontFamily: typography.family.mono,
            fontSize: 11,
            letterSpacing: 2.2,
            color: colors.text.tertiary,
            marginTop: 6,
          }}
        >
          {current.lang.toUpperCase()}
        </Text>
      )}
    </Animated.View>
  );
}
