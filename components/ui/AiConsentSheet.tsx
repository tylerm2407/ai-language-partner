/**
 * AiConsentSheet — explicit permission before learner content is sent to a
 * third-party AI provider.
 *
 * Required by Apple guideline 5.1.2(i) and Google's prominent-disclosure rule,
 * both of which want the disclosure at the point of the action rather than
 * buried in a policy. Named providers, plain language, and a real decline path.
 *
 * Composed from Sheet + existing typography/tokens — no new visual patterns.
 * Copy lives in lib/ai-consent.ts so the sheet, Settings and the privacy policy
 * cannot drift apart.
 */

import React, { useState } from 'react';
import { View, Pressable, ScrollView, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Sheet } from './Sheet';
import { Body, Caption } from './Text';
import { colors, radii, spacing } from '../../config/theme';
import { AI_CONSENT_COPY, type AiConsentKind } from '../../lib/ai-consent';

const PRIVACY_URL = 'https://fluenci.com/privacy';

interface AiConsentSheetProps {
  visible: boolean;
  kind: AiConsentKind;
  /** Learner agreed. Persist, then proceed with the action that triggered this. */
  onAgree: () => void;
  /** Learner declined or dismissed. The triggering action must NOT proceed. */
  onDecline: () => void;
}

export function AiConsentSheet({ visible, kind, onAgree, onDecline }: AiConsentSheetProps) {
  const [declined, setDeclined] = useState(false);
  const copy = AI_CONSENT_COPY[kind];

  function handleDecline() {
    // Show the consequence before closing, so "Not now" is an informed choice
    // rather than a dead end the learner has to guess the meaning of.
    setDeclined(true);
  }

  function handleClose() {
    setDeclined(false);
    onDecline();
  }

  function handleAgree() {
    setDeclined(false);
    onAgree();
  }

  return (
    <Sheet visible={visible} onDismiss={handleClose}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {declined ? (
          <>
            <Body style={styles.title}>Not a problem</Body>
            <Body style={styles.paragraph}>{copy.declinedNote}</Body>
            <Pressable
              style={styles.primaryButton}
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Body style={styles.primaryButtonText}>Got it</Body>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => setDeclined(false)}
              accessibilityRole="button"
              accessibilityLabel="Back to the details"
            >
              <Body style={styles.secondaryButtonText}>Read it again</Body>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.iconRow}>
              <Ionicons
                name={kind === 'voice' ? 'mic-outline' : 'chatbubbles-outline'}
                size={24}
                color={colors.action.accent}
              />
            </View>
            <Body style={styles.title}>{copy.title}</Body>
            <Body style={styles.paragraph}>{copy.intro}</Body>

            <View style={styles.noticeBox}>
              {copy.points.map((point) => (
                <Caption key={point} style={styles.noticeLine}>
                  {`• ${point}`}
                </Caption>
              ))}
            </View>

            <Pressable
              onPress={() => Linking.openURL(PRIVACY_URL)}
              accessibilityRole="link"
              accessibilityLabel="Read the full privacy policy"
              style={styles.linkRow}
            >
              <Caption style={styles.linkText}>Read the full privacy policy</Caption>
              <Ionicons name="open-outline" size={14} color={colors.action.accent} />
            </Pressable>

            <Pressable
              style={styles.primaryButton}
              onPress={handleAgree}
              accessibilityRole="button"
              accessibilityLabel={copy.agreeLabel}
            >
              <Body style={styles.primaryButtonText}>{copy.agreeLabel}</Body>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={handleDecline}
              accessibilityRole="button"
              accessibilityLabel={copy.declineLabel}
            >
              <Body style={styles.secondaryButtonText}>{copy.declineLabel}</Body>
            </Pressable>
            <Caption style={styles.footnote}>
              You can withdraw this any time in Profile → Settings.
            </Caption>
          </>
        )}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  iconRow: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.action.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  paragraph: {
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  noticeBox: {
    backgroundColor: colors.surface.cardAlt,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  noticeLine: {
    color: colors.text.secondary,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    // 44pt minimum touch target — matches ReportContentSheet.
    minHeight: 44,
    marginBottom: spacing.sm,
  },
  linkText: {
    color: colors.action.accent,
    textDecorationLine: 'underline',
  },
  primaryButton: {
    backgroundColor: colors.action.primaryFill,
    borderRadius: radii.lg,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  primaryButtonText: {
    color: colors.text.onPrimary,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.text.secondary,
  },
  footnote: {
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
