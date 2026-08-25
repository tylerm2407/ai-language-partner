import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Sheet } from '../ui/Sheet';
import { Body, Caption } from '../ui/Text';
import { colors, radii, spacing } from '../../config/theme';
import {
  AVATAR_STYLE_OPTIONS,
  AvatarGenerationError,
  capturePhoto,
  fetchAvatarStyles,
  generateAvatar,
  pickFile,
  pickPhoto,
  type PreparedPhoto,
} from '../../lib/avatar-generation';
import type { AvatarStyleOption } from '../../types';

interface AvatarGeneratorSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Called with the new storage path once generation succeeds. */
  onGenerated: (path: string) => void;
  /** Invoked when the user is on a free plan and taps through to upgrade. */
  onUpgrade?: () => void;
}

type Step = 'consent' | 'compose' | 'working';

/**
 * Photo-to-avatar flow.
 *
 * The consent step is not decorative — the photo is sent to a third-party
 * image model, and Apple requires that be disclosed and agreed to before the
 * data is transmitted, not buried in a policy document. The user cannot reach
 * the camera without passing through it.
 */
export const AvatarGeneratorSheet = React.memo(
  ({ visible, onClose, onGenerated, onUpgrade }: AvatarGeneratorSheetProps) => {
    const [step, setStep] = useState<Step>('consent');
    const [styleOptions, setStyleOptions] = useState<AvatarStyleOption[]>(AVATAR_STYLE_OPTIONS);
    const [styleKey, setStyleKey] = useState(AVATAR_STYLE_OPTIONS[0]?.key ?? '');
    const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [needsUpgrade, setNeedsUpgrade] = useState(false);
    // iOS cannot present the native image picker while a React Native <Modal>
    // is on screen (Sheet renders inside one) — the picker has no view
    // controller to present from and the call fails silently. So the sheet is
    // unmounted for the duration of the pick and restored afterwards.
    const [picking, setPicking] = useState(false);

    useEffect(() => {
      if (visible) {
        setStep('consent');
        setPhoto(null);
        setError(null);
        setNeedsUpgrade(false);
        setStyleKey(AVATAR_STYLE_OPTIONS[0]?.key ?? '');
      }
    }, [visible]);

    // Pull the catalogue while the learner is reading the consent copy, so the
    // style list is already populated by the time they reach it. Fetched on
    // open rather than once at mount: a style added server-side then shows up
    // on the next open instead of requiring an app restart.
    useEffect(() => {
      if (!visible) return;
      let cancelled = false;
      fetchAvatarStyles().then((list) => {
        if (cancelled) return;
        setStyleOptions(list);
        // Keep the current pick if the server still offers it; otherwise fall
        // to the first available style rather than leaving a dead key that
        // would fail INVALID_STYLE at generate time.
        setStyleKey((current) =>
          list.some((s) => s.key === current) ? current : (list[0]?.key ?? ''),
        );
      });
      return () => {
        cancelled = true;
      };
    }, [visible]);

    const choose = useCallback(async (source: 'camera' | 'library' | 'file') => {
      setError(null);
      setPicking(true);
      // Let the modal dismissal actually land before the picker is presented.
      await new Promise((resolve) => setTimeout(resolve, 300));
      try {
        const picked =
          source === 'camera'
            ? await capturePhoto()
            : source === 'file'
              ? await pickFile()
              : await pickPhoto();
        if (picked) setPhoto(picked);
      } catch (err) {
        setError(
          err instanceof AvatarGenerationError
            ? err.message
            : 'Could not open your photos. Please try again.'
        );
      } finally {
        setPicking(false);
      }
    }, []);

    const run = useCallback(async () => {
      if (!photo) return;
      setStep('working');
      setError(null);
      setNeedsUpgrade(false);
      try {
        const result = await generateAvatar(photo, styleKey);
        onGenerated(result.path);
        onClose();
      } catch (err) {
        setStep('compose');
        if (err instanceof AvatarGenerationError) {
          setError(err.message);
          setNeedsUpgrade(err.code === 'AVATAR_REQUIRES_PLAN');
        } else {
          setError('Avatar generation failed. Please try again.');
        }
      }
    }, [photo, styleKey, onGenerated, onClose]);

    return (
      <Sheet
        visible={visible && !picking}
        onDismiss={step === 'working' ? undefined : onClose}
        dismissOnBackdrop={step !== 'working'}
      >
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          {step === 'consent' && (
            <>
              <Body style={styles.title}>Make an avatar from a photo</Body>
              <Body style={styles.paragraph}>
                Take or choose a photo and we&apos;ll turn it into an illustrated avatar in the
                style you pick.
              </Body>
              <View style={styles.noticeBox}>
                <Caption style={styles.noticeLine}>
                  • Your photo is sent to our image provider to create the avatar.
                </Caption>
                <Caption style={styles.noticeLine}>
                  • We never store your photo. Only the finished avatar is saved.
                </Caption>
                <Caption style={styles.noticeLine}>
                  • Only you can see your saved avatar, and deleting your account deletes it.
                </Caption>
                <Caption style={styles.noticeLine}>
                  • Use a photo of yourself — not of anyone else.
                </Caption>
              </View>
              <Pressable
                style={styles.primaryButton}
                onPress={() => setStep('compose')}
                accessibilityRole="button"
                accessibilityLabel="Agree and continue"
              >
                <Body style={styles.primaryButtonText}>I agree — continue</Body>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={onClose} accessibilityRole="button">
                <Body style={styles.secondaryButtonText}>Not now</Body>
              </Pressable>
            </>
          )}

          {step === 'compose' && (
            <>
              {/* With a single style there is no choice to make, so the
                  heading and the lone card would be furniture. The picker
                  appears the moment a second style exists server-side. */}
              <Body style={styles.title}>
                {styleOptions.length > 1 ? 'Choose a style' : 'Make an avatar from a photo'}
              </Body>
              {styleOptions.length > 1 && styleOptions.map((option) => {
                const selected = option.key === styleKey;
                return (
                  <Pressable
                    key={option.key}
                    style={[styles.styleCard, selected && styles.styleCardSelected]}
                    onPress={() => setStyleKey(option.key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Style: ${option.label}`}
                  >
                    <Body style={styles.styleLabel}>{option.label}</Body>
                    <Caption style={styles.styleDescription}>{option.description}</Caption>
                  </Pressable>
                );
              })}

              <View style={styles.photoRow}>
                {photo ? (
                  <Image source={{ uri: photo.uri }} style={styles.preview} resizeMode="cover" />
                ) : (
                  <View style={[styles.preview, styles.previewEmpty]}>
                    <Ionicons name="person-outline" size={32} color={colors.text.quaternary} />
                  </View>
                )}
                <View style={styles.photoActions}>
                  <Pressable
                    style={styles.choiceButton}
                    onPress={() => choose('camera')}
                    accessibilityRole="button"
                    accessibilityLabel="Take a photo"
                  >
                    <Ionicons name="camera-outline" size={18} color={colors.text.primary} />
                    <Body style={styles.choiceButtonText}>Take photo</Body>
                  </Pressable>
                  <Pressable
                    style={styles.choiceButton}
                    onPress={() => choose('library')}
                    accessibilityRole="button"
                    accessibilityLabel="Choose a photo"
                  >
                    <Ionicons name="images-outline" size={18} color={colors.text.primary} />
                    <Body style={styles.choiceButtonText}>Choose photo</Body>
                  </Pressable>
                  <Pressable
                    style={styles.choiceButton}
                    onPress={() => choose('file')}
                    accessibilityRole="button"
                    accessibilityLabel="Upload a file"
                    accessibilityHint="Pick an image from Files, iCloud Drive, or another provider"
                  >
                    <Ionicons name="folder-outline" size={18} color={colors.text.primary} />
                    <Body style={styles.choiceButtonText}>Upload file</Body>
                  </Pressable>
                </View>
              </View>

              {error && (
                <View style={styles.errorBox}>
                  <Caption style={styles.errorText}>{error}</Caption>
                  {needsUpgrade && onUpgrade && (
                    <Pressable onPress={onUpgrade} accessibilityRole="button">
                      <Body style={styles.errorLink}>See plans</Body>
                    </Pressable>
                  )}
                </View>
              )}

              <Pressable
                style={[styles.primaryButton, !photo && styles.primaryButtonDisabled]}
                onPress={run}
                disabled={!photo}
                accessibilityRole="button"
                accessibilityLabel="Generate avatar"
                accessibilityState={{ disabled: !photo }}
              >
                <Body style={styles.primaryButtonText}>Generate avatar</Body>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={onClose} accessibilityRole="button">
                <Body style={styles.secondaryButtonText}>Cancel</Body>
              </Pressable>
            </>
          )}

          {step === 'working' && (
            <View style={styles.working}>
              <ActivityIndicator size="large" color={colors.action.accent} />
              <Body style={styles.workingText}>Drawing your avatar…</Body>
              <Caption style={styles.workingHint}>This usually takes under a minute.</Caption>
            </View>
          )}
        </ScrollView>
      </Sheet>
    );
  }
);

AvatarGeneratorSheet.displayName = 'AvatarGeneratorSheet';

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.sm },
  title: { fontSize: 20, fontWeight: '700', color: colors.text.primary, marginBottom: spacing.xxs },
  paragraph: { color: colors.text.secondary },
  noticeBox: {
    backgroundColor: colors.surface.cardAlt,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xxs,
    marginVertical: spacing.xs,
  },
  noticeLine: { color: colors.text.secondary },
  styleCard: {
    backgroundColor: colors.surface.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing.md,
  },
  styleCardSelected: { borderColor: colors.border.focus, backgroundColor: colors.action.primaryTint },
  styleLabel: { color: colors.text.primary, fontWeight: '600' },
  styleDescription: { color: colors.text.tertiary, marginTop: 2 },
  photoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginTop: spacing.xs },
  preview: { width: 96, height: 96, borderRadius: radii.xl },
  previewEmpty: {
    backgroundColor: colors.surface.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  photoActions: { flex: 1, gap: spacing.xs },
  choiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface.cardAlt,
    borderRadius: radii.lg,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  choiceButtonText: { color: colors.text.primary, fontWeight: '600' },
  errorBox: {
    backgroundColor: colors.error.tint,
    borderColor: colors.error.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.sm,
    gap: spacing.xxs,
  },
  errorText: { color: colors.error.light },
  errorLink: { color: colors.action.accent, fontWeight: '600' },
  primaryButton: {
    backgroundColor: colors.action.primaryFill,
    borderRadius: radii.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  primaryButtonDisabled: { opacity: 0.4 },
  primaryButtonText: { color: colors.text.onPrimary, fontWeight: '700' },
  secondaryButton: { alignItems: 'center', paddingVertical: spacing.sm, minHeight: 44, justifyContent: 'center' },
  secondaryButtonText: { color: colors.text.tertiary },
  working: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  workingText: { color: colors.text.primary, fontWeight: '600' },
  workingHint: { color: colors.text.tertiary },
});
