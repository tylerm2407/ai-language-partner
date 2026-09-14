/**
 * Name and avatar. IKEA effect (DESIGN.md §UX Psychology Principles #4): the
 * learner builds something of their own before the sign-up gate, so leaving
 * means abandoning it rather than skipping a form.
 *
 * Two ways to get a look, both pre-auth: a preset from the library (anon-
 * readable, migration 082) or a photo. The photo cannot be turned into an
 * avatar yet — that is a paid model call behind a JWT — so the sheet runs in
 * deferred mode: consent, camera or picker, style, and the prepared JPEG is
 * parked on disk. `flushDraftToProfile` starts the generation the moment an
 * account exists (components/onboarding/deferred-avatar.ts). Until then the
 * step shows the photo itself, so the learner sees what they built.
 */
import { Pressable, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useUi2Theme } from '../../../hooks/useUi2Theme';
import { presetUrlFromId, type AvatarPreset } from '../../../lib/avatar-presets';
import type { PreparedPhoto } from '../../../lib/avatar-generation';
import type { StashedAvatarPhoto } from '../../../lib/onboarding-avatar-photo';
import { Avatar } from '../../avatar/Avatar';
import { AvatarPresetPicker } from '../../avatar/AvatarPresetPicker';
import { AvatarGeneratorSheet } from '../../avatar/AvatarGeneratorSheet';
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
  avatarPhoto,
  onPhotoReady,
  pickerOpen,
  onPickerOpen,
  onPickerClose,
  generatorOpen,
  onGeneratorOpen,
  onGeneratorClose,
}: {
  frame: StepFrame;
  languageName: string;
  displayName: string;
  onChangeName: (name: string) => void;
  avatarPresetId: string | null;
  onPickAvatar: (preset: AvatarPreset) => void;
  /** The parked photo, when the learner chose one over a preset. */
  avatarPhoto: StashedAvatarPhoto | null;
  /** A photo and style came out of the sheet; the caller parks it. */
  onPhotoReady: (photo: PreparedPhoto, styleKey: string) => void;
  pickerOpen: boolean;
  onPickerOpen: () => void;
  onPickerClose: () => void;
  generatorOpen: boolean;
  onGeneratorOpen: () => void;
  onGeneratorClose: () => void;
}) {
  const { c, type } = useUi2Theme();
  const imageUri = avatarPhoto?.uri ?? (avatarPresetId ? presetUrlFromId(avatarPresetId) : null);
  const hasLook = !!avatarPhoto || !!avatarPresetId;
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
          <Avatar size="medium" imageUri={imageUri} displayName={displayName} />
          <View style={{ flex: 1, gap: 8 }}>
            <SlabButton
              label={hasLook ? 'Change avatar' : 'Choose avatar'}
              variant="onPrimary"
              arrow={false}
              onPress={onPickerOpen}
            />
            {/* The photo path is the costlier one (a model call after
                sign-up), so the library leads and this is the second choice —
                but it sits right here, not on a screen of its own. */}
            <Pressable
              onPress={onGeneratorOpen}
              accessibilityRole="button"
              accessibilityLabel={avatarPhoto ? 'Change your photo' : 'Make an avatar from a photo instead'}
              style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}
            >
              <Text style={{ fontFamily: type.uiBold, fontSize: 14, color: c.primary }}>
                {avatarPhoto ? 'Change photo' : 'Use a photo instead'}
              </Text>
            </Pressable>
          </View>
        </SlabCard>
        {avatarPhoto ? (
          <Text style={{ fontFamily: type.ui, fontSize: 13, lineHeight: 18, color: c.muted, marginTop: 8 }}>
            Your illustrated avatar is drawn from this photo right after you sign up.
          </Text>
        ) : null}
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
        onUsePhoto={() => {
          onPickerClose();
          onGeneratorOpen();
        }}
      />
      {/* Deferred mode: the sheet returns the photo instead of generating. */}
      <AvatarGeneratorSheet
        visible={generatorOpen}
        onClose={onGeneratorClose}
        onGenerated={() => undefined}
        onPhotoReady={(photo, styleKey) => {
          onPhotoReady(photo, styleKey);
          frame.cheer();
        }}
      />
    </>
  );
}
