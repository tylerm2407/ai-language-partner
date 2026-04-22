import { useState, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { FeedbackCard } from './FeedbackCard';
import { HighlightedText } from '../shared/HighlightedText';
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
      <Text style={{ fontSize: 14, fontWeight: '600', color: '#6366F1', marginBottom: 8 }}>
        Arrange the words
      </Text>
      <HighlightedText
        text={exercise.prompt}
        highlight={highlight}
        className="text-text-primary text-[18px] font-sans-semibold mb-5 leading-7"
      />

      {/* Answer area */}
      <View style={{
        backgroundColor: '#F9FAFB', borderRadius: 16, padding: 16, marginBottom: 20,
        minHeight: 80, flexDirection: 'row', flexWrap: 'wrap', gap: 8,
        borderWidth: isRevealed ? 2 : 0,
        borderColor: isRevealed ? (isCorrect ? '#22C55E' : '#EF4444') : 'transparent',
      }}>
        {placed.length === 0 && (
          <Text style={{ fontSize: 16, color: '#999' }}>Tap words below to build the sentence</Text>
        )}
        {placed.map((tileIndex, placedIndex) => (
          <Pressable
            key={`placed-${placedIndex}`}
            onPress={() => !isRevealed && handleTapPlaced(placedIndex)}
            style={{
              backgroundColor: '#E0E7FF',
              borderWidth: 2,
              borderColor: '#6366F1',
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
            disabled={isRevealed}
            accessibilityRole="button"
            accessibilityLabel={`Remove word: ${tiles[tileIndex]}`}
          >
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#6366F1' }}>{tiles[tileIndex]}</Text>
          </Pressable>
        ))}
      </View>

      {/* Available tiles */}
      {!isRevealed && (
        <View style={{
          flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20,
        }}>
          {availableIndices.map((tileIndex) => (
            <Pressable
              key={`tile-${tileIndex}`}
              onPress={() => handleTapAvailable(tileIndex)}
              style={{
                backgroundColor: '#F9FAFB',
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 8,
              }}
              accessibilityRole="button"
              accessibilityLabel={`Add word: ${tiles[tileIndex]}`}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111' }}>{tiles[tileIndex]}</Text>
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
            backgroundColor: placed.length > 0 ? '#6366F1' : '#C7D2FE',
            paddingVertical: 16, borderRadius: 14, alignItems: 'center',
          }}
          accessibilityRole="button"
          accessibilityLabel="Check answer"
        >
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>Check</Text>
        </Pressable>
      )}
    </View>
  );
}
