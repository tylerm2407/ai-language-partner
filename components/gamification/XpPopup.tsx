import { useEffect, useRef } from 'react';
import { Text, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GRADIENT_START, GRADIENT_END } from '../../config/gradients';

interface XpPopupProps {
  xp: number;
  visible: boolean;
  onDone: () => void;
}

export function XpPopup({ xp, visible, onDone }: XpPopupProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (visible && xp > 0) {
      // Reset
      translateY.setValue(0);
      opacity.setValue(0);
      scale.setValue(0.5);

      // Animate in
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 250, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
      ]).start();

      // Float up and fade out
      Animated.sequence([
        Animated.delay(300),
        Animated.parallel([
          Animated.timing(translateY, { toValue: -80, duration: 800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.sequence([
            Animated.delay(400),
            Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
          ]),
        ]),
      ]).start(({ finished }) => {
        if (finished) onDone();
      });
    }
  }, [visible, xp, translateY, opacity, scale, onDone]);

  if (!visible) return null;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: '40%',
        alignSelf: 'center',
        zIndex: 999,
        borderRadius: 20,
        shadowColor: '#38BDF8',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
        overflow: 'hidden',
        transform: [{ translateY }, { scale }],
        opacity,
      }}
      pointerEvents="none"
    >
      <LinearGradient
        colors={['rgba(168, 85, 247, 0.9)', 'rgba(56, 189, 248, 0.9)']}
        start={GRADIENT_START}
        end={GRADIENT_END}
        style={{ paddingHorizontal: 20, paddingVertical: 10 }}
      >
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 24,
            fontFamily: 'Inter_700Bold',
            fontWeight: '800',
            textAlign: 'center',
          }}
        >
          +{xp} XP
        </Text>
      </LinearGradient>
    </Animated.View>
  );
}
