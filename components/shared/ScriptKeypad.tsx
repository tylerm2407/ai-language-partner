/**
 * The on-screen script pad — every letter of the target script, one tap each.
 *
 * It is the floor under the transliterator. Transliteration is faster and is
 * what most learners will use, but it cannot be complete: Russian ъ ь э have
 * no Latin spelling anyone guesses, and Korean romaja carries the SOUND of a
 * word rather than its spelling, so 합니다 is unreachable from what a learner
 * hears. Tapping jamo is unambiguous. Anything typed here goes in verbatim,
 * with no conversion between the tap and the field.
 */
import { memo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { Body, Caption } from '../ui2/Ui2Text';
import { haptic } from '../../lib/haptics';

interface ScriptKeypadProps {
  pages: readonly { label: string; rows: readonly (readonly string[])[] }[];
  pageIndex: number;
  onPageChange: (index: number) => void;
  onKey: (key: string) => void;
  onBackspace: () => void;
}

function ScriptKeypadImpl({ pages, pageIndex, onPageChange, onKey, onBackspace }: ScriptKeypadProps) {
  const { c } = useUi2Theme();
  const page = pages[Math.min(pageIndex, pages.length - 1)];
  if (!page) return null;

  return (
    <View
      style={{
        marginTop: 8,
        padding: 8,
        borderRadius: 14,
        backgroundColor: c.surface2,
        borderWidth: 1,
        borderColor: c.cardBorder,
      }}
    >
      {pages.length > 1 ? (
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
          {pages.map((p, i) => (
            <Pressable
              key={p.label}
              onPress={() => onPageChange(i)}
              accessibilityRole="button"
              accessibilityState={{ selected: i === pageIndex }}
              accessibilityLabel={`${p.label} keys`}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 14,
                borderRadius: 10,
                backgroundColor: i === pageIndex ? c.primaryTint : 'transparent',
                borderWidth: 1,
                borderColor: i === pageIndex ? c.primaryTintBorder : c.cardBorder,
              }}
            >
              <Caption style={{ color: i === pageIndex ? c.onTint : c.muted }}>{p.label}</Caption>
            </Pressable>
          ))}
        </View>
      ) : null}

      <ScrollView style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled">
        {page.rows.map((row, r) => (
          <View key={r} style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
            {row.map((key) => (
              <Pressable
                key={key}
                onPress={() => {
                  haptic('select');
                  onKey(key);
                }}
                accessibilityRole="button"
                accessibilityLabel={key}
                // 44pt is the smallest reliable touch target; a pad of 33
                // characters at anything less is a pad nobody can hit.
                style={{
                  flex: 1,
                  minHeight: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 10,
                  backgroundColor: c.card,
                  borderWidth: 1,
                  borderColor: c.cardBorder,
                }}
              >
                <Body style={{ color: c.ink, fontSize: 20 }}>{key}</Body>
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>

      <Pressable
        onPress={() => {
          haptic('select');
          onBackspace();
        }}
        accessibilityRole="button"
        accessibilityLabel="Delete"
        style={{
          minHeight: 44,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 10,
          backgroundColor: c.card,
          borderWidth: 1,
          borderColor: c.cardBorder,
        }}
      >
        <Body style={{ color: c.muted }}>⌫ Delete</Body>
      </Pressable>
    </View>
  );
}

export const ScriptKeypad = memo(ScriptKeypadImpl);
