// Deno tests for ./mp3-duration.ts.
//
// Run with: `deno test supabase/functions/news-audio/mp3-duration.test.ts`
//
// Every case here is a synthetic file built byte by byte, so the tests state
// exactly what the parser is being asked to understand — and, just as
// importantly, what it must REFUSE to understand. A wrong duration is worse
// than no duration: it lays out a scrubber that does not match the audio,
// while null just falls back to the character estimate.

import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { parseMp3DurationMs } from './mp3-duration.ts';

/** A canonical MPEG-1 Layer III, 128 kbps, 44.1 kHz, stereo frame header.
 *
 *  0xFF        — sync, high 8 bits
 *  0xFB        — sync 111 | version 11 (MPEG1) | layer 01 (III) | no CRC
 *  0x90        — bitrate 1001 (128 kbps) | rate 00 (44.1 kHz) | no padding
 *  0x00        — stereo, no copyright, no emphasis
 */
const CBR_128_HEADER = [0xff, 0xfb, 0x90, 0x00];

function cbrFile(totalBytes: number, header = CBR_128_HEADER): Uint8Array {
  const bytes = new Uint8Array(totalBytes);
  bytes.set(header, 0);
  return bytes;
}

Deno.test('CBR 128kbps/44.1kHz: duration is bytes × 8 ÷ kbps', () => {
  // 16,000 bytes at 128 kbps = 16000 × 8 / 128 = 1,000 ms.
  assertEquals(parseMp3DurationMs(cbrFile(16_000)), 1000);
  // 2 minutes 14 seconds' worth, the duration the news card advertises.
  assertEquals(parseMp3DurationMs(cbrFile(2_144_000)), 134_000);
});

Deno.test('CBR: accepts an ArrayBuffer as readily as a Uint8Array', () => {
  const buffer = cbrFile(16_000).buffer as ArrayBuffer;
  assertEquals(parseMp3DurationMs(buffer), 1000);
});

Deno.test('CBR: other valid bitrates decode with their own table entry', () => {
  // 0xA0 = bitrate index 1010 (160 kbps), 44.1 kHz.
  const at160 = parseMp3DurationMs(cbrFile(16_000, [0xff, 0xfb, 0xa0, 0x00]));
  assertEquals(at160, 800); // 16000 × 8 / 160
  // Mono changes only the channel mode; the arithmetic is unchanged.
  assertEquals(parseMp3DurationMs(cbrFile(16_000, [0xff, 0xfb, 0x90, 0xc0])), 1000);
  // MPEG-2 Layer III (0xF3) reads from the OTHER bitrate table: the same
  // index 1001 means 80 kbps there, not 128.
  assertEquals(parseMp3DurationMs(cbrFile(16_000, [0xff, 0xf3, 0x90, 0x00])), 1600);
});

Deno.test('an ID3v2 tag is metadata, not audio, and is excluded', () => {
  // 10-byte header declaring a 100-byte body → 110 bytes to skip.
  const tagBody = 100;
  const total = 16_000 + 10 + tagBody;
  const bytes = new Uint8Array(total);
  bytes.set([0x49, 0x44, 0x33, 0x03, 0x00, 0x00], 0); // 'ID3', v2.3, no flags
  // Synchsafe 100 = 0,0,0,100.
  bytes.set([0x00, 0x00, 0x00, tagBody], 6);
  bytes.set(CBR_128_HEADER, 10 + tagBody);

  // Still exactly 16,000 audio bytes → still 1,000 ms.
  assertEquals(parseMp3DurationMs(bytes), 1000);
});

Deno.test('a trailing ID3v1 tag is excluded too', () => {
  const bytes = new Uint8Array(16_000 + 128);
  bytes.set(CBR_128_HEADER, 0);
  bytes.set([0x54, 0x41, 0x47], 16_000); // 'TAG'
  assertEquals(parseMp3DurationMs(bytes), 1000);
});

Deno.test('a Xing VBR header wins over the CBR arithmetic', () => {
  // Without this, a VBR file is timed from whichever bitrate its first
  // frame happened to use — on a quiet opening syllable, wildly wrong.
  const bytes = new Uint8Array(16_000);
  bytes.set(CBR_128_HEADER, 0);
  const at = 4 + 32; // MPEG1 stereo side info
  bytes.set([0x58, 0x69, 0x6e, 0x67], at); // 'Xing'
  bytes.set([0x00, 0x00, 0x00, 0x01], at + 4); // flags: frame count present
  bytes.set([0x00, 0x00, 0x01, 0x00], at + 8); // 256 frames

  // 256 frames × 1152 samples ÷ 44100 Hz = 6,687 ms — nothing like the
  // 1,000 ms the CBR path would have reported.
  assertEquals(parseMp3DurationMs(bytes), 6687);
});

Deno.test('garbage returns null rather than a confident wrong number', () => {
  assertEquals(parseMp3DurationMs(new TextEncoder().encode('this is not audio at all')), null);
  assertEquals(parseMp3DurationMs(new Uint8Array(0)), null);
  assertEquals(parseMp3DurationMs(new Uint8Array([0xff])), null);
  assertEquals(parseMp3DurationMs(new Uint8Array(4096)), null); // all zeros, no sync
});

Deno.test('unsupported or reserved encodings return null', () => {
  // Reserved MPEG version (bits 20-19 = 01).
  assertEquals(parseMp3DurationMs(cbrFile(16_000, [0xff, 0xeb, 0x90, 0x00])), null);
  // Layer II (bits 18-17 = 10) — a real format, just not one we produce.
  assertEquals(parseMp3DurationMs(cbrFile(16_000, [0xff, 0xfd, 0x90, 0x00])), null);
  // Free-format bitrate (index 0000): rate declared out of band.
  assertEquals(parseMp3DurationMs(cbrFile(16_000, [0xff, 0xfb, 0x00, 0x00])), null);
  // Invalid bitrate index (1111).
  assertEquals(parseMp3DurationMs(cbrFile(16_000, [0xff, 0xfb, 0xf0, 0x00])), null);
  // Reserved sampling-rate index (11).
  assertEquals(parseMp3DurationMs(cbrFile(16_000, [0xff, 0xfb, 0x9c, 0x00])), null);
});

Deno.test('a frame that starts a little way in is still found', () => {
  const bytes = new Uint8Array(16_004);
  bytes.set(CBR_128_HEADER, 4); // four bytes of padding first
  const ms = parseMp3DurationMs(bytes);
  assert(ms !== null && Math.abs(ms - 1000) < 1, `expected ~1000 ms, got ${ms}`);
});
