import { getLessonAudioUri, warmLessonAudio, LESSON_SLOW_RATE } from './lesson-audio';
import { getTextToSpeech, VoiceError } from './ai';
import { getCachedTts, putCachedTts, ttsCacheKey } from './tts-cache';

jest.mock('./ai', () => {
  class MockVoiceError extends Error {
    code: string;
    constructor(message: string, code = 'UNKNOWN') {
      super(message);
      this.code = code;
    }
  }
  return { getTextToSpeech: jest.fn(), VoiceError: MockVoiceError };
});
jest.mock('./tts-cache', () => ({
  getCachedTts: jest.fn(),
  putCachedTts: jest.fn(),
  ttsCacheKey: jest.fn((text: string, lang: string, voice: string, rate: number) =>
    `${lang}|${voice}|${rate}|${text}`),
}));

const mockedTts = getTextToSpeech as jest.MockedFunction<typeof getTextToSpeech>;
const mockedGet = getCachedTts as jest.MockedFunction<typeof getCachedTts>;
const mockedPut = putCachedTts as jest.MockedFunction<typeof putCachedTts>;

beforeEach(() => {
  jest.clearAllMocks();
  mockedGet.mockReturnValue(null);
  mockedPut.mockImplementation((_key, _b64) => 'file:///tts/cached.mp3');
});

describe('getLessonAudioUri', () => {
  it('serves a cache hit without touching the network or the allowance', async () => {
    mockedGet.mockReturnValue('file:///tts/warm.mp3');

    await expect(
      getLessonAudioUri({ text: 'agua', language: 'es', userId: 'u1' }),
    ).resolves.toBe('file:///tts/warm.mp3');
    expect(mockedTts).not.toHaveBeenCalled();
  });

  it('bills lesson audio and pins the shared voice on a miss', async () => {
    mockedTts.mockResolvedValue('BASE64');

    await getLessonAudioUri({ text: 'agua', language: 'es', userId: 'u1' });

    expect(mockedTts).toHaveBeenCalledTimes(1);
    const [, , , options] = mockedTts.mock.calls[0];
    expect(options).toEqual({ purpose: 'lesson', voiceIndex: 0 });
  });

  it('omits rate at normal speed so the canonical cache entry is reused', async () => {
    mockedTts.mockResolvedValue('BASE64');

    await getLessonAudioUri({ text: 'agua', language: 'es', rate: 1 });

    expect(mockedTts.mock.calls[0][3]).not.toHaveProperty('rate');
    expect(ttsCacheKey).toHaveBeenCalledWith('agua', 'es', 'lesson', 1);
  });

  it('threads a slow rate into both the request and the cache key', async () => {
    mockedTts.mockResolvedValue('BASE64');

    await getLessonAudioUri({ text: 'agua', language: 'es', rate: LESSON_SLOW_RATE });

    expect(mockedTts.mock.calls[0][3]).toMatchObject({ rate: LESSON_SLOW_RATE });
    expect(ttsCacheKey).toHaveBeenCalledWith('agua', 'es', 'lesson', LESSON_SLOW_RATE);
  });

  it('still plays when the clip cannot be written to disk', async () => {
    mockedTts.mockResolvedValue('BASE64');
    mockedPut.mockReturnValue(null);

    await expect(getLessonAudioUri({ text: 'agua', language: 'es' })).resolves.toBe(
      'data:audio/mpeg;base64,BASE64',
    );
  });
});

describe('warmLessonAudio', () => {
  it('swallows an ordinary failure — the learner did not ask for this clip', async () => {
    mockedTts.mockRejectedValue(new Error('network down'));

    await expect(warmLessonAudio({ text: 'agua', language: 'es' })).resolves.toBe(false);
  });

  it('rethrows a quota refusal so the caller can stop prefetching', async () => {
    mockedTts.mockRejectedValue(new VoiceError('no allowance left', 'DAILY_LIMIT'));

    await expect(warmLessonAudio({ text: 'agua', language: 'es' })).rejects.toThrow(
      'no allowance left',
    );
  });
});
