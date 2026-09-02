// Deno tests for book segmentation. No network, no TTS bill.

import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  MAX_SEGMENT_CHARS,
  TARGET_SEGMENT_CHARS,
  segmentBook,
  segmentText,
} from './segment.ts';

const SENTENCE = 'Il y avait une fois un roi qui régnait sur un pays très lointain. ';

function bookOf(chars: number): string {
  return SENTENCE.repeat(Math.ceil(chars / SENTENCE.length)).slice(0, chars);
}

Deno.test('segments cover the whole text with no gaps and no overlap', () => {
  // A gap is a silently unnarratable stretch of book; an overlap is a listener
  // hearing the same sentence twice at a track change.
  const content = bookOf(20_000);
  const segments = segmentBook(content);
  assertEquals(segments[0].start, 0);
  assertEquals(segments[segments.length - 1].end, content.length);
  for (let i = 1; i < segments.length; i++) {
    assertEquals(segments[i].start, segments[i - 1].end);
  }
});

Deno.test('indexes are contiguous from zero', () => {
  const segments = segmentBook(bookOf(20_000));
  assertEquals(segments.map((s) => s.index), segments.map((_, i) => i));
});

Deno.test('no segment exceeds the hard ceiling', () => {
  // fish bills per byte, so the ceiling is a spend guard as much as a
  // listening one.
  for (const s of segmentBook(bookOf(50_000))) {
    assert(s.end - s.start <= MAX_SEGMENT_CHARS, `${s.end - s.start}`);
  }
});

Deno.test('cuts land after sentence punctuation where one is available', () => {
  // A mid-clause cut is audible: the narrator stops dead and the next track
  // starts mid-sentence.
  const content = bookOf(20_000);
  const segments = segmentBook(content);
  for (const s of segments.slice(0, -1)) {
    const tail = content.slice(s.end - 2, s.end);
    assert(/[.!?…。！？]\s?$/.test(tail), `bad cut: ${JSON.stringify(tail)}`);
  }
});

Deno.test('a book shorter than one segment is a single segment', () => {
  const segments = segmentBook('Short book. The end.');
  assertEquals(segments.length, 1);
  assertEquals(segments[0].start, 0);
});

Deno.test('text with no punctuation at all still gets cut', () => {
  // Otherwise one malformed book becomes a single unrenderable 2 MB request.
  const content = 'palabra '.repeat(3000);
  const segments = segmentBook(content);
  assert(segments.length > 1);
  for (const s of segments) assert(s.end - s.start <= MAX_SEGMENT_CHARS);
});

Deno.test('segments never collapse to a runt followed by a giant', () => {
  // The backward walk stops at half the target, so a cut cannot be dragged
  // right back to the start of the window.
  for (const s of segmentBook(bookOf(30_000)).slice(0, -1)) {
    assert(s.end - s.start >= TARGET_SEGMENT_CHARS / 2, `runt: ${s.end - s.start}`);
  }
});

Deno.test('empty content yields no segments', () => {
  assertEquals(segmentBook(''), []);
});

Deno.test('segment text drops illustration markers', () => {
  // "Illustration colon Montigneul SC" read aloud is the kind of thing that
  // makes a learner distrust everything else in the app.
  const content = 'Le roi parla. [Illustration: Montigneul SC AH-CABASSON D] Puis il partit.';
  const text = segmentText(content, { index: 0, start: 0, end: content.length });
  assert(!text.includes('Illustration'));
  assert(text.includes('Le roi parla.'));
  assert(text.includes('Puis il partit.'));
});

Deno.test('segment text collapses the hard wrapping Gutenberg leaves behind', () => {
  const content = 'un roi\r\nqui régnait\r\n\r\nsur un pays';
  const text = segmentText(content, { index: 0, start: 0, end: content.length });
  assertEquals(text, 'un roi qui régnait sur un pays');
});

Deno.test('segment offsets index back into the original content', () => {
  // The reader follows along by these, so they must address the real string.
  const content = bookOf(9000);
  for (const s of segmentBook(content)) {
    assert(content.slice(s.start, s.end).length === s.end - s.start);
  }
});
