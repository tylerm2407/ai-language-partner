/**
 * The one free photo avatar — the single step between sign-up and the paywall.
 *
 * Why it sits here and nowhere else: photo-to-avatar is a paid image-model
 * call, and every account gets exactly ONE of them for free, once, ever. The
 * entitlement is a lifetime flag on the profile, spent server-side by
 * `generate-avatar` through `consume_free_avatar` (migration 077) — this
 * screen never decides whether the learner is allowed to generate, it only
 * offers it. A client that grants entitlement is the migration-057 class of
 * bug (CLAUDE.md §1.2).
 *
 * Both exits land on the paywall. Skipping does not skip the ask; it skips the
 * avatar. The learner keeps the free generation either way — it is spent on
 * use, not on arrival — so "Not now" is a real deferral and the profile screen
 * offers the same flow later.
 */
import { useCallback, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../stores/useAppStore';
import { AvatarGeneratorSheet } from '../../components/avatar/AvatarGeneratorSheet';
import { AvatarPresetPicker } from '../../components/avatar/AvatarPresetPicker';
import { Avatar } from '../../components/avatar/Avatar';
import { setAvatarKind } from '../../lib/supabase-queries';
import { presetUrlFromId, type AvatarPreset } from '../../lib/avatar-presets';
import { useAvatarImage, invalidateAvatarImage } from '../../hooks/useAvatarImage';
import { GradientBackground } from '../../components/ui/GradientBackground';
import { Button } from '../../components/ui/Button';
import { colors, spacing, typography } from '../../config/theme';
import { trackEvent } from '../../lib/analytics';

export default function AvatarSetupScreen() {
  const router = useRouter();
  const { profile, setProfile, loading } = useAppStore();
  const [generatorVisible, setGeneratorVisible] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [justChose, setJustChose] = useState(false);

  // A generated avatar lives in the PRIVATE bucket and needs a signed URL; a
  // preset is public artwork whose URL is derived from its id. Only the first
  // costs a round trip, so the hook is asked only about that case.
  const signedUri = useAvatarImage(
    profile?.avatarKind === 'generated' ? profile.avatarImagePath : null,
  );
  const imageUri =
    profile?.avatarKind === 'preset' && profile.avatarPresetId
      ? presetUrlFromId(profile.avatarPresetId)
      : signedUri;

  /**
   * Leave for the paywall. `replace`, not `push`: this screen is a one-time
   * step in a linear setup, and leaving it on the stack would put it behind
   * the paywall's back gesture as somewhere to return to.
   */
  const proceed = useCallback(() => {
    router.replace('/(app)/plans');
  }, [router]);

  /**
   * Pick a premade avatar. No entitlement to spend and no model call — this is
   * stock artwork, so it is free, unlimited, and available before the learner
   * has been asked for anything. The local state updates first so the choice
   * lands instantly; a failed write costs a retry, not the screen.
   */
  const handlePreset = useCallback(
    async (preset: AvatarPreset) => {
      setPickerVisible(false);
      if (!profile) return;
      setProfile({ ...profile, avatarKind: 'preset', avatarPresetId: preset.id });
      setJustChose(true);
      trackEvent('avatar_preset_selected', { presetId: preset.id, source: 'onboarding' });
      try {
        await setAvatarKind(profile.userId, 'preset', preset.id);
      } catch (err) {
        console.error('[avatar-setup] saving the chosen avatar failed:', err);
      }
    },
    [profile, setProfile],
  );

  const handleGenerated = useCallback(
    (path: string) => {
      // The Edge Function has already written avatar_kind and
      // avatar_image_path, so this mirrors the result into the store rather
      // than issuing a second write.
      invalidateAvatarImage(path);
      if (profile) setProfile({ ...profile, avatarKind: 'generated', avatarImagePath: path });
      setGeneratorVisible(false);
      setJustChose(true);
      trackEvent('free_avatar_generated', { source: 'onboarding' });
    },
    [profile, setProfile],
  );

  // The store is still filling in after the profile flush. Holding is right:
  // rendering the default avatar here and swapping it a frame later reads as
  // a glitch on the one screen that is about how the learner looks.
  if (loading || !profile) {
    return (
      <GradientBackground>
        <SafeAreaView className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.action.accent} />
        </SafeAreaView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <SafeAreaView className="flex-1">
        <View className="flex-1 px-6 justify-center">
          <Text
            style={{
              fontFamily: typography.family.display,
              fontSize: 30,
              lineHeight: 38,
              letterSpacing: -1,
              color: colors.text.primary,
            }}
            accessibilityRole="header"
          >
            {justChose ? 'That’s you.' : 'Pick your avatar.'}
          </Text>
          <Text className="text-base text-text-secondary mt-2 mb-8">
            {justChose
              ? 'It’s saved to your profile. You can change it any time from Profile → Avatar.'
              : 'Choose one of ours — free, and there are fifty. Or turn a photo of yourself into an illustrated avatar; every account gets one of those free.'}
          </Text>

          <View className="items-center mb-10">
            <Avatar size="large" imageUri={imageUri} displayName={profile.displayName} />
          </View>

          {justChose ? (
            <Button label="Continue" onPress={proceed} />
          ) : (
            <>
              {/* The library leads. It is free, unlimited and instant, where
                  the photo path spends a once-per-account entitlement — so the
                  cheap choice is the default one and the costly one is opt-in. */}
              <Button label="Choose an avatar" onPress={() => setPickerVisible(true)} />
              <Pressable
                onPress={() => setGeneratorVisible(true)}
                className="py-3 items-center mt-2"
                style={{ minHeight: 44, justifyContent: 'center' }}
                accessibilityRole="button"
                accessibilityLabel="Make an avatar from a photo instead"
              >
                <Text className="text-base font-semibold text-primary">Use a photo instead</Text>
              </Pressable>
              <Pressable
                onPress={proceed}
                className="py-3 items-center mt-1"
                style={{ minHeight: 44, justifyContent: 'center' }}
                accessibilityRole="button"
                accessibilityLabel="Skip the avatar for now"
              >
                <Text className="text-sm text-text-secondary">Not now</Text>
              </Pressable>
              <Text
                className="text-xs text-text-quaternary text-center"
                style={{ marginTop: spacing.xs }}
              >
                You can change this any time from your profile.
              </Text>
            </>
          )}
        </View>
      </SafeAreaView>

      {/* `onUsePhoto` routes out of the grid without backing out of it: a
          learner who browses fifty faces and decides none of them is them
          should reach the camera from where they already are. */}
      <AvatarPresetPicker
        visible={pickerVisible}
        selectedId={profile.avatarPresetId}
        onClose={() => setPickerVisible(false)}
        onSelect={handlePreset}
        onUsePhoto={() => {
          setPickerVisible(false);
          setGeneratorVisible(true);
        }}
      />

      <AvatarGeneratorSheet
        visible={generatorVisible}
        onClose={() => setGeneratorVisible(false)}
        onGenerated={handleGenerated}
        // Reachable only if the free generation has already been spent —
        // a second account-creation retry, or a learner who came back here
        // from their profile after using it.
        onUpgrade={() => {
          setGeneratorVisible(false);
          proceed();
        }}
      />
    </GradientBackground>
  );
}
