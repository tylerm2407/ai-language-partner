import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AvatarConfig } from '../../types';
import { Avatar } from './Avatar';
import { SKIN_TONES, HAIR_COLORS, EYE_COLORS, DEFAULT_AVATAR_CONFIG } from './constants';

interface AvatarCustomizerProps {
  visible: boolean;
  onClose: () => void;
  initialConfig: AvatarConfig;
  onSave: (config: AvatarConfig) => void;
}

type TabKey = 'head' | 'hair' | 'eyes' | 'mouth' | 'accessories';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'head', label: 'Head' },
  { key: 'hair', label: 'Hair' },
  { key: 'eyes', label: 'Eyes' },
  { key: 'mouth', label: 'Mouth' },
  { key: 'accessories', label: 'Accessories' },
];

const HEAD_SHAPES: AvatarConfig['headShape'][] = ['round', 'oval', 'square'];
const HAIR_STYLES: AvatarConfig['hairStyle'][] = ['short', 'medium', 'long', 'buzz', 'curly', 'ponytail', 'none'];
const EYE_STYLES: AvatarConfig['eyeStyle'][] = ['round', 'almond', 'wide', 'narrow'];
const MOUTH_STYLES: AvatarConfig['mouthStyle'][] = ['smile', 'neutral', 'grin', 'small'];

export const AvatarCustomizer = React.memo(
  ({ visible, onClose, initialConfig, onSave }: AvatarCustomizerProps) => {
    const [config, setConfig] = useState<AvatarConfig>(initialConfig);
    const [activeTab, setActiveTab] = useState<TabKey>('head');

    // Reset config when modal opens with new initialConfig
    React.useEffect(() => {
      if (visible) {
        setConfig(initialConfig);
        setActiveTab('head');
      }
    }, [visible, initialConfig]);

    const updateConfig = useCallback((partial: Partial<AvatarConfig>) => {
      setConfig(prev => ({ ...prev, ...partial }));
    }, []);

    const handleSave = useCallback(() => {
      onSave(config);
    }, [config, onSave]);

    const renderColorSwatches = (
      colors: readonly string[],
      selected: string,
      onSelect: (color: string) => void
    ) => (
      <View style={styles.swatchRow}>
        {colors.map(color => (
          <Pressable
            key={color}
            style={[
              styles.swatch,
              { backgroundColor: color },
              selected === color && styles.swatchSelected,
            ]}
            onPress={() => onSelect(color)}
            accessibilityLabel={`Color ${color}`}
            accessibilityRole="button"
          />
        ))}
      </View>
    );

    const renderOptionCards = <T extends string>(
      options: readonly T[],
      selected: T,
      onSelect: (val: T) => void
    ) => (
      <View style={styles.optionGrid}>
        {options.map(option => (
          <Pressable
            key={option}
            style={[
              styles.optionCard,
              selected === option && styles.optionCardSelected,
            ]}
            onPress={() => onSelect(option)}
            accessibilityLabel={`Select ${option}`}
            accessibilityRole="button"
          >
            <Text style={styles.optionCardText}>
              {option.charAt(0).toUpperCase() + option.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>
    );

    const renderTabContent = () => {
      switch (activeTab) {
        case 'head':
          return (
            <View>
              <Text style={styles.sectionLabel}>Head Shape</Text>
              {renderOptionCards(HEAD_SHAPES, config.headShape, val =>
                updateConfig({ headShape: val })
              )}
              <Text style={styles.sectionLabel}>Skin Tone</Text>
              {renderColorSwatches(SKIN_TONES, config.skinTone, color =>
                updateConfig({ skinTone: color })
              )}
            </View>
          );
        case 'hair':
          return (
            <View>
              <Text style={styles.sectionLabel}>Hair Style</Text>
              {renderOptionCards(HAIR_STYLES, config.hairStyle, val =>
                updateConfig({ hairStyle: val })
              )}
              <Text style={styles.sectionLabel}>Hair Color</Text>
              {renderColorSwatches(HAIR_COLORS, config.hairColor, color =>
                updateConfig({ hairColor: color })
              )}
            </View>
          );
        case 'eyes':
          return (
            <View>
              <Text style={styles.sectionLabel}>Eye Style</Text>
              {renderOptionCards(EYE_STYLES, config.eyeStyle, val =>
                updateConfig({ eyeStyle: val })
              )}
              <Text style={styles.sectionLabel}>Eye Color</Text>
              {renderColorSwatches(EYE_COLORS, config.eyeColor, color =>
                updateConfig({ eyeColor: color })
              )}
            </View>
          );
        case 'mouth':
          return (
            <View>
              <Text style={styles.sectionLabel}>Mouth Style</Text>
              {renderOptionCards(MOUTH_STYLES, config.mouthStyle, val =>
                updateConfig({ mouthStyle: val })
              )}
            </View>
          );
        case 'accessories':
          return (
            <View>
              <Text style={styles.sectionLabel}>Accessories</Text>
              <Text style={styles.placeholderText}>
                Accessories will appear here as you unlock them through achievements, streaks, and levels.
              </Text>
            </View>
          );
        default:
          return null;
      }
    };

    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={onClose}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Customize Avatar</Text>
            </View>

            {/* Avatar Preview */}
            <View style={styles.previewContainer}>
              <View style={styles.previewCircle}>
                <Avatar config={config} size="large" expression="neutral" animated />
              </View>
            </View>

            {/* Tab Bar */}
            <View style={styles.tabBar}>
              {TABS.map(tab => (
                <Pressable
                  key={tab.key}
                  style={[
                    styles.tab,
                    activeTab === tab.key && styles.tabActive,
                  ]}
                  onPress={() => setActiveTab(tab.key)}
                  accessibilityLabel={`${tab.label} tab`}
                  accessibilityRole="tab"
                >
                  <Text
                    style={[
                      styles.tabText,
                      activeTab === tab.key && styles.tabTextActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Tab Content */}
            <ScrollView
              style={styles.content}
              contentContainerStyle={styles.contentInner}
              showsVerticalScrollIndicator={false}
            >
              {renderTabContent()}
            </ScrollView>

            {/* Bottom Buttons */}
            <View style={styles.buttonRow}>
              <Pressable
                style={styles.cancelButton}
                onPress={onClose}
                accessibilityLabel="Cancel customization"
                accessibilityRole="button"
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.saveButton}
                onPress={handleSave}
                accessibilityLabel="Save avatar"
                accessibilityRole="button"
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }
);

AvatarCustomizer.displayName = 'AvatarCustomizer';

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0C0F14',
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  previewContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  previewCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#151921',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#38BDF8',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#38BDF8',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 12,
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchSelected: {
    borderColor: '#38BDF8',
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionCard: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#151921',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionCardSelected: {
    borderColor: '#38BDF8',
  },
  optionCardText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  placeholderText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    paddingVertical: 32,
  },
  buttonRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#151921',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  saveButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#A855F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
