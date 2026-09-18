/**
 * LanguageLimitPanel — the body of every "this is a paid feature" step in the
 * language sheets: an explanation and at most two actions.
 *
 * One layout for the limit step, the locked step, the confirm-lock step and
 * the "your upgrade is still activating" step, so the four read as one flow
 * rather than four dialogs. The primary action is a SlabButton; the secondary
 * one is the ghost variant, because it is always the quieter way out.
 */
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { useUi2Theme } from '../../hooks/useUi2Theme';
import { spacing } from '../../config/theme';
import { SlabButton } from './SlabButton';
import { Body } from './Ui2Text';

interface PanelAction {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
}

interface LanguageLimitPanelProps {
  icon: ComponentProps<typeof Ionicons>['name'];
  /** One or more paragraphs. */
  body: string[];
  primary: PanelAction;
  secondary?: PanelAction;
}

export function LanguageLimitPanel({ icon, body, primary, secondary }: LanguageLimitPanelProps) {
  const { c } = useUi2Theme();
  return (
    <View style={styles.wrap}>
      <Ionicons
        name={icon}
        size={28}
        color={c.primary}
        style={styles.icon}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      {body.map((paragraph) => (
        <Body key={paragraph} tone="secondary" style={styles.paragraph}>
          {paragraph}
        </Body>
      ))}
      <SlabButton
        label={primary.label}
        onPress={primary.onPress}
        loading={primary.loading}
        disabled={primary.disabled}
        accessibilityHint={primary.accessibilityHint}
        arrow={false}
        style={styles.primary}
      />
      {secondary ? (
        <SlabButton
          variant="ghost"
          label={secondary.label}
          onPress={secondary.onPress}
          loading={secondary.loading}
          disabled={secondary.disabled}
          accessibilityHint={secondary.accessibilityHint}
          arrow={false}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: spacing.sm },
  icon: { marginBottom: spacing.sm },
  paragraph: { marginBottom: spacing.sm },
  primary: { marginTop: spacing.sm },
});
