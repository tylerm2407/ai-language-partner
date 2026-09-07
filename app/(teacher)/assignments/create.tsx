import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSafeBack } from '../../../hooks/useSafeBack';
import { Ionicons } from '@expo/vector-icons';
import { SlabCard } from '../../../components/ui2/SlabCard';
import { SlabButton } from '../../../components/ui2/SlabButton';
import { Ui2Input } from '../../../components/ui2/Ui2Input';
import { scrimColor } from '../../../components/ui2/Ui2Sheet';
import { useSchoolStore } from '../../../stores/useSchoolStore';
import { useAssignmentBuilder, type AssignmentFormState } from '../../../hooks/useAssignmentBuilder';
import type { ProficiencyLevel, LanguageCode, Classroom } from '../../../types';
// `colors` is deliberately NOT imported: it is the fixed DARK palette. `ui2Shape`
// is a set of scheme-independent numbers and carries over unchanged.
import { ui2Shape } from '../../../config/theme';
import { useUi2Theme } from '../../../hooks/useUi2Theme';

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
  // `scheme` is destructured alongside `c` for the modal scrim: the scrim
  // colour inverts between schemes, so it cannot be a fixed rgba() — see the
  // header of components/ui2/Ui2Sheet.tsx.
  const { c, scheme } = useUi2Theme();
  const goBack = useSafeBack('/(teacher)');
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
  const [showClassPicker, setShowClassPicker] = useState(false);

  const { publish, saveDraft, loading, error } = useAssignmentBuilder();

  const selectedClass = classrooms.find((c) => c.id === selectedClassId);

  const parseList = (value: string): string[] =>
    value.split(',').map((s) => s.trim()).filter(Boolean);

  /** Collect the current form values; returns null (after alerting) if the due date is invalid. */
  const buildFormValues = (): Partial<AssignmentFormState> | null => {
    let dueAt: string | null = null;
    if (dueDate.trim()) {
      const parsed = new Date(dueDate.trim());
      if (Number.isNaN(parsed.getTime())) {
        Alert.alert('Invalid Date', 'Please enter the due date as YYYY-MM-DD.');
        return null;
      }
      dueAt = parsed.toISOString();
    }
    return {
      classroomId: selectedClassId,
      title: title.trim(),
      scenarioKey: selectedScenario === 'custom' ? null : selectedScenario,
      customScenario:
        selectedScenario === 'custom'
          ? {
              label: customLabel.trim(),
              description: customDescription.trim(),
              systemContext: customContext.trim(),
            }
          : null,
      targetLanguage,
      level,
      minDurationMinutes: minDuration,
      mode,
      vocabularyFocus: parseList(vocabFocus),
      grammarFocus: parseList(grammarFocus),
      instructions: instructions.trim(),
      dueAt,
    };
  };

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
    const values = buildFormValues();
    if (!values) return;
    const assignment = await publish(values);
    if (assignment) {
      Alert.alert('Published', 'Assignment has been published.', [
        { text: 'OK', onPress: () => goBack() },
      ]);
    }
    // On failure the hook sets `error`, rendered inline below with a retry.
  };

  const handleSaveDraft = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter an assignment title.');
      return;
    }
    const values = buildFormValues();
    if (!values) return;
    const assignment = await saveDraft(values);
    if (assignment) {
      Alert.alert('Saved', 'Draft saved.', [
        { text: 'OK', onPress: () => goBack() },
      ]);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
        <ScrollView
          className="flex-1 px-4 pt-2"
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back + Header */}
          <Pressable
            onPress={() => goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="flex-row items-center mb-4"
          >
            <Ionicons name="chevron-back" size={24} color={c.primary} />
            <Text
              className="text-base ml-1"
              style={{ fontFamily: 'Nunito_600SemiBold', color: c.primary }}
            >
              Back
            </Text>
          </Pressable>

          <Text
            className="text-[28px] mb-6"
            style={{ fontFamily: 'Nunito_800ExtraBold', color: c.ink }}
            accessibilityRole="header"
          >
            Create Assignment
          </Text>

          {/* Class Selector */}
          {classrooms.length > 1 && (
            <>
              <Text
                className="text-sm mb-2"
                style={{ fontFamily: 'Nunito_600SemiBold', color: c.muted }}
              >
                Class
              </Text>
              <Pressable
                onPress={() => setShowClassPicker(true)}
                accessibilityRole="button"
                accessibilityLabel={`Select class, currently ${selectedClass?.name ?? 'none'}`}
              >
                <SlabCard style={{ marginBottom: 20, padding: 14 }}>
                  <View className="flex-row items-center justify-between">
                    <Text
                      className="text-base"
                      style={{ fontFamily: 'Nunito_400Regular', color: c.ink }}
                    >
                      {selectedClass?.name ?? 'Select a class'}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={c.idle} />
                  </View>
                </SlabCard>
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
              // `8C` is 0.55 alpha. It has to live in the colour, not in an
              // `opacity` prop: this Pressable is the scrim AND the parent of
              // the picker card, and `opacity` would fade the card with it.
              style={{ backgroundColor: `${scrimColor(scheme, c)}8C` }}
              onPress={() => setShowClassPicker(false)}
              accessibilityRole="button"
              accessibilityLabel="Close class picker"
            >
              <View
                style={{
                  backgroundColor: c.card,
                  borderWidth: ui2Shape.border,
                  borderColor: c.cardBorder,
                  borderRadius: ui2Shape.radiusCard,
                  padding: 8,
                  width: '80%',
                  maxHeight: '50%',
                }}
              >
                <ScrollView>
                  {classrooms.map((room) => (
                    <Pressable
                      key={room.id}
                      onPress={() => handleClassSelect(room)}
                      accessibilityRole="button"
                      accessibilityLabel={room.name}
                      style={{
                        paddingVertical: 14,
                        paddingHorizontal: 16,
                        backgroundColor:
                          room.id === selectedClassId
                            ? c.primaryTint
                            : 'transparent',
                        borderRadius: 12,
                      }}
                    >
                      <Text
                        style={{
                          color:
                            room.id === selectedClassId ? c.onTint : c.ink,
                          fontSize: 16,
                          fontFamily: 'Nunito_500Medium',
                        }}
                      >
                        {room.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </Pressable>
          </Modal>

          {/* Title */}
          <Text
            className="text-sm mb-2"
            style={{ fontFamily: 'Nunito_600SemiBold', color: c.muted }}
          >
            Title *
          </Text>
          <Ui2Input
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Restaurant Conversation Practice"
            containerStyle={{ marginBottom: 20 }}
            accessibilityLabel="Assignment title"
          />

          {/* Scenario Picker */}
          <Text
            className="text-sm mb-2"
            style={{ fontFamily: 'Nunito_600SemiBold', color: c.muted }}
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
                    selectedScenario === s.key ? c.primaryTint : c.surface2,
                  borderWidth: ui2Shape.border,
                  borderColor:
                    selectedScenario === s.key ? c.primaryTintBorder : c.cardBorder,
                }}
              >
                <Ionicons
                  name={s.icon}
                  size={22}
                  color={selectedScenario === s.key ? c.onTint : c.idle}
                />
                <Text
                  style={{
                    color: selectedScenario === s.key ? c.onTint : c.muted,
                    fontSize: 11,
                    fontFamily: 'Nunito_600SemiBold',
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
                  selectedScenario === 'custom' ? c.primaryTint : c.surface2,
                borderWidth: ui2Shape.border,
                borderColor:
                  selectedScenario === 'custom' ? c.primaryTintBorder : c.cardBorder,
              }}
            >
              <Ionicons
                name="create-outline"
                size={22}
                color={selectedScenario === 'custom' ? c.onTint : c.idle}
              />
              <Text
                style={{
                  color: selectedScenario === 'custom' ? c.onTint : c.muted,
                  fontSize: 11,
                  fontFamily: 'Nunito_600SemiBold',
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
              <Ui2Input
                value={customLabel}
                onChangeText={setCustomLabel}
                placeholder="Scenario label"
                containerStyle={{ marginBottom: 10 }}
                accessibilityLabel="Custom scenario label"
              />
              <Ui2Input
                value={customDescription}
                onChangeText={setCustomDescription}
                placeholder="Description for students"
                multiline
                containerStyle={{ marginBottom: 10 }}
                accessibilityLabel="Custom scenario description"
              />
              <Ui2Input
                value={customContext}
                onChangeText={setCustomContext}
                placeholder="System context (AI instructions)"
                multiline
                containerStyle={{ marginBottom: 10 }}
                accessibilityLabel="Custom scenario system context"
              />
            </View>
          )}

          {/* Level */}
          <Text
            className="text-sm mb-2"
            style={{ fontFamily: 'Nunito_600SemiBold', color: c.muted }}
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
                    level === lvl.value ? c.primaryTint : c.surface2,
                  borderWidth: ui2Shape.border,
                  borderColor:
                    level === lvl.value ? c.primaryTintBorder : c.cardBorder,
                }}
              >
                <Text
                  style={{
                    color: level === lvl.value ? c.onTint : c.muted,
                    fontSize: 13,
                    fontFamily: 'Nunito_600SemiBold',
                  }}
                >
                  {lvl.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Minimum Duration */}
          <Text
            className="text-sm mb-2"
            style={{ fontFamily: 'Nunito_600SemiBold', color: c.muted }}
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
                    minDuration === d ? c.primaryTint : c.surface2,
                  borderWidth: ui2Shape.border,
                  borderColor:
                    minDuration === d ? c.primaryTintBorder : c.cardBorder,
                }}
              >
                <Text
                  style={{
                    color: minDuration === d ? c.onTint : c.muted,
                    fontSize: 13,
                    fontFamily: 'Nunito_600SemiBold',
                  }}
                >
                  {d} min
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Mode */}
          <Text
            className="text-sm mb-2"
            style={{ fontFamily: 'Nunito_600SemiBold', color: c.muted }}
          >
            Mode
          </Text>
          <View
            className="flex-row mb-4"
            style={{
              backgroundColor: c.surface2,
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
                    mode === m.value ? c.primaryTint : 'transparent',
                }}
              >
                <Text
                  style={{
                    color: mode === m.value ? c.onTint : c.muted,
                    fontSize: 14,
                    fontFamily: 'Nunito_600SemiBold',
                  }}
                >
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Vocabulary Focus */}
          <Text
            className="text-sm mb-2"
            style={{ fontFamily: 'Nunito_600SemiBold', color: c.muted }}
          >
            Vocabulary Focus (comma-separated)
          </Text>
          <Ui2Input
            value={vocabFocus}
            onChangeText={setVocabFocus}
            placeholder="e.g. menu, allergy, reservation"
            containerStyle={{ marginBottom: 16 }}
            accessibilityLabel="Vocabulary focus"
          />

          {/* Grammar Focus */}
          <Text
            className="text-sm mb-2"
            style={{ fontFamily: 'Nunito_600SemiBold', color: c.muted }}
          >
            Grammar Focus (comma-separated)
          </Text>
          <Ui2Input
            value={grammarFocus}
            onChangeText={setGrammarFocus}
            placeholder="e.g. conditional tense, polite requests"
            containerStyle={{ marginBottom: 16 }}
            accessibilityLabel="Grammar focus"
          />

          {/* Instructions */}
          <Text
            className="text-sm mb-2"
            style={{ fontFamily: 'Nunito_600SemiBold', color: c.muted }}
          >
            Instructions
          </Text>
          <Ui2Input
            value={instructions}
            onChangeText={setInstructions}
            placeholder="Additional instructions for students..."
            multiline
            containerStyle={{ marginBottom: 16 }}
            accessibilityLabel="Assignment instructions"
          />

          {/* Due Date */}
          <Text
            className="text-sm mb-2"
            style={{ fontFamily: 'Nunito_600SemiBold', color: c.muted }}
          >
            Due Date
          </Text>
          <Ui2Input
            value={dueDate}
            onChangeText={setDueDate}
            placeholder="YYYY-MM-DD"
            containerStyle={{ marginBottom: 24 }}
            accessibilityLabel="Due date"
          />

          {/* Error state + retry via the action buttons */}
          {error && (
            <View
              className="flex-row items-center mb-4"
              style={{
                backgroundColor: c.card,
                borderWidth: ui2Shape.border,
                borderColor: c.error,
                borderRadius: 12,
                padding: 12,
                gap: 8,
              }}
            >
              <Ionicons name="warning-outline" size={18} color={c.error} />
              <Text
                className="text-sm flex-1"
                style={{ color: c.error, fontFamily: 'Nunito_500Medium' }}
              >
                {error}
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View className="flex-row" style={{ gap: 12 }}>
            <Pressable
              onPress={handleSaveDraft}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Save as draft"
              style={{
                opacity: loading ? 0.5 : 1,
                flex: 1,
                paddingVertical: 16,
                borderRadius: 14,
                alignItems: 'center',
                borderWidth: ui2Shape.border,
                borderColor: c.cardBorder,
                backgroundColor: c.surface2,
              }}
            >
              <Text
                style={{
                  color: c.muted,
                  fontSize: 16,
                  fontFamily: 'Nunito_600SemiBold',
                }}
              >
                Save Draft
              </Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <SlabButton
                label="Publish"
                onPress={handlePublish}
                loading={loading}
                disabled={!title.trim() || !selectedScenario}
                accessibilityHint="Publish assignment to students"
              />
            </View>
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
