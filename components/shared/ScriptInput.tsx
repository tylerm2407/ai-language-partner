/**
 * ScriptInput — a text field a learner can actually type Japanese, Korean,
 * Chinese or Russian into, on a phone that only has an English keyboard.
 *
 * WHY IT IS NOT JUST A TextInput. Neither iOS nor Android lets an app install,
 * select, or even read the system keyboard's language, and a learner who has
 * not already added a Japanese keyboard in the phone's own settings has no way
 * to answer a Japanese typed exercise — of which the courses hold about 1,150
 * per non-Latin language. Telling them to go to Settings is not a feature; the
 * app brings its own input method instead.
 *
 * HOW IT BEHAVES. Exactly like a system IME, because that is what learners who
 * have used one expect and what the rest do not have to unlearn:
 *
 *   - Latin keystrokes accumulate in a COMPOSITION that is converted live, and
 *     the strip above the field shows both halves — `sakana → さかな` — so the
 *     learner can see the machine agreeing with them.
 *   - Where a reading has several spellings (Chinese always, Japanese kanji)
 *     the candidates are offered in a bar. Tapping one commits it.
 *   - The keypad tab types the script directly, for everything transliteration
 *     cannot reach.
 *
 * WHAT LEAVES THE FIELD is always `settle`d — never the half-converted tail.
 * `convert` deliberately holds `t` back because it may still become `ts`, but
 * a learner who presses Check has finished, and 'приве' must not be what gets
 * graded. So the parent is handed the settled string on every keystroke, and
 * the field shows the composition.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { Caption } from '../ui2/Ui2Text';
import { haptic } from '../../lib/haptics';
import { ScriptKeypad } from './ScriptKeypad';
import { scriptInputFor } from '../../lib/script-input';
import type { Candidate } from '../../lib/script-input';
import type { LanguageCode } from '../../types';

interface ScriptInputProps extends Omit<TextInputProps, 'value' | 'onChangeText' | 'style'> {
  /**
   * The language being TYPED, which is not always the course's target: on a
   * translate-to-native row the learner answers in English and must get the
   * plain keyboard. Pass null there.
   */
  language: LanguageCode | null | undefined;
  value: string;
  onChangeText: (text: string) => void;
  /**
   * Strings the learner is likely to need — the exercise's expected answer and
   * its accepted alternatives. Used ONLY to sort the candidate bar, never to
   * add to it, so the bar cannot become a way to read the answer off the
   * screen.
   */
  context?: readonly string[];
  style?: StyleProp<TextStyle>;
  /**
   * Taken explicitly rather than through `...rest` so it reaches the inner
   * TextInput's own JSX, which is where NativeWind's transform runs. A
   * className spread onto a custom component is an untransformed string.
   */
  className?: string;
  /** Layout for the wrapper the bar and the field share (a chat row's flex). */
  containerStyle?: StyleProp<ViewStyle>;
  /**
   * The text welded either side of a fill-blank, when the field is one.
   *
   * A fill-blank answer is a FRAGMENT: the 看_____ row's answer is 護師, and
   * 護師 is not a word, so no word list contains it and typing its reading
   * finds nothing. With the prefix known, the learner can type the reading of
   * the WHOLE word — かんごし — and be offered the missing piece, which is the
   * only way that row is answerable without hunting character by character.
   *
   * `blankContext` in lib/exercise-restore.ts derives it, and the grader
   * already uses the same two strings to weld the fragment back into a word.
   */
  trim?: { prefix: string; suffix: string };
}

export function ScriptInput({
  language,
  value,
  onChangeText,
  context,
  style,
  className,
  containerStyle,
  trim,
  editable = true,
  ...rest
}: ScriptInputProps) {
  const { c } = useUi2Theme();
  const engine = scriptInputFor(language);

  /** Script text already decided. */
  const [committed, setCommitted] = useState(value);
  /** Latin keystrokes not yet converted into anything final. */
  const [buffer, setBuffer] = useState('');
  const [showKeypad, setShowKeypad] = useState(false);
  const [page, setPage] = useState(0);
  /** What we last handed the parent, so an echo does not reset composition. */
  const emitted = useRef(value);

  const conversion = useMemo(
    () => (engine ? engine.convert(buffer) : { text: buffer, pending: '' }),
    [engine, buffer],
  );
  const displayed = committed + conversion.text + conversion.pending;

  const candidates = useMemo(
    () => (engine ? engine.candidates(conversion.text || conversion.pending, context ?? []) : []),
    [engine, conversion.text, conversion.pending, context],
  );

  /**
   * Candidates with the blank's own prefix and suffix taken back off, so what
   * lands in the field completes the word instead of repeating it: on 看_____
   * the bar shows 護師, never 看護師.
   */
  const shown = useMemo(() => {
    if (!trim || (!trim.prefix && !trim.suffix)) return candidates;
    const out: Candidate[] = [];
    const seen = new Set<string>();
    const add = (text: string, reading: string) => {
      if (!text || seen.has(text)) return;
      seen.add(text);
      out.push({ text, reading });
    };
    for (const candidate of candidates) {
      const { text, reading } = candidate;
      const encloses =
        text.startsWith(trim.prefix) &&
        text.endsWith(trim.suffix) &&
        text.length > trim.prefix.length + trim.suffix.length;
      if (encloses) {
        add(text.slice(trim.prefix.length, text.length - trim.suffix.length), reading);
        continue;
      }
      add(text, reading);
    }
    return out;
  }, [candidates, trim]);

  const emit = useCallback(
    (nextCommitted: string, nextBuffer: string) => {
      const settled = nextCommitted + (engine ? engine.settle(nextBuffer) : nextBuffer);
      emitted.current = settled;
      onChangeText(settled);
    },
    [engine, onChangeText],
  );

  // A value the parent changed on its own — a restored session, a cleared
  // field, a retry — replaces the composition rather than fighting it.
  useEffect(() => {
    if (value === emitted.current) return;
    emitted.current = value;
    setCommitted(value);
    setBuffer('');
  }, [value]);

  const apply = useCallback(
    (nextCommitted: string, nextBuffer: string) => {
      setCommitted(nextCommitted);
      setBuffer(nextBuffer);
      emit(nextCommitted, nextBuffer);
    },
    [emit],
  );

  const pick = useCallback(
    (text: string) => {
      haptic('select');
      apply(committed + text, '');
    },
    [apply, committed],
  );

  /**
   * Turn the field's new string back into composition state.
   *
   * React Native hands over the whole text, not the keystroke, so the change
   * has to be recovered by comparing against what was on screen. Typing at the
   * end and backspacing are the two cases that matter for a one-line answer;
   * anything else — a paste, a mid-string edit, autocorrect rewriting a word —
   * is taken at face value and committed whole, which loses the composition
   * but never loses the learner's text.
   */
  const handleChange = useCallback(
    (next: string) => {
      if (!engine) {
        emitted.current = next;
        setCommitted(next);
        onChangeText(next);
        return;
      }
      if (next === displayed) return;

      if (next.startsWith(displayed)) {
        const typed = next.slice(displayed.length);
        let nextCommitted = committed;
        let nextBuffer = buffer;
        for (const ch of typed) {
          if (engine.commitOnSpace && ch === ' ' && nextBuffer) {
            // Space is how a Chinese IME accepts the leading candidate. Falling
            // through to a literal space would leave pinyin in the answer.
            const top = shown[0];
            nextCommitted += top ? top.text : engine.settle(nextBuffer);
            nextBuffer = '';
            continue;
          }
          if (/[A-Za-z'ü-]/.test(ch)) {
            nextBuffer += ch;
            continue;
          }
          // Punctuation and spaces end a word, so whatever was composing is
          // settled before them.
          nextCommitted += engine.settle(nextBuffer) + ch;
          nextBuffer = '';
        }
        apply(nextCommitted, nextBuffer);
        return;
      }

      if (displayed.startsWith(next)) {
        const removed = displayed.length - next.length;
        if (buffer.length >= removed) {
          apply(committed, buffer.slice(0, buffer.length - removed));
        } else {
          apply(next, '');
        }
        return;
      }

      apply(next, '');
    },
    [engine, displayed, committed, buffer, apply, onChangeText, shown],
  );

  const settleNow = useCallback(() => {
    if (!engine || !buffer) return;
    apply(committed + engine.settle(buffer), '');
  }, [engine, buffer, committed, apply]);

  const field = (
    <TextInput
      {...rest}
      value={displayed}
      onChangeText={handleChange}
      onBlur={settleNow}
      editable={editable}
      // Autocorrect rewrites transliteration into English words — `nihao`
      // becomes `nacho` — and auto-capitalisation puts a stray uppercase letter
      // into a buffer the converter reads as romaji. Both are forced off while
      // an input method is driving the field, and left to the caller when one
      // is not: a Spanish chat message should still capitalise its sentences.
      autoCapitalize={engine ? 'none' : rest.autoCapitalize}
      autoCorrect={engine ? false : rest.autoCorrect}
      spellCheck={engine ? false : rest.spellCheck}
      className={className}
      style={style}
    />
  );

  if (!engine) return field;

  const pages = engine.keypadPages ?? (engine.keypad.length ? [{ label: 'ABC', rows: engine.keypad }] : []);

  return (
    <View style={containerStyle}>
      {field}

      {editable ? (
        <View style={{ marginTop: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Caption style={{ flex: 1, color: c.muted }}>
              {conversion.pending || conversion.text
                ? `${buffer} → ${conversion.text}${conversion.pending}`
                : trim && (trim.prefix || trim.suffix)
                  ? `${engine.hint} For a blank, type the whole word's sound.`
                  : engine.hint}
            </Caption>
            {pages.length ? (
              <Pressable
                onPress={() => {
                  haptic('select');
                  settleNow();
                  setShowKeypad((v) => !v);
                }}
                accessibilityRole="button"
                accessibilityLabel={showKeypad ? 'Hide the script keypad' : 'Show the script keypad'}
                accessibilityState={{ expanded: showKeypad }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 10,
                  backgroundColor: showKeypad ? c.primaryTint : 'transparent',
                  borderWidth: 1,
                  borderColor: showKeypad ? c.primaryTintBorder : c.cardBorder,
                }}
              >
                <Ionicons name="keypad-outline" size={14} color={showKeypad ? c.onTint : c.muted} />
                <Caption style={{ color: showKeypad ? c.onTint : c.muted }}>
                  {pages[0].rows[0][0]}
                </Caption>
              </Pressable>
            ) : null}
          </View>

          {shown.length ? (
            <ScrollView
              horizontal
              keyboardShouldPersistTaps="handled"
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: 6 }}
              contentContainerStyle={{ gap: 6 }}
            >
              {shown.map((candidate) => (
                <Pressable
                  key={`${candidate.reading}:${candidate.text}`}
                  onPress={() => pick(candidate.text)}
                  accessibilityRole="button"
                  accessibilityLabel={`${candidate.text}, ${candidate.reading}`}
                  style={{
                    minHeight: 44,
                    paddingHorizontal: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 10,
                    backgroundColor: c.card,
                    borderWidth: 1,
                    borderColor: c.cardBorder,
                  }}
                >
                  <Caption style={{ color: c.ink, fontSize: 18 }}>{candidate.text}</Caption>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          {showKeypad && pages.length ? (
            <ScriptKeypad
              pages={pages}
              pageIndex={page}
              onPageChange={setPage}
              onKey={(key) => apply(committed + engine.settle(buffer) + key, '')}
              onBackspace={() => {
                if (buffer) apply(committed, buffer.slice(0, -1));
                else apply(committed.slice(0, -1), '');
              }}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
