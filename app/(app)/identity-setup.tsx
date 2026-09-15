/**
 * Name and avatar — the first screen after sign-up, before the paywall.
 *
 * Why here and not in the pre-auth form: photo-to-avatar is a paid image-model
 * call behind a JWT, and Tyler's call (2026-09-13) is that the learner should
 * SEE their finished avatar before being asked for money — it is the most
 * professional moment in setup and the clearest "you already got something".
 * So the whole identity step moved to the far side of sign-up, where the
 * render can actually run.
 *
 * Entitlement is the server's: every account gets exactly ONE free
 * generation, spent by `generate-avatar` through consume_free_avatar
 * (migration 077) and given back if the render fails. This screen never
 * decides whether a learner may generate; it only offers it. A client that
 * grants entitlement is the migration-057 class of bug (CLAUDE.md §1.2).
 *
 * The wait is honest and unskippable: a full screen with Sol and copy that
 * says minutes, not seconds. A failed render drops back to the form with the
 * reason and the preset library still available, so nobody is stranded.
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../stores/useAppStore';
import { AvatarGeneratorSheet } from '../../components/avatar/AvatarGeneratorSheet';
import { AvatarPresetPicker } from '../../components/avatar/AvatarPresetPicker';
import { Avatar } from '../../components/avatar/Avatar';
import { Ui2Screen } from '../../components/ui2/Ui2Screen';
import { SlabButton } from '../../components/ui2/SlabButton';
import { SlabCard } from '../../components/ui2/SlabCard';
import { MascotSol } from '../../components/ui2/MascotSol';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { useScreenView } from '../../hooks/useScreenView';
import { useAvatarImage, invalidateAvatarImage } from '../../hooks/useAvatarImage';
import { setAvatarKind, upsertProfile } from '../../lib/supabase-queries';
import { presetUrlFromId, type AvatarPreset } from '../../lib/avatar-presets';
import {
  AvatarGenerationError,
  generateAvatar,
  type PreparedPhoto,
} from '../../lib/avatar-generation';
import { DISPLAY_NAME_MAX_CHARS } from '../../components/onboarding/steps/config';
import { trackEvent } from '../../lib/analytics';
import { authErrorCopy } from '../../lib/auth-errors';

type Phase = 'form' | 'drawing';

export default function IdentitySetupScreen() {
  useScreenView('onboarding', { stepName: 'identity_setup' });
  const { c, type } = useUi2Theme();
  const router = useRouter();
  const { profile, setProfile, loading } = useAppStore();

  const [name, setName] = useState('');
  const [nameSeeded, setNameSeeded] = useState(false);
  const [phase, setPhase] = useState<Phase>('form');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [drawError, setDrawError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Seed the field once from the profile (a returning account may already
  // have a name); never overwrite what the learner is typing.
  useEffect(() => {
    if (profile && !nameSeeded) {
      setName(profile.displayName ?? '');
      setNameSeeded(true);
    }
  }, [profile, nameSeeded]);

  // A generated avatar lives in the PRIVATE bucket and needs a signed URL; a
  // preset is public artwork whose URL is derived from its id.
  const signedUri = useAvatarImage(
    profile?.avatarKind === 'generated' ? profile.avatarImagePath : null,
  );
  const imageUri =
    profile?.avatarKind === 'preset' && profile.avatarPresetId
      ? presetUrlFromId(profile.avatarPresetId)
      : signedUri;
  const hasLook = !!imageUri;

  /** Stock artwork: free, unlimited, instant. Written straight away. */
  const handlePreset = useCallback(
    async (preset: AvatarPreset) => {
      setPickerOpen(false);
      if (!profile) return;
      setProfile({ ...profile, avatarKind: 'preset', avatarPresetId: preset.id });
      trackEvent('avatar_preset_selected', { presetId: preset.id, source: 'onboarding' });
      try {
        await setAvatarKind(profile.userId, 'preset', preset.id);
      } catch (err) {
        console.error('[identity-setup] saving the chosen avatar failed:', err);
      }
    },
    [profile, setProfile],
  );

  /**
   * The photo path. The sheet hands back the prepared photo and style
   * (deferred mode) and this screen owns the wait, full-screen, so the render
   * is the whole screen rather than a spinner inside a sheet.
   */
  const handlePhotoReady = useCallback(
    async (photo: PreparedPhoto, styleKey: string) => {
      setGeneratorOpen(false);
      setDrawError(null);
      setPhase('drawing');
      try {
        const result = await generateAvatar(photo, styleKey);
        // The Edge Function has already written avatar_kind and
        // avatar_image_path; mirror it rather than issuing a second write.
        invalidateAvatarImage(result.path);
        const current = useAppStore.getState().profile;
        if (current) setProfile({ ...current, avatarKind: 'generated', avatarImagePath: result.path });
        trackEvent('free_avatar_generated', { source: 'onboarding' });
      } catch (err) {
        setDrawError(
          err instanceof AvatarGenerationError
            ? err.message
            : 'We could not draw your avatar. Pick one from the library, or try the photo again.',
        );
      } finally {
        setPhase('form');
      }
    },
    [setProfile],
  );

  /** Save the name if it changed, then on to the paywall. */
  const handleContinue = useCallback(async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const trimmed = name.trim();
      if (trimmed !== (profile.displayName ?? '')) {
        const updated = await upsertProfile(profile.userId, { displayName: trimmed });
        setProfile(updated);
      }
      // Straight to the paywall. `source` tells it to land on Home when the
      // learner leaves, whatever the navigator's back stack holds.
      router.replace({ pathname: '/(app)/plans', params: { source: 'onboarding' } });
    } catch (err) {
      const { title, message } = authErrorCopy(err);
      Alert.alert(title, message);
    } finally {
      setSaving(false);
    }
  }, [profile, name, router, setProfile]);

  // The store is still filling in after the profile flush. Holding is right:
  // rendering the default avatar here and swapping it a frame later reads as
  // a glitch on the one screen that is about how the learner looks.
  if (loading || !profile) {
    return (
      <Ui2Screen fixed>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      </Ui2Screen>
    );
  }

  if (phase === 'drawing') {
    return (
      <Ui2Screen fixed>
        <View style={[styles.center, { gap: 20, paddingHorizontal: 32 }]} accessibilityLiveRegion="polite">
          <MascotSol size={140} mood="think" />
          <Text
            accessibilityRole="header"
            style={{ fontFamily: type.heading, fontSize: 28, lineHeight: 34, color: c.ink, textAlign: 'center' }}
          >
            Drawing your avatar…
          </Text>
          <Text style={{ fontFamily: type.ui, fontSize: 15, lineHeight: 22, color: c.muted, textAlign: 'center' }}>
            This takes a few minutes — we draw it at full quality. Keep the app open.
          </Text>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      </Ui2Screen>
    );
  }

  return (
    <Ui2Screen
      footer={
        <SlabButton
          label="Continue"
          onPress={handleContinue}
          loading={saving}
          disabled={saving}
        />
      }
    >
      <View style={styles.stack}>
        <Text
          accessibilityRole="header"
          style={{ fontFamily: type.heading, fontSize: 30, lineHeight: 36, letterSpacing: -0.5, color: c.ink }}
        >
          Make it yours
        </Text>
        <Text style={{ fontFamily: type.ui, fontSize: 14, lineHeight: 20, color: c.muted }}>
          Pick a name and a look. This is who you&apos;ll be in your lessons and with Sol.
        </Text>

        <SlabCard style={[styles.inputCard, { borderColor: c.primary }]}>
          <TextInput
            value={name}
            onChangeText={(text) => setName(text.slice(0, DISPLAY_NAME_MAX_CHARS))}
            placeholder="What should we call you?"
            placeholderTextColor={c.idle}
            maxLength={DISPLAY_NAME_MAX_CHARS}
            style={[styles.singleLine, { fontFamily: type.uiHeavy, color: c.ink }]}
            accessibilityLabel="Your display name"
            autoFocus={!name}
          />
        </SlabCard>

        <Text style={[styles.eyebrow, { fontFamily: type.uiHeavy, color: c.muted }]}>Pick a look</Text>
        <SlabCard style={styles.avatarRow}>
          <Avatar size="medium" imageUri={imageUri} displayName={name} />
          <View style={{ flex: 1, gap: 8 }}>
            <SlabButton
              label={hasLook ? 'Change avatar' : 'Choose avatar'}
              variant="onPrimary"
              arrow={false}
              onPress={() => setPickerOpen(true)}
            />
            {/* The library leads: free, unlimited, instant. The photo path
                spends the account's one free generation, so it is the second
                choice — but it sits right here, not on a screen of its own. */}
            <Pressable
              onPress={() => setGeneratorOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Make an avatar from a photo"
              style={styles.link}
            >
              <Text style={{ fontFamily: type.uiBold, fontSize: 14, color: c.primary }}>
                {profile.avatarKind === 'generated' ? 'Redraw from a photo' : 'Use a photo instead'}
              </Text>
            </Pressable>
          </View>
        </SlabCard>
        <Text style={{ fontFamily: type.ui, fontSize: 13, lineHeight: 18, color: c.muted }}>
          Your first illustrated avatar from a photo is on us. You can change either any time from
          your profile.
        </Text>
        {drawError ? (
          <SlabCard tint="primary" style={{ gap: 4 }}>
            <Text style={{ fontFamily: type.uiBold, fontSize: 14, lineHeight: 19, color: c.ink }}>
              Couldn&apos;t draw that one
            </Text>
            <Text style={{ fontFamily: type.ui, fontSize: 13, lineHeight: 18, color: c.muted }}>{drawError}</Text>
          </SlabCard>
        ) : null}
      </View>

      <AvatarPresetPicker
        visible={pickerOpen}
        selectedId={profile.avatarPresetId}
        onClose={() => setPickerOpen(false)}
        onSelect={handlePreset}
        onUsePhoto={() => {
          setPickerOpen(false);
          setGeneratorOpen(true);
        }}
      />
      {/* Deferred mode: the sheet returns the photo; the screen draws. */}
      <AvatarGeneratorSheet
        visible={generatorOpen}
        onClose={() => setGeneratorOpen(false)}
        onGenerated={() => undefined}
        onPhotoReady={handlePhotoReady}
      />
    </Ui2Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stack: { gap: 18 },
  inputCard: { gap: 10 },
  singleLine: { fontSize: 16, lineHeight: 22, padding: 0, minHeight: 28 },
  eyebrow: { fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  link: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
});
