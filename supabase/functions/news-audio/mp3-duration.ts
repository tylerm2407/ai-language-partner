// Read the playing time of a rendered MP3 out of the bytes themselves.
//
// Pure, no I/O, `deno test`-able — same split as ./script.ts.
//
// ── Why measure instead of estimate ──
//
// The player needs a duration before the first byte of audio is fetched: the
// scrubber has to have a track length to lay out, and "LISTEN · 2:14" on the
// news card is rendered from the list query with no audio loaded at all.
// ./script.ts can *estimate* from character count, but that is a
// speaking-rate guess and drifts tens of seconds on a 250-word read, which
// is visible as a scrubber that reaches the end early and then sits there.
//
// The real value is in the file. Every caller should prefer this and fall
// back to the estimate only when it returns null.
//
// Deliberately no external dependency for this. The MP3 metadata libraries
// on npm are tens of kilobytes and carry stream abstractions we have no use
// for; the part we need is one 4-byte header and a lookup table.

/** Bits 20-19 of the frame header. Plain constants rather than a `const
 *  enum`, which Deno's isolatedModules transpile does not erase. */
const MPEG_RESERVED = 1;
const MPEG_1 = 3;

/** Layer III only — that is what "MP3" means and what both providers emit.
 *  Layer I/II files exist but we never produce them, and returning null for
 *  one is more honest than decoding it with the wrong table. */
const LAYER_III = 1; // bits 18-17

/** kbps by bitrate index, Layer III. Index 0 is "free format" (rate declared
 *  out of band) and 15 is invalid; both are treated as unrecognised. */
const BITRATES_MPEG1_L3 = [
  0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0,
];
const BITRATES_MPEG2_L3 = [
  0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0,
];

/** Hz by sampling-rate index, per version. Index 3 is reserved. */
const SAMPLE_RATES: Record<number, number[]> = {
  3: [44100, 48000, 32000, 0], // MPEG 1
  2: [22050, 24000, 16000, 0], // MPEG 2
  0: [11025, 12000, 8000, 0], // MPEG 2.5
};

/** PCM samples represented by one Layer III frame. Halved on MPEG2/2.5. */
const SAMPLES_PER_FRAME_MPEG1 = 1152;
const SAMPLES_PER_FRAME_MPEG2 = 576;

/** How far into the file we will hunt for the first frame sync before giving
 *  up. Generous enough to clear an oversized or slightly malformed ID3 tag,
 *  small enough that garbage input is rejected in microseconds. */
const MAX_SYNC_SEARCH_BYTES = 8192;

interface FrameHeader {
  offset: number;
  version: number;
  bitrateKbps: number;
  sampleRateHz: number;
  samplesPerFrame: number;
  /** 1 = mono, 2 = anything else. Only used to locate the Xing header. */
  channels: number;
}

/** Size in bytes of an ID3v2 tag at the head of the buffer, or 0 if there
 *  isn't one. The tag is metadata, not audio, so its bytes must not be
 *  divided by the bitrate. */
function id3v2Size(bytes: Uint8Array): number {
  if (bytes.length < 10) return 0;
  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return 0; // 'ID3'
  // Synchsafe integer: 7 significant bits per byte, high bit always clear.
  const size =
    (bytes[6] & 0x7f) * 0x200000 +
    (bytes[7] & 0x7f) * 0x4000 +
    (bytes[8] & 0x7f) * 0x80 +
    (bytes[9] & 0x7f);
  const hasFooter = (bytes[5] & 0x10) !== 0;
  return 10 + size + (hasFooter ? 10 : 0);
}

/** 128 if the file ends with a legacy ID3v1 tag, else 0. Same reasoning as
 *  above — trailing metadata is not audio. */
function id3v1Size(bytes: Uint8Array): number {
  if (bytes.length < 128) return 0;
  const start = bytes.length - 128;
  const isTag = bytes[start] === 0x54 && bytes[start + 1] === 0x41 && bytes[start + 2] === 0x47;
  return isTag ? 128 : 0;
}

/** Decode the 4-byte frame header at `offset`, or null if it isn't one. */
function readFrameHeader(bytes: Uint8Array, offset: number): FrameHeader | null {
  if (offset + 4 > bytes.length) return null;
  const b0 = bytes[offset];
  const b1 = bytes[offset + 1];
  const b2 = bytes[offset + 2];
  const b3 = bytes[offset + 3];

  // 11-bit frame sync.
  if (b0 !== 0xff || (b1 & 0xe0) !== 0xe0) return null;

  const version = (b1 >> 3) & 0x03;
  if (version === MPEG_RESERVED) return null;
  if (((b1 >> 1) & 0x03) !== LAYER_III) return null;

  const isMpeg1 = version === MPEG_1;
  const bitrateKbps = (isMpeg1 ? BITRATES_MPEG1_L3 : BITRATES_MPEG2_L3)[(b2 >> 4) & 0x0f];
  if (!bitrateKbps) return null;

  const sampleRateHz = SAMPLE_RATES[version][(b2 >> 2) & 0x03];
  if (!sampleRateHz) return null;

  // Channel mode 0b11 is single channel.
  const channels = ((b3 >> 6) & 0x03) === 3 ? 1 : 2;

  return {
    offset,
    version,
    bitrateKbps,
    sampleRateHz,
    samplesPerFrame: isMpeg1 ? SAMPLES_PER_FRAME_MPEG1 : SAMPLES_PER_FRAME_MPEG2,
    channels,
  };
}

/** Total frame count declared by a Xing/Info VBR header inside the first
 *  frame, or null when there isn't one.
 *
 *  This matters: a VBR file has no single bitrate, so the CBR arithmetic
 *  below would report whatever rate the *first* frame happened to use —
 *  which on a quiet opening syllable can be wildly low, producing a duration
 *  several times too long. Neither provider currently returns VBR, but
 *  "currently" is not a guarantee worth betting the scrubber on. */
function xingFrameCount(bytes: Uint8Array, header: FrameHeader): number | null {
  // Offset of the Xing tag = 4-byte header + side info, whose size depends
  // on version and channel count.
  const sideInfo =
    header.version === MPEG_1
      ? header.channels === 1 ? 17 : 32
      : header.channels === 1 ? 9 : 17;
  const at = header.offset + 4 + sideInfo;
  if (at + 12 > bytes.length) return null;

  const tag = String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);
  if (tag !== 'Xing' && tag !== 'Info') return null;

  const flags =
    (bytes[at + 4] << 24) | (bytes[at + 5] << 16) | (bytes[at + 6] << 8) | bytes[at + 7];
  if ((flags & 0x01) === 0) return null; // frame count not present

  const frames =
    ((bytes[at + 8] << 24) |
      (bytes[at + 9] << 16) |
      (bytes[at + 10] << 8) |
      bytes[at + 11]) >>>
    0;
  return frames > 0 ? frames : null;
}

/**
 * Duration of an MP3 in milliseconds, or null if the bytes cannot be read
 * as one.
 *
 * Null is a normal outcome, not an error: the caller falls back to
 * `estimateDurationMs`. Anything this function cannot understand — a
 * truncated download, a WAV that a provider mislabelled, Layer II, free-
 * format bitrate — must return null rather than a confident wrong number,
 * because a wrong duration is worse than an approximate one. It lays out a
 * scrubber that does not match the audio.
 *
 * Known and accepted imprecision: on a file carrying a LAME tag this counts
 * every declared frame, including the encoder delay and end padding that a
 * gapless-aware decoder would drop. Measured against a real LAME CBR file it
 * reads 4,075 ms where ffprobe reads 4,003 — a fixed ~70 ms overhang, so
 * 1.8% on a four-second clip and 0.06% on a two-minute narration. Not worth
 * parsing the LAME extension to recover.
 */
export function parseMp3DurationMs(buffer: ArrayBuffer | Uint8Array): number | null {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 4) return null;

  const start = id3v2Size(bytes);
  const end = bytes.length - id3v1Size(bytes);
  if (end <= start) return null;

  // Scan for the first real frame. Usually it is at exactly `start`; the
  // search covers padding bytes and slightly-wrong tag sizes in the wild.
  const limit = Math.min(end - 4, start + MAX_SYNC_SEARCH_BYTES);
  let header: FrameHeader | null = null;
  for (let i = start; i <= limit; i++) {
    header = readFrameHeader(bytes, i);
    if (header) break;
  }
  if (!header) return null;

  const frames = xingFrameCount(bytes, header);
  if (frames !== null) {
    return Math.round((frames * header.samplesPerFrame * 1000) / header.sampleRateHz);
  }

  // CBR: audio bytes ÷ bytes-per-second. bitrate is in kbps, so
  // durationMs = bytes × 8 × 1000 ÷ (kbps × 1000) = bytes × 8 ÷ kbps.
  const audioBytes = end - header.offset;
  const ms = (audioBytes * 8) / header.bitrateKbps;
  return ms > 0 ? Math.round(ms) : null;
}
