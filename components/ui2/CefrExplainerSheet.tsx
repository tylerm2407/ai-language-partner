/**
 * CefrExplainerSheet — what a CEFR level is, for a learner who has never
 * heard of one.
 *
 * WHY A SHEET AND NOT A SCREEN. The acronym is defined once, in one sentence,
 * on the onboarding level step, and then shows up every day on Home as "B1 ·
 * 42% to B2". The question "what does B1 mean?" is asked where the badge is,
 * weeks after onboarding, so the answer opens from the badge. A settings page
 * would be found once and never again.
 *
 * WHAT IT SHOWS. One paragraph on the scale, the six-rung ladder using the
 * same can-do lines every badge already uses (`lib/cefr-labels.ts`), the
 * learner's rung marked, the report's honesty line, and — where the caller
 * allows — a route to the Proficiency Report. Language-neutral throughout, for
 * the reason the labels file gives.
 *
 * Canvas: "CEFR Level Explainer" (2026-09-13), light and dark boards.
 */
import { useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { CEFR_LADDER, normalizeBand, type CefrBand } from '../../lib/cefr-proficiency';
import { CEFR_BAND_NAMES, CEFR_CAN_DO } from '../../lib/cefr-labels';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { Chip, type ChipVariant } from './Chip';
import { SlabButton } from './SlabButton';
import { Ui2Sheet } from './Ui2Sheet';

export interface CefrLadderRow {
  band: CefrBand;
  name: string;
  canDo: string;
  /** True on the learner's own rung; false everywhere when the band is unknown. */
  current: boolean;
  /** Chip colour: green climbing to amber to pink, two rungs per tint. */
  variant: ChipVariant;
}

/**
 * Pure so the ladder can be asserted without a render harness. An unknown or
 * garbled band marks nothing rather than guessing a rung.
 */
export function cefrLadderRows(band: string | null | undefined): CefrLadderRow[] {
  const current = normalizeBand(band);
  return CEFR_LADDER.map((b) => ({
    band: b,
    name: CEFR_BAND_NAMES[b],
    canDo: CEFR_CAN_DO[b],
    current: b === current,
    variant: cefrChipVariant(b),
  }));
}

export function cefrChipVariant(band: CefrBand): ChipVariant {
  switch (band) {
    case 'A1':
    case 'A2':
      return 'success';
    case 'B1':
    case 'B2':
      return 'warning';
    default:
      return 'error';
  }
}

interface CefrExplainerSheetProps {
  visible: boolean;
  onDismiss: () => void;
  /** The learner's band, marked on the ladder. Null or unrecognised marks none. */
  band: string | null | undefined;
  /** Opens the Proficiency Report. Omit on the report itself and pre-sign-in. */
  onSeeReport?: () => void;
}

const SHEET_HEIGHT = Math.min(720, Math.round(Dimensions.get('window').height * 0.9));

export function CefrExplainerSheet({ visible, onDismiss, band, onSeeReport }: CefrExplainerSheetProps) {
  const { c, type, shape } = useUi2Theme();
  const rows = cefrLadderRows(band);

  return (
    <Ui2Sheet visible={visible} onDismiss={onDismiss} height={SHEET_HEIGHT}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text
            style={{ fontFamily: type.heading, fontSize: 22, lineHeight: 28, color: c.ink, flex: 1 }}
            accessibilityRole="header"
          >
            What is a CEFR level?
          </Text>
          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={8}
            style={[styles.close, { backgroundColor: c.surface2 }]}
          >
            <Ionicons name="close" size={18} color={c.muted} />
          </Pressable>
        </View>
        <Text style={{ fontFamily: type.ui, fontSize: 14, lineHeight: 20, color: c.muted }}>
          The Common European Framework of Reference is a six-step scale, A1 to C2, that schools
          and employers use to describe what you can do in a language. Fluenci measures you on it,
          so your level means the same thing outside the app.
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.ladder} showsVerticalScrollIndicator={false}>
        {rows.map((row) => (
          <View
            key={row.band}
            style={[styles.row, row.current && { backgroundColor: c.primaryTint }]}
            accessible
            accessibilityLabel={`${row.band}, ${row.name}${row.current ? ', your level' : ''}. ${row.canDo}.`}
          >
            <Chip label={row.band} variant={row.variant} style={styles.chip} />
            <View style={styles.rowText}>
              <View style={styles.nameRow}>
                <Text style={{ fontFamily: type.uiBold, fontSize: 14, lineHeight: 18, color: c.ink }}>{row.name}</Text>
                {row.current ? (
                  <View style={[styles.you, { backgroundColor: c.primary, borderRadius: shape.radiusButton }]}>
                    <Text style={{ fontFamily: type.uiHeavy, fontSize: 10, letterSpacing: 0.6, color: c.onPrimary }}>
                      YOU
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={{ fontFamily: type.ui, fontSize: 12, lineHeight: 16, color: c.muted }}>{row.canDo}</Text>
            </View>
          </View>
        ))}

        {/* Honesty line. Same claim the Proficiency Report makes; do not soften. */}
        <View style={[styles.note, { backgroundColor: c.surface2 }]}>
          <Ionicons name="information-circle-outline" size={18} color={c.idle} style={{ marginTop: 1 }} />
          <Text style={{ fontFamily: type.ui, fontSize: 12, lineHeight: 16, color: c.idle, flex: 1 }}>
            Your level is an estimate from what you have practised in Fluenci. It is not an official
            CEFR certificate.
          </Text>
        </View>
      </ScrollView>

      {onSeeReport ? (
        <SlabButton
          label="See how your level is measured"
          onPress={() => {
            onDismiss();
            onSeeReport();
          }}
          style={styles.cta}
        />
      ) : null}
    </Ui2Sheet>
  );
}

/**
 * Local open/closed state plus the props the sheet needs, so a call site is
 * one hook and one element rather than a useState it has to name.
 */
export function useCefrExplainer(): { visible: boolean; open: () => void; close: () => void } {
  const [visible, setVisible] = useState(false);
  return { visible, open: () => setVisible(true), close: () => setVisible(false) };
}

const styles = StyleSheet.create({
  header: { gap: 8, marginBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 36 },
  close: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1, marginHorizontal: -14 },
  ladder: { gap: 2, paddingBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, minHeight: 56 },
  chip: { width: 44, height: 36, borderRadius: 12, justifyContent: 'center' },
  rowText: { flex: 1, gap: 2, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  you: { paddingHorizontal: 8, paddingVertical: 3 },
  note: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 16, marginHorizontal: 14, marginTop: 12 },
  cta: { marginTop: 12 },
});
