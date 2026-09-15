/**
 * Ui2Header — the UI 2.0 counterpart to `components/ui/ScreenHeader.tsx`.
 *
 * The prop surface is character-for-character the old one ({ title, subtitle,
 * onBack, right, centered, style }) so migrating a screen is an import swap.
 * That matters more than it looks: DESIGN.md forbids running Dark Glow and
 * UI 2.0 on the same screen, so every prop that changes name here is a reason
 * for somebody to convert half a screen and stop.
 *
 * Two things genuinely change. The chevron and the type now read their colour
 * from the scheme-aware palette instead of the fixed dark `colors` object —
 * that is the entire point of the migration, since the old header rendered
 * near-white text whatever the OS was set to. And the fixed 44pt back slot is
 * kept even when there is no `onBack`, because it is what keeps a centered
 * title optically centered against whatever `right` puts on the other side.
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { haptic } from '../../lib/haptics';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { Body, Heading } from './Ui2Text';

interface Ui2HeaderProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
  /** Visually centered title (defaults to left-aligned). */
  centered?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Ui2Header({ title, subtitle, onBack, right, centered = false, style }: Ui2HeaderProps) {
  const { c } = useUi2Theme();

  return (
    <View style={[styles.container, style]}>
      <View style={styles.row}>
        {onBack ? (
          <Pressable
            onPress={() => {
              haptic('buttonPress');
              onBack();
            }}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={10}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={24} color={c.ink} />
          </Pressable>
        ) : (
          // Reserved, not omitted — see the header comment.
          <View style={styles.backBtn} />
        )}

        <View style={[styles.titleArea, centered ? styles.centered : styles.leading]}>
          {title ? <Heading level={2}>{title}</Heading> : null}
          {subtitle ? (
            <Body size="sm" tone="secondary" style={centered ? styles.subtitleCentered : styles.subtitle}>
              {subtitle}
            </Body>
          ) : null}
        </View>

        <View style={styles.rightArea}>{right}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
  titleArea: { flex: 1, justifyContent: 'center', minWidth: 0 },
  leading: { alignItems: 'flex-start' },
  centered: { alignItems: 'center' },
  subtitle: { marginTop: 2 },
  subtitleCentered: { marginTop: 2, textAlign: 'center' },
  rightArea: { minWidth: 44, alignItems: 'flex-end' },
});
