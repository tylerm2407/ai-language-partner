import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassSurface } from '../ui/GlassSurface';
import type { ConversationGrade } from '../../types';

interface RubricDisplayProps {
  grade: ConversationGrade;
}

function scoreColor(total: number): string {
  if (total >= 80) return '#3FB950';
  if (total >= 60) return '#E2E6EA';
  return '#F85149';
}

interface RubricBarProps {
  label: string;
  score: number;
  max: number;
}

function RubricBar({ label, score, max }: RubricBarProps) {
  const pct = Math.min(100, Math.round((score / max) * 100));
  const color = score >= max * 0.8 ? '#3FB950' : score >= max * 0.6 ? '#E2E6EA' : '#F85149';

  return (
    <View style={{ marginBottom: 12 }}>
      <View className="flex-row items-center justify-between mb-1">
        <Text
          style={{
            color: '#80868C',
            fontSize: 13,
            fontFamily: 'Nunito_500Medium',
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 13,
            fontFamily: 'Nunito_600SemiBold',
          }}
        >
          {score}/{max}
        </Text>
      </View>
      <View
        style={{
          height: 8,
          borderRadius: 4,
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            height: '100%',
            width: `${pct}%`,
            backgroundColor: color,
            borderRadius: 4,
          }}
        />
      </View>
    </View>
  );
}

export default function RubricDisplay({ grade }: RubricDisplayProps) {
  const totalColor = scoreColor(grade.totalScore);

  return (
    <GlassSurface innerStyle={{ padding: 20 }}>
      {/* Total score */}
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <Text
          style={{
            color: totalColor,
            fontSize: 48,
            fontFamily: 'Nunito_800ExtraBold',
          }}
          accessibilityLabel={`Total score: ${grade.totalScore} out of 100`}
        >
          {grade.totalScore}
        </Text>
        <Text
          style={{
            color: '#5C6166',
            fontSize: 13,
            fontFamily: 'Nunito_500Medium',
          }}
        >
          / 100
        </Text>
      </View>

      {/* Rubric bars */}
      <RubricBar label="Participation" score={grade.participation} max={25} />
      <RubricBar label="Language Usage" score={grade.languageUsage} max={25} />
      <RubricBar label="Grammar & Vocabulary" score={grade.grammarVocabulary} max={25} />
      <RubricBar label="Duration" score={grade.durationCompliance} max={25} />

      {/* Summary */}
      {grade.summary ? (
        <Text
          style={{
            color: '#80868C',
            fontSize: 14,
            fontFamily: 'Nunito_400Regular',
            marginTop: 16,
            lineHeight: 20,
          }}
        >
          {grade.summary}
        </Text>
      ) : null}

      {/* Strengths */}
      {grade.strengths.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Text
            style={{
              color: '#3FB950',
              fontSize: 13,
              fontFamily: 'Nunito_600SemiBold',
              marginBottom: 6,
            }}
          >
            Strengths
          </Text>
          {grade.strengths.map((s, i) => (
            <View key={i} className="flex-row items-start mb-1">
              <Ionicons
                name="ellipse"
                size={6}
                color="#3FB950"
                style={{ marginTop: 6, marginRight: 8 }}
              />
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 13,
                  fontFamily: 'Nunito_400Regular',
                  flex: 1,
                  lineHeight: 18,
                }}
              >
                {s}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Improvements */}
      {grade.improvements.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Text
            style={{
              color: '#E2E6EA',
              fontSize: 13,
              fontFamily: 'Nunito_600SemiBold',
              marginBottom: 6,
            }}
          >
            Areas for Improvement
          </Text>
          {grade.improvements.map((s, i) => (
            <View key={i} className="flex-row items-start mb-1">
              <Ionicons
                name="ellipse"
                size={6}
                color="#E2E6EA"
                style={{ marginTop: 6, marginRight: 8 }}
              />
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 13,
                  fontFamily: 'Nunito_400Regular',
                  flex: 1,
                  lineHeight: 18,
                }}
              >
                {s}
              </Text>
            </View>
          ))}
        </View>
      )}
    </GlassSurface>
  );
}
