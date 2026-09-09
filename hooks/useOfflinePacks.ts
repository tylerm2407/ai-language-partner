import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import { useAppStore, effectiveTier } from '../stores/useAppStore';
import {
  clearAllPacks,
  downloadBookPack,
  downloadNewsPack,
  downloadUnitPack,
  enforcePackBudget,
  getAutoDownload,
  listPacks,
  offlinePacksEntitled,
  OFFLINE_PACKS_MAX_BYTES,
  packId,
  removePack,
  setAutoDownload,
  type BookPackTarget,
  type NewsPackTarget,
  type OfflinePack,
  type PackKind,
  type PackProgress,
  type UnitPackTarget,
} from '../lib/offline-packs';

export type PackTarget =
  | { kind: 'unit'; target: UnitPackTarget }
  | { kind: 'book'; target: BookPackTarget }
  | { kind: 'news'; target: NewsPackTarget };

export interface OfflinePacksApi {
  /** The plan sells offline packs. Everything below is inert when false. */
  entitled: boolean;
  packs: OfflinePack[];
  totalBytes: number;
  maxBytes: number;
  isLoading: boolean;
  autoDownload: boolean;
  setAutoDownload: (on: boolean) => Promise<void>;
  /** Progress for an in-flight download keyed by pack id, else undefined. */
  progressFor: (kind: PackKind, refId: string) => PackProgress | undefined;
  hasPack: (kind: PackKind, refId: string) => boolean;
  download: (spec: PackTarget) => Promise<OfflinePack | null>;
  remove: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Last download failure, for the row that asked. Cleared on the next attempt. */
  lastError: string | null;
}

/**
 * The learner-facing side of lib/offline-packs.ts: what is on the device,
 * whether this plan may add to it, and the buttons that do.
 */
export function useOfflinePacks(): OfflinePacksApi {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const subscription = useAppStore((s) => s.subscription);
  const entitledTier = useAppStore((s) => s.entitledTier);
  const entitled = offlinePacksEntitled(effectiveTier(subscription, entitledTier));

  const [packs, setPacks] = useState<OfflinePack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [autoDownload, setAuto] = useState(true);
  const [progress, setProgress] = useState<Record<string, PackProgress>>({});
  const [lastError, setLastError] = useState<string | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setPacks([]);
      setIsLoading(false);
      return;
    }
    const [list, auto] = await Promise.all([listPacks(userId), getAutoDownload(userId)]);
    if (!mounted.current) return;
    setPacks(list);
    setAuto(auto);
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    mounted.current = true;
    refresh().catch((err) => console.warn('[offline-packs] refresh failed:', err));
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  const totalBytes = useMemo(() => packs.reduce((sum, p) => sum + p.bytes, 0), [packs]);

  const hasPack = useCallback(
    (kind: PackKind, refId: string) => packs.some((p) => p.id === packId(kind, refId)),
    [packs],
  );

  const progressFor = useCallback(
    (kind: PackKind, refId: string) => progress[packId(kind, refId)],
    [progress],
  );

  const download = useCallback(
    async (spec: PackTarget): Promise<OfflinePack | null> => {
      if (!userId || !entitled) return null;
      const refId = spec.kind === 'unit' ? spec.target.unitId : spec.kind === 'book' ? spec.target.bookId : `${spec.target.language}:${spec.target.date ?? 'today'}`;
      const id = packId(spec.kind, refId);
      setLastError(null);
      setProgress((prev) => ({ ...prev, [id]: { done: 0, total: 1 } }));
      const onProgress = (p: PackProgress) => {
        if (mounted.current) setProgress((prev) => ({ ...prev, [id]: p }));
      };
      try {
        let pack: OfflinePack;
        if (spec.kind === 'unit') pack = await downloadUnitPack(userId, spec.target, { onProgress });
        else if (spec.kind === 'book') pack = await downloadBookPack(userId, spec.target, { onProgress });
        else pack = await downloadNewsPack(userId, spec.target, { onProgress });
        await enforcePackBudget(userId);
        await refresh();
        return pack;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Download failed';
        if (mounted.current) setLastError(message);
        return null;
      } finally {
        if (mounted.current) {
          setProgress((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        }
      }
    },
    [userId, entitled, refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!userId) return;
      await removePack(userId, id);
      await refresh();
    },
    [userId, refresh],
  );

  const clearAll = useCallback(async () => {
    if (!userId) return;
    await clearAllPacks(userId);
    await refresh();
  }, [userId, refresh]);

  const setAutoDownloadPref = useCallback(
    async (on: boolean) => {
      if (!userId) return;
      setAuto(on);
      await setAutoDownload(userId, on);
    },
    [userId],
  );

  return {
    entitled,
    packs,
    totalBytes,
    maxBytes: OFFLINE_PACKS_MAX_BYTES,
    isLoading,
    autoDownload,
    setAutoDownload: setAutoDownloadPref,
    progressFor,
    hasPack,
    download,
    remove,
    clearAll,
    refresh,
    lastError,
  };
}
