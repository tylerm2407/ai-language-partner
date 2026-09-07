import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SlabCard, type SlabTint } from '../ui2/SlabCard';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import type { ConversationGrade } from '../../types';

interface RubricDisplayProps {
  grade: ConversationGrade;
}

/**
 * The band is carried by a TINT behind the number rather than by colouring the
 * numerals. UI 2.0 runs in light mode too, where `green`/`yellow` as text sit
 * around 2:1 on a white card — the tint keeps the colour coding and keeps the
 * score readable, which colouring 48px numerals does not.
 */
function scoreTint(total: number): SlabTint {
  if (total >= 80) return 'green';
  if (total >= 60) return 'yellow';
  return 'pink';
}

interface RubricBarProps {
  label: string;
  score: number;
  max: number;
}

function RubricBar({ label, score, max }: RubricBarProps) {
  const { c } = useUi2Theme();
  const pct = Math.min(100, Math.round((score / max) * 100));
  const color = score >= max * 0.8 ? c.green : score >= max * 0.6 ? c.yellow : c.error;

  return (
    <View style={{ marginBottom: 12 }}>
      <View className="flex-row items-center justify-between mb-1">
        <Text
          style={{
            color: c.muted,
            fontSize: 13,
            fontFamily: 'Nunito_500Medium',
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            color: c.ink,
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
          backgroundColor: c.track,
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
  const { c } = useUi2Theme();
  const totalTint = scoreTint(grade.totalScore);

  return (
    <SlabCard style={{ padding: 20 }}>
      {/* Total score */}
      <SlabCard tint={totalTint} style={{ alignItems: 'center', marginBottom: 20 }}>
        <Text
          style={{
            color: c.ink,
            fontSize: 48,
            fontFamily: 'Nunito_800ExtraBold',
          }}
          accessibilityLabel={`Total score: ${grade.totalScore} out of 100`}
        >
          {grade.totalScore}
        </Text>
        <Text
          style={{
            color: c.muted,
            fontSize: 13,
            fontFamily: 'Nunito_500Medium',
          }}
        >
          / 100
        </Text>
      </SlabCard>

      {/* Rubric bars */}
      <RubricBar label="Participation" score={grade.participation} max={25} />
      <RubricBar label="Language Usage" score={grade.languageUsage} max={25} />
      <RubricBar label="Grammar & Vocabulary" score={grade.grammarVocabulary} max={25} />
      <RubricBar label="Duration" score={grade.durationCompliance} max={25} />

      {/* Summary */}
      {grade.summary ? (
        <Text
          style={{
            color: c.muted,
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
              color: c.ink,
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
                color={c.green}
                style={{ marginTop: 6, marginRight: 8 }}
              />
              <Text
                style={{
                  color: c.ink,
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
              color: c.ink,
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
                color={c.yellow}
                style={{ marginTop: 6, marginRight: 8 }}
              />
              <Text
                style={{
                  color: c.ink,
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
    </SlabCard>
  );
}
