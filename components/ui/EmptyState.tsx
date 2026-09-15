import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ui2Shape } from '../../config/theme';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { Button } from './Button';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * The glyph was a fixed sky blue (#7DD3FC), a colour that exists nowhere in
 * UI 2.0; `primary` is the accent in both schemes. Everything else here was a
 * Dark Glow tailwind class — `bg-dark-card`, `text-text-primary` — which is a
 * fixed dark palette by another name and renders as a black slab in light mode.
 */
export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  const { c, type } = useUi2Theme();
  return (
    <View style={{ backgroundColor: c.card, borderColor: c.cardBorder, borderWidth: ui2Shape.border, borderBottomWidth: ui2Shape.slab, borderRadius: ui2Shape.radiusCard, padding: 32, alignItems: 'center' }}>
      <Ionicons name={icon} size={48} color={c.primary} />
      <Text style={{ fontSize: 18, lineHeight: 26, fontFamily: type.uiBold, color: c.ink, marginTop: 16, marginBottom: 8 }}>{title}</Text>
      <Text style={{ fontSize: 14, lineHeight: 20, fontFamily: type.ui, color: c.muted, textAlign: 'center', marginBottom: 16 }}>{description}</Text>
      {actionLabel && onAction && (
        <Button label={actionLabel} variant="primary" onPress={onAction} />
      )}
    </View>
  );
}
