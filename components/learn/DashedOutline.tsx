/**
 * DashedOutline — a dashed rounded-rect border drawn in SVG.
 *
 * React Native's `borderStyle: 'dashed'` is not usable here: on Android it
 * silently falls back to a solid border as soon as `borderRadius` is set, and
 * on both platforms the dash phase is not controllable. The upcoming-lesson
 * rows lean on that dash to read as "not yet yours", so it has to survive on
 * Android — hence `react-native-svg`, which the app already ships for the
 * ambient glow layer.
 *
 * Renders into an absolutely-positioned overlay and never takes a touch, so it
 * can be dropped inside any Pressable without changing its hit area.
 */

import React, { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

interface DashedOutlineProps {
  color: string;
  radius: number;
  /** [dash, gap] in px. */
  dash?: [number, number];
  strokeWidth?: number;
}

export function DashedOutline({
  color,
  radius,
  dash = [5, 4],
  strokeWidth = 1,
}: DashedOutlineProps) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) =>
      prev && prev.width === width && prev.height === height ? prev : { width, height },
    );
  };

  // The stroke straddles the path, so inset by half its width to keep the
  // outer edge flush with the container rather than clipped by it.
  const inset = strokeWidth / 2;

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={onLayout}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {size && size.width > strokeWidth && size.height > strokeWidth && (
        <Svg width={size.width} height={size.height}>
          <Rect
            x={inset}
            y={inset}
            width={size.width - strokeWidth}
            height={size.height - strokeWidth}
            rx={radius}
            ry={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={dash.join(',')}
          />
        </Svg>
      )}
    </View>
  );
}
