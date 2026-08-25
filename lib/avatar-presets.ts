/**
 * Premade avatar library (client half).
 *
 * The catalogue lives in `avatar_presets` (migration 081) and the artwork in
 * the PUBLIC `avatar-presets` bucket. Both are read-only to clients: picking a
 * preset writes `user_profiles.avatar_kind = 'preset'` and `avatar_preset_id`
 * through setAvatarKind, and nothing else.
 *
 * Why the images are public, unlike the generated ones in `avatars`: these are
 * stock artwork shipped with the product, identical for every learner, and
 * rendered as a fifty-tile grid before anyone has trusted us with a photo. A
 * signed URL per tile would be fifty signing round-trips to draw one screen.
 * The generated avatars stay private because they are pictures of the learner.
 *
 * Served from the database rather than bundled so the library can grow, be
 * reordered, or have a bad tile retired without an App Store release — the
 * same reasoning as the style catalogue in generate-avatar.
 */
import { supabase } from './supabase';

const BUCKET = 'avatar-presets';

export interface AvatarPreset {
  /** Stable id, e.g. `s26-anime_pop`. Stored in user_profiles.avatar_preset_id. */
  id: string;
  /** Art-direction style this tile was rendered in. */
  styleKey: string;
  /** Fully-resolved public image URL. */
  url: string;
}

/**
 * Fetch the published preset library, in display order.
 *
 * Throws rather than returning [] on failure. An empty grid and a broken grid
 * look identical to a learner, and the caller needs to tell them apart to show
 * a retry instead of an apparently-empty library (CLAUDE.md §5).
 */
export async function fetchAvatarPresets(): Promise<AvatarPreset[]> {
  const { data, error } = await supabase
    .from('avatar_presets')
    .select('id, style_key, storage_path')
    .eq('is_published', true)
    .order('sort_order', { ascending: true })
    .limit(200);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id as string,
    styleKey: row.style_key as string,
    url: publicPresetUrl(row.storage_path as string),
  }));
}

/**
 * Public URL for a preset image.
 *
 * Exported so a saved `avatar_preset_id` can be rendered without fetching the
 * whole catalogue — the path is derived from the id, which is the filename.
 */
export function publicPresetUrl(storagePath: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

/** Public URL for a preset id (`s26-anime_pop` -> its .jpg in the bucket). */
export function presetUrlFromId(presetId: string): string {
  return publicPresetUrl(`${presetId}.jpg`);
}
