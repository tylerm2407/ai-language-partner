/**
 * Tests for the premade avatar library client (avatar-presets.ts).
 *
 * The important behaviour here is the failure mode. An empty grid and a broken
 * grid look identical to a learner, so `fetchAvatarPresets` must THROW rather
 * than return [] — the picker needs to tell them apart to show a retry instead
 * of an apparently-empty library (CLAUDE.md §5: returning [] on failure hides
 * outages).
 */
const mockGetPublicUrl = jest.fn((path: string) => ({
  data: { publicUrl: `https://cdn.test/storage/v1/object/public/avatar-presets/${path}` },
}));

const mockLimit = jest.fn();
jest.mock('./supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({ limit: (...a: unknown[]) => mockLimit(...a) }),
        }),
      }),
    }),
    storage: { from: () => ({ getPublicUrl: (p: string) => mockGetPublicUrl(p) }) },
  },
}));

import { fetchAvatarPresets, presetUrlFromId, publicPresetUrl } from './avatar-presets';

beforeEach(() => jest.clearAllMocks());

describe('fetchAvatarPresets', () => {
  it('maps rows to presets with resolved public URLs, in server order', async () => {
    mockLimit.mockResolvedValue({
      data: [
        { id: 's01-anime_pop', style_key: 'anime_pop', storage_path: 's01-anime_pop.jpg' },
        { id: 's02-retro_cartoon', style_key: 'retro_cartoon', storage_path: 's02-retro_cartoon.jpg' },
      ],
      error: null,
    });

    const presets = await fetchAvatarPresets();

    expect(presets).toHaveLength(2);
    // Order is the server's `sort_order`, not re-sorted here — the interleave
    // across styles is a curation decision made in SQL.
    expect(presets.map((p) => p.id)).toEqual(['s01-anime_pop', 's02-retro_cartoon']);
    expect(presets[0].url).toContain('avatar-presets/s01-anime_pop.jpg');
    expect(presets[0].styleKey).toBe('anime_pop');
  });

  it('throws on error instead of returning an empty library', async () => {
    // The whole point: a broken fetch must not render as "no avatars exist".
    mockLimit.mockResolvedValue({ data: null, error: new Error('network down') });

    await expect(fetchAvatarPresets()).rejects.toThrow();
  });

  it('returns an empty array when the catalogue is genuinely empty', async () => {
    // Distinct from the failure above — no error, just nothing published yet.
    mockLimit.mockResolvedValue({ data: [], error: null });

    await expect(fetchAvatarPresets()).resolves.toEqual([]);
  });

  it('tolerates a null data payload without throwing', async () => {
    mockLimit.mockResolvedValue({ data: null, error: null });

    await expect(fetchAvatarPresets()).resolves.toEqual([]);
  });
});

describe('preset URLs', () => {
  it('derives a URL from a preset id without fetching the catalogue', () => {
    // A saved avatar_preset_id must render on any screen that has the profile
    // but no reason to load all fifty tiles.
    expect(presetUrlFromId('s26-anime_pop')).toContain('s26-anime_pop.jpg');
    expect(mockGetPublicUrl).toHaveBeenCalledWith('s26-anime_pop.jpg');
  });

  it('passes a storage path through unchanged', () => {
    expect(publicPresetUrl('s07-retro_cartoon.jpg')).toContain('s07-retro_cartoon.jpg');
  });
});
