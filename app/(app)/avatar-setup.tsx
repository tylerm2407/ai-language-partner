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
import { AvatarCustomizer } from '../../components/avatar/AvatarCustomizer';
import { Avatar } from '../../components/avatar/Avatar';
import { updateAvatarConfig } from '../../lib/supabase-queries';
import { useAvatarImage, invalidateAvatarImage } from '../../hooks/useAvatarImage';
import { DEFAULT_AVATAR_CONFIG } from '../../components/avatar/constants';
import { GradientBackground } from '../../components/ui/GradientBackground';
import { Button } from '../../components/ui/Button';
import { colors, spacing, typography } from '../../config/theme';
import { trackEvent } from '../../lib/analytics';

export default function AvatarSetupScreen() {
  const router = useRouter();
  const { profile, setProfile, loading } = useAppStore();
  const [generatorVisible, setGeneratorVisible] = useState(false);
  const [customizerVisible, setCustomizerVisible] = useState(false);
  const [justGenerated, setJustGenerated] = useState(false);

  const imageUri = useAvatarImage(
    profile?.avatarKind === 'generated' ? profile.avatarImagePath : null,
  );

  /**
   * Leave for the paywall. `replace`, not `push`: this screen is a one-time
   * step in a linear setup, and leaving it on the stack would put it behind
   * the paywall's back gesture as somewhere to return to.
   */
  const proceed = useCallback(() => {
    router.replace('/(app)/plans');
  }, [router]);

  /**
   * Save a hand-built avatar. Unlike the photo path there is no entitlement to
   * spend and no model call — the config is just profile data, so it writes
   * directly. Failing here must not strand the learner on a setup screen, so
   * the local state is updated either way and the error only costs a retry.
   */
  const handleCustomized = useCallback(
    async (config: Parameters<typeof updateAvatarConfig>[1]) => {
      setCustomizerVisible(false);
      if (!profile) return;
      setProfile({ ...profile, avatarConfig: config, avatarKind: 'procedural' });
      try {
        await updateAvatarConfig(profile.userId, config);
      } catch (err) {
        console.error('[avatar-setup] saving the built avatar failed:', err);
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
      setJustGenerated(true);
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
            {justGenerated ? 'That’s you.' : 'One free avatar, on us.'}
          </Text>
          <Text className="text-base text-text-secondary mt-2 mb-8">
            {justGenerated
              ? 'It’s saved to your profile. You can change it any time from Profile → Avatar.'
              : 'Turn a photo of yourself into an illustrated avatar. Every account gets one free — after that it’s part of a paid plan.'}
          </Text>

          <View className="items-center mb-10">
            <Avatar
              config={profile.avatarConfig ?? DEFAULT_AVATAR_CONFIG}
              size="large"
              expression="happy"
              imageUri={imageUri}
            />
          </View>

          {justGenerated ? (
            <Button label="Continue" onPress={proceed} />
          ) : (
            <>
              <Button label="Use a photo" onPress={() => setGeneratorVisible(true)} />
              {/* The other half of the avatar. Without this the only choices
                  here were "spend your one free generation" or "skip", and a
                  learner who wanted to hand-build a look had nowhere to do it
                  until they found Profile → Avatar later. */}
              <Pressable
                onPress={() => setCustomizerVisible(true)}
                className="py-3 items-center mt-2"
                style={{ minHeight: 44, justifyContent: 'center' }}
                accessibilityRole="button"
                accessibilityLabel="Build an avatar instead"
              >
                <Text className="text-base font-semibold text-primary">Build one instead</Text>
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
                Skipping keeps your free avatar — you can use it later from your profile.
              </Text>
            </>
          )}
        </View>
      </SafeAreaView>

      {/* `onUsePhoto` is what puts the camera inside the builder: a learner who
          opens the customizer and then decides they would rather use a photo
          does not have to back out and find the other button. */}
      <AvatarCustomizer
        visible={customizerVisible}
        initialConfig={profile.avatarConfig ?? DEFAULT_AVATAR_CONFIG}
        onClose={() => setCustomizerVisible(false)}
        onSave={handleCustomized}
        onUsePhoto={() => {
          setCustomizerVisible(false);
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
