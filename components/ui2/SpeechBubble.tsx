/**
 * SpeechBubble — Sol plus a card with the step's question. Slides in from the
 * right on each step change (keyed by the step), so the mascot "brings" the
 * next question with it.
 */
import { StyleSheet, Text, View } from 'react-native';
import Animated, { SlideInRight } from 'react-native-reanimated';
import { MascotSol, type MascotMood } from './MascotSol';
import { useMotion } from '../../hooks/useMotion';
import { useUi2Theme } from '../../hooks/useUi2Theme';

interface SpeechBubbleProps {
  text: string;
  mood?: MascotMood;
}

export function SpeechBubble({ text, mood = 'idle' }: SpeechBubbleProps) {
  const { c, type, shape } = useUi2Theme();
  const { shouldReduce } = useMotion();
  const entering = shouldReduce ? undefined : SlideInRight.springify().damping(18).stiffness(170);

  return (
    <Animated.View entering={entering} style={styles.row}>
      <MascotSol size={72} mood={mood} />
      <View
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
      </View>
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
