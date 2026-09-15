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
import { SUPPORTED_LANGUAGES } from '../../../config/app';
import { useAuth } from '../../../hooks/useAuth';
import { useClassManagement } from '../../../hooks/useClassManagement';
import type { LanguageCode, ProficiencyLevel } from '../../../types';
// `colors` is deliberately not imported: it is the fixed DARK palette, and a
// screen that reads it stays dark whatever the phone is set to.
import { useUi2Theme } from '../../../hooks/useUi2Theme';

const LEVELS: { value: ProficiencyLevel; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'elementary', label: 'Elementary' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'upper_intermediate', label: 'Upper Int.' },
  { value: 'advanced', label: 'Advanced' },
];

export default function CreateClassScreen() {
  const { c } = useUi2Theme();
  const goBack = useSafeBack('/(teacher)');
  const { user } = useAuth();
  const { createClass, loading, error } = useClassManagement(user?.id);
  const [name, setName] = useState('');
  const [language, setLanguage] = useState<LanguageCode>('es');
  const [level, setLevel] = useState<ProficiencyLevel>('beginner');
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

  const selectedLang = SUPPORTED_LANGUAGES.find((l) => l.code === language);

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a class name.');
      return;
    }
    const classroom = await createClass({
      name: name.trim(),
      targetLanguage: language,
      level,
    });
    if (classroom) {
      setInviteCode(classroom.inviteCode);
    }
    // On failure the hook sets `error`, rendered inline below with a retry.
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
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back button + header */}
          <Pressable
            onPress={() => goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="flex-row items-center mb-4"
          >
            <Ionicons name="chevron-back" size={24} color={c.primary} />
            <Text
              className="text-base ml-1"
              style={{ fontFamily: 'Manrope_600SemiBold', color: c.primary }}
            >
              Back
            </Text>
          </Pressable>

          <Text
            className="text-[28px] mb-6"
            style={{ fontFamily: 'Manrope_800ExtraBold', color: c.ink }}
            accessibilityRole="header"
          >
            Create Class
          </Text>

          {/* Class Name */}
          <Text
            className="text-sm mb-2"
            style={{ fontFamily: 'Manrope_600SemiBold', color: c.muted }}
          >
            Class Name *
          </Text>
          <Ui2Input
            containerStyle={{ marginBottom: 20 }}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Spanish 101"
            accessibilityLabel="Class name input"
          />

          {/* Language Picker */}
          <Text
            className="text-sm mb-2"
            style={{ fontFamily: 'Manrope_600SemiBold', color: c.muted }}
          >
            Target Language
          </Text>
          <Pressable
            onPress={() => setShowLanguagePicker(true)}
            accessibilityRole="button"
            accessibilityLabel={`Select language, currently ${selectedLang?.name ?? language}`}
          >
            <SlabCard style={{ marginBottom: 20, padding: 14 }}>
              <View className="flex-row items-center justify-between">
                <Text
                  className="text-base"
                  style={{ fontFamily: 'Manrope_400Regular', color: c.ink }}
                >
                  {selectedLang ? `${selectedLang.flag} ${selectedLang.name}` : language}
                </Text>
                <Ionicons name="chevron-down" size={18} color={c.idle} />
              </View>
            </SlabCard>
          </Pressable>

          {/* Language Picker Modal */}
          <Modal
            visible={showLanguagePicker}
            transparent
            animationType="fade"
            onRequestClose={() => setShowLanguagePicker(false)}
          >
            <Pressable
              className="flex-1 justify-center items-center"
              style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
              onPress={() => setShowLanguagePicker(false)}
              accessibilityRole="button"
              accessibilityLabel="Close language picker"
            >
              <View
                style={{
                  backgroundColor: c.card,
                  borderRadius: 18,
                  padding: 8,
                  width: '80%',
                  maxHeight: '60%',
                }}
              >
                <ScrollView>
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <Pressable
                      key={lang.code}
                      onPress={() => {
                        setLanguage(lang.code as LanguageCode);
                        setShowLanguagePicker(false);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={lang.name}
                      style={{
                        paddingVertical: 14,
                        paddingHorizontal: 16,
                        backgroundColor:
                          lang.code === language
                            ? c.primaryTint
                            : 'transparent',
                        borderRadius: 12,
                      }}
                    >
                      <Text
                        style={{
                          color: lang.code === language ? c.onTint : c.ink,
                          fontSize: 16,
                          fontFamily: 'Manrope_500Medium',
                        }}
                      >
                        {lang.flag} {lang.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </Pressable>
          </Modal>

          {/* Level Picker */}
          <Text
            className="text-sm mb-2"
            style={{ fontFamily: 'Manrope_600SemiBold', color: c.muted }}
          >
            Proficiency Level
          </Text>
          <View className="flex-row flex-wrap mb-6" style={{ gap: 8 }}>
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
                      ? c.primaryTint
                      : c.surface2,
                  borderWidth: 1,
                  borderColor:
                    level === lvl.value
                      ? c.primary
                      : c.cardBorder,
                }}
              >
                <Text
                  style={{
                    color: level === lvl.value ? c.onTint : c.muted,
                    fontSize: 13,
                    fontFamily: 'Manrope_600SemiBold',
                  }}
                >
                  {lvl.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Error state + retry */}
          {error && (
            <View
              className="flex-row items-center mb-4"
              style={{
                backgroundColor: c.pinkTint,
                borderRadius: 12,
                padding: 12,
                gap: 8,
              }}
            >
              <Ionicons name="warning-outline" size={18} color={c.error} />
              <Text
                className="text-sm flex-1"
                style={{ color: c.error, fontFamily: 'Manrope_500Medium' }}
              >
                {error}
              </Text>
              <Pressable
                onPress={handleCreate}
                accessibilityRole="button"
                accessibilityLabel="Retry creating class"
                style={{ paddingVertical: 4, paddingHorizontal: 8 }}
              >
                <Text
                  style={{ color: c.primary, fontSize: 13, fontFamily: 'Manrope_600SemiBold' }}
                >
                  Retry
                </Text>
              </Pressable>
            </View>
          )}

          {/* Create Button */}
          <SlabButton
            label="Create Class"
            onPress={handleCreate}
            loading={loading}
            disabled={!name.trim()}
            accessibilityHint="Create a new class with the selected settings"
          />
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Invite Code Modal */}
      <Modal
        visible={inviteCode !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setInviteCode(null);
          goBack();
        }}
      >
        <View
          className="flex-1 justify-center items-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
        >
          <SlabCard
            style={{ width: '85%', padding: 28, alignItems: 'center' }}
          >
            <Ionicons name="checkmark-circle" size={48} color={c.green} />
            <Text
              className="text-xl mt-4 mb-2"
              style={{ fontFamily: 'Manrope_700Bold', color: c.ink }}
            >
              Class Created
            </Text>
            <Text
              className="text-sm mb-4 text-center"
              style={{ fontFamily: 'Manrope_400Regular', color: c.muted }}
            >
              Share this invite code with your students
            </Text>
            <View
              style={{
                backgroundColor: c.primaryTint,
                paddingVertical: 16,
                paddingHorizontal: 32,
                borderRadius: 14,
                marginBottom: 20,
              }}
            >
              <Text
                style={{
                  color: c.onTint,
                  fontSize: 28,
                  fontFamily: 'Manrope_800ExtraBold',
                  letterSpacing: 4,
                }}
              >
                {inviteCode}
              </Text>
            </View>
            <SlabButton
              label="Done"
              onPress={() => {
                setInviteCode(null);
                goBack();
              }}
              accessibilityHint="Close and go back to classes"
            />
          </SlabCard>
        </View>
      </Modal>
    </View>
  );
}
