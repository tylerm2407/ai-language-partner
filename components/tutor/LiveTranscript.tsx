/**
 * The live transcript. Always on screen, never behind a toggle.
 *
 * Two reasons it is not optional, and either one alone would be enough:
 *
 *  1. It is the entire feature for a learner who is deaf or hard of hearing.
 *     A voice call with a hideable transcript is a voice call they cannot take.
 *  2. It is the best study aid here for everyone else. Hearing a word you half
 *     recognise and being able to look at it is the difference between the word
 *     landing and the word evaporating — and it is the reason people replay
 *     audio lessons at all.
 *
 * ── WHY NOT ChatBubble ──
 *
 * `components/chat/ChatBubble.tsx` looks like the obvious reuse and is the
 * wrong shape. It takes a `ConversationMessage` (id, timestamps, corrections,
 * gloss) and owns a pile of behaviour a live transcript must not have: it
 * fetches TTS and plays audio, calls `translateText` over the network, writes
 * corrections to Supabase, and mounts a report sheet. Playing audio from a row
 * DURING a live call would talk over the tutor, and a translate tap would bill
 * a model call per turn mid-conversation. Adapting it would mean threading a
 * "live" flag through 800 lines to switch most of it off.
 *
 * Since the Talk redesign (canvas "Talk · C variations", C1, 2026-09-08) the
 * turns are CAPTIONS, not bubbles: a small speaker label in the speaker's
 * colour (tutor violet, you green), then the words. The turn still being
 * spoken is in ink and heavy; finished turns fall back to the helper tone, so
 * the eye lands on what is being said now. Same grouping, same labels, same
 * autoscroll, same interrupted-turn note.
 *
 * ── AN INTERRUPTED TURN IS NOT A SHORT TURN ──
 *
 * `truncateCurrentTutorTurn` cuts a barged-in turn back to what was actually
 * audible. If that text then renders identically to a turn the tutor finished,
 * the transcript quietly asserts the tutor stopped there by choice — and a
 * learner reviewing it later reads a half sentence as the whole answer. So an
 * interrupted turn gets a dashed edge, an icon and the words "cut off". Icon
 * and text, not the border colour alone.
 */

import { useCallback, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { spacing } from '../../config/theme';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { Body, Caption } from '../ui2/Ui2Text';
import type {
  TranscriptRole,
  TranscriptState,
  TranscriptTurn,
  TurnStatus,
} from '../../lib/tutor-transcript';

export interface TranscriptGroup {
  role: TranscriptRole;
  /** Stable across re-renders: the id of the group's first turn. */
  key: string;
  turns: readonly TranscriptTurn[];
}

/**
 * Consecutive same-speaker turns, collapsed into one group.
 *
 * The speaker label is drawn once per group rather than once per turn. This is
 * not only tidier — the realtime layer emits a new turn id every time the
 * server segments an utterance, so a learner who says one long sentence with a
 * pause in it produces two turns. Labelling both "You" reads as two separate
 * remarks, which is a claim about the conversation that never happened.
 */
export function groupTurns(turns: readonly TranscriptTurn[]): TranscriptGroup[] {
  const groups: TranscriptGroup[] = [];
  for (const turn of turns) {
    const last = groups[groups.length - 1];
    if (last && last.role === turn.role) {
      last.turns = [...last.turns, turn];
    } else {
      groups.push({ role: turn.role, key: turn.id, turns: [turn] });
    }
  }
  return groups;
}

/** Who is talking. There is no tutor name in `TranscriptState` and this
 *  component is deliberately not given one — the name is already on the ring
 *  above, and repeating it on every group turns the transcript into a wall of
 *  the tutor's name. */
export function speakerLabel(role: TranscriptRole): string {
  return role === 'learner' ? 'You' : 'Tutor';
}

/**
 * The note under a turn, or `null` when the turn needs none.
 *
 * Only `interrupted` gets one. `streaming` deliberately does not: a caption
 * saying "still speaking" under text that is visibly growing is noise, and it
 * would flicker away a moment later.
 */
export function turnStatusNote(status: TurnStatus): string | null {
  return status === 'interrupted' ? 'Cut off — you started talking' : null;
}

/** VoiceOver reads one bubble as one sentence: who said it, what they said,
 *  and whether it was finished. Composed here so the same string is used for
 *  the label and can be tested without a renderer. */
export function turnAccessibilityLabel(turn: TranscriptTurn): string {
  const note = turnStatusNote(turn.status);
  const speaker = speakerLabel(turn.role);
  return note ? `${speaker}: ${turn.text}. ${note}` : `${speaker}: ${turn.text}`;
}

interface LiveTranscriptProps {
  transcript: TranscriptState;
}

export function LiveTranscript({ transcript }: LiveTranscriptProps) {
  const { c, type } = useUi2Theme();
  const scrollRef = useRef<ScrollView>(null);

  // Follow the conversation. `animated: false` because the content grows on
  // nearly every socket frame — an animated scroll would be permanently
  // mid-flight and would fight a learner trying to read back up the list.
  const onContentSizeChange = useCallback(() => {
    scrollRef.current?.scrollToEnd({ animated: false });
  }, []);

  const groups = groupTurns(transcript.turns);

  const speakerColor = (role: TranscriptRole) => (role === 'learner' ? c.green : c.primary);

  if (groups.length === 0) {
    return (
      <View style={styles.empty}>
        <Caption tone="tertiary" style={styles.emptyText}>
          What you both say will appear here as you talk.
        </Caption>
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      onContentSizeChange={onContentSizeChange}
      style={styles.scroll}
      contentContainerStyle={styles.content}
      // The transcript is a document, not a control surface: it must stay
      // readable and scrollable while the call runs.
      keyboardShouldPersistTaps="handled"
    >
      {groups.map((group) => {
        return (
          <View key={group.key} style={styles.group}>
            <Caption
              size="sm"
              style={{ color: speakerColor(group.role), fontFamily: type.uiHeavy, letterSpacing: 0.8 }}
            >
              {speakerLabel(group.role).toUpperCase()}
            </Caption>

            {group.turns.map((turn) => {
              const note = turnStatusNote(turn.status);
              const live = turn.status === 'streaming';
              return (
                <View
                  key={turn.id}
                  accessibilityRole="text"
                  accessibilityLabel={turnAccessibilityLabel(turn)}
                  style={styles.turn}
                >
                  <Body
                    size={live ? 'md' : 'sm'}
                    weight={live ? 'bold' : 'medium'}
                    tone={live ? 'primary' : 'secondary'}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  >
                    {turn.text}
                  </Body>

                  {note ? (
                    <View style={styles.note}>
                      <Ionicons name="cut-outline" size={12} color={c.muted} />
                      <Caption
                        size="sm"
                        tone="tertiary"
                        accessibilityElementsHidden
                        importantForAccessibility="no"
                      >
                        {note}
                      </Caption>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        );
      })}
    </ScrollView>
  );
}

/** DESIGN.md §Message bubbles: r18 with the speaker's own corner squared. */
const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  emptyText: {
    textAlign: 'center',
  },
  group: {
    gap: spacing.xxs,
  },
  turn: {
    gap: spacing.xxs,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
});
