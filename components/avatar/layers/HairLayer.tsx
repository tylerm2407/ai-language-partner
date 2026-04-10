import React from 'react';
import { Circle, G, Path } from 'react-native-svg';

interface HairLayerProps {
  size: number;
  hairStyle: 'short' | 'medium' | 'long' | 'buzz' | 'curly' | 'ponytail' | 'none';
  hairColor: string;
  headShape: 'round' | 'oval' | 'square';
}

export const HairLayer = React.memo(({ size, hairStyle, hairColor, headShape }: HairLayerProps) => {
  const cx = size / 2;
  const cy = size / 2;
  const headRadius = headShape === 'oval' ? size * 0.35 : size * 0.4;
  const topY = cy - (headShape === 'oval' ? size * 0.42 : size * 0.4);

  switch (hairStyle) {
    case 'none':
      return null;

    case 'buzz': {
      const buzzHeight = size * 0.08;
      return (
        <G>
          <Path
            d={`M ${cx - headRadius} ${cy - headRadius + buzzHeight}
                Q ${cx} ${topY - buzzHeight} ${cx + headRadius} ${cy - headRadius + buzzHeight}`}
            fill={hairColor}
          />
        </G>
      );
    }

    case 'short': {
      const hairHeight = size * 0.15;
      return (
        <G>
          <Path
            d={`M ${cx - headRadius} ${cy - headRadius + hairHeight * 0.5}
                Q ${cx - headRadius * 0.5} ${topY - hairHeight} ${cx} ${topY - hairHeight * 0.8}
                Q ${cx + headRadius * 0.5} ${topY - hairHeight} ${cx + headRadius} ${cy - headRadius + hairHeight * 0.5}`}
            fill={hairColor}
          />
        </G>
      );
    }

    case 'medium': {
      const hairHeight = size * 0.25;
      return (
        <G>
          <Path
            d={`M ${cx - headRadius - size * 0.03} ${cy - headRadius * 0.3}
                Q ${cx - headRadius - size * 0.05} ${topY - hairHeight * 0.5} ${cx} ${topY - hairHeight * 0.7}
                Q ${cx + headRadius + size * 0.05} ${topY - hairHeight * 0.5} ${cx + headRadius + size * 0.03} ${cy - headRadius * 0.3}`}
            fill={hairColor}
          />
          {/* Side hair */}
          <Path
            d={`M ${cx - headRadius - size * 0.03} ${cy - headRadius * 0.3}
                L ${cx - headRadius - size * 0.02} ${cy + size * 0.05}`}
            stroke={hairColor}
            strokeWidth={size * 0.06}
            strokeLinecap="round"
          />
          <Path
            d={`M ${cx + headRadius + size * 0.03} ${cy - headRadius * 0.3}
                L ${cx + headRadius + size * 0.02} ${cy + size * 0.05}`}
            stroke={hairColor}
            strokeWidth={size * 0.06}
            strokeLinecap="round"
          />
        </G>
      );
    }

    case 'long': {
      const flowY = size * 0.65;
      return (
        <G>
          <Path
            d={`M ${cx - headRadius - size * 0.05} ${cy - headRadius * 0.2}
                Q ${cx - headRadius - size * 0.08} ${topY - size * 0.12} ${cx} ${topY - size * 0.15}
                Q ${cx + headRadius + size * 0.08} ${topY - size * 0.12} ${cx + headRadius + size * 0.05} ${cy - headRadius * 0.2}
                L ${cx + headRadius + size * 0.06} ${flowY}
                Q ${cx + headRadius * 0.5} ${flowY + size * 0.05} ${cx} ${flowY - size * 0.02}
                Q ${cx - headRadius * 0.5} ${flowY + size * 0.05} ${cx - headRadius - size * 0.06} ${flowY}
                Z`}
            fill={hairColor}
          />
        </G>
      );
    }

    case 'curly': {
      const curlyRadius = size * 0.045;
      const curlyY = topY - size * 0.02;
      const curls: React.ReactElement[] = [];
      const count = 7;
      for (let i = 0; i < count; i++) {
        const angle = Math.PI + (Math.PI * i) / (count - 1);
        const x = cx + headRadius * 0.95 * Math.cos(angle);
        const y = cy + (headShape === 'oval' ? size * 0.42 : size * 0.4) * Math.sin(angle);
        curls.push(
          <Circle key={i} cx={x} cy={y} r={curlyRadius} fill={hairColor} />
        );
      }
      // Extra curls on top
      curls.push(
        <Circle key="top1" cx={cx - size * 0.1} cy={curlyY} r={curlyRadius * 1.1} fill={hairColor} />,
        <Circle key="top2" cx={cx + size * 0.1} cy={curlyY} r={curlyRadius * 1.1} fill={hairColor} />,
        <Circle key="top3" cx={cx} cy={curlyY - size * 0.02} r={curlyRadius * 1.2} fill={hairColor} />
      );
      return <G>{curls}</G>;
    }

    case 'ponytail': {
      const hairHeight = size * 0.12;
      return (
        <G>
          {/* Top arc */}
          <Path
            d={`M ${cx - headRadius} ${cy - headRadius + hairHeight * 0.5}
                Q ${cx} ${topY - hairHeight} ${cx + headRadius} ${cy - headRadius + hairHeight * 0.5}`}
            fill={hairColor}
          />
          {/* Ponytail extending right */}
          <Path
            d={`M ${cx + headRadius * 0.7} ${topY + size * 0.05}
                Q ${cx + headRadius + size * 0.15} ${topY - size * 0.05} ${cx + headRadius + size * 0.18} ${topY + size * 0.15}
                Q ${cx + headRadius + size * 0.2} ${topY + size * 0.3} ${cx + headRadius + size * 0.12} ${topY + size * 0.35}`}
            stroke={hairColor}
            strokeWidth={size * 0.07}
            strokeLinecap="round"
            fill="none"
          />
          {/* Hair tie */}
          <Circle
            cx={cx + headRadius * 0.85}
            cy={topY + size * 0.06}
            r={size * 0.025}
            fill="#64748B"
          />
        </G>
      );
    }

    default:
      return null;
  }
});

HairLayer.displayName = 'HairLayer';
