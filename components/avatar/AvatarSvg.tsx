import React from 'react';
import Svg, { Circle } from 'react-native-svg';
import { AvatarConfig } from '../../types';
import { HeadLayer } from './layers/HeadLayer';
import { HairLayer } from './layers/HairLayer';
import { EyesLayer } from './layers/EyesLayer';
import { MouthLayer } from './layers/MouthLayer';
import { AccessoryLayer } from './layers/AccessoryLayer';

interface AvatarSvgProps {
  config: AvatarConfig;
  size: number;
}

export const AvatarSvg = React.memo(({ config, size }: AvatarSvgProps) => {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {config.background && (
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={config.background} />
      )}
      <HeadLayer size={size} headShape={config.headShape} skinTone={config.skinTone} />
      <HairLayer
        size={size}
        hairStyle={config.hairStyle}
        hairColor={config.hairColor}
        headShape={config.headShape}
      />
      <EyesLayer size={size} eyeStyle={config.eyeStyle} eyeColor={config.eyeColor} />
      <MouthLayer size={size} mouthStyle={config.mouthStyle} />
      <AccessoryLayer size={size} accessory={config.accessory} />
    </Svg>
  );
});

AvatarSvg.displayName = 'AvatarSvg';
