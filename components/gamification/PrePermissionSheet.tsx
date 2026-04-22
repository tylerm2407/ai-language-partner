/**
 * PrePermissionSheet — explains the notification value BEFORE requesting
 * the iOS system permission. Pre-prompt pattern empirically lifts opt-in
 * rates 2-3× vs cold-firing the system dialog (conversion-research.md
 * §Invisible Details → permission pre-prompts).
 *
 * Triggered from the Home screen after the learner completes their first
 * lesson, when checklist.firstLesson is true and checklist.dailyReminder
 * is false. Handled once per user lifecycle.
 */

import React from 'react';
import { View } from 'react-native';
import { Sheet } from '../ui/Sheet';
import { TactileButton } from '../ui/TactileButton';
import { Heading, Body } from '../ui/Text';
import { Mascot } from '../mascot/Mascot';
import { spacing } from '../../config/theme';

interface PrePermissionSheetProps {
  visible: boolean;
  onEnable: () => void | Promise<void>;
  onDismiss: () => void;
}

export function PrePermissionSheet({
  visible,
  onEnable,
  onDismiss,
}: PrePermissionSheetProps) {
  return (
    <Sheet visible={visible} onDismiss={onDismiss} dismissOnBackdrop={false}>
      <View style={{ alignItems: 'center', paddingTop: spacing.sm }}>
        <Mascot state="happy" size="md" style={{ marginBottom: spacing.md }} />
        <Heading level={2} style={{ textAlign: 'center' }}>
          Protect your streak
        </Heading>
        <Body
          tone="secondary"
          style={{ textAlign: 'center', marginTop: spacing.xs, maxWidth: 320 }}
        >
          Lumi will only tap you when your streak is about to break. One nudge a day, max — no spam.
        </Body>

        <View style={{ alignSelf: 'stretch', marginTop: spacing.lg }}>
          <TactileButton
            label="Enable reminders"
            onPress={onEnable}
            accessibilityLabel="Enable notifications"
          />
        </View>
        <View style={{ alignSelf: 'stretch', marginTop: spacing.xs }}>
          <TactileButton
            label="Not yet"
            variant="ghost"
            onPress={onDismiss}
            accessibilityLabel="Dismiss without enabling notifications"
          />
        </View>
      </View>
    </Sheet>
  );
}
