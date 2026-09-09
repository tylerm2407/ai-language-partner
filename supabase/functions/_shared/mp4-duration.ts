/**
 * Read the duration of an MP4/M4A container without decoding it.
 *
 * Why: `transcribe` is billed by OpenAI per second of audio, and its only
 * input guard was a byte cap. Bytes do not bound seconds — at 8 kbps a
 * 7.5 MB file is two hours — so the daily voice allowance could be blown
 * through in one request, and the read-then-increment gate never saw it
 * coming. Reserving the minutes BEFORE the call needs the duration before the
 * call, and the container header carries it: `moov` → `mvhd` holds a
 * timescale and a duration in that timescale.
 *
 * Pure and defensive. Anything that is not a well-formed MP4 with a readable
 * `mvhd` returns null and the caller falls back to a conservative estimate.
 * The header is the first few hundred bytes on a normal recording; the walk
 * is bounded so a hostile file cannot make it expensive.
 */

const MAX_BOXES_WALKED = 64;

function readUint32(bytes: Uint8Array, at: number): number | null {
  if (at + 4 > bytes.length) return null;
  return ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
}

function readUint64(bytes: Uint8Array, at: number): number | null {
  const hi = readUint32(bytes, at);
  const lo = readUint32(bytes, at + 4);
  if (hi === null || lo === null) return null;
  return hi * 4294967296 + lo;
}

function boxType(bytes: Uint8Array, at: number): string | null {
  if (at + 8 > bytes.length) return null;
  return String.fromCharCode(bytes[at + 4], bytes[at + 5], bytes[at + 6], bytes[at + 7]);
}

/** Walk sibling boxes in [start, end) looking for `type`; returns its payload range. */
function findBox(
  bytes: Uint8Array,
  start: number,
  end: number,
  type: string,
): { payloadStart: number; payloadEnd: number } | null {
  let at = start;
  let walked = 0;
  while (at + 8 <= end && walked < MAX_BOXES_WALKED) {
    walked += 1;
    let size = readUint32(bytes, at);
    const kind = boxType(bytes, at);
    if (size === null || kind === null) return null;
    let headerLen = 8;
    if (size === 1) {
      const large = readUint64(bytes, at + 8);
      if (large === null) return null;
      size = large;
      headerLen = 16;
    } else if (size === 0) {
      size = end - at;
    }
    if (size < headerLen) return null;
    const boxEnd = Math.min(end, at + size);
    if (kind === type) return { payloadStart: at + headerLen, payloadEnd: boxEnd };
    at += size;
  }
  return null;
}

/**
 * Duration in seconds, or null when it cannot be read.
 *
 * Handles `mvhd` version 0 (32-bit fields) and version 1 (64-bit). A zero or
 * absurd timescale is treated as unreadable rather than as zero seconds —
 * "unknown" must never be mistaken for "free".
 */
export function parseMp4DurationSeconds(bytes: Uint8Array): number | null {
  const moov = findBox(bytes, 0, bytes.length, 'moov');
  if (!moov) return null;
  const mvhd = findBox(bytes, moov.payloadStart, moov.payloadEnd, 'mvhd');
  if (!mvhd) return null;

  const version = bytes[mvhd.payloadStart];
  let timescale: number | null;
  let duration: number | null;
  if (version === 1) {
    // version(1) flags(3) creation(8) modification(8) timescale(4) duration(8)
    timescale = readUint32(bytes, mvhd.payloadStart + 20);
    duration = readUint64(bytes, mvhd.payloadStart + 24);
  } else {
    // version(1) flags(3) creation(4) modification(4) timescale(4) duration(4)
    timescale = readUint32(bytes, mvhd.payloadStart + 12);
    duration = readUint32(bytes, mvhd.payloadStart + 16);
  }
  if (timescale === null || duration === null) return null;
  if (timescale <= 0 || !Number.isFinite(duration)) return null;
  const seconds = duration / timescale;
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 24 * 3600) return null;
  return seconds;
}

/**
 * The most audio `byteLength` bytes could plausibly hold, in seconds.
 *
 * Used only when the container gave no answer. Assumes 8 kbps — below any
 * codec a phone records speech at — so the reservation is an over-estimate
 * that settlement corrects downward once the provider reports the real
 * duration. Over-reserving briefly costs nothing; under-reserving is the hole.
 */
export function maxSecondsForBytes(byteLength: number): number {
  const FLOOR_BITS_PER_SECOND = 8_000;
  return Math.ceil((byteLength * 8) / FLOOR_BITS_PER_SECOND);
}
