/**
 * Ui2InlineError — the UI 2.0 counterpart to `components/ui/InlineError.tsx`.
 *
 * Same props ({ copy, onRetry, retryLabel }), same `ErrorCopy` shape, same
 * default label. The reason this component exists at all is unchanged and
 * worth restating: it is the alternative to `Alert.alert('Error', …)`, so the
 * learner keeps the screen they were on and the retry is one tap away
 * (CLAUDE.md §5). Anything that makes it harder to reach for than an Alert
 * defeats it, which is why the API did not get "improved" on the way across.
 *
 * The failure is signalled three ways — the alert glyph, the word in the title,
 * and the colour — so it survives both a colour-blind reader and a screenshot
 * in greyscale. The glyph is not decoration here; `c.error` alone would be the
 * colour-only signal DESIGN.md forbids.
 *
 * The retry stays a text button rather than a `SlabButton`: an inline error is
 * usually nested inside a card or a list row, and a 56pt slab block inside one
 * reads as the screen's primary action when it is a recovery from a hiccup.
 * The 44pt minimum is held by the Pressable's own minHeight.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { haptic } from '../../lib/haptics';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { Body } from './Ui2Text';
import type { ErrorCopy } from '../../lib/error-copy';

interface Ui2InlineErrorProps {
  copy: ErrorCopy;
  onRetry: () => void;
  retryLabel?: string;
}

export function Ui2InlineError({ copy, onRetry, retryLabel = 'Try again' }: Ui2InlineErrorProps) {
  const { c } = useUi2Theme();

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Ionicons name="alert-circle" size={16} color={c.error} style={styles.icon} />
        <View style={styles.text}>
          <Body size="sm" weight="bold" tone="error">
            {copy.title}
          </Body>
          <Body size="sm" tone="tertiary">
            {copy.message}
          </Body>
        </View>
      </View>

      <Pressable
        onPress={() => {
          haptic('buttonPress');
          onRetry();
        }}
        accessibilityRole="button"
        accessibilityLabel={retryLabel}
        style={styles.retry}
      >
        <Body size="sm" weight="bold" tone="accent">
          {retryLabel}
        </Body>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 16, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, paddingHorizontal: 16 },
  icon: { marginTop: 2 },
  text: { marginLeft: 4, flexShrink: 1 },
  retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
});
