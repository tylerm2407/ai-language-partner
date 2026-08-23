import React from 'react';
import { Image, Pressable, View } from 'react-native';
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
  /**
   * Resolved image for a preset or photo-generated avatar. When absent the
   * procedural SVG built from `config` is rendered, which is what every
   * account created before migration 067 uses.
   */
  imageUri?: string | null;
}

export const Avatar = React.memo(
  ({
    config = DEFAULT_AVATAR_CONFIG,
    size = 'medium',
    expression = 'neutral',
    animated = true,
    onPress,
    imageUri,
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
      >
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={{ width: pixelSize, height: pixelSize, borderRadius: pixelSize / 2 }}
            resizeMode="cover"
          />
        ) : undefined}
      </AvatarExpression>
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
