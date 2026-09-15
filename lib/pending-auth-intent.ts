import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PendingAuthIntent } from './auth-links';

const STORAGE_KEY = '@fluenci/pending-auth-intent';

export async function savePendingAuthIntent(intent: PendingAuthIntent): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
    ...intent,
    email: intent.email.trim().toLowerCase(),
  }));
}

export async function readPendingAuthIntent(): Promise<PendingAuthIntent | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PendingAuthIntent>;
    if (
      (value.type !== 'recovery' && value.type !== 'signup') ||
      typeof value.email !== 'string' ||
      typeof value.createdAt !== 'number'
    ) {
      await clearPendingAuthIntent();
      return null;
    }
    return value as PendingAuthIntent;
  } catch {
    await clearPendingAuthIntent();
    return null;
  }
}

export async function clearPendingAuthIntent(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
