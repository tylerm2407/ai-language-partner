/**
 * Photo-to-avatar generation (client half).
 *
 * The device captures or picks a photo, downscales it here, and hands the
 * bytes to the `generate-avatar` Edge Function, which owns the art-direction
 * prompt, the paid-tier check, the daily quota, and the image-model call.
 *
 * Nothing in this file decides entitlement. The tier gate lives server-side
 * (CLAUDE.md §1.2); `AVATAR_REQUIRES_PLAN` coming back from the function is
 * the authority, and the UI reacts to it rather than pre-judging it.
 *
 * The source photo is never uploaded to storage and never written to a table —
 * it is posted to the function, used in memory, and discarded.
 */
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { supabase } from './supabase';
import type { AvatarStyleOption } from '../types';

/**
 * Longest edge of the photo we send. The model renders a 1024x1024 portrait,
 * so anything larger is bytes on the wire for no quality gain — a raw 12MP
 * selfie is ~8x this with no effect on the result.
 */
const MAX_UPLOAD_EDGE = 1024;

/** JPEG quality for the downscaled upload. */
const UPLOAD_QUALITY = 0.85;

/**
 * Largest file accepted from the Files app. The image library hands us
 * camera-roll photos with predictable sizes, but a file browser can surface a
 * 100MB TIFF — reading that into memory to downscale it would stall the UI.
 */
const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** Image types the downscaler can decode. */
const ACCEPTED_FILE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/heic', 'image/heif'];

export class AvatarGenerationError extends Error {
  readonly code?: string;
  readonly status?: number;

  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = 'AvatarGenerationError';
    this.code = code;
    this.status = status;
  }
}

export interface GeneratedAvatar {
  /** Storage path inside the private `avatars` bucket. */
  path: string;
  styleKey: string;
}

/**
 * Styles offered in the picker. Labels only — the image prompts live
 * server-side in `supabase/functions/_shared/avatar-styles.ts` and must never
 * be shipped in the bundle (CLAUDE.md §6).
 */
export const AVATAR_STYLE_OPTIONS: AvatarStyleOption[] = [
  {
    key: 'anime_pop',
    label: 'Anime Pop',
    description: 'Bold cel-shaded anime with clean linework and saturated colour.',
  },
];

/** A photo chosen by the user, already downscaled and encoded. */
export interface PreparedPhoto {
  base64: string;
  /** Local file URI, for showing a preview before generating. */
  uri: string;
  mimeType: 'image/jpeg';
}

async function prepare(uri: string): Promise<PreparedPhoto> {
  const result = await manipulateAsync(
    uri,
    [{ resize: { width: MAX_UPLOAD_EDGE } }],
    { compress: UPLOAD_QUALITY, format: SaveFormat.JPEG, base64: true }
  );

  if (!result.base64) {
    throw new AvatarGenerationError('Could not read that photo. Please try another.');
  }

  return { base64: result.base64, uri: result.uri, mimeType: 'image/jpeg' };
}

/**
 * Take a photo with the camera. Returns null if the user cancels.
 * Throws if permission is denied, so the caller can explain why.
 */
export async function capturePhoto(): Promise<PreparedPhoto | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new AvatarGenerationError(
      'Fluenci needs camera access to take your avatar photo. You can enable it in Settings.',
      'PERMISSION_DENIED'
    );
  }

  // The iOS Simulator has no camera, and some devices refuse the capture UI.
  // Both surface here as a throw, which reads to the user as "nothing
  // happened" unless it is turned into an actionable message.
  let result;
  try {
    result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
  } catch {
    throw new AvatarGenerationError(
      'The camera is not available on this device. Choose an existing photo instead.',
      'CAMERA_UNAVAILABLE'
    );
  }

  if (result.canceled || !result.assets?.[0]) return null;
  return prepare(result.assets[0].uri);
}

/**
 * Pick an existing photo. Returns null if the user cancels.
 * Throws if permission is denied.
 */
export async function pickPhoto(): Promise<PreparedPhoto | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new AvatarGenerationError(
      'Fluenci needs photo access to use a picture for your avatar. You can enable it in Settings.',
      'PERMISSION_DENIED'
    );
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  return prepare(result.assets[0].uri);
}

/**
 * Pick an image from the Files app (iCloud Drive, On My iPhone, third-party
 * providers). Returns null if the user cancels.
 *
 * This exists alongside `pickPhoto` because a screenshot AirDropped or synced
 * from a computer often lands in Files rather than the photo library, and the
 * image picker cannot see it there. No permission prompt — the document picker
 * grants access to exactly the file the user chose.
 */
export async function pickFile(): Promise<PreparedPhoto | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ACCEPTED_FILE_TYPES,
    // Copy into the cache so the downscaler can read it — a security-scoped
    // provider URI is not readable by other Expo APIs without this.
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];

  if (asset.size != null && asset.size > MAX_FILE_BYTES) {
    throw new AvatarGenerationError(
      'That file is too large. Choose an image under 25MB.',
      'FILE_TOO_LARGE'
    );
  }

  // The `type` filter is advisory on some providers, so re-check rather than
  // trusting it and failing later inside the downscaler.
  if (asset.mimeType && !ACCEPTED_FILE_TYPES.includes(asset.mimeType.toLowerCase())) {
    throw new AvatarGenerationError(
      'That file is not an image. Choose a PNG, JPEG, or HEIC.',
      'NOT_AN_IMAGE'
    );
  }

  return prepare(asset.uri);
}

/**
 * Generate the avatar. On success the user's profile already points at the new
 * image server-side, so the caller only needs to refresh the profile.
 *
 * Mirrors the error unwrapping in `lib/ai.ts`: supabase-js collapses any non-2xx
 * into a generic message, and the real cause (AVATAR_REQUIRES_PLAN,
 * DAILY_AVATAR_LIMIT_REACHED, IMAGE_REJECTED) is only in `error.context`.
 */
export async function generateAvatar(
  photo: PreparedPhoto,
  styleKey: string
): Promise<GeneratedAvatar> {
  const { data, error } = await supabase.functions.invoke('generate-avatar', {
    body: { styleKey, imageBase64: photo.base64, mimeType: photo.mimeType },
  });

  if (error) {
    let detail = error.message;
    let code: string | undefined;
    let status: number | undefined;

    try {
      const ctx = (error as unknown as Record<string, unknown>).context;
      if (ctx && typeof (ctx as Response).json === 'function') {
        status = (ctx as Response).status;
        const body = await (ctx as Response).json();
        if (body?.error) detail = body.error;
        if (body?.code) code = body.code;
      }
    } catch {
      // Body wasn't JSON — fall through with the generic message.
    }

    throw new AvatarGenerationError(detail, code, status);
  }

  if (!data?.path) {
    throw new AvatarGenerationError('Avatar generation did not return an image.');
  }

  return { path: data.path as string, styleKey: data.styleKey as string };
}
