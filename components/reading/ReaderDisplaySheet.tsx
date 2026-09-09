/**
 * ReaderDisplaySheet — the "Aa" sheet: text size, line spacing, face, and
 * Night reading. One sheet for books and passages, because it reads and
 * writes `lib/reading-preferences` directly rather than taking values as
 * props, so the two readers cannot drift apart.
 *
 * It renders INSIDE the reader's `ReaderThemeScope`, and `Ui2Sheet` is a
 * Modal, so flipping Night reading here re-skins the page and this sheet in
 * the same frame. That is the best feedback the switch can give and it costs
 * nothing: context crosses the Modal.
 *
 * Every control is a real control to a screen reader — the size row is
 * `adjustable`, the spacing and face groups are radio groups, Night reading is
 * a switch — because the sheet is otherwise a row of unlabeled pills.
 */
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Ui2Sheet } from '../ui2/Ui2Sheet';
import { Body, Caption, Heading } from '../ui2/Ui2Text';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { useReadingPreferences } from '../../hooks/useReadingPreferences';
import {
  READER_BRIGHTNESS_STEPS,
  READER_FONT_SIZES,
  type ReaderBrightness,
  type ReaderFont,
  type ReaderFontSizeIndex,
  type ReaderLineSpacing,
} from '../../lib/reading-preferences';
import { ui2ReaderType, spacing } from '../../config/theme';
import { haptic } from '../../lib/haptics';
import { trackEvent } from '../../lib/analytics';
import { isReaderBrightnessAvailable } from '../../lib/reader-brightness';

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

const PREVIEW = 'The quick brown fox jumps over the lazy dog.';
const MAX_INDEX = (READER_FONT_SIZES.length - 1) as ReaderFontSizeIndex;

const SPACING_OPTIONS: { value: ReaderLineSpacing; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'normal', label: 'Normal' },
  { value: 'relaxed', label: 'Relaxed' },
];

const FONT_OPTIONS: { value: ReaderFont; label: string }[] = [
  { value: 'sans', label: 'Sans' },
  { value: 'serif', label: 'Serif' },
];

export function ReaderDisplaySheet({ visible, onDismiss }: Props) {
  const { c, shape, type } = useUi2Theme();
  const { prefs, update, fontSize, lineHeightMultiplier, fontFamily } = useReadingPreferences();

  const setSize = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(MAX_INDEX, next)) as ReaderFontSizeIndex;
      if (clamped === prefs.fontSizeIndex) return;
      haptic('select');
      void update({ fontSizeIndex: clamped });
      trackEvent('reading_display_changed', { source: 'size', count: clamped });
    },
    [prefs.fontSizeIndex, update],
  );

  const setSpacing = useCallback(
    (value: ReaderLineSpacing) => {
      if (value === prefs.lineSpacing) return;
      haptic('select');
      void update({ lineSpacing: value });
      trackEvent('reading_display_changed', { source: 'spacing', count: SPACING_OPTIONS.findIndex((o) => o.value === value) });
    },
    [prefs.lineSpacing, update],
  );

  const setFont = useCallback(
    (value: ReaderFont) => {
      if (value === prefs.font) return;
      haptic('select');
      void update({ font: value });
      trackEvent('reading_display_changed', { source: 'font', count: value === 'serif' ? 1 : 0 });
    },
    [prefs.font, update],
  );

  const setBrightness = useCallback(
    (value: ReaderBrightness) => {
      if (value === prefs.brightness) return;
      haptic('select');
      void update({ brightness: value });
      trackEvent('reading_display_changed', {
        source: 'brightness',
        count: value === null ? -1 : READER_BRIGHTNESS_STEPS.indexOf(value),
      });
    },
    [prefs.brightness, update],
  );

  const toggleNight = useCallback(() => {
    const next = !prefs.nightReading;
    haptic('select');
    void update({ nightReading: next });
    trackEvent('reading_display_changed', { source: 'night', ok: next });
  }, [prefs.nightReading, update]);

  const atMin = prefs.fontSizeIndex === 0;
  const atMax = prefs.fontSizeIndex === MAX_INDEX;

  return (
    <Ui2Sheet visible={visible} onDismiss={onDismiss}>
      <Heading level={3} accessibilityRole="header">Display</Heading>

      {/* Live preview: the effect of every control, without closing the sheet. */}
      <View style={[styles.preview, { backgroundColor: c.surface2, borderRadius: shape.radiusCard }]}>
        <Text
          style={{ fontFamily, fontSize, lineHeight: fontSize * lineHeightMultiplier, color: c.ink }}
          numberOfLines={2}
        >
          {PREVIEW}
        </Text>
      </View>

      {/* Text size */}
      <View
        style={styles.row}
        accessibilityRole="adjustable"
        accessibilityLabel="Text size"
        accessibilityValue={{ min: 0, max: MAX_INDEX, now: prefs.fontSizeIndex, text: `${fontSize} point` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'increment') setSize(prefs.fontSizeIndex + 1);
          if (e.nativeEvent.actionName === 'decrement') setSize(prefs.fontSizeIndex - 1);
        }}
      >
        <Body size="sm" weight="semibold" tone="secondary" style={styles.rowLabel}>Text size</Body>
        <View style={styles.stepper}>
          <StepButton icon="remove" label="Smaller text" disabled={atMin} onPress={() => setSize(prefs.fontSizeIndex - 1)} />
          <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {READER_FONT_SIZES.map((size, i) => (
              <View
                key={size}
                style={{
                  width: 6 + i * 2,
                  height: 6 + i * 2,
                  borderRadius: 999,
                  backgroundColor: i <= prefs.fontSizeIndex ? c.primary : c.track,
                }}
              />
            ))}
          </View>
          <StepButton icon="add" label="Larger text" disabled={atMax} onPress={() => setSize(prefs.fontSizeIndex + 1)} />
        </View>
      </View>

      {/* Line spacing */}
      <View style={styles.row}>
        <Body size="sm" weight="semibold" tone="secondary" style={styles.rowLabel}>Line spacing</Body>
        <View
          style={[styles.segments, { backgroundColor: c.surface2, borderRadius: shape.radiusButton }]}
          accessibilityRole="radiogroup"
          accessibilityLabel="Line spacing"
        >
          {SPACING_OPTIONS.map((o) => {
            const selected = o.value === prefs.lineSpacing;
            return (
              <Pressable
                key={o.value}
                onPress={() => setSpacing(o.value)}
                accessibilityRole="radio"
                accessibilityLabel={o.label}
                accessibilityState={{ checked: selected }}
                style={[styles.segment, { backgroundColor: selected ? c.primary : 'transparent', borderRadius: shape.radiusButton }]}
              >
                <Text style={{ fontFamily: type.uiBold, fontSize: 14, color: selected ? c.onPrimary : c.muted }}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Font */}
      <View style={styles.row}>
        <Body size="sm" weight="semibold" tone="secondary" style={styles.rowLabel}>Font</Body>
        <View
          style={[styles.segments, { backgroundColor: c.surface2, borderRadius: shape.radiusButton }]}
          accessibilityRole="radiogroup"
          accessibilityLabel="Font"
        >
          {FONT_OPTIONS.map((o) => {
            const selected = o.value === prefs.font;
            const fg = selected ? c.onPrimary : c.muted;
            return (
              <Pressable
                key={o.value}
                onPress={() => setFont(o.value)}
                accessibilityRole="radio"
                accessibilityLabel={`${o.label} font`}
                accessibilityState={{ checked: selected }}
                style={[styles.segment, styles.fontSegment, { backgroundColor: selected ? c.primary : 'transparent', borderRadius: shape.radiusButton }]}
              >
                {/* The sample is set in its own face so the choice is visible
                    before it is made. No fontWeight beside a named family. */}
                <Text style={{ fontFamily: ui2ReaderType[o.value], fontSize: 20, color: fg }}>Aa</Text>
                <Text style={{ fontFamily: type.ui, fontSize: 11, color: fg, marginTop: 2 }}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Brightness — five steps plus "Auto", which hands the phone its own
          setting back. Steps rather than a slider: no slider dependency, and
          each step is a 44pt radio a screen reader can name. */}
      {isReaderBrightnessAvailable() && (
      <View style={styles.row}>
        <Body size="sm" weight="semibold" tone="secondary" style={styles.rowLabel}>Brightness</Body>
        <View
          style={[styles.segments, { backgroundColor: c.surface2, borderRadius: shape.radiusButton }]}
          accessibilityRole="radiogroup"
          accessibilityLabel="Brightness"
        >
          {[null, ...READER_BRIGHTNESS_STEPS].map((step, i) => {
            const selected = step === prefs.brightness;
            const fg = selected ? c.onPrimary : c.muted;
            const label = step === null ? 'Auto' : `${Math.round(step * 100)} percent`;
            return (
              <Pressable
                key={label}
                onPress={() => setBrightness(step)}
                accessibilityRole="radio"
                accessibilityLabel={step === null ? 'Automatic brightness' : `Brightness ${label}`}
                accessibilityState={{ checked: selected }}
                style={[styles.segment, { backgroundColor: selected ? c.primary : 'transparent', borderRadius: shape.radiusButton }]}
              >
                {step === null ? (
                  <Text style={{ fontFamily: type.uiBold, fontSize: 13, color: fg }}>Auto</Text>
                ) : (
                  <Ionicons name={i <= 2 ? 'sunny-outline' : 'sunny'} size={12 + i * 2} color={fg} />
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
      )}

      {/* Night reading — the Settings checked-row pattern (Motion, Vibration). */}
      <Pressable
        onPress={toggleNight}
        accessibilityRole="switch"
        accessibilityState={{ checked: prefs.nightReading }}
        accessibilityLabel="Night reading"
        accessibilityHint="Amber text on a black page for reading in the dark"
        style={[
          styles.switchRow,
          {
            backgroundColor: prefs.nightReading ? c.primaryTint : c.card,
            borderRadius: shape.radiusCard,
          },
        ]}
      >
        <Ionicons
          name={prefs.nightReading ? 'checkmark-circle' : 'moon-outline'}
          size={24}
          color={prefs.nightReading ? c.onTint : c.idle}
        />
        <View style={styles.switchCopy}>
          <Body weight="semibold">Night reading</Body>
          <Caption tone="secondary" style={{ marginTop: 2 }}>
            Amber text on a black page. Removes blue light on OLED screens and cuts it sharply on others.
          </Caption>
        </View>
      </Pressable>
    </Ui2Sheet>
  );
}

interface StepButtonProps {
  icon: 'add' | 'remove';
  label: string;
  disabled: boolean;
  onPress: () => void;
}

function StepButton({ icon, label, disabled, onPress }: StepButtonProps) {
  const { c, shape } = useUi2Theme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={[
        styles.step,
        { backgroundColor: c.primaryTint, borderRadius: shape.radiusButton, opacity: disabled ? 0.4 : 1 },
      ]}
    >
      <Ionicons name={icon} size={22} color={c.onTint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  preview: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 64,
    justifyContent: 'center',
  },
  row: { marginBottom: spacing.md },
  rowLabel: { marginBottom: spacing.xs },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // 44pt targets (Apple HIG).
  step: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dots: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  segments: { flexDirection: 'row', padding: spacing.xxs },
  segment: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs },
  fontSegment: { minHeight: 56 },
  switchRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, minHeight: 56 },
  switchCopy: { flex: 1, marginLeft: spacing.sm },
});
