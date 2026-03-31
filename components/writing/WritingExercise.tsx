import { useState, useRef } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { WritingPrompt } from '../../types';

interface Props {
  prompt: WritingPrompt;
  isGrading: boolean;
  onSubmit: (text: string, wordCount: number, timeSpentMs: number) => void;
  onExit: () => void;
}

export function WritingExercise({ prompt, isGrading, onSubmit, onExit }: Props) {
  const [text, setText] = useState('');
  const startTimeRef = useRef(Date.now());

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const meetsMinWords = !prompt.minWords || wordCount >= prompt.minWords;
  const exceedsMaxWords = prompt.maxWords ? wordCount > prompt.maxWords : false;
  const canSubmit = text.trim().length > 0 && meetsMinWords && !exceedsMaxWords && !isGrading;

  const handleSubmit = () => {
    const timeSpentMs = Date.now() - startTimeRef.current;
    onSubmit(text.trim(), wordCount, timeSpentMs);
  };

  if (isGrading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={{ fontSize: 16, color: '#666', marginTop: 16 }}>Checking your writing...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable onPress={onExit} style={{ padding: 8, marginRight: 8 }} accessibilityRole="button" accessibilityLabel="Exit">
              <Text style={{ fontSize: 24, color: '#666' }}>x</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#6366F1' }}>Writing Practice</Text>
              <Text style={{ fontSize: 13, color: '#999' }}>{prompt.cefrLevel} | {prompt.promptType}</Text>
            </View>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          {/* Prompt */}
          <View style={{ backgroundColor: '#F9FAFB', borderRadius: 16, padding: 20, marginBottom: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#111', lineHeight: 26 }}>
              {prompt.promptText}
            </Text>
          </View>

          {/* Target Vocabulary Hints */}
          {prompt.targetVocabulary.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#666', marginBottom: 6 }}>
                Try to use these words:
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {prompt.targetVocabulary.map((word, i) => (
                  <View key={i} style={{ backgroundColor: '#E0E7FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 14, color: '#6366F1', fontWeight: '600' }}>{word}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Target Grammar Hints */}
          {prompt.targetGrammar.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#666', marginBottom: 6 }}>
                Grammar focus:
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {prompt.targetGrammar.map((grammar, i) => (
                  <View key={i} style={{ backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 14, color: '#666' }}>{grammar}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Text Input */}
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Start writing..."
            placeholderTextColor="#999"
            multiline
            style={{
              borderWidth: 2,
              borderColor: exceedsMaxWords ? '#EF4444' : '#D1D5DB',
              borderRadius: 14,
              paddingHorizontal: 16,
              paddingVertical: 12,
              fontSize: 16,
              minHeight: 200,
              textAlignVertical: 'top',
              color: '#111',
              lineHeight: 24,
            }}
            accessibilityLabel="Your writing"
          />

          {/* Word Count */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            <Text style={{
              fontSize: 13,
              color: exceedsMaxWords ? '#EF4444' : !meetsMinWords ? '#CA8A04' : '#999',
            }}>
              {wordCount} word{wordCount !== 1 ? 's' : ''}
              {prompt.minWords ? ` (min ${prompt.minWords})` : ''}
              {prompt.maxWords ? ` (max ${prompt.maxWords})` : ''}
            </Text>
          </View>
        </ScrollView>

        {/* Submit Button */}
        <View style={{ padding: 20, borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={{
              backgroundColor: canSubmit ? '#6366F1' : '#C7D2FE',
              paddingVertical: 16,
              borderRadius: 14,
              alignItems: 'center',
            }}
            accessibilityRole="button"
            accessibilityLabel="Submit writing"
          >
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>Submit</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
