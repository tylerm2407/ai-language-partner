/**
 * Mute, type, hang up.
 *
 * ── END IS LAST AND BEHIND A DIVIDER ──
 *
 * Ending the call is the one action here that cannot be undone: the session is
 * closed, the minutes are spent, and the learner is back on the lobby. It goes
 * last in reading order with a hairline above it, exactly as
 * `app/(app)/practice/handsfree.tsx` does, so a thumb reaching for mute in the
 * middle of a sentence cannot land on it. That screen's comment is the reason,
 * verbatim: "End is separated below a divider so it is not hit by accident with
 * a thumb aiming for Pause."
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
 * Every control carries both a label and a hint. An icon-only button with no
 * label is silent to VoiceOver, and this screen is used with the phone at ear
 * height where nobody is reading it closely anyway.
 */

import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { radii, spacing } from '../../config/theme';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { Body } from '../ui2/Ui2Text';

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
/** The mute button is the one a learner hits without looking. */
const MUTE_SIZE = 64;

interface CallControlsProps {
  muted: boolean;
  onToggleMute: () => void;
  onEnd: () => void;
  onSendText: (text: string) => void;
}

export function CallControls({ muted, onToggleMute, onEnd, onSendText }: CallControlsProps) {
  const { c, type, shape } = useUi2Theme();
  const [draft, setDraft] = useState('');
  const submission = composerSubmission(draft);

  // Both the mute key and the composer are slab surfaces, so they read as one
  // row of physical controls rather than two unrelated widgets.
  const surface = {
    backgroundColor: c.card,
    borderColor: c.cardBorder,
    borderWidth: shape.border,
  };
  const mutedSurface = { backgroundColor: c.yellowTint, borderColor: c.yellowBorder };

  const send = useCallback(() => {
    const text = composerSubmission(draft);
    if (text === null) return;
    onSendText(text);
    // Cleared immediately rather than after an ack: the turn is on its way and
    // leaving the words in the box invites sending them twice.
    setDraft('');
  }, [draft, onSendText]);

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <Pressable
          onPress={onToggleMute}
          accessibilityRole="button"
          // The label states the CURRENT state and the button's effect together,
          // because "Mute" alone leaves a screen-reader user unable to tell
          // whether they are already muted.
          accessibilityLabel={muted ? 'Unmute your microphone' : 'Mute your microphone'}
          accessibilityHint={
            muted
              ? 'Your tutor cannot hear you. Turns it back on.'
              : 'Stops your tutor hearing you. The call keeps running.'
          }
          accessibilityState={{ selected: muted }}
          style={[styles.mute, surface, muted && mutedSurface]}
        >
          {/* One colour for both states: the tint behind the glyph changes and
              the glyph itself is struck through. A yellow glyph on the yellow
              tint would be 1.35:1 — the state would read as a blank key. */}
          <Ionicons name={muted ? 'mic-off' : 'mic'} size={26} color={c.ink} />
        </Pressable>

        <View style={[styles.composer, surface]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={send}
            placeholder="Type instead of speaking"
            placeholderTextColor={c.idle}
            returnKeyType="send"
            // The turn is sent on submit, so the keyboard stays put for the
            // next one instead of dropping between every exchange.
            blurOnSubmit={false}
            accessibilityLabel="Type your turn"
            accessibilityHint="Sends what you type to your tutor, instead of speaking it."
            style={[styles.input, { color: c.ink, fontFamily: type.ui }]}
            // Dynamic Type: the input grows with the rest of the screen but
            // stops before it pushes the send button off the row.
            maxFontSizeMultiplier={1.4}
          />
          <Pressable
            onPress={send}
            disabled={submission === null}
            accessibilityRole="button"
            accessibilityLabel="Send"
            accessibilityHint="Sends your typed turn to your tutor."
            accessibilityState={{ disabled: submission === null }}
            style={[
              styles.send,
              { backgroundColor: submission === null ? c.surface2 : c.primary },
            ]}
          >
            <Ionicons
              name="arrow-up"
              size={20}
              color={submission === null ? c.idle : c.onPrimary}
            />
          </Pressable>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: c.cardBorder }]} />

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
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mute: {
    width: MUTE_SIZE,
    height: MUTE_SIZE,
    borderRadius: MUTE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Muted is a state worth noticing across the room — a yellow tint plus the
  // struck-through mic glyph, never the tint on its own. See `mutedSurface`.
  composer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.sm,
    paddingRight: spacing.xxs,
    paddingVertical: spacing.xxs,
    minHeight: MUTE_SIZE,
    borderRadius: radii.xxl,
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
    borderRadius: TOUCH_MIN / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginTop: spacing.xs,
  },
  end: {
    minHeight: TOUCH_MIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
