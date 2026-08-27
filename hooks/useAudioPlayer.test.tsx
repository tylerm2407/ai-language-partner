/**
 * `useAudioPlayer` must release its native player on unmount.
 *
 * The regression this pins: the hook exposed a `cleanup()` but nothing ever
 * invoked it on teardown, and only one of its five call sites even
 * destructured it. So every exercise that played a clip left an `Audio.Sound`
 * loaded — on iOS a real native player holding a decoder and part of the audio
 * session — and they accumulated across a lesson.
 *
 * `didJustFinish` also arrives from native and can land after the component is
 * gone, which is the ordinary case for a listening exercise that advances
 * while its clip is still playing.
 */
import React from 'react';
import TestRenderer from 'react-test-renderer';

const mockUnloadAsync = jest.fn().mockResolvedValue(undefined);
const mockStopAsync = jest.fn().mockResolvedValue(undefined);
const mockSetOnPlaybackStatusUpdate = jest.fn();
const mockCreateAsync = jest.fn();

jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: (...args: unknown[]) => mockCreateAsync(...args),
    },
  },
}));
jest.mock('../lib/audio-session', () => ({
  setAudioSessionMode: jest.fn().mockResolvedValue(undefined),
}));

import { useAudioPlayer } from './useAudioPlayer';

/** Exposes the hook's api to the test without rendering anything. */
function Harness({ onReady }: { onReady: (api: ReturnType<typeof useAudioPlayer>) => void }) {
  const api = useAudioPlayer();
  onReady(api);
  return null;
}

function mountPlayer() {
  let api!: ReturnType<typeof useAudioPlayer>;
  let r!: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    r = TestRenderer.create(<Harness onReady={(a) => { api = a; }} />);
  });
  return { get api() { return api; }, renderer: r };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUnloadAsync.mockResolvedValue(undefined);
  mockCreateAsync.mockResolvedValue({
    sound: {
      unloadAsync: mockUnloadAsync,
      stopAsync: mockStopAsync,
      setOnPlaybackStatusUpdate: mockSetOnPlaybackStatusUpdate,
    },
  });
});

describe('useAudioPlayer teardown', () => {
  it('unloads the sound when the component unmounts', async () => {
    const p = mountPlayer();
    await TestRenderer.act(async () => {
      await p.api.play('file://clip.mp3');
    });
    expect(mockCreateAsync).toHaveBeenCalledTimes(1);
    expect(mockUnloadAsync).not.toHaveBeenCalled();

    TestRenderer.act(() => {
      p.renderer.unmount();
    });

    // THE regression: this used to be zero, and the player stayed alive.
    expect(mockUnloadAsync).toHaveBeenCalledTimes(1);
  });

  it('detaches the status listener on unmount', async () => {
    // A retained callback keeps the closure — and the component — reachable.
    const p = mountPlayer();
    await TestRenderer.act(async () => {
      await p.api.play('file://clip.mp3');
    });
    TestRenderer.act(() => {
      p.renderer.unmount();
    });
    expect(mockSetOnPlaybackStatusUpdate).toHaveBeenCalledWith(null);
  });

  it('unloads a clip that finished loading after unmount', async () => {
    // The teardown effect has already run by then, so nothing else would ever
    // release this player.
    let resolveCreate!: (v: unknown) => void;
    mockCreateAsync.mockReturnValue(new Promise((res) => { resolveCreate = res; }));

    const p = mountPlayer();
    let playPromise!: Promise<void>;
    TestRenderer.act(() => {
      playPromise = p.api.play('file://slow.mp3');
    });
    TestRenderer.act(() => {
      p.renderer.unmount();
    });

    await TestRenderer.act(async () => {
      resolveCreate({
        sound: {
          unloadAsync: mockUnloadAsync,
          stopAsync: mockStopAsync,
          setOnPlaybackStatusUpdate: mockSetOnPlaybackStatusUpdate,
        },
      });
      await playPromise;
    });

    expect(mockUnloadAsync).toHaveBeenCalledTimes(1);
  });

  it('replaces, rather than stacks, players across successive plays', async () => {
    const p = mountPlayer();
    await TestRenderer.act(async () => {
      await p.api.play('file://one.mp3');
    });
    await TestRenderer.act(async () => {
      await p.api.play('file://two.mp3');
    });
    // The first player is released before the second is created.
    expect(mockUnloadAsync).toHaveBeenCalledTimes(1);
    expect(mockCreateAsync).toHaveBeenCalledTimes(2);
  });
});
