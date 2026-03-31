import { useState, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { Exercise } from '../../types';

interface Props {
  exercise: Exercise;
  onAnswer: (isCorrect: boolean, answer: string) => void;
}

export function SentenceConstructionExercise({ exercise, onAnswer }: Props) {
  const tiles = useMemo(() => {
    const correctTiles = (exercise.metadata?.tiles as string[]) ?? exercise.correctAnswer.split(' ');
    const distractors = (exercise.metadata?.distractors as string[]) ?? [];
    const all = [...correctTiles, ...distractors];
    // Shuffle deterministically based on exercise id
    return all.sort(() => 0.5 - Math.random());
  }, [exercise]);

  const [placed, setPlaced] = useState<number[]>([]); // indices into tiles
  const [isRevealed, setIsRevealed] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const assembledSentence = placed.map((i) => tiles[i]).join(' ');
  const availableIndices = tiles.map((_, i) => i).filter((i) => !placed.includes(i));

  const handleTapAvailable = (index: number) => {
    Haptics.selectionAsync();
    setPlaced((prev) => [...prev, index]);
  };

  const handleTapPlaced = (placedIndex: number) => {
    Haptics.selectionAsync();
    setPlaced((prev) => prev.filter((_, i) => i !== placedIndex));
  };

  const handleCheck = () => {
    const correct = assembledSentence.toLowerCase().trim() === exercise.correctAnswer.toLowerCase().trim();
    setIsCorrect(correct);
    setIsRevealed(true);

    if (correct) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleContinue = () => {
    onAnswer(isCorrect, assembledSentence);
  };

  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: '#6366F1', marginBottom: 8 }}>
        Arrange the words
      </Text>
      <Text style={{ fontSize: 18, fontWeight: '600', color: '#111', marginBottom: 20, lineHeight: 26 }}>
        {exercise.prompt}
      </Text>

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

      {/* Feedback */}
      {isRevealed && !isCorrect && (
        <View style={{ backgroundColor: '#FEE2E2', borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 14, color: '#EF4444' }}>
            Correct answer: <Text style={{ fontWeight: '600' }}>{exercise.correctAnswer}</Text>
          </Text>
        </View>
      )}

      {/* Button */}
      {!isRevealed ? (
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
      ) : (
        <Pressable
          onPress={handleContinue}
          style={{ backgroundColor: '#6366F1', paddingVertical: 16, borderRadius: 14, alignItems: 'center' }}
          accessibilityRole="button"
          accessibilityLabel="Continue"
        >
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>Continue</Text>
        </Pressable>
      )}
    </View>
  );
}
