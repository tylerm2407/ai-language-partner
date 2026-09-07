import { useEffect, useRef } from 'react';
import { View, Text, Pressable, Modal, Dimensions, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SlabCard } from '../ui2/SlabCard';
import { scrimColor } from '../ui2/Ui2Sheet';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { getLeagueConfig } from '../../lib/levels';
import { haptic } from '../../lib/haptics';
import type { LeagueTier } from '../../lib/levels';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PARTICLE_COUNT = 14;
/** 0xB3 ≈ 70%, matching the achievement modal's scrim. */
const SCRIM_ALPHA = 'B3';

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
  const { c, scheme } = useUi2Theme();
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

      // The buzz rides the animation rather than the mount: one Heavy thump as
      // the card springs in, and for a league promotion a second one timed to
      // the level number landing 200ms later. A promotion is rarer than a level
      // and should not feel identical to it — the double-thump is what makes
      // the difference legible through the pocket, without a new sound or a
      // longer animation.
      haptic('levelUp');
      if (tierChanged) {
        const promotionThump = setTimeout(() => haptic('milestone'), 200);
        return () => clearTimeout(promotionThump);
      }
    }
  }, [visible, tierChanged, cardScale, cardOpacity, backdropOpacity, levelScale]);

  const confettiColors = [leagueConfig.color, c.yellow, c.green, c.primary, c.pink, c.onTint];

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onDismiss}>
      <Animated.View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: scrimColor(scheme, c) + SCRIM_ALPHA, opacity: backdropOpacity }}>
        <Animated.View style={{ width: SCREEN_WIDTH * 0.82, borderRadius: 24, overflow: 'hidden', transform: [{ scale: cardScale }], opacity: cardOpacity }}>
          {/* Was a gradient hairline around a fixed dark panel; the slab's own
              border and bottom edge carry that depth in UI 2.0. */}
          <SlabCard hero style={{ padding: 32, alignItems: 'center' }}>
              {/* Confetti */}
              <View style={{ position: 'absolute', top: '35%', left: '50%' }}>
                {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
                  <ConfettiParticle key={i} index={i} color={confettiColors[i % confettiColors.length]} />
                ))}
              </View>

              <Text className="text-sm font-semibold tracking-widest uppercase mb-4" style={{ color: c.muted }}>
                {tierChanged ? 'League Promotion!' : 'Level Up!'}
              </Text>

              {/* Level number */}
              <Animated.View style={{ transform: [{ scale: levelScale }], marginBottom: 16 }}>
                <View
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    overflow: 'hidden',
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: tierChanged ? leagueConfig.color : c.primary,
                  }}
                >
                  <Text style={{ color: c.onPrimary, fontSize: 32, fontWeight: '800' }}>{newLevel}</Text>
                </View>
              </Animated.View>

              <Text className="text-2xl font-bold text-center mb-2" style={{ color: c.ink }}>
                Level {newLevel}!
              </Text>

              {tierChanged && (
                <View className="flex-row items-center gap-2 mb-4">
                  <Ionicons name="shield" size={24} color={leagueConfig.color} />
                  <Text style={{ color: c.ink, fontSize: 20, fontWeight: '800' }}>
                    {leagueConfig.label} League
                  </Text>
                </View>
              )}

              <Text className="text-base text-center mb-8" style={{ color: c.muted }}>
                {tierChanged
                  ? `You've been promoted to the ${leagueConfig.label} League! Keep it up!`
                  : 'Keep learning to reach the next level!'}
              </Text>

              <Pressable
                style={{ width: '100%', borderRadius: 14, overflow: 'hidden', paddingVertical: 16, alignItems: 'center', backgroundColor: tierChanged ? leagueConfig.color : c.primary }}
                onPress={() => {
                  haptic('buttonPress');
                  onDismiss();
                }}
                accessibilityRole="button"
                accessibilityLabel="Continue"
              >
                <Text style={{ color: c.onPrimary, fontSize: 18, fontWeight: '700' }}>
                  Continue
                </Text>
              </Pressable>
          </SlabCard>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
