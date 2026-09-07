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
import { Ui2Sheet } from '../ui2/Ui2Sheet';
import { SlabButton } from '../ui2/SlabButton';
import { Heading, Body } from '../ui2/Ui2Text';
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
    <Ui2Sheet visible={visible} onDismiss={onDismiss} dismissOnBackdrop={false}>
      <View style={{ alignItems: 'center', paddingTop: spacing.sm }}>
        <Mascot state="sleepy" size="lg" style={{ marginBottom: spacing.md }} />
        <Heading level={2} style={{ textAlign: 'center' }}>
          One reminder a day
        </Heading>
        <Body
          tone="secondary"
          style={{ textAlign: 'center', marginTop: spacing.xs, maxWidth: 320 }}
        >
Lumi will tap you once in the evening if you haven't practised yet. One nudge a day, max — no spam, and nothing to lose if you skip it.
        </Body>

        <View style={{ alignSelf: 'stretch', marginTop: spacing.lg }}>
          <SlabButton
            label="Enable reminders"
            onPress={onEnable}
            accessibilityHint="Turns on notifications"
          />
        </View>
        <View style={{ alignSelf: 'stretch', marginTop: spacing.xs }}>
          <SlabButton
            label="Not yet"
            variant="ghost"
            onPress={onDismiss}
            accessibilityHint="Dismisses without enabling notifications"
          />
        </View>
      </View>
    </Ui2Sheet>
  );
}
