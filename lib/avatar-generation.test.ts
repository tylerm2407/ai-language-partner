import {
  AvatarGenerationError,
  AVATAR_STYLE_OPTIONS,
  fetchAvatarStyles,
  generateAvatar,
} from './avatar-generation';
import { AVATAR_STYLES } from '../supabase/functions/_shared/avatar-styles';
import type { PreparedPhoto } from './avatar-generation';

// Native pickers are irrelevant to these tests — only the invoke path is under
// test. Mocking them keeps the module importable under jest.
// (babel-plugin-jest-hoist lifts these above the imports at transform time.)
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));

const mockInvoke = jest.fn();
jest.mock('./supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));

const photo: PreparedPhoto = {
  base64: 'ZmFrZQ==',
  uri: 'file:///tmp/selfie.jpg',
  mimeType: 'image/jpeg',
};

/** Build the error shape supabase-js produces for a non-2xx function response. */
function functionError(status: number, body: Record<string, unknown>) {
  return {
    message: 'Edge Function returned a non-2xx status code',
    context: { status, json: async () => body },
  };
}

beforeEach(() => mockInvoke.mockReset());

describe('generateAvatar', () => {
  it('returns the stored path on success', async () => {
    mockInvoke.mockResolvedValue({ data: { path: 'u1/anime_pop_1.png', styleKey: 'anime_pop' }, error: null });

    await expect(generateAvatar(photo, 'anime_pop')).resolves.toEqual({
      path: 'u1/anime_pop_1.png',
      styleKey: 'anime_pop',
    });
  });

  it('never sends the prompt — only the style key and image', async () => {
    mockInvoke.mockResolvedValue({ data: { path: 'p', styleKey: 'anime_pop' }, error: null });

    await generateAvatar(photo, 'anime_pop');

    const [name, options] = mockInvoke.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(name).toBe('generate-avatar');
    expect(Object.keys(options.body).sort()).toEqual(['imageBase64', 'mimeType', 'styleKey']);
  });

  it('surfaces the server code for a free-plan caller', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: functionError(403, {
        error: 'Photo avatars are available on paid plans.',
        code: 'AVATAR_REQUIRES_PLAN',
      }),
    });

    // The tier gate is server-side, so the client must relay the real reason
    // rather than the generic supabase-js message.
    await expect(generateAvatar(photo, 'anime_pop')).rejects.toMatchObject({
      code: 'AVATAR_REQUIRES_PLAN',
      status: 403,
      message: 'Photo avatars are available on paid plans.',
    });
  });

  it('surfaces the daily limit code', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: functionError(429, {
        error: "You've used all 5 avatar generations for today.",
        code: 'DAILY_AVATAR_LIMIT_REACHED',
      }),
    });

    await expect(generateAvatar(photo, 'anime_pop')).rejects.toMatchObject({
      code: 'DAILY_AVATAR_LIMIT_REACHED',
    });
  });

  it('falls back to the generic message when the body is not JSON', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: {
          status: 500,
          json: async () => {
            throw new Error('not json');
          },
        },
      },
    });

    await expect(generateAvatar(photo, 'anime_pop')).rejects.toBeInstanceOf(AvatarGenerationError);
  });

  it('rejects a success response with no path rather than returning undefined', async () => {
    mockInvoke.mockResolvedValue({ data: {}, error: null });

    await expect(generateAvatar(photo, 'anime_pop')).rejects.toBeInstanceOf(AvatarGenerationError);
  });
});

describe('AVATAR_STYLE_OPTIONS', () => {
  it('carries labels only — image prompts stay server-side (CLAUDE.md §6)', () => {
    for (const option of AVATAR_STYLE_OPTIONS) {
      expect(Object.keys(option).sort()).toEqual(['description', 'key', 'label']);
    }
  });
});

describe('fetchAvatarStyles', () => {
  it('returns the catalogue the server sends', async () => {
    const serverStyles = [
      { key: 'anime_pop', label: 'Anime Pop', description: 'a' },
      { key: 'watercolour', label: 'Watercolour', description: 'b' },
    ];
    mockInvoke.mockResolvedValue({ data: { styles: serverStyles }, error: null });

    await expect(fetchAvatarStyles()).resolves.toEqual(serverStyles);
    // The picker must ask for the catalogue, not a generation.
    expect(mockInvoke).toHaveBeenCalledWith('generate-avatar', { body: { action: 'styles' } });
  });

  it('falls back rather than throwing when the function errors', async () => {
    // A learner who is offline still gets a usable picker; generation itself
    // re-validates the key server-side, so a stale key fails loudly there.
    mockInvoke.mockResolvedValue({ data: null, error: new Error('offline') });

    await expect(fetchAvatarStyles()).resolves.toEqual(AVATAR_STYLE_OPTIONS);
  });

  it('falls back on an empty or malformed catalogue', async () => {
    mockInvoke.mockResolvedValue({ data: { styles: [] }, error: null });
    await expect(fetchAvatarStyles()).resolves.toEqual(AVATAR_STYLE_OPTIONS);

    mockInvoke.mockResolvedValue({ data: { styles: [{ nope: true }] }, error: null });
    await expect(fetchAvatarStyles()).resolves.toEqual(AVATAR_STYLE_OPTIONS);
  });

  it('never lets a server prompt reach the client', async () => {
    // Belt and braces: listAvatarStyles strips prompts, but if that ever
    // regressed the picker would happily render one into the UI.
    mockInvoke.mockResolvedValue({
      data: { styles: [{ key: 'k', label: 'L', description: 'd', prompt: 'SECRET' }] },
      error: null,
    });
    const listed = await fetchAvatarStyles();
    expect(JSON.stringify(listed)).not.toContain('SECRET');
  });
});

describe('offline fallback stays in sync with the server catalogue', () => {
  it('offers no style the server cannot render', () => {
    // The fallback is only reached when the catalogue fetch fails, which is
    // exactly when nobody is watching. A key removed or renamed server-side
    // would leave it offering a style that fails INVALID_STYLE at generate
    // time — long after the learner has taken the photo.
    for (const option of AVATAR_STYLE_OPTIONS) {
      expect(Object.keys(AVATAR_STYLES)).toContain(option.key);
    }
  });
});
