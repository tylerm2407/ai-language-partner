// Deno tests for _shared/mp4-duration.ts: a hand-built MP4 header, both mvhd
// versions, and the ways a hostile or foreign file must come back null.

import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { maxSecondsForBytes, parseMp4DurationSeconds } from './mp4-duration.ts';

function u32(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}
function u64(n: number): number[] {
  return [...u32(Math.floor(n / 4294967296)), ...u32(n >>> 0)];
}
function ascii(s: string): number[] {
  return [...s].map((c) => c.charCodeAt(0));
}
function box(type: string, payload: number[]): number[] {
  return [...u32(8 + payload.length), ...ascii(type), ...payload];
}

/** ftyp + moov(mvhd) with the given timescale/duration. */
function mp4(timescale: number, duration: number, version: 0 | 1 = 0): Uint8Array {
  const mvhd = version === 1
    ? [1, 0, 0, 0, ...u64(0), ...u64(0), ...u32(timescale), ...u64(duration), ...new Array(80).fill(0)]
    : [0, 0, 0, 0, ...u32(0), ...u32(0), ...u32(timescale), ...u32(duration), ...new Array(80).fill(0)];
  return new Uint8Array([
    ...box('ftyp', ascii('M4A ')),
    ...box('moov', [...box('mvhd', mvhd), ...box('trak', [])]),
  ]);
}

Deno.test('reads the duration from a version-0 mvhd', () => {
  assertEquals(parseMp4DurationSeconds(mp4(44100, 44100 * 7)), 7);
  assertEquals(parseMp4DurationSeconds(mp4(1000, 12_345)), 12.345);
});

Deno.test('reads the duration from a version-1 mvhd', () => {
  assertEquals(parseMp4DurationSeconds(mp4(16000, 16000 * 90, 1)), 90);
});

Deno.test('a file that is not MP4 is null, never zero', () => {
  assertEquals(parseMp4DurationSeconds(new Uint8Array([0xff, 0xfb, 0x90, 0x00, 1, 2, 3])), null);
  assertEquals(parseMp4DurationSeconds(new Uint8Array(0)), null);
});

Deno.test('an mvhd with a zero timescale or an absurd duration is unreadable', () => {
  assertEquals(parseMp4DurationSeconds(mp4(0, 100)), null);
  assertEquals(parseMp4DurationSeconds(mp4(1, 48 * 3600)), null);
});

Deno.test('a moov that lies about its size cannot walk past the buffer', () => {
  const good = mp4(1000, 5000);
  // Overstate the moov box size wildly.
  const bytes = new Uint8Array(good);
  const moovAt = 8 + 4 + 4; // after ftyp (8 + 'M4A ' payload of 4)
  bytes.set(u32(0x7fffffff), moovAt);
  // Still parses what is actually there, or returns null — never throws.
  const result = parseMp4DurationSeconds(bytes);
  assertEquals(result === null || result === 5, true);
});

Deno.test('the byte fallback assumes the lowest plausible bitrate, so it over-reserves', () => {
  // 1 KB at 8 kbps is one second; anything a phone records is far denser.
  assertEquals(maxSecondsForBytes(1000), 1);
  assertEquals(maxSecondsForBytes(7_500_000), 7500);
});
