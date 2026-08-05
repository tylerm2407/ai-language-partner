import { useState, useMemo } from 'react';
import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { FeedbackCard } from './FeedbackCard';
import { HighlightedText } from '../shared/HighlightedText';
import { Body, Caption } from '../ui/Text';
import { colors, spacing, radii } from '../../config/theme';
import { gradeAnswer } from '../../lib/grading';
import type { GradeResult } from '../../lib/grading';
import type { Exercise } from '../../types';

interface Props {
  exercise: Exercise;
  onAnswer: (isCorrect: boolean, answer: string) => void;
  userId?: string;
  language?: string;
  cefrLevel?: string;
  onContinue?: () => void;
}

export function SentenceConstructionExercise({
  exercise,
  onAnswer,
  userId,
  language,
  cefrLevel,
  onContinue,
}: Props) {
  const tiles = useMemo(() => {
    const correctTiles = (exercise.metadata?.tiles as string[]) ?? exercise.correctAnswer.split(' ');
    const distractors = (exercise.metadata?.distractors as string[]) ?? [];
    const all = [...correctTiles, ...distractors];
    // Shuffle deterministically based on exercise id
    return all.sort(() => 0.5 - Math.random());
  }, [exercise]);

  const [placed, setPlaced] = useState<number[]>([]); // indices into tiles
  const [isRevealed, setIsRevealed] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);

  const assembledSentence = placed.map((i) => tiles[i]).join(' ');
  const availableIndices = tiles.map((_, i) => i).filter((i) => !placed.includes(i));
  const highlight = exercise.targetWord ?? exercise.targetGrammar;

  const handleTapAvailable = (index: number) => {
    Haptics.selectionAsync();
    setPlaced((prev) => [...prev, index]);
  };

  const handleTapPlaced = (placedIndex: number) => {
    Haptics.selectionAsync();
    setPlaced((prev) => prev.filter((_, i) => i !== placedIndex));
  };

  const handleCheck = () => {
    const grade = gradeAnswer(
      assembledSentence,
      exercise.correctAnswer,
      exercise.acceptedAnswers,
      {
        exerciseHints: {
          exerciseType: exercise.type,
          skillType: exercise.skillType,
          targetGrammar: exercise.targetGrammar,
          targetWord: exercise.targetWord,
        },
      },
    );
    setResult(grade);
    setIsRevealed(true);

    if (grade.isCorrect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    onAnswer(grade.isCorrect, assembledSentence);
  };

  const handleRetry = () => {
    setPlaced([]);
    setIsRevealed(false);
    setResult(null);
  };

  const isCorrect = result?.isCorrect ?? false;

  return (
    <View style={{ flex: 1 }}>
      <Caption tone="accent" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
        Arrange the words
      </Caption>
      <HighlightedText
        text={exercise.prompt}
        highlight={highlight}
        className="text-text-primary text-[18px] font-sans-semibold mb-5 leading-7"
      />

      {/* Answer area */}
      <View style={{
        backgroundColor: colors.surface.cardAlt, borderRadius: radii.xl, padding: spacing.md, marginBottom: spacing.lg + spacing.xxs,
        minHeight: 80, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs,
        borderWidth: isRevealed ? 2 : 0,
        borderColor: isRevealed ? (isCorrect ? colors.success.base : colors.error.base) : 'transparent',
      }}>
        {isRevealed && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xxs }}>
            <Ionicons
              name={isCorrect ? 'checkmark-circle' : 'close-circle'}
              size={20}
              color={isCorrect ? colors.success.base : colors.error.base}
              style={{ marginRight: spacing.xxs }}
            />
          </View>
        )}
        {placed.length === 0 && (
          <Body tone="tertiary">Tap words below to build the sentence</Body>
        )}
        {placed.map((tileIndex, placedIndex) => (
          <Pressable
            key={`placed-${placedIndex}`}
            onPress={() => !isRevealed && handleTapPlaced(placedIndex)}
            style={{
              backgroundColor: colors.indigo[900],
              borderWidth: 2,
              borderColor: colors.action.primaryFill,
              borderRadius: radii.sm,
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xs,
            }}
            disabled={isRevealed}
            accessibilityRole="button"
            accessibilityLabel={`Remove word: ${tiles[tileIndex]}`}
          >
            <Body weight="semibold" tone="accent">{tiles[tileIndex]}</Body>
          </Pressable>
        ))}
      </View>

      {/* Available tiles */}
      {!isRevealed && (
        <View style={{
          flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.lg + spacing.xxs,
        }}>
          {availableIndices.map((tileIndex) => (
            <Pressable
              key={`tile-${tileIndex}`}
              onPress={() => handleTapAvailable(tileIndex)}
              style={{
                backgroundColor: colors.surface.card,
                borderRadius: radii.sm,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
              }}
              accessibilityRole="button"
              accessibilityLabel={`Add word: ${tiles[tileIndex]}`}
            >
              <Body weight="semibold">{tiles[tileIndex]}</Body>
            </Pressable>
          ))}
        </View>
      )}

      {/* Differentiated feedback */}
      {result && isRevealed && language && onContinue ? (
        <FeedbackCard
          result={result}
          exercise={exercise}
          language={language}
          cefrLevel={cefrLevel}
          userId={userId}
          onRetry={handleRetry}
          onContinue={onContinue}
        />
      ) : null}

      {/* Check button */}
      {!isRevealed && (
        <Pressable
          onPress={handleCheck}
          disabled={placed.length === 0}
          style={{
            backgroundColor: placed.length > 0 ? colors.action.primaryFill : colors.indigo[200],
            paddingVertical: spacing.md, borderRadius: radii.lg, alignItems: 'center',
          }}
          accessibilityRole="button"
          accessibilityLabel="Check answer"
        >
          <Body size="lg" weight="semibold" tone="onPrimary">Check</Body>
        </Pressable>
      )}
    </View>
  );
}
