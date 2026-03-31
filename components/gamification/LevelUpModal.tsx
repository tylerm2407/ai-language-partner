import { useEffect, useRef } from 'react';
import { View, Text, Pressable, Modal, Dimensions, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GRADIENT_COLORS, GRADIENT_START, GRADIENT_END } from '../../config/gradients';
import { Ionicons } from '@expo/vector-icons';
import { getLeagueConfig } from '../../lib/levels';
import type { LeagueTier } from '../../lib/levels';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PARTICLE_COUNT = 14;

function ConfettiParticle({ index, color }: { index: number; color: string }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0)).current;
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const angle = (index / PARTICLE_COUNT) * Math.PI * 2;
    const distance = 80 + Math.random() * 60;
    const targetX = Math.cos(angle) * distance;
    const targetY = Math.sin(angle) * distance;
    const delay = index * 30;

    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.delay(600),
          Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
        Animated.spring(scale, { toValue: 1, speed: 30, bounciness: 10, useNativeDriver: true }),
        Animated.spring(translateX, { toValue: targetX, speed: 10, bounciness: 6, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: targetY, speed: 10, bounciness: 6, useNativeDriver: true }),
        Animated.timing(rotation, { toValue: Math.random() > 0.5 ? 1 : -1, duration: 1000, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]),
    ]).start();
  }, [index, translateX, translateY, opacity, scale, rotation]);

  const shapes = ['ellipse', 'star-outline', 'diamond-outline'] as const;
  const shape = shapes[index % shapes.length];
  const size = 8 + (index % 3) * 4;
  const spin = rotation.interpolate({ inputRange: [-1, 1], outputRange: ['-360deg', '360deg'] });

  return (
    <Animated.View
      style={{ position: 'absolute', width: size, height: size, transform: [{ translateX }, { translateY }, { scale }, { rotate: spin }], opacity }}
    >
      <Ionicons name={shape} size={size} color={color} />
    </Animated.View>
  );
}

interface LevelUpModalProps {
  visible: boolean;
  newLevel: number;
  newTier: LeagueTier;
  tierChanged: boolean;
  onDismiss: () => void;
}

export function LevelUpModal({ visible, newLevel, newTier, tierChanged, onDismiss }: LevelUpModalProps) {
  const cardScale = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const levelScale = useRef(new Animated.Value(0)).current;

  const leagueConfig = getLeagueConfig(newTier);

  useEffect(() => {
    if (visible) {
      cardScale.setValue(0);
      cardOpacity.setValue(0);
      backdropOpacity.setValue(0);
      levelScale.setValue(0);

      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(cardScale, { toValue: 1, speed: 14, bounciness: 8, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
      Animated.sequence([
        Animated.delay(200),
        Animated.spring(levelScale, { toValue: 1, speed: 20, bounciness: 12, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, cardScale, cardOpacity, backdropOpacity, levelScale]);

  const confettiColors = [leagueConfig.color, '#FBBF24', '#34D399', '#38BDF8', '#F472B6', '#A855F7'];

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onDismiss}>
      <Animated.View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.7)', opacity: backdropOpacity }}>
        <Animated.View style={{ width: SCREEN_WIDTH * 0.82, borderRadius: 24, overflow: 'hidden', transform: [{ scale: cardScale }], opacity: cardOpacity }}>
          <LinearGradient
            colors={[...GRADIENT_COLORS]}
            start={GRADIENT_START}
            end={GRADIENT_END}
            style={{ borderRadius: 24, padding: 1.5 }}
          >
            <View style={{ borderRadius: 22.5, padding: 32, alignItems: 'center', backgroundColor: '#151921' }}>
              {/* Confetti */}
              <View style={{ position: 'absolute', top: '35%', left: '50%' }}>
                {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
                  <ConfettiParticle key={i} index={i} color={confettiColors[i % confettiColors.length]} />
                ))}
              </View>

              <Text className="text-sm font-semibold text-text-secondary tracking-widest uppercase mb-4">
                {tierChanged ? 'League Promotion!' : 'Level Up!'}
              </Text>

              {/* Level number */}
              <Animated.View style={{ transform: [{ scale: levelScale }], marginBottom: 16 }}>
                <View style={{ width: 80, height: 80, borderRadius: 40, overflow: 'hidden' }}>
                  <LinearGradient
                    colors={tierChanged ? [leagueConfig.color, leagueConfig.color + 'CC'] : [...GRADIENT_COLORS]}
                    start={GRADIENT_START}
                    end={GRADIENT_END}
                    style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 32, fontWeight: '800' }}>{newLevel}</Text>
                  </LinearGradient>
                </View>
              </Animated.View>

              <Text className="text-2xl font-bold text-text-primary text-center mb-2">
                Level {newLevel}!
              </Text>

              {tierChanged && (
                <View className="flex-row items-center gap-2 mb-4">
                  <Ionicons name="shield" size={24} color={leagueConfig.color} />
                  <Text style={{ color: leagueConfig.color, fontSize: 20, fontWeight: '800' }}>
                    {leagueConfig.label} League
                  </Text>
                </View>
              )}

              <Text className="text-base text-text-secondary text-center mb-8">
                {tierChanged
                  ? `You've been promoted to the ${leagueConfig.label} League! Keep it up!`
                  : 'Keep learning to reach the next level!'}
              </Text>

              <Pressable
                style={{ width: '100%', borderRadius: 14, overflow: 'hidden' }}
                onPress={onDismiss}
                accessibilityRole="button"
                accessibilityLabel="Continue"
              >
                <LinearGradient
                  colors={tierChanged ? [leagueConfig.color, leagueConfig.color + 'CC'] : [...GRADIENT_COLORS]}
                  start={GRADIENT_START}
                  end={GRADIENT_END}
                  style={{ paddingVertical: 16, alignItems: 'center', borderRadius: 14 }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>
                    {tierChanged ? 'Awesome!' : 'Continue'}
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
