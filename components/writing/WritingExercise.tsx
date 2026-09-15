import { useState, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { WritingPrompt } from '../../types';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { haptic } from '../../lib/haptics';
import { cefrAccessibilityLabel, cefrCanDo } from '../../lib/cefr-labels';
import { completeWritingBlank, completeWritingFrame, writingBlankParts } from '../../lib/writing-scaffolds';
import { countWritingUnits, type WritingLengthCount } from '../../lib/writing-length';

interface Props {
  prompt: WritingPrompt;
  /** Course language of the prompt. Decides whether length is whitespace words
   * or (ja/zh) dictionary word segments; omitted means whitespace. */
  language?: string | null;
  isGrading: boolean;
  attemptNumber?: number;
  onSubmit: (text: string, length: WritingLengthCount, timeSpentMs: number) => void;
  onExit: () => void;
}

/** "3 words" / "3 word segments" / "3 characters" — never characters called words. */
function lengthLabel(length: WritingLengthCount): string {
  const noun = length.unit === 'segment' ? 'word segment' : length.unit;
  return `${length.count} ${noun}${length.count === 1 ? '' : 's'}`;
}

export function WritingExercise({ prompt, language, isGrading, attemptNumber = 1, onSubmit, onExit }: Props) {
  const { c } = useUi2Theme();
  const [text, setText] = useState('');
  const [scaffoldInputs, setScaffoldInputs] = useState<Record<number, string>>({});
  const startTimeRef = useRef(Date.now());

  const scaffoldType = prompt.scaffoldType ?? 'free';
  const scaffoldData = prompt.scaffoldData ?? {};

  // Compute combined text for scaffold types
  const getCombinedText = (): string => {
    if (scaffoldType === 'fill_blank') {
      return completeWritingBlank(scaffoldData, scaffoldInputs[0] ?? '___');
    }
    if (scaffoldType === 'sentence_frame') {
      const starters = (scaffoldData.starters as string[]) ?? [];
      return starters.map((s, i) => completeWritingFrame(s, scaffoldInputs[i] ?? '')).join(' ').trim();
    }
    if (scaffoldType === 'guided_paragraph') {
      const starters = (scaffoldData.starters as string[]) ?? [];
      return starters.map((s, i) => completeWritingFrame(s, scaffoldInputs[i] ?? '')).join('\n').trim();
    }
    return text;
  };

  const combinedText = getCombinedText();
  // Japanese and Chinese have no whitespace words. On a runtime with
  // Intl.Segmenter the count is word segments and the task bounds apply; on
  // Hermes (no Segmenter) the count is characters, the bounds cannot be
  // checked here, and the server's segment count decides on submit.
  const length = countWritingUnits(combinedText, language);
  const lengthKnown = length.method !== 'unavailable';
  const meetsMinWords = !lengthKnown || !prompt.minWords || length.count >= prompt.minWords;
  const exceedsMaxWords = lengthKnown && prompt.maxWords ? length.count > prompt.maxWords : false;

  const isScaffoldComplete = (): boolean => {
    if (scaffoldType === 'fill_blank') return (scaffoldInputs[0]?.trim().length ?? 0) > 0;
    if (scaffoldType === 'sentence_frame' || scaffoldType === 'guided_paragraph') {
      const starters = (scaffoldData.starters as string[]) ?? [];
      return starters.every((_, i) => (scaffoldInputs[i]?.trim().length ?? 0) > 0);
    }
    return text.trim().length > 0;
  };

  const canSubmit = isScaffoldComplete() && meetsMinWords && !exceedsMaxWords && !isGrading;

  const handleSubmit = () => {
    // Submit is a bare Pressable rather than the shared <Button>, so it was the
    // one primary action in the app with no press feedback of any kind — and it
    // is followed by a grading spinner, which makes a missed tap look like the
    // app hanging rather than like nothing having happened.
    haptic('buttonPress');
    const timeSpentMs = Date.now() - startTimeRef.current;
    onSubmit(combinedText.trim(), length, timeSpentMs);
  };

  if (isGrading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={c.primary} />
          <Text style={{ fontSize: 16, color: c.muted, marginTop: 16 }}>Checking your writing...</Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
    <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* Was a lowercase "x" glyph in `padding: 8` — about 29x40pt, and a
                lowercase x is not a close affordance anyone recognises. Now a
                real 44pt icon target, on the palette's own `muted` step. */}
            <Pressable
              onPress={onExit}
              hitSlop={8}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: 4 }}
              accessibilityRole="button"
              accessibilityLabel="Exit writing practice"
            >
              <Ionicons name="close" size={24} color={c.muted} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: c.onTint }}>Writing Practice</Text>
              <Text
                style={{ fontSize: 13, color: c.muted }}
                accessibilityLabel={`${cefrAccessibilityLabel(prompt.cefrLevel)} ${scaffoldType !== 'free' ? scaffoldType.replace('_', ' ') : prompt.promptType}.${attemptNumber > 1 ? ` Attempt ${attemptNumber}.` : ''}`}
              >
                {prompt.cefrLevel} | {scaffoldType !== 'free' ? scaffoldType.replace('_', ' ') : prompt.promptType}
                {attemptNumber > 1 ? ` | Attempt ${attemptNumber}` : ''}
              </Text>
              {/* The header is too tight for the full label, so the code carries
                  its meaning on the line below rather than standing alone. */}
              <Text style={{ fontSize: 12, color: c.muted }} accessibilityElementsHidden importantForAccessibility="no">
                {cefrCanDo(prompt.cefrLevel)}
              </Text>
            </View>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          {/* Prompt */}
          <View style={{ backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder, borderRadius: 16, padding: 20, marginBottom: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: c.ink, lineHeight: 26 }}>
              {prompt.promptText}
            </Text>
          </View>

          {/* Target Vocabulary Hints */}
          {prompt.targetVocabulary.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              {/* `target_vocabulary` is stored as ENGLISH glosses, so this
                  cannot say "use these words" — the learner would write English
                  into a target-language composition, and grade-writing scores
                  the same list. */}
              <Text style={{ fontSize: 14, fontWeight: '600', color: c.muted, marginBottom: 6 }}>
                Vocabulary ideas (use the target-language equivalents):
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {prompt.targetVocabulary.map((word, i) => (
                  <View key={i} style={{ backgroundColor: c.primaryTint, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 14, color: c.onTint, fontWeight: '600' }}>{word}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Target Grammar Hints */}
          {prompt.targetGrammar.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: c.muted, marginBottom: 6 }}>
                Grammar focus:
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {prompt.targetGrammar.map((grammar, i) => (
                  <View key={i} style={{ backgroundColor: c.surface2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 14, color: c.ink }}>{grammar}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Scaffold-specific Input UIs */}
          {scaffoldType === 'fill_blank' && (
            <FillBlankInput
              scaffoldData={scaffoldData}
              value={scaffoldInputs[0] ?? ''}
              onChange={(val) => setScaffoldInputs({ ...scaffoldInputs, 0: val })}
            />
          )}

          {scaffoldType === 'sentence_frame' && (
            <SentenceFrameInput
              scaffoldData={scaffoldData}
              values={scaffoldInputs}
              onChange={(idx, val) => setScaffoldInputs({ ...scaffoldInputs, [idx]: val })}
            />
          )}

          {scaffoldType === 'guided_paragraph' && (
            <GuidedParagraphInput
              scaffoldData={scaffoldData}
              values={scaffoldInputs}
              onChange={(idx, val) => setScaffoldInputs({ ...scaffoldInputs, [idx]: val })}
            />
          )}

          {/* Free-form text input (for essay, academic, free types) */}
          {(scaffoldType === 'free' || scaffoldType === 'essay' || scaffoldType === 'academic') && (
            <>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Start writing..."
                placeholderTextColor={c.idle}
                multiline
                style={{
                  borderWidth: 2,
                  borderColor: exceedsMaxWords ? c.error : c.cardBorder,
                  borderRadius: 14,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  fontSize: 16,
                  minHeight: 200,
                  textAlignVertical: 'top',
                  color: c.ink,
                  lineHeight: 24,
                }}
                accessibilityLabel="Your writing"
              />
            </>
          )}

          {/* Length. When the runtime cannot segment ja/zh the label is a neutral
              character count with no bound shown, since the bounds are in words. */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            <Text style={{
              fontSize: 13,
              // Under-minimum is `ink` rather than an amber: the palette's
              // yellow is a FILL colour (see badgeColors' warning variant, which
              // pairs yellowTint with ink text) and fails as body text on a
              // white ground. The "(min N)" suffix carries the state in words.
              color: exceedsMaxWords ? c.error : !meetsMinWords ? c.ink : c.muted,
            }}>
              {lengthLabel(length)}
              {lengthKnown && prompt.minWords ? ` (min ${prompt.minWords})` : ''}
              {lengthKnown && prompt.maxWords ? ` (max ${prompt.maxWords})` : ''}
              {lengthKnown ? '' : ' · length checked on submit'}
            </Text>
          </View>
        </ScrollView>

        {/* Submit Button */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 90, borderTopWidth: 1, borderTopColor: c.cardBorder }}>
          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={{
              backgroundColor: canSubmit ? c.primary : c.track,
              paddingVertical: 16,
              borderRadius: 14,
              alignItems: 'center',
            }}
            accessibilityRole="button"
            accessibilityLabel="Submit writing"
          >
            {/* The disabled label is `muted`, not white: white on the unfilled
                track is ~1.4:1 in light mode. `idle` was tried and is 2.9:1
                there, still under the 3:1 large-text floor; `muted` is 4.4:1
                in light and 5.8:1 in dark. */}
            <Text style={{ color: canSubmit ? c.onPrimary : c.muted, fontSize: 18, fontWeight: '600' }}>Submit</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </View>
  );
}

// ─── Scaffold Sub-Components ─────────────────────────────────────

function FillBlankInput({
  scaffoldData,
  value,
  onChange,
}: {
  scaffoldData: Record<string, unknown>;
  value: string;
  onChange: (val: string) => void;
}) {
  const { c } = useUi2Theme();
  const hint = (scaffoldData.hint as string) ?? '';
  const { before, after } = writingBlankParts(scaffoldData);

  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
        {/* Split by `writingBlankParts`, not by whitespace words: Japanese and
            Chinese frames have no spaces to split on, and the marker form keeps
            the sentence's own spacing around the blank. */}
        <Text style={{ fontSize: 16, color: c.ink }}>{before}</Text>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="___"
          placeholderTextColor={c.idle}
          style={{
            borderBottomWidth: 2,
            borderBottomColor: c.primary,
            fontSize: 16,
            color: c.ink,
            minWidth: 80,
            paddingVertical: 4,
            textAlign: 'center',
          }}
          accessibilityLabel="Fill in the blank"
        />
        <Text style={{ fontSize: 16, color: c.ink }}>{after}</Text>
      </View>
      {hint ? (
        <Text style={{ fontSize: 13, color: c.muted, marginTop: 8, fontStyle: 'italic' }}>
          Hint: {hint}
        </Text>
      ) : null}
    </View>
  );
}

function SentenceFrameInput({
  scaffoldData,
  values,
  onChange,
}: {
  scaffoldData: Record<string, unknown>;
  values: Record<number, string>;
  onChange: (idx: number, val: string) => void;
}) {
  const { c } = useUi2Theme();
  const starters = (scaffoldData.starters as string[]) ?? [];

  return (
    <View style={{ marginBottom: 16 }}>
      {starters.map((starter, i) => {
        const { before, after } = starter.includes('___')
          ? writingBlankParts({ sentence: starter })
          : { before: starter, after: '' };
        return (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
          <Text style={{ fontSize: 16, color: c.ink, marginRight: 4 }}>{before}</Text>
          <TextInput
            value={values[i] ?? ''}
            onChangeText={(val) => onChange(i, val)}
            placeholder="..."
            placeholderTextColor={c.idle}
            style={{
              borderBottomWidth: 2,
              borderBottomColor: c.primary,
              fontSize: 16,
              color: c.ink,
              flex: 1,
              minWidth: 100,
              paddingVertical: 4,
            }}
            accessibilityLabel={`Complete: ${starter}`}
          />
          {after ? <Text style={{ fontSize: 16, color: c.ink, marginLeft: 4 }}>{after}</Text> : null}
        </View>
        );
      })}
    </View>
  );
}

function GuidedParagraphInput({
  scaffoldData,
  values,
  onChange,
}: {
  scaffoldData: Record<string, unknown>;
  values: Record<number, string>;
  onChange: (idx: number, val: string) => void;
}) {
  const { c } = useUi2Theme();
  const starters = (scaffoldData.starters as string[]) ?? [];

  return (
    <View style={{ marginBottom: 16 }}>
      {starters.map((starter, i) => (
        <View key={i} style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: c.muted, marginBottom: 4 }}>{starter}</Text>
          <TextInput
            value={values[i] ?? ''}
            onChangeText={(val) => onChange(i, val)}
            placeholder={starter.includes('___') ? 'Complete the blank...' : 'Continue writing...'}
            placeholderTextColor={c.idle}
            multiline
            style={{
              borderWidth: 2,
              borderColor: c.cardBorder,
              borderRadius: 14,
              paddingHorizontal: 16,
              paddingVertical: 10,
              fontSize: 16,
              minHeight: 60,
              textAlignVertical: 'top',
              color: c.ink,
            }}
            accessibilityLabel={starter.includes('___') ? `Complete: ${starter}` : `Continue from: ${starter}`}
          />
        </View>
      ))}
    </View>
  );
}
