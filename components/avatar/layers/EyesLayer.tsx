import React from 'react';
import { Circle, Ellipse, G } from 'react-native-svg';

interface EyesLayerProps {
  size: number;
  eyeStyle: 'round' | 'almond' | 'wide' | 'narrow';
  eyeColor: string;
}

export const EyesLayer = React.memo(({ size, eyeStyle, eyeColor }: EyesLayerProps) => {
  const leftX = size * 0.35;
  const rightX = size * 0.65;
  const eyeY = size * 0.42;
  const pupilRadius = size * 0.025;

  const renderEye = (cx: number) => {
    switch (eyeStyle) {
      case 'round': {
        const r = size * 0.05;
        return (
          <G>
            <Circle cx={cx} cy={eyeY} r={r} fill="#FFFFFF" />
            <Circle cx={cx} cy={eyeY} r={pupilRadius} fill={eyeColor} />
          </G>
        );
      }
      case 'almond': {
        const rx = size * 0.06;
        const ry = size * 0.04;
        return (
          <G>
            <Ellipse cx={cx} cy={eyeY} rx={rx} ry={ry} fill="#FFFFFF" />
            <Circle cx={cx} cy={eyeY} r={pupilRadius} fill={eyeColor} />
          </G>
        );
      }
      case 'wide': {
        const r = size * 0.06;
        return (
          <G>
            <Circle cx={cx} cy={eyeY} r={r} fill="#FFFFFF" />
            <Circle cx={cx} cy={eyeY} r={pupilRadius * 1.2} fill={eyeColor} />
          </G>
        );
      }
      case 'narrow': {
        const rx = size * 0.05;
        const ry = size * 0.03;
        return (
          <G>
            <Ellipse cx={cx} cy={eyeY} rx={rx} ry={ry} fill="#FFFFFF" />
            <Circle cx={cx} cy={eyeY} r={pupilRadius * 0.9} fill={eyeColor} />
          </G>
        );
      }
      default:
        return null;
    }
  };

  return (
    <G>
      {renderEye(leftX)}
      {renderEye(rightX)}
    </G>
  );
});

EyesLayer.displayName = 'EyesLayer';
