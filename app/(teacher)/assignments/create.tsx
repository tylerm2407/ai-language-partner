import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GradientBackground } from '../../../components/ui/GradientBackground';
import { GlassSurface } from '../../../components/ui/GlassSurface';
import { GradientButton } from '../../../components/ui/GradientButton';
import { useSchoolStore } from '../../../stores/useSchoolStore';
import type { ProficiencyLevel, LanguageCode, Classroom } from '../../../types';

// ─── Scenarios ──────────────────────────────────────────────────
interface Scenario {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
  systemContext: string;
}

const SCENARIOS: Scenario[] = [
  {
    key: 'restaurant',
    label: 'Restaurant',
    icon: 'restaurant',
    description: 'Practice ordering food and asking about menu items.',
    systemContext:
      'Simulate a restaurant waiter. Present menu items, ask preferences, handle allergy questions.',
  },
  {
    key: 'job_interview',
    label: 'Job Interview',
    icon: 'briefcase',
    description: 'Introduce yourself and answer common interview questions.',
    systemContext:
      'Simulate an interviewer. Ask about experience, strengths, weaknesses.',
  },
  {
    key: 'directions',
    label: 'Directions',
    icon: 'navigate',
    description: 'Ask for and give directions to a destination.',
    systemContext:
      'Simulate a helpful local giving directions using landmarks.',
  },
  {
    key: 'shopping',
    label: 'Shopping',
    icon: 'cart',
    description: 'Shop for clothes, electronics, or groceries.',
    systemContext:
      'Simulate a shop assistant helping a customer find and buy items.',
  },
  {
    key: 'making_friends',
    label: 'Making Friends',
    icon: 'people',
    description: 'Meet someone new and have a casual conversation.',
    systemContext:
      'Simulate meeting a new person. Ask about hobbies, hometown, interests.',
  },
  {
    key: 'doctor',
    label: 'Doctor',
    icon: 'medkit',
    description: 'Describe symptoms and understand medical advice.',
    systemContext:
      'Simulate a doctor visit. Ask about symptoms, suggest treatments.',
  },
  {
    key: 'phone_call',
    label: 'Phone Call',
    icon: 'call',
    description: 'Make reservations, inquiries, or appointments by phone.',
    systemContext:
      'Simulate a phone call scenario for making reservations or appointments.',
  },
  {
    key: 'airport_hotel',
    label: 'Airport / Hotel',
    icon: 'airplane',
    description: 'Check in, ask about facilities, handle travel situations.',
    systemContext:
      'Simulate airport check-in or hotel front desk interactions.',
  },
  {
    key: 'free_chat',
    label: 'Free Chat',
    icon: 'chatbubbles',
    description: 'Open conversation on any topic.',
    systemContext: 'Have a free conversation on any topic the student chooses.',
  },
];

const DURATION_OPTIONS = [5, 10, 15, 20, 30] as const;

const MODES: { value: 'text' | 'voice' | 'either'; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'voice', label: 'Voice' },
  { value: 'either', label: 'Either' },
];

const LEVELS: { value: ProficiencyLevel; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'elementary', label: 'Elementary' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'upper_intermediate', label: 'Upper Int.' },
  { value: 'advanced', label: 'Advanced' },
];

export default function CreateAssignmentScreen() {
  const router = useRouter();
  const { classrooms } = useSchoolStore();

  // Form state
  const [selectedClassId, setSelectedClassId] = useState<string>(
    classrooms[0]?.id ?? '',
  );
  const [title, setTitle] = useState('');
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [customLabel, setCustomLabel] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [customContext, setCustomContext] = useState('');
  const [level, setLevel] = useState<ProficiencyLevel>(
    classrooms[0]?.level ?? 'beginner',
  );
  const [targetLanguage, setTargetLanguage] = useState<LanguageCode>(
    classrooms[0]?.targetLanguage ?? 'es',
  );
  const [minDuration, setMinDuration] = useState<number>(10);
  const [mode, setMode] = useState<'text' | 'voice' | 'either'>('either');
  const [vocabFocus, setVocabFocus] = useState('');
  const [grammarFocus, setGrammarFocus] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [showClassPicker, setShowClassPicker] = useState(false);

  const selectedClass = classrooms.find((c) => c.id === selectedClassId);

  const handleClassSelect = (c: Classroom) => {
    setSelectedClassId(c.id);
    setLevel(c.level);
    setTargetLanguage(c.targetLanguage);
    setShowClassPicker(false);
  };

  const handlePublish = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter an assignment title.');
      return;
    }
    if (!selectedScenario) {
      Alert.alert('Required', 'Please select a scenario.');
      return;
    }
    setLoading(true);
    try {
      // TODO: call createAssignment from useAssignmentBuilder hook
      Alert.alert('Published', 'Assignment has been published.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to publish';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter an assignment title.');
      return;
    }
    // TODO: save as draft
    Alert.alert('Saved', 'Draft saved.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  return (
    <GradientBackground>
      <SafeAreaView className="flex-1" edges={['top']}>
        <ScrollView
          className="flex-1 px-4 pt-2"
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Back + Header */}
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="flex-row items-center mb-4"
          >
            <Ionicons name="chevron-back" size={24} color="#38BDF8" />
            <Text
              className="text-base text-primary ml-1"
              style={{ fontFamily: 'Inter_600SemiBold' }}
            >
              Back
            </Text>
          </Pressable>

          <Text
            className="text-[28px] text-text-primary mb-6"
            style={{ fontFamily: 'Inter_700Bold' }}
            accessibilityRole="header"
          >
            Create Assignment
          </Text>

          {/* Class Selector */}
          {classrooms.length > 1 && (
            <>
              <Text
                className="text-sm text-text-secondary mb-2"
                style={{ fontFamily: 'Inter_600SemiBold' }}
              >
                Class
              </Text>
              <Pressable
                onPress={() => setShowClassPicker(true)}
                accessibilityRole="button"
                accessibilityLabel={`Select class, currently ${selectedClass?.name ?? 'none'}`}
              >
                <GlassSurface
                  style={{ marginBottom: 20 }}
                  innerStyle={{ padding: 14 }}
                >
                  <View className="flex-row items-center justify-between">
                    <Text
                      className="text-base text-text-primary"
                      style={{ fontFamily: 'Inter_400Regular' }}
                    >
                      {selectedClass?.name ?? 'Select a class'}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color="#64748B" />
                  </View>
                </GlassSurface>
              </Pressable>
            </>
          )}

          {/* Class Picker Modal */}
          <Modal
            visible={showClassPicker}
            transparent
            animationType="fade"
            onRequestClose={() => setShowClassPicker(false)}
          >
            <Pressable
              className="flex-1 justify-center items-center"
              style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
              onPress={() => setShowClassPicker(false)}
              accessibilityRole="button"
              accessibilityLabel="Close class picker"
            >
              <View
                style={{
                  backgroundColor: '#151921',
                  borderRadius: 18,
                  padding: 8,
                  width: '80%',
                  maxHeight: '50%',
                }}
              >
                <ScrollView>
                  {classrooms.map((c) => (
                    <Pressable
                      key={c.id}
                      onPress={() => handleClassSelect(c)}
                      accessibilityRole="button"
                      accessibilityLabel={c.name}
                      style={{
                        paddingVertical: 14,
                        paddingHorizontal: 16,
                        backgroundColor:
                          c.id === selectedClassId
                            ? 'rgba(168, 85, 247, 0.15)'
                            : 'transparent',
                        borderRadius: 12,
                      }}
                    >
                      <Text
                        style={{
                          color:
                            c.id === selectedClassId ? '#A855F7' : '#F1F5F9',
                          fontSize: 16,
                          fontFamily: 'Inter_500Medium',
                        }}
                      >
                        {c.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </Pressable>
          </Modal>

          {/* Title */}
          <Text
            className="text-sm text-text-secondary mb-2"
            style={{ fontFamily: 'Inter_600SemiBold' }}
          >
            Title *
          </Text>
          <GlassSurface style={{ marginBottom: 20 }} innerStyle={{ padding: 0 }}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Restaurant Conversation Practice"
              placeholderTextColor="#64748B"
              style={{
                color: '#F1F5F9',
                fontSize: 16,
                fontFamily: 'Inter_400Regular',
                padding: 14,
              }}
              accessibilityLabel="Assignment title"
            />
          </GlassSurface>

          {/* Scenario Picker */}
          <Text
            className="text-sm text-text-secondary mb-2"
            style={{ fontFamily: 'Inter_600SemiBold' }}
          >
            Scenario *
          </Text>
          <View className="flex-row flex-wrap mb-4" style={{ gap: 8 }}>
            {SCENARIOS.map((s) => (
              <Pressable
                key={s.key}
                onPress={() => setSelectedScenario(s.key)}
                accessibilityRole="button"
                accessibilityLabel={s.label}
                accessibilityState={{ selected: selectedScenario === s.key }}
                style={{
                  width: '30%',
                  minWidth: 95,
                  paddingVertical: 12,
                  paddingHorizontal: 8,
                  borderRadius: 14,
                  alignItems: 'center',
                  backgroundColor:
                    selectedScenario === s.key
                      ? 'rgba(168, 85, 247, 0.2)'
                      : 'rgba(30, 35, 50, 0.6)',
                  borderWidth: 1,
                  borderColor:
                    selectedScenario === s.key
                      ? '#A855F7'
                      : 'rgba(255, 255, 255, 0.08)',
                }}
              >
                <Ionicons
                  name={s.icon}
                  size={22}
                  color={selectedScenario === s.key ? '#A855F7' : '#64748B'}
                />
                <Text
                  style={{
                    color: selectedScenario === s.key ? '#A855F7' : '#94A3B8',
                    fontSize: 11,
                    fontFamily: 'Inter_600SemiBold',
                    marginTop: 6,
                    textAlign: 'center',
                  }}
                  numberOfLines={1}
                >
                  {s.label}
                </Text>
              </Pressable>
            ))}
            {/* Custom option */}
            <Pressable
              onPress={() => setSelectedScenario('custom')}
              accessibilityRole="button"
              accessibilityLabel="Custom scenario"
              accessibilityState={{ selected: selectedScenario === 'custom' }}
              style={{
                width: '30%',
                minWidth: 95,
                paddingVertical: 12,
                paddingHorizontal: 8,
                borderRadius: 14,
                alignItems: 'center',
                backgroundColor:
                  selectedScenario === 'custom'
                    ? 'rgba(168, 85, 247, 0.2)'
                    : 'rgba(30, 35, 50, 0.6)',
                borderWidth: 1,
                borderColor:
                  selectedScenario === 'custom'
                    ? '#A855F7'
                    : 'rgba(255, 255, 255, 0.08)',
              }}
            >
              <Ionicons
                name="create-outline"
                size={22}
                color={selectedScenario === 'custom' ? '#A855F7' : '#64748B'}
              />
              <Text
                style={{
                  color: selectedScenario === 'custom' ? '#A855F7' : '#94A3B8',
                  fontSize: 11,
                  fontFamily: 'Inter_600SemiBold',
                  marginTop: 6,
                  textAlign: 'center',
                }}
              >
                Custom
              </Text>
            </Pressable>
          </View>

          {/* Custom scenario fields */}
          {selectedScenario === 'custom' && (
            <View className="mb-4">
              <GlassSurface style={{ marginBottom: 10 }} innerStyle={{ padding: 0 }}>
                <TextInput
                  value={customLabel}
                  onChangeText={setCustomLabel}
                  placeholder="Scenario label"
                  placeholderTextColor="#64748B"
                  style={{
                    color: '#F1F5F9',
                    fontSize: 15,
                    fontFamily: 'Inter_400Regular',
                    padding: 14,
                  }}
                  accessibilityLabel="Custom scenario label"
                />
              </GlassSurface>
              <GlassSurface style={{ marginBottom: 10 }} innerStyle={{ padding: 0 }}>
                <TextInput
                  value={customDescription}
                  onChangeText={setCustomDescription}
                  placeholder="Description for students"
                  placeholderTextColor="#64748B"
                  multiline
                  style={{
                    color: '#F1F5F9',
                    fontSize: 15,
                    fontFamily: 'Inter_400Regular',
                    padding: 14,
                    minHeight: 60,
                  }}
                  accessibilityLabel="Custom scenario description"
                />
              </GlassSurface>
              <GlassSurface style={{ marginBottom: 10 }} innerStyle={{ padding: 0 }}>
                <TextInput
                  value={customContext}
                  onChangeText={setCustomContext}
                  placeholder="System context (AI instructions)"
                  placeholderTextColor="#64748B"
                  multiline
                  style={{
                    color: '#F1F5F9',
                    fontSize: 15,
                    fontFamily: 'Inter_400Regular',
                    padding: 14,
                    minHeight: 80,
                  }}
                  accessibilityLabel="Custom scenario system context"
                />
              </GlassSurface>
            </View>
          )}

          {/* Level */}
          <Text
            className="text-sm text-text-secondary mb-2"
            style={{ fontFamily: 'Inter_600SemiBold' }}
          >
            Level
          </Text>
          <View className="flex-row flex-wrap mb-4" style={{ gap: 8 }}>
            {LEVELS.map((lvl) => (
              <Pressable
                key={lvl.value}
                onPress={() => setLevel(lvl.value)}
                accessibilityRole="button"
                accessibilityLabel={lvl.label}
                accessibilityState={{ selected: level === lvl.value }}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  backgroundColor:
                    level === lvl.value
                      ? 'rgba(168, 85, 247, 0.2)'
                      : 'rgba(30, 35, 50, 0.6)',
                  borderWidth: 1,
                  borderColor:
                    level === lvl.value
                      ? '#A855F7'
                      : 'rgba(255, 255, 255, 0.1)',
                }}
              >
                <Text
                  style={{
                    color: level === lvl.value ? '#A855F7' : '#94A3B8',
                    fontSize: 13,
                    fontFamily: 'Inter_600SemiBold',
                  }}
                >
                  {lvl.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Minimum Duration */}
          <Text
            className="text-sm text-text-secondary mb-2"
            style={{ fontFamily: 'Inter_600SemiBold' }}
          >
            Minimum Duration
          </Text>
          <View className="flex-row mb-4" style={{ gap: 8 }}>
            {DURATION_OPTIONS.map((d) => (
              <Pressable
                key={d}
                onPress={() => setMinDuration(d)}
                accessibilityRole="button"
                accessibilityLabel={`${d} minutes`}
                accessibilityState={{ selected: minDuration === d }}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  backgroundColor:
                    minDuration === d
                      ? 'rgba(56, 189, 248, 0.2)'
                      : 'rgba(30, 35, 50, 0.6)',
                  borderWidth: 1,
                  borderColor:
                    minDuration === d
                      ? '#38BDF8'
                      : 'rgba(255, 255, 255, 0.1)',
                }}
              >
                <Text
                  style={{
                    color: minDuration === d ? '#38BDF8' : '#94A3B8',
                    fontSize: 13,
                    fontFamily: 'Inter_600SemiBold',
                  }}
                >
                  {d} min
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Mode */}
          <Text
            className="text-sm text-text-secondary mb-2"
            style={{ fontFamily: 'Inter_600SemiBold' }}
          >
            Mode
          </Text>
          <View
            className="flex-row mb-4"
            style={{
              backgroundColor: 'rgba(30, 35, 50, 0.6)',
              borderRadius: 12,
              padding: 3,
            }}
          >
            {MODES.map((m) => (
              <Pressable
                key={m.value}
                onPress={() => setMode(m.value)}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === m.value }}
                accessibilityLabel={m.label}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 10,
                  alignItems: 'center',
                  backgroundColor:
                    mode === m.value
                      ? 'rgba(168, 85, 247, 0.2)'
                      : 'transparent',
                }}
              >
                <Text
                  style={{
                    color: mode === m.value ? '#A855F7' : '#94A3B8',
                    fontSize: 14,
                    fontFamily: 'Inter_600SemiBold',
                  }}
                >
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Vocabulary Focus */}
          <Text
            className="text-sm text-text-secondary mb-2"
            style={{ fontFamily: 'Inter_600SemiBold' }}
          >
            Vocabulary Focus (comma-separated)
          </Text>
          <GlassSurface style={{ marginBottom: 16 }} innerStyle={{ padding: 0 }}>
            <TextInput
              value={vocabFocus}
              onChangeText={setVocabFocus}
              placeholder="e.g. menu, allergy, reservation"
              placeholderTextColor="#64748B"
              style={{
                color: '#F1F5F9',
                fontSize: 15,
                fontFamily: 'Inter_400Regular',
                padding: 14,
              }}
              accessibilityLabel="Vocabulary focus"
            />
          </GlassSurface>

          {/* Grammar Focus */}
          <Text
            className="text-sm text-text-secondary mb-2"
            style={{ fontFamily: 'Inter_600SemiBold' }}
          >
            Grammar Focus (comma-separated)
          </Text>
          <GlassSurface style={{ marginBottom: 16 }} innerStyle={{ padding: 0 }}>
            <TextInput
              value={grammarFocus}
              onChangeText={setGrammarFocus}
              placeholder="e.g. conditional tense, polite requests"
              placeholderTextColor="#64748B"
              style={{
                color: '#F1F5F9',
                fontSize: 15,
                fontFamily: 'Inter_400Regular',
                padding: 14,
              }}
              accessibilityLabel="Grammar focus"
            />
          </GlassSurface>

          {/* Instructions */}
          <Text
            className="text-sm text-text-secondary mb-2"
            style={{ fontFamily: 'Inter_600SemiBold' }}
          >
            Instructions
          </Text>
          <GlassSurface style={{ marginBottom: 16 }} innerStyle={{ padding: 0 }}>
            <TextInput
              value={instructions}
              onChangeText={setInstructions}
              placeholder="Additional instructions for students..."
              placeholderTextColor="#64748B"
              multiline
              style={{
                color: '#F1F5F9',
                fontSize: 15,
                fontFamily: 'Inter_400Regular',
                padding: 14,
                minHeight: 80,
              }}
              accessibilityLabel="Assignment instructions"
            />
          </GlassSurface>

          {/* Due Date */}
          <Text
            className="text-sm text-text-secondary mb-2"
            style={{ fontFamily: 'Inter_600SemiBold' }}
          >
            Due Date
          </Text>
          <GlassSurface style={{ marginBottom: 24 }} innerStyle={{ padding: 0 }}>
            <TextInput
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#64748B"
              style={{
                color: '#F1F5F9',
                fontSize: 15,
                fontFamily: 'Inter_400Regular',
                padding: 14,
              }}
              accessibilityLabel="Due date"
            />
          </GlassSurface>

          {/* Action Buttons */}
          <View className="flex-row" style={{ gap: 12 }}>
            <Pressable
              onPress={handleSaveDraft}
              accessibilityRole="button"
              accessibilityLabel="Save as draft"
              style={{
                flex: 1,
                paddingVertical: 16,
                borderRadius: 14,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.15)',
                backgroundColor: 'rgba(30, 35, 50, 0.6)',
              }}
            >
              <Text
                style={{
                  color: '#94A3B8',
                  fontSize: 16,
                  fontFamily: 'Inter_600SemiBold',
                }}
              >
                Save Draft
              </Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <GradientButton
                label="Publish"
                onPress={handlePublish}
                loading={loading}
                disabled={!title.trim() || !selectedScenario}
                accessibilityHint="Publish assignment to students"
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}
