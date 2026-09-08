/**
 * Mute, type, hang up.
 *
 * ── END IS LAST AND ON ITS OWN ──
 *
 * Ending the call is the one action here that cannot be undone: the session is
 * closed, the minutes are spent, and the learner is back on the lobby. It goes
 * last in reading order and on its own line under the round controls, exactly
 * as `app/(app)/practice/handsfree.tsx` does, so a thumb reaching for mute in
 * the middle of a sentence cannot land on it. That screen's comment is the
 * reason, verbatim: "End is separated below a divider so it is not hit by
 * accident with a thumb aiming for Pause." Tint blocks draws no rules, so the
 * separation is space rather than a hairline; the order is unchanged.
 *
 * It is not styled as a big red button either. `error` text on the plain
 * background is the app's existing destructive-action treatment and it does not
 * compete for the eye with the control the learner actually wants — and it is
 * deliberately NOT a SlabButton, which would make hanging up the loudest thing
 * on the screen.
 *
 * ── THE COMPOSER IS AN ACCESSIBILITY PATH, NOT A CONVENIENCE ──
 *
 * Typing a turn is how the call works for someone who is mute, in a quiet
 * carriage, in a shared office, or simply too self-conscious to speak a
 * sentence out loud on their first attempt — which is a real and common state
 * for a beginner in a new language. A speech-only call excludes all of them.
 * It also rescues the case where the microphone genuinely will not work: the
 * conversation continues instead of ending.
 *
 * Since the Talk redesign (canvas "Talk · C variations", C1, 2026-09-08) the
 * composer opens from a round "Type" control beside Mute, so the resting
 * screen is two buttons and the sound picture. Opening it is one tap, it
 * autofocuses, and it stays open until the learner closes it — the path is
 * one step longer, not narrower. Send still refuses an empty turn.
 *
 * Every control carries both a label and a hint. An icon-only button with no
 * label is silent to VoiceOver, and this screen is used with the phone at ear
 * height, where the learner may not be looking at it at all.
 */
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { radii, spacing } from '../../config/theme';
import { Body, Caption } from '../ui2/Ui2Text';

/**
 * What actually gets sent for a given composer value, or `null` if nothing
 * should be.
 *
 * Whitespace is collapsed rather than merely trimmed: the text goes to a model
 * as a conversational turn, and a stray run of spaces or a pasted newline is
 * tokens spent on nothing. Returning `null` for an empty value is what stops a
 * stray tap on Send producing an empty turn — which the tutor would answer, at
 * cost, having been told the learner said "".
 */
export function composerSubmission(raw: string): string | null {
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  return collapsed === '' ? null : collapsed;
}

/** HIG minimum, and the floor for every control on this screen. */
const TOUCH_MIN = 44;
/** The two round controls; mute is the one a learner hits without looking. */
const ROUND = 56;

interface CallControlsProps {
  muted: boolean;
  onToggleMute: () => void;
  onEnd: () => void;
  onSendText: (text: string) => void;
}

export function CallControls({ muted, onToggleMute, onEnd, onSendText }: CallControlsProps) {
  const { c, type, shape } = useUi2Theme();
  const [draft, setDraft] = useState('');
  const [composing, setComposing] = useState(false);
  const submission = composerSubmission(draft);

  const send = useCallback(() => {
    const text = composerSubmission(draft);
    if (text === null) return;
    onSendText(text);
    setDraft('');
  }, [draft, onSendText]);

  return (
    <View style={styles.root}>
      {composing ? (
        <View style={[styles.composer, { backgroundColor: c.card, borderRadius: shape.radiusCard }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={send}
            placeholder="Type instead of speaking"
            placeholderTextColor={c.idle}
            returnKeyType="send"
            blurOnSubmit={false}
            autoFocus
            accessibilityLabel="Type your turn"
            accessibilityHint="Sends what you type to your tutor, instead of speaking it."
            style={[styles.input, { color: c.ink, fontFamily: type.ui }]}
            maxFontSizeMultiplier={1.4}
          />
          <Pressable
            onPress={send}
            disabled={submission === null}
            accessibilityRole="button"
            accessibilityLabel="Send"
            accessibilityHint="Sends your typed turn to your tutor."
            accessibilityState={{ disabled: submission === null }}
            style={[styles.send, { backgroundColor: submission === null ? c.surface2 : c.primary }]}
          >
            <Ionicons name="arrow-up" size={20} color={submission === null ? c.idle : c.onPrimary} />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.row}>
        <View style={styles.control}>
          <Pressable
            onPress={onToggleMute}
            accessibilityRole="button"
            accessibilityLabel={muted ? 'Unmute your microphone' : 'Mute your microphone'}
            accessibilityHint={
              muted
                ? 'Your tutor cannot hear you. Turns it back on.'
                : 'Stops your tutor hearing you. The call keeps running.'
            }
            accessibilityState={{ selected: muted }}
            style={[styles.round, { backgroundColor: muted ? c.pinkTint : c.card }]}
          >
            {/* The tint behind the glyph changes AND the glyph is struck
                through: muted is never carried by colour alone. */}
            <Ionicons name={muted ? 'mic-off' : 'mic'} size={24} color={muted ? c.error : c.ink} />
          </Pressable>
          <Caption tone="tertiary">{muted ? 'Muted' : 'Mute'}</Caption>
        </View>

        <View style={styles.control}>
          <Pressable
            onPress={() => setComposing((open) => !open)}
            accessibilityRole="button"
            accessibilityLabel={composing ? 'Close the keyboard' : 'Type instead of speaking'}
            accessibilityHint={
              composing
                ? 'Puts the keyboard away. Anything you typed stays.'
                : 'Opens a text box so you can type to your tutor instead of speaking.'
            }
            accessibilityState={{ selected: composing }}
            style={[styles.round, { backgroundColor: composing ? c.primaryTint : c.card }]}
          >
            <Ionicons
              name={composing ? 'chevron-down' : 'chatbox-ellipses-outline'}
              size={24}
              color={composing ? c.onTint : c.ink}
            />
          </Pressable>
          <Caption tone="tertiary">Type</Caption>
        </View>
      </View>

      <Pressable
        onPress={onEnd}
        accessibilityRole="button"
        accessibilityLabel="End call"
        accessibilityHint="Hangs up and takes you to a summary of the conversation."
        style={styles.end}
      >
        <Body weight="bold" tone="error">
          End call
        </Body>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
  },
  control: {
    alignItems: 'center',
    gap: spacing.xxs,
  },
  round: {
    width: ROUND,
    height: ROUND,
    borderRadius: ROUND / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composer: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.sm,
    paddingRight: spacing.xxs,
    paddingVertical: spacing.xxs,
    minHeight: ROUND,
  },
  input: {
    flex: 1,
    fontSize: 16,
    // No lineHeight: on Android a lineHeight on a single-line TextInput
    // vertically clips the caret as the text scales.
    paddingVertical: spacing.xs,
  },
  // Disabled is carried by the fill AND the glyph colour AND accessibilityState;
  // a full-strength CTA that does nothing when tapped reads as a broken app.
  send: {
    width: TOUCH_MIN,
    height: TOUCH_MIN,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  end: {
    minHeight: TOUCH_MIN,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
