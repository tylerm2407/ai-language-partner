/**
 * Name and avatar. IKEA effect (DESIGN.md §UX Psychology Principles #4): the
 * learner builds something of their own before the sign-up gate, so leaving
 * means abandoning it rather than skipping a form.
 */
import { Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useUi2Theme } from '../../../hooks/useUi2Theme';
import { presetUrlFromId, type AvatarPreset } from '../../../lib/avatar-presets';
import { Avatar } from '../../avatar/Avatar';
import { AvatarPresetPicker } from '../../avatar/AvatarPresetPicker';
import { SlabButton } from '../../ui2/SlabButton';
import { SlabCard } from '../../ui2/SlabCard';
import { stepStyles, type StepFrame } from './bits';
import { DISPLAY_NAME_MAX_CHARS } from './config';

export function IdentityStep({
  frame,
  languageName,
  displayName,
  onChangeName,
  avatarPresetId,
  onPickAvatar,
  pickerOpen,
  onPickerOpen,
  onPickerClose,
}: {
  frame: StepFrame;
  languageName: string;
  displayName: string;
  onChangeName: (name: string) => void;
  avatarPresetId: string | null;
  onPickAvatar: (preset: AvatarPreset) => void;
  pickerOpen: boolean;
  onPickerOpen: () => void;
  onPickerClose: () => void;
}) {
  const { c, type } = useUi2Theme();
  return (
    <>
      {frame.hero('Make it yours', 'meet')}
      <Animated.View entering={frame.enter(0)}>
        <Text style={{ fontFamily: type.ui, fontSize: 14, lineHeight: 20, color: c.muted }}>
          Pick a name and a look. This is who you&apos;ll be in {languageName}.
        </Text>
      </Animated.View>
      <Animated.View entering={frame.enter(1)}>
        <SlabCard style={[stepStyles.inputCard, { borderColor: c.primary }]}>
          <TextInput
            value={displayName}
            onChangeText={(text) => onChangeName(text.slice(0, DISPLAY_NAME_MAX_CHARS))}
            placeholder="What should we call you?"
            placeholderTextColor={c.idle}
            maxLength={DISPLAY_NAME_MAX_CHARS}
            style={[stepStyles.singleLine, { fontFamily: type.uiHeavy, color: c.ink }]}
            accessibilityLabel="Your display name"
            autoFocus={!displayName}
          />
        </SlabCard>
      </Animated.View>
      <Animated.View entering={frame.enter(2)}>
        <Text style={[stepStyles.eyebrow, { fontFamily: type.uiHeavy, color: c.muted }]}>Pick a look</Text>
      </Animated.View>
      <Animated.View entering={frame.enter(3)}>
        <SlabCard style={stepStyles.avatarRow}>
          <Avatar
            size="medium"
            imageUri={avatarPresetId ? presetUrlFromId(avatarPresetId) : null}
            displayName={displayName}
          />
          <View style={{ flex: 1 }}>
            <SlabButton
              label={avatarPresetId ? 'Change avatar' : 'Choose avatar'}
              variant="onPrimary"
              arrow={false}
              onPress={onPickerOpen}
            />
          </View>
        </SlabCard>
      </Animated.View>

      {/* Pre-auth, deliberately. The preset catalogue is anon-readable
          (migration 082) precisely so this step keeps its avatar — the
          IKEA effect above depends on the learner building something
          before the sign-up gate, not after it. The choice rides in the
          local draft and is flushed by `flushDraftToProfile` once a session
          exists; nothing is written server-side here. */}
      <AvatarPresetPicker
        visible={pickerOpen}
        selectedId={avatarPresetId}
        onClose={onPickerClose}
        onSelect={(preset: AvatarPreset) => {
          onPickAvatar(preset);
          frame.cheer();
        }}
      />
    </>
  );
}
