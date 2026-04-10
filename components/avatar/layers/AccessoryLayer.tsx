import React from 'react';
import { Circle, G, Line, Path, Rect } from 'react-native-svg';

interface AccessoryLayerProps {
  size: number;
  accessory: string | null;
}

export const AccessoryLayer = React.memo(({ size, accessory }: AccessoryLayerProps) => {
  if (!accessory) return null;

  const cx = size / 2;

  switch (accessory) {
    case 'glasses': {
      const eyeY = size * 0.42;
      const leftX = size * 0.35;
      const rightX = size * 0.65;
      const lensR = size * 0.08;
      const strokeWidth = Math.max(size * 0.015, 1);
      return (
        <G>
          {/* Left lens */}
          <Circle
            cx={leftX}
            cy={eyeY}
            r={lensR}
            stroke="#64748B"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Right lens */}
          <Circle
            cx={rightX}
            cy={eyeY}
            r={lensR}
            stroke="#64748B"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Bridge */}
          <Line
            x1={leftX + lensR}
            y1={eyeY}
            x2={rightX - lensR}
            y2={eyeY}
            stroke="#64748B"
            strokeWidth={strokeWidth}
          />
          {/* Left arm */}
          <Line
            x1={leftX - lensR}
            y1={eyeY}
            x2={leftX - lensR - size * 0.04}
            y2={eyeY - size * 0.01}
            stroke="#64748B"
            strokeWidth={strokeWidth}
          />
          {/* Right arm */}
          <Line
            x1={rightX + lensR}
            y1={eyeY}
            x2={rightX + lensR + size * 0.04}
            y2={eyeY - size * 0.01}
            stroke="#64748B"
            strokeWidth={strokeWidth}
          />
        </G>
      );
    }

    case 'hat': {
      const headTop = size * 0.1;
      const brimY = size * 0.2;
      const hatWidth = size * 0.5;
      const hatHeight = size * 0.15;
      return (
        <G>
          {/* Hat body */}
          <Rect
            x={cx - hatWidth * 0.35}
            y={headTop}
            width={hatWidth * 0.7}
            height={hatHeight}
            rx={size * 0.02}
            ry={size * 0.02}
            fill="#FFD700"
          />
          {/* Brim */}
          <Rect
            x={cx - hatWidth * 0.55}
            y={brimY}
            width={hatWidth * 1.1}
            height={size * 0.03}
            rx={size * 0.015}
            ry={size * 0.015}
            fill="#FFD700"
          />
        </G>
      );
    }

    case 'earrings': {
      const earY = size * 0.52;
      const headRadius = size * 0.4;
      const earringR = size * 0.02;
      return (
        <G>
          <Circle
            cx={cx - headRadius - size * 0.01}
            cy={earY}
            r={earringR}
            fill="#FFD700"
          />
          <Circle
            cx={cx + headRadius + size * 0.01}
            cy={earY}
            r={earringR}
            fill="#FFD700"
          />
        </G>
      );
    }

    default:
      return null;
  }
});

AccessoryLayer.displayName = 'AccessoryLayer';
