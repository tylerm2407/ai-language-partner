import { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { useMotion } from '../../hooks/useMotion';

/**
 * Three-dot animated typing indicator styled to match assistant bubbles.
 *
 * The bounce is an infinite loop that starts on its own and runs for as long as
 * the tutor is composing, which is exactly the shape WCAG 2.2 SC 2.2.2 asks for a
 * stop mechanism for — so it is gated on `useMotion().shouldReduce`. Reduced
 * motion keeps the three dots and the bubble, and simply holds them still: the
 * "the tutor is answering" signal survives, the movement does not.
 */
export function TypingIndicator() {
  const { c } = useUi2Theme();
  const { shouldReduce } = useMotion();
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (shouldReduce) {
      // Whatever a previous run left mid-bounce, put the dots back on the line.
      dot1.setValue(0);
      dot2.setValue(0);
      dot3.setValue(0);
      return;
    }

    const animateDot = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: -6, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
        ])
      );

    const animation = Animated.parallel([
      animateDot(dot1, 0),
      animateDot(dot2, 150),
      animateDot(dot3, 300),
    ]);
    animation.start();

    return () => animation.stop();
  }, [shouldReduce, dot1, dot2, dot3]);

  const dotStyle = {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: c.idle,
    marginHorizontal: 3,
  };

  return (
    <View className="self-start mb-2 ml-0">
      {/* Same shell as an assistant bubble — r18 / bl-4, card fill, 1px border. */}
      <View
        className="rounded-[18px] rounded-bl-[4px] px-4 py-3 flex-row items-center"
        style={{ backgroundColor: c.card, borderColor: c.cardBorder, borderWidth: 1 }}
      >
        <Animated.View style={[dotStyle, { transform: [{ translateY: dot1 }] }]} />
        <Animated.View style={[dotStyle, { transform: [{ translateY: dot2 }] }]} />
        <Animated.View style={[dotStyle, { transform: [{ translateY: dot3 }] }]} />
      </View>
    </View>
  );
}
