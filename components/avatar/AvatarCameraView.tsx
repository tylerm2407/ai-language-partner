/**
 * In-app camera for the photo-to-avatar flow.
 *
 * Replaces the system camera hand-off (`ImagePicker.launchCameraAsync`), which
 * left the app entirely and came back through Apple's crop screen. Here the
 * viewfinder is rendered inside the avatar sheet: a square live preview with a
 * dimmed mask and a circular cutout that says "put your face here", then a
 * frozen review with Retake / Use photo.
 *
 * The crop is fixed to the circle's bounding square, computed from the
 * captured image dimensions by `coverCropRect` — no drag-to-adjust.
 *
 * Failure paths are surfaced as text, never swallowed: a denied permission
 * gets an Open Settings link, and a device with no usable camera (the iOS
 * Simulator, some emulators) gets a "choose a photo instead" exit so the flow
 * is never a dead end.
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  type LayoutChangeEvent,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { CameraView, type CameraType, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { Body, Caption } from '../ui/Text';
import { radii, spacing, ui2Dark, ui2Light, type Ui2Palette } from '../../config/theme';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import {
  AvatarGenerationError,
  coverCropRect,
  prepareCapturedPhoto,
  type PreparedPhoto,
} from '../../lib/avatar-generation';

interface AvatarCameraViewProps {
  /** Called with the cropped, downscaled photo when the learner taps Use photo. */
  onCaptured: (photo: PreparedPhoto) => void;
  /** Back to the compose step without a photo. */
  onCancel: () => void;
  /** The camera cannot be used here — offer the library instead. */
  onChoosePhotoInstead: () => void;
}

interface Shot {
  uri: string;
  width: number;
  height: number;
}

/** Diameter of the face guide as a fraction of the square viewfinder. */
const GUIDE_FRACTION = 0.78;

/** Alpha of the mask outside the guide. Dark enough to direct, light enough to frame. */
const MASK_COLOR = 'rgba(0, 0, 0, 0.55)';

export function AvatarCameraView({ onCaptured, onCancel, onChoosePhotoInstead }: AvatarCameraViewProps) {
  const { c, scheme } = useUi2Theme();
  const styles = STYLES[scheme];
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('front');
  const [viewSize, setViewSize] = useState(0);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shot, setShot] = useState<Shot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setViewSize(e.nativeEvent.layout.width);
  }, []);

  const capture = useCallback(async () => {
    const camera = cameraRef.current;
    if (!camera || !ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const picture = await camera.takePictureAsync({ quality: 1 });
      if (!picture?.uri) throw new Error('empty capture');
      setShot({ uri: picture.uri, width: picture.width, height: picture.height });
    } catch {
      // The Simulator and some devices have a preview but no capture pipeline.
      setUnavailable(true);
    } finally {
      setBusy(false);
    }
  }, [ready, busy]);

  const usePhoto = useCallback(async () => {
    if (!shot || busy) return;
    setBusy(true);
    setError(null);
    try {
      const rect = coverCropRect(
        { width: shot.width, height: shot.height },
        { width: viewSize, height: viewSize },
        viewSize * GUIDE_FRACTION,
      );
      onCaptured(await prepareCapturedPhoto(shot.uri, rect));
    } catch (err) {
      setError(
        err instanceof AvatarGenerationError ? err.message : 'Could not use that photo. Please retake it.',
      );
    } finally {
      setBusy(false);
    }
  }, [shot, busy, viewSize, onCaptured]);

  const retake = useCallback(() => {
    setShot(null);
    setError(null);
  }, []);

  const flip = useCallback(() => {
    setReady(false);
    setFacing((f) => (f === 'front' ? 'back' : 'front'));
  }, []);

  // Permission is resolved before the viewfinder mounts; `useCameraPermissions`
  // returns null until the native side has answered.
  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.stack}>
        <Body style={styles.title}>Take your photo</Body>
        <Body style={styles.paragraph}>
          Fluenci needs camera access to take your avatar photo.
          {permission.canAskAgain ? '' : ' You can enable it in Settings.'}
        </Body>
        {permission.canAskAgain ? (
          <Pressable style={styles.primaryButton} onPress={requestPermission} accessibilityRole="button">
            <Body style={styles.primaryButtonText}>Allow camera</Body>
          </Pressable>
        ) : (
          <Pressable
            style={styles.primaryButton}
            onPress={() => { Linking.openSettings().catch(() => {}); }}
            accessibilityRole="button"
          >
            <Body style={styles.primaryButtonText}>Open Settings</Body>
          </Pressable>
        )}
        <Pressable style={styles.secondaryButton} onPress={onChoosePhotoInstead} accessibilityRole="button">
          <Body style={styles.secondaryButtonText}>Choose a photo instead</Body>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onCancel} accessibilityRole="button">
          <Body style={styles.secondaryButtonText}>Back</Body>
        </Pressable>
      </View>
    );
  }

  if (unavailable) {
    return (
      <View style={styles.stack}>
        <Body style={styles.title}>Camera not available</Body>
        <Body style={styles.paragraph}>
          This device can&apos;t take a photo right now. You can still use a picture you already have.
        </Body>
        <Pressable style={styles.primaryButton} onPress={onChoosePhotoInstead} accessibilityRole="button">
          <Body style={styles.primaryButtonText}>Choose a photo</Body>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onCancel} accessibilityRole="button">
          <Body style={styles.secondaryButtonText}>Back</Body>
        </Pressable>
      </View>
    );
  }

  const guide = viewSize * GUIDE_FRACTION;
  // The mask is one View whose transparent interior is the circle: a huge
  // border draws the dim ring, and the square parent clips the ring's outer
  // edge. Pure RN, no SVG, no masked-view dependency.
  const ringWidth = viewSize;
  const maskSize = guide + ringWidth * 2;

  return (
    <View style={styles.stack}>
      <View style={styles.header}>
        <Pressable
          style={styles.iconButton}
          onPress={shot ? retake : onCancel}
          accessibilityRole="button"
          accessibilityLabel={shot ? 'Retake photo' : 'Back'}
        >
          <Ionicons name={shot ? 'arrow-back' : 'close'} size={22} color={c.ink} />
        </Pressable>
        <Body style={styles.headerTitle}>{shot ? 'Looking good?' : 'Take your photo'}</Body>
        <View style={styles.iconButton} />
      </View>

      <View style={styles.viewfinder} onLayout={onLayout}>
        {viewSize > 0 && (
          shot ? (
            <Image
              source={{ uri: shot.uri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              accessible
              accessibilityRole="image"
              accessibilityLabel="Your photo"
            />
          ) : (
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing={facing}
              mirror={facing === 'front'}
              animateShutter={false}
              onCameraReady={() => setReady(true)}
              onMountError={() => setUnavailable(true)}
            />
          )
        )}
        {viewSize > 0 && (
          <View pointerEvents="none" style={styles.maskClip} accessibilityElementsHidden>
            <View
              style={{
                width: maskSize,
                height: maskSize,
                borderRadius: maskSize / 2,
                borderWidth: ringWidth,
                borderColor: MASK_COLOR,
              }}
            />
          </View>
        )}
        {!shot && !ready && viewSize > 0 && (
          <View pointerEvents="none" style={styles.centeredOverlay}>
            <ActivityIndicator color={c.ink} />
          </View>
        )}
      </View>

      <Caption style={styles.hint}>
        {shot ? 'The circle is what becomes your avatar.' : 'Center your face in the circle.'}
      </Caption>

      {error && (
        <View style={styles.errorBox}>
          <Caption style={styles.errorText}>{error}</Caption>
        </View>
      )}

      {shot ? (
        <View style={styles.reviewRow}>
          <Pressable
            style={[styles.reviewButton, styles.reviewSecondary]}
            onPress={retake}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Retake photo"
          >
            <Body style={styles.reviewSecondaryText}>Retake</Body>
          </Pressable>
          <Pressable
            style={[styles.reviewButton, styles.reviewPrimary, busy && styles.disabled]}
            onPress={usePhoto}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Use this photo"
            accessibilityState={{ disabled: busy }}
          >
            {busy ? (
              <ActivityIndicator color={c.onPrimary} />
            ) : (
              <Body style={styles.reviewPrimaryText}>Use photo</Body>
            )}
          </Pressable>
        </View>
      ) : (
        <View style={styles.controls}>
          <Pressable
            style={styles.iconButton}
            onPress={onChoosePhotoInstead}
            accessibilityRole="button"
            accessibilityLabel="Choose a photo instead"
          >
            <Ionicons name="images-outline" size={24} color={c.ink} />
          </Pressable>
          <Pressable
            style={[styles.shutter, (!ready || busy) && styles.disabled]}
            onPress={capture}
            disabled={!ready || busy}
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            accessibilityState={{ disabled: !ready || busy }}
          >
            <View style={styles.shutterInner} />
          </Pressable>
          <Pressable
            style={styles.iconButton}
            onPress={flip}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={facing === 'front' ? 'Switch to back camera' : 'Switch to front camera'}
          >
            <Ionicons name="camera-reverse-outline" size={26} color={c.ink} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const SHUTTER_SIZE = 72;

/** Built once per scheme at module load — same reasoning as AvatarGeneratorSheet. */
const makeStyles = (c: Ui2Palette) => StyleSheet.create({
  stack: { gap: spacing.sm },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl },
  title: { fontSize: 20, fontWeight: '700', color: c.ink, marginBottom: spacing.xxs },
  paragraph: { color: c.muted },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: c.ink, fontWeight: '700', fontSize: 17 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewfinder: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: c.surface2,
  },
  maskClip: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  centeredOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { color: c.muted, textAlign: 'center' },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  shutter: {
    width: SHUTTER_SIZE,
    height: SHUTTER_SIZE,
    borderRadius: SHUTTER_SIZE / 2,
    borderWidth: 4,
    borderColor: c.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: SHUTTER_SIZE - 16,
    height: SHUTTER_SIZE - 16,
    borderRadius: (SHUTTER_SIZE - 16) / 2,
    backgroundColor: c.primary,
  },
  disabled: { opacity: 0.4 },
  reviewRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  reviewButton: {
    flex: 1,
    borderRadius: radii.lg,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewPrimary: { backgroundColor: c.primary },
  reviewPrimaryText: { color: c.onPrimary, fontWeight: '700' },
  reviewSecondary: { backgroundColor: c.surface2 },
  reviewSecondaryText: { color: c.ink, fontWeight: '600' },
  errorBox: {
    backgroundColor: c.card,
    borderColor: c.error,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.sm,
  },
  errorText: { color: c.error },
  primaryButton: {
    backgroundColor: c.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  primaryButtonText: { color: c.onPrimary, fontWeight: '700' },
  secondaryButton: { alignItems: 'center', paddingVertical: spacing.sm, minHeight: 44, justifyContent: 'center' },
  secondaryButtonText: { color: c.idle },
});

const STYLES = { light: makeStyles(ui2Light), dark: makeStyles(ui2Dark) };
