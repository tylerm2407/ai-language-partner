import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
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
import { GradientBackground } from '../../../components/ui/GradientBackground';
import { GlassSurface } from '../../../components/ui/GlassSurface';
import { GradientButton } from '../../../components/ui/GradientButton';
import { SUPPORTED_LANGUAGES } from '../../../config/app';
import { useAuth } from '../../../hooks/useAuth';
import { useClassManagement } from '../../../hooks/useClassManagement';
import type { LanguageCode, ProficiencyLevel } from '../../../types';
import { colors } from '../../../config/theme';

const LEVELS: { value: ProficiencyLevel; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'elementary', label: 'Elementary' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'upper_intermediate', label: 'Upper Int.' },
  { value: 'advanced', label: 'Advanced' },
];

export default function CreateClassScreen() {
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
    <GradientBackground>
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
            <Ionicons name="chevron-back" size={24} color="#818CF8" />
            <Text
              className="text-base text-primary ml-1"
              style={{ fontFamily: 'Nunito_600SemiBold' }}
            >
              Back
            </Text>
          </Pressable>

          <Text
            className="text-[28px] text-text-primary mb-6"
            style={{ fontFamily: 'Nunito_800ExtraBold' }}
            accessibilityRole="header"
          >
            Create Class
          </Text>

          {/* Class Name */}
          <Text
            className="text-sm text-text-secondary mb-2"
            style={{ fontFamily: 'Nunito_600SemiBold' }}
          >
            Class Name *
          </Text>
          <GlassSurface style={{ marginBottom: 20 }} innerStyle={{ padding: 0 }}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Spanish 101"
              placeholderTextColor="#64748B"
              style={{
                color: '#F1F5F9',
                fontSize: 16,
                fontFamily: 'Nunito_400Regular',
                padding: 14,
              }}
              accessibilityLabel="Class name input"
            />
          </GlassSurface>

          {/* Language Picker */}
          <Text
            className="text-sm text-text-secondary mb-2"
            style={{ fontFamily: 'Nunito_600SemiBold' }}
          >
            Target Language
          </Text>
          <Pressable
            onPress={() => setShowLanguagePicker(true)}
            accessibilityRole="button"
            accessibilityLabel={`Select language, currently ${selectedLang?.name ?? language}`}
          >
            <GlassSurface style={{ marginBottom: 20 }} innerStyle={{ padding: 14 }}>
              <View className="flex-row items-center justify-between">
                <Text
                  className="text-base text-text-primary"
                  style={{ fontFamily: 'Nunito_400Regular' }}
                >
                  {selectedLang ? `${selectedLang.flag} ${selectedLang.name}` : language}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#64748B" />
              </View>
            </GlassSurface>
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
                  backgroundColor: '#151921',
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
                            ? 'rgba(168, 85, 247, 0.15)'
                            : 'transparent',
                        borderRadius: 12,
                      }}
                    >
                      <Text
                        style={{
                          color: lang.code === language ? '#A855F7' : '#F1F5F9',
                          fontSize: 16,
                          fontFamily: 'Nunito_500Medium',
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
            className="text-sm text-text-secondary mb-2"
            style={{ fontFamily: 'Nunito_600SemiBold' }}
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
                      ? 'rgba(168, 85, 247, 0.2)'
                      : colors.surface.cardAlt,
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
                    fontFamily: 'Nunito_600SemiBold',
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
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderRadius: 12,
                padding: 12,
                gap: 8,
              }}
            >
              <Ionicons name="warning-outline" size={18} color="#EF4444" />
              <Text
                className="text-sm flex-1"
                style={{ color: '#EF4444', fontFamily: 'Nunito_500Medium' }}
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
                  style={{ color: '#818CF8', fontSize: 13, fontFamily: 'Nunito_600SemiBold' }}
                >
                  Retry
                </Text>
              </Pressable>
            </View>
          )}

          {/* Create Button */}
          <GradientButton
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
          <GlassSurface
            style={{ width: '85%' }}
            innerStyle={{ padding: 28, alignItems: 'center' }}
          >
            <Ionicons name="checkmark-circle" size={48} color="#22C55E" />
            <Text
              className="text-xl text-text-primary mt-4 mb-2"
              style={{ fontFamily: 'Nunito_700Bold' }}
            >
              Class Created
            </Text>
            <Text
              className="text-sm text-text-secondary mb-4 text-center"
              style={{ fontFamily: 'Nunito_400Regular' }}
            >
              Share this invite code with your students
            </Text>
            <View
              style={{
                backgroundColor: 'rgba(168, 85, 247, 0.15)',
                paddingVertical: 16,
                paddingHorizontal: 32,
                borderRadius: 14,
                marginBottom: 20,
              }}
            >
              <Text
                style={{
                  color: '#A855F7',
                  fontSize: 28,
                  fontFamily: 'Nunito_800ExtraBold',
                  letterSpacing: 4,
                }}
              >
                {inviteCode}
              </Text>
            </View>
            <GradientButton
              label="Done"
              onPress={() => {
                setInviteCode(null);
                goBack();
              }}
              accessibilityHint="Close and go back to classes"
            />
          </GlassSurface>
        </View>
      </Modal>
    </GradientBackground>
  );
}
