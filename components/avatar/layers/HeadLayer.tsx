import React from 'react';
import { Circle, Ellipse, G, Rect } from 'react-native-svg';

interface HeadLayerProps {
  size: number;
  headShape: 'round' | 'oval' | 'square';
  skinTone: string;
}

export const HeadLayer = React.memo(({ size, headShape, skinTone }: HeadLayerProps) => {
  const cx = size / 2;
  const cy = size / 2;

  switch (headShape) {
    case 'round':
      return (
        <G>
          <Circle cx={cx} cy={cy} r={size * 0.4} fill={skinTone} />
        </G>
      );
    case 'oval':
      return (
        <G>
          <Ellipse cx={cx} cy={cy} rx={size * 0.35} ry={size * 0.42} fill={skinTone} />
        </G>
      );
    case 'square':
      return (
        <G>
          <Rect
            x={cx - size * 0.35}
            y={cy - size * 0.38}
            width={size * 0.7}
            height={size * 0.76}
            rx={size * 0.1}
            ry={size * 0.1}
            fill={skinTone}
          />
        </G>
      );
    default:
      return null;
  }
});

HeadLayer.displayName = 'HeadLayer';
