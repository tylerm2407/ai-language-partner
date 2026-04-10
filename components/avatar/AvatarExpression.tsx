import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { AvatarConfig, AvatarExpression as AvatarExpressionType } from '../../types';
import { AvatarSvg } from './AvatarSvg';

interface AvatarExpressionProps {
  config: AvatarConfig;
  size: number;
  expression: AvatarExpressionType;
  animated: boolean;
}

export const AvatarExpression = React.memo(
  ({ config, size, expression, animated }: AvatarExpressionProps) => {
    const scale = useRef(new Animated.Value(1)).current;
    const rotation = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      scale.stopAnimation();
      rotation.stopAnimation();
      scale.setValue(1);
      rotation.setValue(0);

      if (!animated) return;

      let anim: Animated.CompositeAnimation | null = null;

      switch (expression) {
        case 'neutral':
          anim = Animated.loop(
            Animated.sequence([
              Animated.timing(scale, { toValue: 1.02, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
              Animated.timing(scale, { toValue: 1.0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            ])
          );
          break;

        case 'happy':
          anim = Animated.sequence([
            Animated.spring(scale, { toValue: 1.1, damping: 8, stiffness: 200, useNativeDriver: true }),
            Animated.spring(scale, { toValue: 1.0, damping: 10, stiffness: 150, useNativeDriver: true }),
          ]);
          break;

        case 'sad':
          anim = Animated.sequence([
            Animated.timing(scale, { toValue: 0.95, duration: 400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
            Animated.timing(scale, { toValue: 1.0, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          ]);
          break;

        case 'celebrating':
          anim = Animated.parallel([
            Animated.sequence([
              Animated.spring(scale, { toValue: 1.15, damping: 6, stiffness: 250, useNativeDriver: true }),
              Animated.spring(scale, { toValue: 1.0, damping: 10, stiffness: 150, useNativeDriver: true }),
            ]),
            Animated.sequence([
              Animated.timing(rotation, { toValue: -5, duration: 100, useNativeDriver: true }),
              Animated.timing(rotation, { toValue: 5, duration: 100, useNativeDriver: true }),
              Animated.timing(rotation, { toValue: -3, duration: 80, useNativeDriver: true }),
              Animated.timing(rotation, { toValue: 3, duration: 80, useNativeDriver: true }),
              Animated.timing(rotation, { toValue: 0, duration: 100, useNativeDriver: true }),
            ]),
          ]);
          break;
      }

      anim?.start();

      return () => anim?.stop();
    }, [expression, animated, scale, rotation]);

    const rotateInterpolation = rotation.interpolate({
      inputRange: [-360, 360],
      outputRange: ['-360deg', '360deg'],
    });

    return (
      <Animated.View
        style={[
          { width: size, height: size, alignItems: 'center', justifyContent: 'center' },
          animated
            ? { transform: [{ scale }, { rotate: rotateInterpolation }] }
            : undefined,
        ]}
      >
        <AvatarSvg config={config} size={size} />
      </Animated.View>
    );
  }
);

AvatarExpression.displayName = 'AvatarExpression';
