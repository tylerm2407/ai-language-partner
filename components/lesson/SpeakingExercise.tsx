import { useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { AudioPlayButton } from '../audio/AudioPlayButton';
import { RecordButton } from '../audio/RecordButton';
import { scorePronunciation } from '../../lib/ai';
import { useAuth } from '../../hooks/useAuth';
import type { Exercise, LanguageCode } from '../../types';

interface SpeakingExerciseProps {
  exercise: Exercise;
  targetLanguage: LanguageCode;
  onAnswer: (answer: string, isCorrect: boolean) => void;
}

/**
 * Speaking exercise: listen to prompt audio, then record yourself saying it.
 * Audio is sent to the backend for pronunciation scoring.
 */
export function SpeakingExercise({ exercise, targetLanguage, onAnswer }: SpeakingExerciseProps) {
  const { user } = useAuth();
  const [phase, setPhase] = useState<'listen' | 'record' | 'scoring' | 'result'>('listen');
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleRecordingComplete = async (result: {
    uri: string;
    base64: string;
    durationMs: number;
  }) => {
    setPhase('scoring');
    setError(null);

    try {
      const scoreResult = await scorePronunciation({
        userId: user!.id,
        audioBase64: result.base64,
        expectedText: exercise.correctAnswer,
        language: targetLanguage,
      });

      setScore(scoreResult.score);
      setFeedback(scoreResult.feedback);
      setPhase('result');

      const isCorrect = scoreResult.score >= 60; // 60% threshold for pass

      setTimeout(() => {
        onAnswer(`pronunciation_score:${scoreResult.score}`, isCorrect);
      }, 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scoring failed');
      setPhase('record');
    }
  };

  return (
    <View>
      <Text style={{ fontSize: 14, color: '#6366F1', fontWeight: '600', marginBottom: 8 }}>
        Listen and repeat
      </Text>

      <Text style={{ fontSize: 22, fontWeight: '600', marginBottom: 8, textAlign: 'center' }}>
        {exercise.prompt}
      </Text>

      <Text style={{ fontSize: 16, color: '#666', marginBottom: 24, textAlign: 'center' }}>
        {exercise.correctAnswer}
      </Text>

      {/* Step 1: Listen */}
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        {exercise.promptAudioUrl ? (
          <AudioPlayButton audioUrl={exercise.promptAudioUrl} size={64} />
        ) : (
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: '#E5E7EB',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 11, color: '#999' }}>No audio</Text>
          </View>
        )}
        <Text style={{ fontSize: 13, color: '#666', marginTop: 6 }}>
          {phase === 'listen' ? 'Listen first, then record' : 'Tap to replay'}
        </Text>
      </View>

      {/* Step 2: Record */}
      {(phase === 'listen' || phase === 'record') && (
        <View style={{ alignItems: 'center' }}>
          <RecordButton onRecordingComplete={handleRecordingComplete} size={72} />
          {phase === 'listen' && (
            <Text style={{ fontSize: 13, color: '#999', marginTop: 12, textAlign: 'center' }}>
              Listen to the audio above, then hold the button to record your pronunciation.
            </Text>
          )}
        </View>
      )}

      {/* Step 3: Scoring */}
      {phase === 'scoring' && (
        <View style={{ alignItems: 'center', padding: 24 }}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={{ fontSize: 16, color: '#666', marginTop: 12 }}>
            Analyzing your pronunciation...
          </Text>
        </View>
      )}

      {/* Step 4: Result */}
      {phase === 'result' && score !== null && (
        <View style={{ alignItems: 'center', padding: 24 }}>
          <View
            style={{
              width: 100,
              height: 100,
              borderRadius: 50,
              backgroundColor: score >= 80 ? '#DCFCE7' : score >= 60 ? '#FEF9C3' : '#FEE2E2',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                fontSize: 32,
                fontWeight: '700',
                color: score >= 80 ? '#22C55E' : score >= 60 ? '#CA8A04' : '#EF4444',
              }}
            >
              {score}%
            </Text>
          </View>
          <Text
            style={{
              fontSize: 18,
              fontWeight: '600',
              color: score >= 60 ? '#22C55E' : '#EF4444',
              marginBottom: 4,
            }}
          >
            {score >= 80 ? 'Excellent!' : score >= 60 ? 'Good enough!' : 'Try again'}
          </Text>
          <Text style={{ fontSize: 14, color: '#666', textAlign: 'center' }}>
            {feedback}
          </Text>
        </View>
      )}

      {/* Error */}
      {error && (
        <Text style={{ fontSize: 14, color: '#EF4444', textAlign: 'center', marginTop: 12 }}>
          {error}
        </Text>
      )}
    </View>
  );
}
