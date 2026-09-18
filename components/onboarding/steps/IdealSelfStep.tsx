/**
 * The ideal-moment step. The sentence the learner writes (or the chip they
 * tap) picks the topic, and the topic picks the micro lesson two steps later
 * — this is the one answer the rest of the flow is built from.
 */
import { Text, TextInput } from 'react-native';
import Animated from 'react-native-reanimated';
import { useUi2Theme } from '../../../hooks/useUi2Theme';
import type { LanguageCode } from '../../../types';
import { SlabCard } from '../../ui2/SlabCard';
import { Chip } from '../../ui2/Chip';
import { Ui2Mascot } from '../../ui2/Ui2Mascot';
import { TOPIC_CHIPS, type TopicKey } from '../topic-packs';
import { stepStyles, type StepFrame } from './bits';
import { IDEAL_SELF_MAX_CHARS, IDEAL_SELF_PLACEHOLDER } from './config';

export function IdealSelfStep({
  frame,
  targetLanguage,
  languageName,
  text,
  onChangeText,
  topic,
  onPickChip,
  onCommitTopic,
  solLine,
}: {
  frame: StepFrame;
  targetLanguage: LanguageCode;
  languageName: string;
  text: string;
  onChangeText: (text: string) => void;
  topic: TopicKey | null;
  /** A chip tap: sets the topic AND fills the box with the chip's sentence. */
  onPickChip: (key: TopicKey, sentence: string) => void;
  /** Leaving the box: guess the topic from the free text if no chip was tapped. */
  onCommitTopic: () => void;
  /** The mascot's reaction to a recognised topic, or null when there is none to react to. */
  solLine: string | null | undefined;
}) {
  const { c, type } = useUi2Theme();
  return (
    <>
      {frame.hero(`Picture a moment you'd love to have in ${languageName}.`, 'rise', 'think')}
      <Animated.View entering={frame.enter(0)}>
        <Text style={{ fontFamily: type.ui, fontSize: 14, lineHeight: 20, color: c.muted }}>
          Pick the closest, then make it yours. Your first lesson is built from this.
        </Text>
      </Animated.View>
      <Animated.View entering={frame.enter(1)}>
        <SlabCard style={[stepStyles.inputCard, { borderColor: c.primary }]}>
          <TextInput
            value={text}
            onChangeText={(next) => onChangeText(next.slice(0, IDEAL_SELF_MAX_CHARS))}
            onBlur={onCommitTopic}
            placeholder={IDEAL_SELF_PLACEHOLDER[targetLanguage] ?? IDEAL_SELF_PLACEHOLDER.en}
            placeholderTextColor={c.idle}
            multiline
            numberOfLines={4}
            maxLength={IDEAL_SELF_MAX_CHARS}
            style={[stepStyles.multiline, { fontFamily: type.ui, color: c.ink }]}
            accessibilityLabel="Your ideal L2 self — a sentence describing your language vision"
          />
          <Text style={{ fontFamily: type.uiHeavy, fontSize: 12, color: c.muted, textAlign: 'right' }}>
            {text.length} / {IDEAL_SELF_MAX_CHARS}
          </Text>
        </SlabCard>
      </Animated.View>
      <Animated.View entering={frame.enter(2)} style={stepStyles.chips}>
        {TOPIC_CHIPS.map((chip) => (
          <Chip
            key={chip.key}
            label={chip.tag}
            variant={topic === chip.key ? 'primary' : 'neutral'}
            onPress={() => {
              onPickChip(chip.key, chip.text(languageName));
              frame.cheer();
            }}
          />
        ))}
      </Animated.View>
      {/* The mascot reacting to the topic by name is the only proof, at this point
          in the flow, that the sentence went anywhere. */}
      {solLine ? (
        <Animated.View entering={frame.enter(3)}>
          <SlabCard tint="primary" style={stepStyles.solCard}>
            <Ui2Mascot size={40} mood="cheer" />
            <Text style={{ flex: 1, fontFamily: type.ui, fontSize: 13, lineHeight: 19, color: c.ink }}>
              {solLine}
            </Text>
          </SlabCard>
        </Animated.View>
      ) : null}
    </>
  );
}
