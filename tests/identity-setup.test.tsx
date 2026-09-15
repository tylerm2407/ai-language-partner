/**
 * Tests for app/(app)/identity-setup.tsx — name + avatar after sign-up.
 *
 * Not colocated: expo-router bundles every .tsx under app/, so tests for
 * screens live here (see plans-paywall.test.tsx).
 *
 * What is worth pinning: the wait is full-screen and unskippable while a
 * photo renders, the finished avatar reaches the store without a second
 * write, a failed render drops back to the form with the reason, and Continue
 * leaves for the paywall tagged as the setup path so it exits to Home.
 */
import React from 'react';
import TestRenderer, { type ReactTestInstance } from 'react-test-renderer';

import IdentitySetupScreen from '../app/(app)/identity-setup';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('expo-status-bar', () => ({ StatusBar: 'StatusBar' }));
jest.mock('../lib/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('../hooks/useScreenView', () => ({ useScreenView: jest.fn() }));
jest.mock('../hooks/useAvatarImage', () => ({
  useAvatarImage: (path: string | null) => (path ? `signed:${path}` : null),
  invalidateAvatarImage: jest.fn(),
}));
jest.mock('../components/ui2/MascotSol', () => ({ MascotSol: 'MascotSol' }));
jest.mock('../components/avatar/Avatar', () => ({ Avatar: 'Avatar' }));
jest.mock('../components/avatar/AvatarPresetPicker', () => ({ AvatarPresetPicker: 'AvatarPresetPicker' }));
// The sheet is the photo's source; the test drives it through its
// onPhotoReady prop, so a host stand-in that keeps its props is enough.
jest.mock('../components/avatar/AvatarGeneratorSheet', () => ({ AvatarGeneratorSheet: 'AvatarGeneratorSheet' }));
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (initial: number) => ({ value: initial }),
    useAnimatedStyle: (factory: () => unknown) => factory(),
    withSpring: (to: number) => to,
    FadeInDown: { delay: () => ({ duration: () => ({}) }) },
  };
});
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), notificationAsync: jest.fn() }));
// lib/haptics reads its preference from AsyncStorage at import time; the
// native module does not exist under jest.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(async () => {}),
    getItem: jest.fn(async () => null),
    removeItem: jest.fn(async () => {}),
  },
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: jest.fn(), canGoBack: () => false }),
}));

const mockGenerate = jest.fn();
jest.mock('../lib/avatar-generation', () => {
  class AvatarGenerationError extends Error {
    code?: string;
    constructor(message: string, code?: string) {
      super(message);
      this.code = code;
    }
  }
  return {
    AvatarGenerationError,
    generateAvatar: (...a: unknown[]) => mockGenerate(...a),
  };
});

const mockUpsertProfile = jest.fn();
const mockSetAvatarKind = jest.fn();
jest.mock('../lib/supabase-queries', () => ({
  upsertProfile: (...a: unknown[]) => mockUpsertProfile(...a),
  setAvatarKind: (...a: unknown[]) => mockSetAvatarKind(...a),
}));

// Builds public URLs off the Supabase client, which needs env at import time.
jest.mock('../lib/avatar-presets', () => ({
  presetUrlFromId: (id: string) => `preset:${id}`,
}));

const mockSetProfile = jest.fn();
const state = {
  loading: false,
  profile: {
    userId: 'u1',
    displayName: '',
    avatarKind: 'procedural',
    avatarPresetId: null,
    avatarImagePath: null,
  },
  setProfile: (p: unknown) => mockSetProfile(p),
};
jest.mock('../stores/useAppStore', () => {
  const store = (selector?: (s: unknown) => unknown) =>
    typeof selector === 'function' ? selector(state) : state;
  store.getState = () => state;
  return { useAppStore: store };
});

function texts(renderer: TestRenderer.ReactTestRenderer): string {
  return renderer.root
    .findAll((n: ReactTestInstance) => typeof n.type === 'string', { deep: true })
    .flatMap((n) => (Array.isArray(n.children) ? n.children : []))
    .filter((c): c is string => typeof c === 'string')
    .join(' ');
}

async function render() {
  let renderer!: TestRenderer.ReactTestRenderer;
  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(<IdentitySetupScreen />);
  });
  return renderer;
}

function byLabel(renderer: TestRenderer.ReactTestRenderer, label: string) {
  return renderer.root.find(
    (n: ReactTestInstance) =>
      n.props?.accessibilityLabel === label && typeof n.props?.onPress === 'function',
  );
}

function sheet(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.findByType('AvatarGeneratorSheet' as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  state.profile = {
    userId: 'u1',
    displayName: '',
    avatarKind: 'procedural',
    avatarPresetId: null,
    avatarImagePath: null,
  };
});

const PHOTO = { base64: 'abc', uri: 'file:///p.jpg', mimeType: 'image/jpeg' as const };

describe('continue', () => {
  it('saves a new name and leaves for the paywall as the setup path', async () => {
    mockUpsertProfile.mockResolvedValue({ ...state.profile, displayName: 'Simmer' });
    const renderer = await render();

    const input = renderer.root.find(
      (n: ReactTestInstance) => n.props?.accessibilityLabel === 'Your display name' && typeof n.props?.onChangeText === 'function',
    );
    await TestRenderer.act(async () => input.props.onChangeText('  Simmer  '));
    await TestRenderer.act(async () => byLabel(renderer, 'Continue').props.onPress());

    expect(mockUpsertProfile).toHaveBeenCalledWith('u1', { displayName: 'Simmer' });
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/(app)/plans', params: { source: 'onboarding' } });
  });

  it('skips the profile write when the name did not change', async () => {
    const renderer = await render();
    await TestRenderer.act(async () => byLabel(renderer, 'Continue').props.onPress());
    expect(mockUpsertProfile).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });
});

describe('photo avatar', () => {
  it('draws full-screen with no way out, then mirrors the result into the store', async () => {
    let settle!: (v: { path: string; styleKey: string }) => void;
    mockGenerate.mockReturnValue(new Promise((resolve) => { settle = resolve; }));
    const renderer = await render();

    // Not awaited: the handler itself awaits the render, which is held open
    // here on purpose so the waiting screen can be asserted.
    const ready = sheet(renderer).props.onPhotoReady;
    TestRenderer.act(() => {
      void ready(PHOTO, 'anime_pop');
    });
    await TestRenderer.act(async () => {});

    const waiting = texts(renderer);
    expect(waiting).toMatch(/Drawing your avatar/);
    expect(waiting).toMatch(/few minutes/);
    // No Continue, no Skip, no Cancel while the render runs.
    expect(renderer.root.findAll((n: ReactTestInstance) => typeof n.props?.onPress === 'function')).toHaveLength(0);
    expect(mockGenerate).toHaveBeenCalledWith(PHOTO, 'anime_pop');

    await TestRenderer.act(async () => settle({ path: 'avatars/u1.png', styleKey: 'anime_pop' }));

    expect(mockSetProfile).toHaveBeenCalledWith(
      expect.objectContaining({ avatarKind: 'generated', avatarImagePath: 'avatars/u1.png' }),
    );
    // Back on the form, with the way forward restored.
    expect(byLabel(renderer, 'Continue')).toBeTruthy();
  });

  it('drops back to the form with the server\'s reason when the render fails', async () => {
    const { AvatarGenerationError } = jest.requireMock('../lib/avatar-generation');
    mockGenerate.mockRejectedValue(new AvatarGenerationError("You've used your free avatar.", 'AVATAR_REQUIRES_PLAN'));
    const renderer = await render();

    await TestRenderer.act(async () => sheet(renderer).props.onPhotoReady(PHOTO, 'anime_pop'));

    expect(texts(renderer)).toMatch(/used your free avatar/);
    expect(mockSetProfile).not.toHaveBeenCalled();
    expect(byLabel(renderer, 'Continue')).toBeTruthy();
  });
});
