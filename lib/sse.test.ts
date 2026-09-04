/**
 * Unit tests for the SSE frame scanner.
 *
 * The cases that matter are the ones an XHR actually produces: a frame split
 * across two reads, and a multi-byte character split across two reads. Neither
 * is reproducible by feeding the parser one whole response, which is why they
 * are written as an explicit byte-at-a-time drip below.
 */

import { scanSseFrames, parseSseData } from './sse';

/**
 * Replay `text` the way `xhr.responseText` grows: each step re-reads the whole
 * response so far and resumes from the last complete frame boundary.
 */
function drip(text: string, steps: number[]): { events: ReturnType<typeof scanSseFrames>['events'] } {
  let offset = 0;
  const events: ReturnType<typeof scanSseFrames>['events'] = [];
  for (const upTo of steps) {
    const result = scanSseFrames(text.slice(0, upTo), offset);
    offset = result.consumed;
    events.push(...result.events);
  }
  return { events };
}

describe('scanSseFrames', () => {
  it('reads a complete frame', () => {
    const frame = 'event: chunk\ndata: {"text":"hola"}\n\n';
    const { events, consumed } = scanSseFrames(frame);
    expect(events).toEqual([{ event: 'chunk', data: '{"text":"hola"}' }]);
    expect(consumed).toBe(frame.length);
  });

  it('reads several frames from one read', () => {
    const text =
      'event: chunk\ndata: {"text":"a"}\n\n' +
      'event: chunk\ndata: {"text":"b"}\n\n' +
      'event: done\ndata: {"reply":"ab"}\n\n';
    const { events } = scanSseFrames(text);
    expect(events.map((e) => e.event)).toEqual(['chunk', 'chunk', 'done']);
    expect(events[2].data).toBe('{"reply":"ab"}');
  });

  it('leaves an incomplete frame unconsumed and picks it up on the next read', () => {
    const complete = 'event: chunk\ndata: {"text":"hola"}\n\n';
    const text = `${complete}event: done\ndata: {"repl`;
    const first = scanSseFrames(text);
    expect(first.events).toHaveLength(1);
    expect(first.consumed).toBe(complete.length);

    const rest = `${text}y":"hola"}\n\n`;
    const second = scanSseFrames(rest, first.consumed);
    expect(second.events).toEqual([{ event: 'done', data: '{"reply":"hola"}' }]);
    expect(second.consumed).toBe(rest.length);
  });

  it('never emits the same frame twice across incremental reads', () => {
    const text =
      'event: chunk\ndata: {"text":"uno"}\n\n' +
      'event: chunk\ndata: {"text":"dos"}\n\n' +
      'event: done\ndata: {"reply":"uno dos"}\n\n';
    // One character at a time — the worst case a slow network produces.
    const steps = Array.from({ length: text.length + 1 }, (_, i) => i);
    const { events } = drip(text, steps);
    expect(events.map((e) => e.data)).toEqual([
      '{"text":"uno"}',
      '{"text":"dos"}',
      '{"reply":"uno dos"}',
    ]);
  });

  it('recovers text that decoded as a replacement character in an earlier read', () => {
    // What a split multi-byte character looks like: one read shows U+FFFD, the
    // next shows the real character. Resuming from the last frame boundary is
    // what makes the second read win.
    const broken = 'event: chunk\ndata: {"text":"�';
    const whole = 'event: chunk\ndata: {"text":"¡Buenas!"}\n\n';

    const first = scanSseFrames(broken, 0);
    expect(first.events).toHaveLength(0);
    expect(first.consumed).toBe(0);

    const second = scanSseFrames(whole, first.consumed);
    expect(second.events[0].data).toBe('{"text":"¡Buenas!"}');
  });

  it('defaults the event name and joins multi-line data per the spec', () => {
    const { events } = scanSseFrames('data: one\ndata: two\n\n');
    expect(events).toEqual([{ event: 'message', data: 'one\ntwo' }]);
  });

  it('ignores comment keep-alives instead of emitting empty events', () => {
    const { events } = scanSseFrames(': ping\n\nevent: chunk\ndata: {"text":"x"}\n\n');
    expect(events).toEqual([{ event: 'chunk', data: '{"text":"x"}' }]);
  });

  it('ignores id and retry fields', () => {
    const { events } = scanSseFrames('id: 7\nretry: 3000\nevent: chunk\ndata: hi\n\n');
    expect(events).toEqual([{ event: 'chunk', data: 'hi' }]);
  });

  it('accepts CRLF framing', () => {
    const frame = 'event: chunk\r\ndata: hola\r\n\r\n';
    const { events, consumed } = scanSseFrames(frame);
    expect(events).toEqual([{ event: 'chunk', data: 'hola' }]);
    expect(consumed).toBe(frame.length);
  });

  it('strips exactly one space after the colon', () => {
    const { events } = scanSseFrames('data:  leading\n\n');
    expect(events[0].data).toBe(' leading');
  });

  it('returns nothing for a body that is not an event stream at all', () => {
    const { events, consumed } = scanSseFrames('{"reply":"hola","correction":null}');
    expect(events).toEqual([]);
    expect(consumed).toBe(0);
  });
});

describe('parseSseData', () => {
  it('parses a payload', () => {
    expect(parseSseData<{ text: string }>('{"text":"hola"}')).toEqual({ text: 'hola' });
  });

  it('answers null for a truncated payload rather than throwing', () => {
    expect(parseSseData('{"text":"hol')).toBeNull();
  });
});
