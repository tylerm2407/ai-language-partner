/**
 * ScenarioPicker — what the Situations tab shows before a conversation.
 *
 * "Situations", not "AI Chat" (Tyler, 2026-09-08): the old title named the
 * technology rather than what the learner gets, and could put people off. The
 * AI is still disclosed — the consent sheet, and the subtitle's "your tutor".
 *
 * Direction G1 "Gallery" from the canvas page "AI Chat · picker" (Tyler,
 * 2026-09-08): a two-column grid of scene tiles, Free Chat last and full
 * width, and a sheet for the tapped scene with its description, the language
 * and level, whether a saved conversation will resume, and ONE button —
 * Continue.
 *
 * ── WHY ONE BUTTON WHERE THERE WERE TWO ──
 *
 * The old cards offered "Text Chat" and "Live Voice". Live Voice was only a
 * shortcut that started the same chat with hands-free already switched on;
 * every mode is reachable inside the chat anyway — the composer's mic for a
 * spoken turn, the spoken-replies toggle, the hands-free toggle. So Continue
 * opens the chat as text with the mic ready and takes nothing away. The
 * real-time voice call is the Talk tab and is a different product (a live
 * speech-to-speech session with a persona); this tab is the corrected,
 * turn-by-turn chat that works without speaking at all.
 *
 * Every scene keeps its description: it moved from the card to the sheet, one
 * tap away, instead of being printed nine times on the screen.
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { spacing } from '../../config/theme';
import { SlabButton } from '../ui2/SlabButton';
import { Ui2Sheet } from '../ui2/Ui2Sheet';
import { Body, Caption, Heading, Hero } from '../ui2/Ui2Text';
import type { Ui2Palette } from '../../config/theme';

export interface PickerScenario {
  /** Built-in key, or null for a teacher-authored scene. */
  key: string | null;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface ScenarioPickerProps {
  scenarios: PickerScenario[];
  /** "Spanish". */
  languageName: string;
  /** The learner's CEFR line, never a bare code — see lib/cefr-labels.ts. */
  levelLine: string;
  /** Scenario keys (or labels for keyless scenes) with a saved conversation. */
  resumable: ReadonlySet<string>;
  onStart: (scenario: PickerScenario) => void;
}

/** One of four tints, rotated so a wall of tiles is not one colour. Pure so it can be asserted. */
export function tileTone(index: number, c: Ui2Palette): { bg: string; fg: string } {
  const tones = [
    { bg: c.primaryTint, fg: c.primary },
    { bg: c.greenTint, fg: c.green },
    { bg: c.yellowTint, fg: c.yellow },
    { bg: c.pinkTint, fg: c.pink },
  ];
  return tones[index % tones.length];
}

/** The identity a saved conversation is keyed on: the built-in key, or the label for a custom scene. */
export function scenarioIdentity(scenario: Pick<PickerScenario, 'key' | 'label'>): string {
  return scenario.key ?? scenario.label;
}

/** Copy for the sheet's resume line. Pure so both branches are asserted. */
export function resumeHint(hasHistory: boolean): string {
  return hasHistory ? 'Picks up where you left off.' : 'A new conversation.';
}

export function ScenarioPicker({ scenarios, languageName, levelLine, resumable, onStart }: ScenarioPickerProps) {
  const { c, shape } = useUi2Theme();
  const [open, setOpen] = useState<PickerScenario | null>(null);

  const openTone = open ? tileTone(scenarios.indexOf(open), c) : null;
  const hasHistory = open ? resumable.has(scenarioIdentity(open)) : false;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Hero accessibilityRole="header">Situations</Hero>
        <Body tone="secondary" style={styles.subtitle}>
          Pick a scene to practise in {languageName}. Type or speak, your call.
        </Body>

        <View style={styles.grid}>
          {scenarios.map((scenario, index) => {
            const tone = tileTone(index, c);
            const wide = scenario.key === 'free_chat';
            return (
              <Pressable
                key={scenarioIdentity(scenario)}
                onPress={() => setOpen(scenario)}
                accessibilityRole="button"
                accessibilityLabel={scenario.label}
                accessibilityHint="Shows what this scene practises and lets you start it."
                style={[
                  styles.tile,
                  wide ? styles.tileWide : styles.tileHalf,
                  { backgroundColor: c.card, borderRadius: shape.radiusCard },
                ]}
              >
                <View style={[styles.iconWell, { backgroundColor: tone.bg }]}>
                  <Ionicons name={scenario.icon} size={22} color={tone.fg} />
                </View>
                <Body weight="extrabold" style={styles.tileLabel} numberOfLines={2}>
                  {scenario.label}
                </Body>
                {wide ? (
                  <Caption tone="tertiary" numberOfLines={1}>
                    Any topic
                  </Caption>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <Ui2Sheet visible={open !== null} onDismiss={() => setOpen(null)}>
        {open && openTone ? (
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <View style={[styles.iconWellLarge, { backgroundColor: openTone.bg }]}>
                <Ionicons name={open.icon} size={24} color={openTone.fg} />
              </View>
              <View style={styles.sheetTitle}>
                <Heading level={3} accessibilityRole="header">
                  {open.label}
                </Heading>
                <Caption tone="tertiary">
                  {languageName} · {levelLine}
                </Caption>
              </View>
            </View>

            <Body tone="secondary">{open.description}</Body>

            <Caption tone="tertiary" accessibilityLiveRegion="polite">
              {resumeHint(hasHistory)}
            </Caption>

            <SlabButton
              label="Continue"
              onPress={() => {
                const picked = open;
                setOpen(null);
                onStart(picked);
              }}
              accessibilityHint="Opens the chat. You can type, or tap the microphone to speak."
            />
          </View>
        ) : null}
      </Ui2Sheet>
    </View>
  );
}

const TILE_GAP = spacing.xs + 2;

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: 120,
    gap: spacing.sm,
  },
  subtitle: {
    marginBottom: spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: TILE_GAP,
  },
  tile: {
    padding: spacing.md,
    gap: spacing.sm,
    minHeight: 128,
    justifyContent: 'flex-start',
  },
  tileHalf: {
    // Two per row: half the width less half the gap.
    flexBasis: '48%',
    flexGrow: 1,
  },
  tileWide: {
    flexBasis: '100%',
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWell: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWellLarge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    flexShrink: 1,
  },
  sheet: {
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sheetTitle: {
    flex: 1,
    gap: 2,
  },
});
