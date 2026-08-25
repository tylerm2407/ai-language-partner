/**
 * Avatar renderer.
 *
 * Two states only: an image, or initials.
 *
 * The layer-based procedural SVG that used to live behind this was removed —
 * it built a face from head/hair/eyes/mouth pickers, and its output was only
 * ever as good as its worst combination. It is replaced by the premade
 * library (AvatarPresetPicker) plus photo generation, both of which produce
 * artwork somebody has actually looked at.
 *
 * The initials fallback is NOT decorative. Accounts created before the change
 * still carry `avatar_kind = 'procedural'` and an `avatar_config` nothing can
 * render any more, and a learner who has never chosen anything has no image
 * either. Both land here, which is why this must never render blank.
 */
import React, { useMemo } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { AVATAR_SIZES } from './constants';
import { colors } from '../../config/theme';
import type { AvatarSize } from '../../types';

interface AvatarProps {
  size?: AvatarSize;
  onPress?: () => void;
  /** Resolved image for a preset or photo-generated avatar. */
  imageUri?: string | null;
  /** Used for the initials fallback when there is no image. */
  displayName?: string | null;
}

/**
 * Up to two initials from a display name. Falls back to a neutral glyph rather
 * than an empty circle for names that are blank, whitespace, or emoji-only.
 */
export function initialsFor(displayName?: string | null): string {
  const words = (displayName ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const letters = words
    .map((w) => Array.from(w)[0] ?? '')
    .filter((c) => /\p{L}|\p{N}/u.test(c))
    .slice(0, 2)
    .join('');
  return letters ? letters.toUpperCase() : '·';
}

export const Avatar = React.memo(
  ({ size = 'medium', onPress, imageUri, displayName }: AvatarProps) => {
    const pixelSize = AVATAR_SIZES[size];
    // Apple HIG: interactive elements need 44pt, but a decorative avatar must
    // not be padded out to 44 or it breaks tight rows.
    const containerSize = onPress ? Math.max(pixelSize, 44) : pixelSize;
    const initials = useMemo(() => initialsFor(displayName), [displayName]);

    const content = imageUri ? (
      <Image
        source={{ uri: imageUri }}
        style={{ width: pixelSize, height: pixelSize, borderRadius: pixelSize / 2 }}
        resizeMode="cover"
      />
    ) : (
      <View
        style={{
          width: pixelSize,
          height: pixelSize,
          borderRadius: pixelSize / 2,
          backgroundColor: colors.surface.cardAlt,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            // Scales with the circle so one component serves 32px through 128px.
            fontSize: Math.round(pixelSize * 0.4),
            lineHeight: Math.round(pixelSize * 0.48),
            fontWeight: '700',
            color: colors.text.secondary,
          }}
          // The wrapper already carries an accessible label; the glyph itself
          // would otherwise be read out a second time.
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          {initials}
        </Text>
      </View>
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
  },
);

Avatar.displayName = 'Avatar';
