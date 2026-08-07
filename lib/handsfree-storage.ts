/**
 * Device-local hands-free preferences.
 *
 * Two things, both deliberately local rather than on the profile: the safety
 * acknowledgement (a per-device concern — a learner who acknowledged it on
 * their phone has not acknowledged it on a borrowed tablet) and the last
 * chosen session length (a convenience, not data worth a round trip).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const HANDSFREE_STORAGE_VERSION = 1;

const ackKey = (userId: string) => `handsfree:ack:v${HANDSFREE_STORAGE_VERSION}:${userId}`;
const configKey = (userId: string) => `handsfree:config:v${HANDSFREE_STORAGE_VERSION}:${userId}`;

export interface HandsFreeStoredConfig {
  targetDurationMs: number;
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
    const value = (parsed as Record<string, unknown>).targetDurationMs;
    return typeof value === 'number' && value > 0 ? { targetDurationMs: value } : null;
  } catch {
    return null;
  }
}

export async function saveHandsFreeConfig(
  userId: string,
  config: HandsFreeStoredConfig,
): Promise<void> {
  try {
    await AsyncStorage.setItem(configKey(userId), JSON.stringify(config));
  } catch {
    // Non-fatal: the default duration is offered next time.
  }
}
