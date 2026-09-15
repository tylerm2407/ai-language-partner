/**
 * Ui2EmptyState — the UI 2.0 counterpart to `components/ui/EmptyState.tsx`.
 *
 * Same five props ({ icon, title, description, actionLabel, onAction }) and the
 * same rule that the action renders only when BOTH `actionLabel` and `onAction`
 * are given — a labelled button that does nothing is worse than no button, and
 * mirroring the condition means a screen that relied on it keeps behaving.
 *
 * The surface is a `SlabCard` rather than a re-implementation of the 2px/5px
 * outline: there is exactly one place that decides what a slab looks like, and
 * the day the bottom edge changes from 5px this file should not need editing.
 *
 * The glyph moves into a tinted disc. The old one floated a bare 48px `#7DD3FC`
 * icon, a colour that only works on the Dark Glow ground — on UI 2.0's white it
 * is a pale smear. The disc gives the icon its own contrast in both schemes
 * without needing a second icon colour per scheme.
 */
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { SlabCard } from './SlabCard';
import { SlabButton } from './SlabButton';
import { Body, Heading } from './Ui2Text';

interface Ui2EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function Ui2EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  style,
}: Ui2EmptyStateProps) {
  const { c, shape } = useUi2Theme();

  return (
    <SlabCard style={[styles.card, style]}>
      <View
        style={[
          styles.disc,
          { backgroundColor: c.primaryTint, borderColor: c.primaryTintBorder, borderWidth: shape.border },
        ]}
      >
        <Ionicons name={icon} size={32} color={c.onTint} />
      </View>

      {/* Level 3 keeps the empty state from out-shouting the screen title it
          sits under; the old one used an 18px semibold, which is the same size. */}
      <Heading level={3} style={styles.centeredText}>
        {title}
      </Heading>
      <Body size="sm" tone="secondary" style={styles.centeredText}>
        {description}
      </Body>

      {actionLabel && onAction ? (
        // No arrow: an empty state's action is the end of the interaction
        // ("Add your first book"), not a step on the way somewhere.
        <SlabButton label={actionLabel} onPress={onAction} arrow={false} style={styles.action} />
      ) : null}
    </SlabCard>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24, gap: 8 },
  disc: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  centeredText: { textAlign: 'center' },
  action: { marginTop: 12, alignSelf: 'stretch' },
});
