/**
 * The react-native-track-player playback service.
 *
 * This runs OUTSIDE the React tree — it is what the iOS lock screen / Control
 * Centre and the Android media notification dispatch into, including while the
 * app is backgrounded or has been killed and relaunched by a transport button.
 * So it must not touch component state, navigation, or any hook.
 *
 * Deliberately minimal: it maps remote transport events onto the player and
 * nothing else. Anything richer (analytics, marking an article as heard) would
 * be running at moments no screen is mounted to observe the result.
 */
import TrackPlayer, { Event } from 'react-native-track-player';

/** How far a lock-screen jump moves. Matches the in-app ±15s controls. */
export const REMOTE_JUMP_SECONDS = 15;

export async function PlaybackService(): Promise<void> {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.stop());

  TrackPlayer.addEventListener(Event.RemoteSeek, ({ position }) =>
    TrackPlayer.seekTo(position),
  );

  // Jump rather than next/previous track: a news article is a single item, so
  // "next track" has nothing to go to. Skipping within the piece is what a
  // listener actually wants from a lock-screen button here.
  TrackPlayer.addEventListener(Event.RemoteJumpForward, ({ interval }) =>
    TrackPlayer.seekBy(interval ?? REMOTE_JUMP_SECONDS),
  );
  TrackPlayer.addEventListener(Event.RemoteJumpBackward, ({ interval }) =>
    TrackPlayer.seekBy(-(interval ?? REMOTE_JUMP_SECONDS)),
  );

  // Headphones unplugged, or a call arrived. Pausing is the expected courtesy;
  // continuing to narrate into a car speaker after someone unplugs is not.
  TrackPlayer.addEventListener(Event.RemoteDuck, async ({ paused, permanent }) => {
    if (permanent) {
      await TrackPlayer.pause();
      return;
    }
    if (paused) await TrackPlayer.pause();
    else await TrackPlayer.play();
  });
}
