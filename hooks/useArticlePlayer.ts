/**
 * Playback for a narrated news article.
 *
 * Built on react-native-track-player rather than the app's existing
 * `useAudioPlayer` because this is the first surface that needs playback to
 * outlive the screen: background listening and lock-screen controls. expo-av
 * offers neither — it has no MPNowPlayingInfoCenter or MediaSession binding at
 * all, and no Android foreground service — so no amount of wrapping it would
 * have got there.
 *
 * `useAudioPlayer` stays exactly as it is for everything else. One-shot lesson
 * and chat clips do not want a media session, a notification, or a lock-screen
 * entry, and giving them one would put "Fluenci — el agua" on the lock screen
 * every time a learner tapped a vocabulary word.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
  Event,
  State,
  useProgress,
  useTrackPlayerEvents,
} from 'react-native-track-player';
import {
  enterNewsPlaybackSession,
  releaseNewsPlaybackSession,
} from '../lib/audio-session';
import { REMOTE_JUMP_SECONDS } from '../lib/news-playback-service';

export type ArticlePlayerStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'ended'
  | 'error';

/** Offered speeds. Slower is a comprehension aid, not a novelty — a learner
 *  reading at B1 in their third language is not a podcast listener at 2x. */
export const PLAYBACK_RATES = [0.75, 1.0, 1.25] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

export const SKIP_SECONDS = REMOTE_JUMP_SECONDS;

export interface ArticleTrack {
  id: string;
  url: string;
  title: string;
  /** Shown as the artist line on the lock screen. */
  subtitle: string;
  artworkUrl?: string | null;
  /** Server's estimate, used to render a duration before the file loads. */
  durationMs?: number | null;
}

/**
 * Player setup is process-global in RNTP — `setupPlayer` throws if called
 * twice — so it is guarded here rather than per-mount.
 */
let playerReady: Promise<void> | null = null;

async function ensurePlayer(): Promise<void> {
  if (!playerReady) {
    playerReady = (async () => {
      await TrackPlayer.setupPlayer({ autoHandleInterruptions: true });
      await TrackPlayer.updateOptions({
        android: {
          // Stopping when the app is swiped away is the honest default for a
          // single article: leaving a notification behind for something the
          // learner has closed reads as the app refusing to quit.
          appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
        },
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.Stop,
          Capability.SeekTo,
          Capability.JumpForward,
          Capability.JumpBackward,
        ],
        compactCapabilities: [Capability.Play, Capability.Pause],
        forwardJumpInterval: SKIP_SECONDS,
        backwardJumpInterval: SKIP_SECONDS,
      });
    })().catch((err) => {
      // Let the next attempt retry rather than caching a rejected promise
      // forever — a transient setup failure must not disable audio for the
      // rest of the session.
      playerReady = null;
      throw err;
    });
  }
  return playerReady;
}

export interface ArticlePlayer {
  status: ArticlePlayerStatus;
  positionMs: number;
  durationMs: number;
  rate: PlaybackRate;
  error: string | null;
  load: (track: ArticleTrack) => Promise<void>;
  playPause: () => Promise<void>;
  seekToMs: (ms: number) => Promise<void>;
  skipBy: (deltaSeconds: number) => Promise<void>;
  cycleRate: () => Promise<void>;
  unload: () => Promise<void>;
}

export function useArticlePlayer(): ArticlePlayer {
  const [status, setStatus] = useState<ArticlePlayerStatus>('idle');
  const [rate, setRate] = useState<PlaybackRate>(1.0);
  const [error, setError] = useState<string | null>(null);
  // Seeded from the server's estimate so the duration label is right before
  // the file has loaded; replaced by the real value once RNTP reports it.
  const [estimatedDurationMs, setEstimatedDurationMs] = useState(0);
  const loadedRef = useRef(false);

  const progress = useProgress(250);

  useTrackPlayerEvents([Event.PlaybackState, Event.PlaybackError], (event) => {
    if (event.type === Event.PlaybackError) {
      setError('This article could not be played.');
      setStatus('error');
      return;
    }
    if (event.type === Event.PlaybackState) {
      switch (event.state) {
        case State.Playing:
          setStatus('playing');
          break;
        case State.Paused:
          setStatus('paused');
          break;
        case State.Ended:
          setStatus('ended');
          break;
        case State.Buffering:
        case State.Loading:
          setStatus('loading');
          break;
        default:
          break;
      }
    }
  });

  const load = useCallback(async (track: ArticleTrack) => {
    setStatus('loading');
    setError(null);
    setEstimatedDurationMs(track.durationMs ?? 0);
    try {
      await enterNewsPlaybackSession();
      await ensurePlayer();
      await TrackPlayer.reset();
      await TrackPlayer.add({
        id: track.id,
        url: track.url,
        title: track.title,
        artist: track.subtitle,
        artwork: track.artworkUrl ?? undefined,
      });
      loadedRef.current = true;
      setStatus('ready');
    } catch (err) {
      loadedRef.current = false;
      setError(err instanceof Error ? err.message : 'This article could not be played.');
      setStatus('error');
    }
  }, []);

  const playPause = useCallback(async () => {
    if (!loadedRef.current) return;
    const state = await TrackPlayer.getPlaybackState();
    if (state.state === State.Playing) await TrackPlayer.pause();
    else await TrackPlayer.play();
  }, []);

  const seekToMs = useCallback(async (ms: number) => {
    if (!loadedRef.current) return;
    const durationSec = (await TrackPlayer.getProgress()).duration;
    const target = Math.min(Math.max(0, ms / 1000), durationSec || Infinity);
    await TrackPlayer.seekTo(target);
  }, []);

  const skipBy = useCallback(async (deltaSeconds: number) => {
    if (!loadedRef.current) return;
    await TrackPlayer.seekBy(deltaSeconds);
  }, []);

  const cycleRate = useCallback(async () => {
    const next = PLAYBACK_RATES[(PLAYBACK_RATES.indexOf(rate) + 1) % PLAYBACK_RATES.length];
    setRate(next);
    if (loadedRef.current) await TrackPlayer.setRate(next);
  }, [rate]);

  const unload = useCallback(async () => {
    loadedRef.current = false;
    setStatus('idle');
    try {
      await TrackPlayer.reset();
    } finally {
      // Always hand the session back, even if reset threw: an article player
      // still holding it is how the next lesson plays out of the earpiece.
      await releaseNewsPlaybackSession();
    }
  }, []);

  // Leaving the screen must stop the narration and release the session.
  useEffect(() => {
    return () => {
      void unload();
    };
  }, [unload]);

  return {
    status,
    positionMs: Math.round(progress.position * 1000),
    durationMs: progress.duration > 0 ? Math.round(progress.duration * 1000) : estimatedDurationMs,
    rate,
    error,
    load,
    playPause,
    seekToMs,
    skipBy,
    cycleRate,
    unload,
  };
}
