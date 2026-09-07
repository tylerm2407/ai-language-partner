/**
 * SpeechBubble — Sol plus a card with the step's question.
 *
 * Each onboarding step picks an `entrance`, so the bubble arrives a different
 * way every time instead of replaying one slide. The parent remounts the step
 * body (keyed on the step) so `entering` fires on every arrival. Sol and the
 * card animate as two pieces: that is what makes each entrance read as its own
 * moment rather than one row moving.
 */
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  FadeInUp,
  SlideInRight,
  ZoomIn,
  type BaseAnimationBuilder,
} from 'react-native-reanimated';
import { MascotSol, type MascotMood } from './MascotSol';
import { useMotion } from '../../hooks/useMotion';
import { useUi2Theme } from '../../hooks/useUi2Theme';

/**
 * - `slide`: the whole row springs in from the right — Sol brings the question.
 * - `rise`: Sol fades in, the card floats up a beat later — for a reflective ask.
 * - `pop`: Sol pops to size, the card pops out of Sol's side — a quick, confident question.
 * - `meet`: Sol drifts in from the left, the card from the right, and they meet at the tail.
 * - `drop`: both settle down from above, card first — a grounded, practical question.
 */
export type SpeechBubbleEntrance = 'slide' | 'rise' | 'pop' | 'meet' | 'drop';

interface SpeechBubbleProps {
  text: string;
  mood?: MascotMood;
  entrance?: SpeechBubbleEntrance;
}

interface EntranceSet {
  row?: BaseAnimationBuilder;
  sol?: BaseAnimationBuilder;
  card?: BaseAnimationBuilder;
}

function buildEntrance(entrance: SpeechBubbleEntrance): EntranceSet {
  switch (entrance) {
    case 'slide':
      return { row: SlideInRight.springify().damping(18).stiffness(170) };
    case 'rise':
      return {
        sol: FadeIn.duration(320),
        card: FadeInUp.delay(120).springify().damping(16).stiffness(150),
      };
    case 'pop':
      return {
        sol: ZoomIn.springify().damping(12).stiffness(220),
        card: ZoomIn.delay(90).springify().damping(14).stiffness(200),
      };
    case 'meet':
      return {
        sol: FadeInLeft.springify().damping(17).stiffness(160),
        card: FadeInRight.delay(60).springify().damping(17).stiffness(160),
      };
    case 'drop':
      return {
        card: FadeInDown.springify().damping(15).stiffness(180),
        sol: FadeInDown.delay(110).springify().damping(13).stiffness(190),
      };
  }
}

export function SpeechBubble({ text, mood = 'idle', entrance = 'slide' }: SpeechBubbleProps) {
  const { c, type, shape } = useUi2Theme();
  const { shouldReduce } = useMotion();
  const anim: EntranceSet = shouldReduce ? {} : buildEntrance(entrance);

  return (
    <Animated.View entering={anim.row} style={styles.row}>
      <Animated.View entering={anim.sol}>
        <MascotSol size={72} mood={mood} />
      </Animated.View>
      <Animated.View
        entering={anim.card}
        style={[
          styles.bubble,
          { backgroundColor: c.card, borderColor: c.cardBorder, borderWidth: shape.border, borderRadius: shape.radiusCard },
        ]}
      >
        <View
          style={[
            styles.tail,
            { backgroundColor: c.card, borderColor: c.cardBorder, borderLeftWidth: shape.border, borderBottomWidth: shape.border },
          ]}
        />
        <Text
          accessibilityRole="header"
          style={{ fontFamily: type.heading, fontSize: 18, lineHeight: 23, color: c.ink }}
        >
          {text}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bubble: { flex: 1, paddingVertical: 12, paddingHorizontal: 14 },
  tail: {
    position: 'absolute',
    left: -9,
    top: 22,
    width: 14,
    height: 14,
    transform: [{ rotate: '45deg' }],
  },
});
