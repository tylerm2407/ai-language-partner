import React from 'react';
import { Pressable, View } from 'react-native';
import {
  AvatarConfig,
  AvatarExpression as AvatarExpressionType,
  AvatarSize,
} from '../../types';
import { AVATAR_SIZES, DEFAULT_AVATAR_CONFIG } from './constants';
import { AvatarExpression } from './AvatarExpression';

interface AvatarProps {
  config?: AvatarConfig;
  size?: AvatarSize;
  expression?: AvatarExpressionType;
  animated?: boolean;
  onPress?: () => void;
}

export const Avatar = React.memo(
  ({
    config = DEFAULT_AVATAR_CONFIG,
    size = 'medium',
    expression = 'neutral',
    animated = true,
    onPress,
  }: AvatarProps) => {
    const pixelSize = AVATAR_SIZES[size];
    const minTouchTarget = 44;
    const containerSize = Math.max(pixelSize, minTouchTarget);

    const content = (
      <AvatarExpression
        config={config}
        size={pixelSize}
        expression={expression}
        animated={animated}
      />
    );

    if (onPress) {
      return (
        <Pressable
          onPress={onPress}
          accessibilityLabel="User avatar"
          accessibilityRole="button"
          style={{
            width: containerSize,
            height: containerSize,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {content}
        </Pressable>
      );
    }

    return (
      <View
        accessibilityLabel="User avatar"
        accessibilityRole="image"
        style={{
          width: containerSize,
          height: containerSize,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {content}
      </View>
    );
  }
);

Avatar.displayName = 'Avatar';
