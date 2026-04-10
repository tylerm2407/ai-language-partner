import React from 'react';
import { G, Path } from 'react-native-svg';

interface MouthLayerProps {
  size: number;
  mouthStyle: 'smile' | 'neutral' | 'grin' | 'small';
}

export const MouthLayer = React.memo(({ size, mouthStyle }: MouthLayerProps) => {
  const cx = size * 0.5;
  const cy = size * 0.62;
  const strokeWidth = Math.max(size * 0.02, 1);
  const mouthColor = '#C0392B';

  switch (mouthStyle) {
    case 'smile': {
      const w = size * 0.12;
      return (
        <G>
          <Path
            d={`M ${cx - w} ${cy} Q ${cx} ${cy + size * 0.08} ${cx + w} ${cy}`}
            stroke={mouthColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
          />
        </G>
      );
    }

    case 'neutral': {
      const w = size * 0.08;
      return (
        <G>
          <Path
            d={`M ${cx - w} ${cy} L ${cx + w} ${cy}`}
            stroke={mouthColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
          />
        </G>
      );
    }

    case 'grin': {
      const w = size * 0.15;
      return (
        <G>
          <Path
            d={`M ${cx - w} ${cy} Q ${cx} ${cy + size * 0.12} ${cx + w} ${cy}`}
            stroke={mouthColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
          />
        </G>
      );
    }

    case 'small': {
      const w = size * 0.06;
      return (
        <G>
          <Path
            d={`M ${cx - w} ${cy} Q ${cx} ${cy + size * 0.04} ${cx + w} ${cy}`}
            stroke={mouthColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
          />
        </G>
      );
    }

    default:
      return null;
  }
});

MouthLayer.displayName = 'MouthLayer';
