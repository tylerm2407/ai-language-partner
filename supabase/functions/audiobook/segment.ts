// How a book is cut into narratable segments.
//
// Pure, so the segmentation can be tested without a database or a TTS bill.
//
// NOT chapters. `reading_books.chapter_breaks` is populated on 384 of 9,864
// books (3.9%), so keying audio on chapters would leave 96% of the library
// unnarratable. Segments are fixed-size windows that end on a sentence
// boundary, which is what a listener actually notices.

/**
 * Target characters per segment.
 *
 * ~2,400 characters is roughly 400 words, or two and a half minutes of speech
 * — long enough to be worth a track, short enough that the first listener's
 * wait is tolerable and that a abandoned listen has not cost much. fish bills
 * per UTF-8 byte, so this is a spend unit as much as a listening unit.
 */
export const TARGET_SEGMENT_CHARS = 2400;

/** Never emit a segment longer than this, even without a sentence boundary. */
export const MAX_SEGMENT_CHARS = 3200;

export interface Segment {
  index: number;
  start: number;
  end: number;
}

/** Sentence-ending punctuation, including the CJK forms. */
const SENTENCE_END = /[.!?…。！？]/;

/**
 * Cut `content` into segments that end on a sentence where possible.
 *
 * Offsets are into the ORIGINAL string, so a segment can be tied back to the
 * text the reader is showing and a listener can follow along.
 *
 * A segment boundary mid-sentence is audible — the narrator stops dead and the
 * next track starts mid-clause — so the cut is walked back to the last
 * sentence end within the window. Only if there is none (a wall of text with
 * no punctuation) does it fall back to a hard cut at MAX_SEGMENT_CHARS.
 */
export function segmentBook(content: string): Segment[] {
  const segments: Segment[] = [];
  const length = content.length;
  let start = 0;

  while (start < length) {
    if (length - start <= MAX_SEGMENT_CHARS) {
      segments.push({ index: segments.length, start, end: length });
      break;
    }

    const windowEnd = Math.min(start + MAX_SEGMENT_CHARS, length);
    let cut = -1;
    // Walk back from the window end looking for a sentence boundary, but never
    // back past the target — a 200-character segment followed by a 3,000
    // character one is worse than one slightly-long segment.
    for (let i = windowEnd - 1; i >= start + TARGET_SEGMENT_CHARS / 2; i--) {
      if (SENTENCE_END.test(content[i])) {
        cut = i + 1;
        break;
      }
    }
    if (cut === -1) cut = windowEnd;

    segments.push({ index: segments.length, start, end: cut });
    start = cut;
  }

  return segments;
}

/**
 * The text of one segment, tidied for a narrator.
 *
 * Imported Gutenberg text is hard-wrapped, so a raw slice carries line breaks
 * mid-sentence; some engines pause on them. `[Illustration: ...]` markers are
 * dropped outright — they are typesetting notes, and hearing "Illustration
 * colon Montigneul SC" read aloud is the kind of thing that makes a learner
 * distrust everything else in the app.
 */
export function segmentText(content: string, segment: Segment): string {
  return content
    .slice(segment.start, segment.end)
    .replace(/\[Illustration:[^\]]*\]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
