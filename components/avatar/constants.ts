import { AvatarConfig } from '../../types';

export const AVATAR_SIZES = { small: 32, medium: 64, large: 128 } as const;

export const SKIN_TONES = [
  '#FDDCB5', '#F5C7A1', '#E8B48A', '#D4956B', '#BB7A50', '#8D5B3A', '#6B4226', '#4A2D17',
];

export const HAIR_COLORS = [
  '#0A0A0A', '#2C1B0E', '#5A3214', '#8B4513', '#CD853F', '#DAA520', '#C0392B', '#E8E8E8', '#6C63FF',
];

export const EYE_COLORS = [
  '#4A3728', '#2E86AB', '#22C55E', '#8B6914', '#6C63FF', '#1A1A2E',
];

export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  headShape: 'round',
  skinTone: '#F5C7A1',
  hairStyle: 'short',
  hairColor: '#2C1B0E',
  eyeStyle: 'round',
  eyeColor: '#4A3728',
  mouthStyle: 'smile',
  accessory: null,
  outfit: null,
  background: null,
};
