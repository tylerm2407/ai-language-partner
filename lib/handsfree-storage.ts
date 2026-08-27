/**
 * Device-local hands-free preferences.
 *
 * Two things, both deliberately local rather than on the profile: the safety
 * acknowledgement (a per-device concern — a learner who acknowledged it on
 * their phone has not acknowledged it on a borrowed tablet) and the last
 * chosen session length (a convenience, not data worth a round trip).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Key-namespace version, shared by both entries.
 *
 * Do NOT bump this to retire a config shape: it is baked into the ack key too,
 * so a bump would silently re-show the driving-safety notice to every existing
 * learner. Config shape changes go through HANDSFREE_CONFIG_SCHEMA_VERSION
 * below, which is what the rest of this repo's stores do (see
 * OFFLINE_QUEUE_SCHEMA_VERSION, LESSON_SESSION_SCHEMA_VERSION,
 * READ_CACHE_SCHEMA_VERSION).
 */
export const HANDSFREE_STORAGE_VERSION = 1;

/**
 * Schema version of the config *value*. Blobs carrying any other version are
 * discarded on load rather than read field by field.
 *
 * The ack entry has no envelope because it has no shape to get wrong — it is a
 * bare ISO timestamp whose only meaning is "this key exists".
 */
export const HANDSFREE_CONFIG_SCHEMA_VERSION = 1;

const ackKey = (userId: string) => `handsfree:ack:v${HANDSFREE_STORAGE_VERSION}:${userId}`;
const configKey = (userId: string) => `handsfree:config:v${HANDSFREE_STORAGE_VERSION}:${userId}`;

export interface HandsFreeStoredConfig {
  targetDurationMs: number;
}

/** What actually goes on disk: the caller's config plus a schema stamp. */
interface StoredConfigEnvelope extends HandsFreeStoredConfig {
  version: number;
}

/**
 * Whether the driving-safety notice has been acknowledged on this device.
 *
 * Fails CLOSED: a storage error returns false, so the notice is shown again.
 * Showing a safety message twice is a minor annoyance; skipping it because
 * AsyncStorage hiccuped is not a trade worth making.
 */
export async function hasAcknowledgedDrivingSafety(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ackKey(userId))) !== null;
  } catch {
    return false;
  }
}

export async function acknowledgeDrivingSafety(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(ackKey(userId), new Date().toISOString());
  } catch {
    // Non-fatal: the learner sees the notice again next time.
  }
}

export async function loadHandsFreeConfig(
  userId: string,
): Promise<HandsFreeStoredConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(configKey(userId));
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;

    const v = parsed as Record<string, unknown>;
    const duration = v.targetDurationMs;

    // One discard branch for "we cannot vouch for this blob": a foreign schema
    // version, a pre-envelope blob from before this stamp existed, or an
    // in-version blob whose duration is unusable. Losing a remembered session
    // length costs the learner one tap on the duration picker; guessing at the
    // meaning of a shape we did not write costs a crash in the session loop.
    if (
      v.version !== HANDSFREE_CONFIG_SCHEMA_VERSION ||
      typeof duration !== 'number' ||
      !Number.isFinite(duration) ||
      duration <= 0
    ) {
      await AsyncStorage.removeItem(configKey(userId));
      return null;
    }

    return { targetDurationMs: duration };
  } catch {
    return null;
  }
}

export async function saveHandsFreeConfig(
  userId: string,
  config: HandsFreeStoredConfig,
): Promise<void> {
  try {
    const envelope: StoredConfigEnvelope = {
      version: HANDSFREE_CONFIG_SCHEMA_VERSION,
      targetDurationMs: config.targetDurationMs,
    };
    await AsyncStorage.setItem(configKey(userId), JSON.stringify(envelope));
  } catch {
    // Non-fatal: the default duration is offered next time.
  }
}
