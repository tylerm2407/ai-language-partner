/**
 * Photo-to-avatar generation (client half).
 *
 * The device captures (in-app camera, `components/avatar/AvatarCameraView`)
 * or picks a photo, downscales it here, and hands the bytes to the
 * `generate-avatar` Edge Function, which owns the art-direction
 * prompt, the paid-tier check, the monthly quota, and the image-model call.
 *
 * The render takes minutes, not seconds — longer than any request a phone can
 * hold open — so the function answers with a job id the moment entitlement
 * clears and finishes in the background. `generateAvatar` then polls the
 * `avatar_jobs` row (migration 112) until it settles.
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
import { getAvatarJob } from './supabase-queries';
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
 * Fallback styles for the picker, used only when the catalogue cannot be
 * fetched (offline, or the function is down). Labels only — the image prompts
 * live server-side in `supabase/functions/_shared/avatar-styles.ts` and must
 * never be shipped in the bundle (CLAUDE.md §6).
 *
 * This list is deliberately NOT the source of truth. It used to be, and that
 * made every new style a two-place edit where forgetting the second place
 * failed silently: the server would happily render a style the picker never
 * offered. `fetchAvatarStyles()` asks the server instead, and
 * lib/avatar-styles-sync.test.ts asserts every key here still exists there so
 * the fallback cannot rot into offering a style that no longer renders.
 */
export const AVATAR_STYLE_OPTIONS: AvatarStyleOption[] = [
  {
    key: 'anime_pop',
    label: 'Anime Pop',
    description: 'Bold cel-shaded anime with clean linework and saturated colour.',
  },
];

/**
 * The style catalogue, straight from the server.
 *
 * Falls back to AVATAR_STYLE_OPTIONS rather than throwing: a learner who is
 * offline, or hitting a wobbling function, should still see a picker they can
 * use. Generation itself re-validates the key server-side, so a stale fallback
 * entry fails loudly at generate time rather than rendering something wrong.
 */
export async function fetchAvatarStyles(): Promise<AvatarStyleOption[]> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-avatar', {
      body: { action: 'styles' },
    });
    if (error) throw error;
    const styles = (data as { styles?: unknown })?.styles;
    if (!Array.isArray(styles) || styles.length === 0) return AVATAR_STYLE_OPTIONS;
    // Rebuild each entry from the three safe fields rather than passing the
    // server object through. listAvatarStyles() already strips the prompt, so
    // this is defence in depth — but it is the difference between a
    // server-side regression being invisible and it being unable to reach the
    // UI at all (CLAUDE.md §6: never expose model prompts).
    const valid = styles
      .filter(
        (s): s is AvatarStyleOption =>
          !!s && typeof s.key === 'string' && typeof s.label === 'string',
      )
      .map(({ key, label, description }) => ({
        key,
        label,
        description: typeof description === 'string' ? description : '',
      }));
    return valid.length > 0 ? valid : AVATAR_STYLE_OPTIONS;
  } catch (err) {
    console.warn('[avatar] style catalogue fetch failed, using fallback:', err);
    return AVATAR_STYLE_OPTIONS;
  }
}

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

/** A rectangle in image pixels, as `expo-image-manipulator`'s `crop` expects it. */
export interface CropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

/**
 * The square of the captured image that sat under a centred guide when the
 * live preview was drawn with `cover` scaling (expo-camera's default FILL).
 *
 * Under `cover` the image is scaled so its smaller side fills the view, so one
 * view point equals `min(imageW / viewW, imageH / viewH)` image pixels. The
 * guide is centred, so the crop is too. Clamped to the image bounds so a
 * swapped width/height from the native side (orientation quirks) can only make
 * the crop slightly smaller, never invalid.
 */
export function coverCropRect(
  image: { width: number; height: number },
  view: { width: number; height: number },
  guideSize: number,
): CropRect {
  const pxPerPt = Math.min(image.width / view.width, image.height / view.height);
  const side = Math.floor(Math.min(guideSize * pxPerPt, image.width, image.height));
  return {
    originX: Math.max(0, Math.floor((image.width - side) / 2)),
    originY: Math.max(0, Math.floor((image.height - side) / 2)),
    width: side,
    height: side,
  };
}

/**
 * Crop a photo taken by the in-app camera to `rect`, then downscale and
 * encode it like any other picked photo.
 */
export async function prepareCapturedPhoto(uri: string, rect: CropRect): Promise<PreparedPhoto> {
  const result = await manipulateAsync(
    uri,
    [{ crop: rect }, { resize: { width: MAX_UPLOAD_EDGE } }],
    { compress: UPLOAD_QUALITY, format: SaveFormat.JPEG, base64: true }
  );

  if (!result.base64) {
    throw new AvatarGenerationError('Could not read that photo. Please try again.');
  }

  return { base64: result.base64, uri: result.uri, mimeType: 'image/jpeg' };
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

/** How often to ask whether the job has settled. */
const JOB_POLL_INTERVAL_MS = 3_000;

/**
 * How long to wait for a job before giving up on the client. The server
 * abandons the provider call at 300s and settles the row failed, so this only
 * fires if the function instance died mid-render (wall clock, OOM) and never
 * wrote back.
 */
const JOB_POLL_DEADLINE_MS = 6 * 60 * 1000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Generate the avatar. On success the user's profile already points at the new
 * image server-side, so the caller only needs to refresh the profile.
 *
 * Two phases. The invoke is quick: it either refuses (and the real reason —
 * AVATAR_REQUIRES_PLAN, MONTHLY_AVATAR_LIMIT_REACHED — is only in
 * `error.context`, mirroring the unwrapping in `lib/ai.ts`) or hands back a
 * job id with a 202. The wait is the poll loop below: a settled row carries
 * either the stored path or the same learner-facing message the synchronous
 * response used to.
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

  // A server that still answers synchronously (or a future fast path) returns
  // the path directly; honour it rather than polling for a job that never was.
  if (typeof data?.path === 'string' && data.path) {
    return { path: data.path as string, styleKey: (data.styleKey as string) ?? styleKey };
  }

  const jobId = typeof data?.jobId === 'string' ? (data.jobId as string) : '';
  if (!jobId) {
    throw new AvatarGenerationError('Avatar generation did not return an image.');
  }

  return waitForAvatarJob(jobId, styleKey);
}

/** Poll one job until it settles. Exported for the sheet's resume path and tests. */
export async function waitForAvatarJob(
  jobId: string,
  styleKey: string,
  { intervalMs = JOB_POLL_INTERVAL_MS, deadlineMs = JOB_POLL_DEADLINE_MS } = {}
): Promise<GeneratedAvatar> {
  const startedAt = Date.now();
  // Tolerate a few consecutive read failures (lie-fi, a token refresh) rather
  // than abandoning a render we have already paid for.
  let consecutiveReadFailures = 0;

  while (Date.now() - startedAt < deadlineMs) {
    await sleep(intervalMs);

    let job;
    try {
      job = await getAvatarJob(jobId);
      consecutiveReadFailures = 0;
    } catch (err) {
      consecutiveReadFailures += 1;
      if (consecutiveReadFailures >= 5) {
        throw new AvatarGenerationError(
          'Lost the connection while drawing your avatar. Check your profile in a minute — it may have finished.',
          'NETWORK'
        );
      }
      console.warn('[avatar] job poll failed, retrying:', err);
      continue;
    }

    if (!job) {
      throw new AvatarGenerationError('Avatar generation did not return an image.', 'JOB_MISSING');
    }
    if (job.status === 'done' && job.avatarPath) {
      return { path: job.avatarPath, styleKey: job.styleKey || styleKey };
    }
    if (job.status === 'failed') {
      throw new AvatarGenerationError(
        job.errorMessage ?? 'Avatar generation failed. Please try again.',
        job.errorCode ?? 'GENERATION_FAILED'
      );
    }
  }

  throw new AvatarGenerationError(
    'Avatar generation is taking longer than expected. Please try again.',
    'GENERATION_TIMEOUT'
  );
}
