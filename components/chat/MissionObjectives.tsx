/**
 * The mission checklist, pinned between the transcript and the composer.
 *
 * It lives INSIDE the chat screen's KeyboardAvoidingView so it sits above
 * all three composer branches — text, hold-to-talk, hands-free — and rises
 * with the keyboard instead of being covered by it. While the keyboard is up
 * it collapses to its 44pt header so the transcript keeps its room; a tap
 * reopens it.
 *
 * State is never colour alone: a met objective is a filled check AND green,
 * an open one an outline ring AND idle grey, and the header counts them in
 * words. A newly met objective buzzes once and is announced once — the ids
 * that already fired are remembered so a re-render cannot repeat either.
 */
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing } from '../../config/theme';
import { useMotion } from '../../hooks/useMotion';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { haptic } from '../../lib/haptics';
import type { MissionMeta } from '../../types/missions';
import { Body, Caption } from '../ui2/Ui2Text';

export interface MissionObjectivesProps {
  mission: MissionMeta;
  /** Objective ids the server has confirmed. */
  met: readonly string[];
  /** Ids that became met on the latest turn — what buzzes and is announced. */
  lastTicked: readonly string[];
}

/** "Mission 2 · 1 of 3 done". Exported so the count line can be asserted. */
export function objectivesHeaderLine(stage: number, metCount: number, total: number): string {
  return `Mission ${stage} · ${metCount} of ${total} done`;
}

export function MissionObjectives({ mission, met, lastTicked }: MissionObjectivesProps) {
  const { c } = useUi2Theme();
  const { durationOr0 } = useMotion();
  const [expanded, setExpanded] = useState(true);
  const rotation = useRef(new Animated.Value(1)).current;
  /** Ids already buzzed for this mission. Reset when the mission changes. */
  const firedRef = useRef<Set<string>>(new Set());
  const missionKeyRef = useRef<MissionMeta | null>(null);

  const total = mission.objectives.length;
  const metCount = mission.objectives.filter((o) => met.includes(o.id)).length;
  const lastId = lastTicked.length > 0 ? lastTicked[lastTicked.length - 1] : null;
  const lastText = lastId ? mission.objectives.find((o) => o.id === lastId)?.text ?? null : null;

  // Collapse while the keyboard is up; the learner can reopen with a tap.
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(showEvent, () => setExpanded(false));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    Animated.timing(rotation, {
      toValue: expanded ? 1 : 0,
      duration: durationOr0('short'),
      useNativeDriver: true,
    }).start();
  }, [expanded, rotation, durationOr0]);

  // One buzz and one announcement per newly met id, ever.
  useEffect(() => {
    if (missionKeyRef.current !== mission) {
      missionKeyRef.current = mission;
      firedRef.current = new Set();
    }
    for (const id of lastTicked) {
      if (firedRef.current.has(id)) continue;
      firedRef.current.add(id);
      haptic('correct');
      const text = mission.objectives.find((o) => o.id === id)?.text;
      // `accessibilityLiveRegion` is Android-only; this is the iOS path.
      if (text) AccessibilityInfo.announceForAccessibility(`Objective done: ${text}`);
    }
  }, [lastTicked, mission]);

  const chevronStyle = {
    transform: [
      {
        rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }),
      },
    ],
  };

  return (
    <View style={[styles.strip, { backgroundColor: c.surface2, borderTopColor: c.cardBorder }]}>
      <Pressable
        onPress={() => setExpanded((prev) => !prev)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`Mission ${mission.stage}, ${metCount} of ${total} objectives done`}
        accessibilityHint={expanded ? 'Hides the objectives' : 'Shows the objectives'}
        style={styles.header}
      >
        <Ionicons name="flag-outline" size={18} color={c.onTint} />
        <Body size="sm" weight="bold" style={styles.headerText} numberOfLines={1}>
          {objectivesHeaderLine(mission.stage, metCount, total)}
        </Body>
        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-down" size={18} color={c.idle} />
        </Animated.View>
      </Pressable>

      {expanded ? (
        <View style={styles.rows}>
          {mission.objectives.map((objective) => {
            const done = met.includes(objective.id);
            return (
              <View
                key={objective.id}
                style={styles.row}
                accessible
                accessibilityLabel={`${done ? 'Done' : 'Not done'}: ${objective.text}`}
              >
                <Ionicons
                  name={done ? 'checkmark-circle' : 'ellipse-outline'}
                  size={18}
                  color={done ? c.green : c.idle}
                />
                <Body size="sm" tone={done ? 'primary' : 'secondary'} style={styles.rowText} numberOfLines={2}>
                  {objective.text}
                </Body>
              </View>
            );
          })}
        </View>
      ) : null}

      {/* Zero-height, so it is read and never seen. */}
      <Caption
        accessibilityLiveRegion="polite"
        style={styles.liveRegion}
        accessibilityElementsHidden={lastText === null}
      >
        {lastText ? `Objective done: ${lastText}` : ''}
      </Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
  },
  header: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerText: { flex: 1 },
  rows: { paddingBottom: spacing.xs },
  row: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rowText: { flex: 1 },
  liveRegion: { height: 0, overflow: 'hidden' },
});
