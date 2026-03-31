import { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';

/** Three-dot animated typing indicator styled to match assistant bubbles. */
export function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
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
  }, [dot1, dot2, dot3]);

  const dotStyle = {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#94A3B8',
    marginHorizontal: 3,
  };

  return (
    <View className="self-start mb-2 ml-0">
      <View className="bg-dark-card rounded-[18px] rounded-bl-[4px] px-4 py-3 flex-row items-center">
        <Animated.View style={[dotStyle, { transform: [{ translateY: dot1 }] }]} />
        <Animated.View style={[dotStyle, { transform: [{ translateY: dot2 }] }]} />
        <Animated.View style={[dotStyle, { transform: [{ translateY: dot3 }] }]} />
      </View>
    </View>
  );
}
