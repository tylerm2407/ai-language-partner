/**
 * Incremental extraction of one named top-level string value from JSON that is
 * still arriving.
 *
 * Why this exists: the ai-chat model returns a JSON envelope whose first key is
 * `reply`. To start speaking the reply before the model has finished writing
 * the correction and the vocabulary list, we have to read that one string value
 * out of a document that is, at every moment, syntactically invalid — there is
 * no closing brace yet, so `JSON.parse` cannot help.
 *
 * The obvious shortcut — accumulate the raw text and run a regex like
 * /"reply"\s*:\s*"(.*?)"/ over it — is wrong, and wrong in a way that only
 * shows up in production. A reply containing an escaped quote (`dijo \"hola\"`)
 * terminates the regex early, so the learner hears half a sentence and the
 * rest is silently dropped. A reply containing `\n` is emitted with a literal
 * backslash-n. This decodes escapes properly instead, one character at a time,
 * and can be suspended and resumed at ANY byte boundary — including the middle
 * of a `\uXXXX` escape, which is where a chunk boundary is most likely to fall
 * for the accented characters every target language uses.
 *
 * Pure: no Deno APIs, no network, no I/O. See ./json-string-stream.test.ts.
 */

/** Nothing between a key's closing quote and its `:` but these. */
function isJsonSpace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
}

/** The two-character escapes JSON defines. Anything else after a backslash is
 *  malformed; we pass the character through rather than lose a character of
 *  the learner's reply over a model's punctuation slip. */
function unescape(ch: string): string {
  switch (ch) {
    case 'n': return '\n';
    case 't': return '\t';
    case 'r': return '\r';
    case 'b': return '\b';
    case 'f': return '\f';
    case '"': return '"';
    case '\\': return '\\';
    case '/': return '/';
    default: return ch;
  }
}

type Phase = 'seeking' | 'value' | 'closed';

export class JsonStringValueStream {
  readonly #needle: string;
  #phase: Phase = 'seeking';
  /** Raw input received but not yet interpretable. */
  #pending = '';
  /** The previous character was an unconsumed backslash. */
  #escaping = false;
  /** Hex digits collected so far for a `\uXXXX` escape, 0-3 of them. */
  #hex = '';
  #inHex = false;
  /**
   * A decoded high surrogate waiting for its partner.
   *
   * `😀` decodes to two code units that only mean anything together.
   * Emitting the first alone would put a lone surrogate into a string we are
   * about to `JSON.stringify` into an SSE frame, so we hold it for exactly one
   * character. Held back at most one unit, released by the next character or
   * by `end()`.
   */
  #highSurrogate = '';

  /** @param key the top-level key whose string value should be extracted. */
  constructor(key: string) {
    this.#needle = `"${key}"`;
  }

  /** True once the value's closing quote has been consumed. Further pushes are
   *  ignored — anything after it belongs to the rest of the envelope. */
  get done(): boolean {
    return this.#phase === 'closed';
  }

  /** Feed the next raw chunk. Returns the characters of the value decoded by
   *  this chunk, which is often '' — before the key arrives, and whenever a
   *  chunk ends mid-escape. */
  push(chunk: string): string {
    if (this.#phase === 'closed' || !chunk) return '';
    this.#pending += chunk;
    if (this.#phase === 'seeking' && !this.#enterValue()) return '';
    return this.#decode();
  }

  /** Release anything held back when the input ends without a closing quote —
   *  a truncated completion, or a provider that dropped the connection. */
  end(): string {
    const held = this.#highSurrogate;
    this.#highSurrogate = '';
    return held;
  }

  /**
   * Find `"<key>" : "` and consume through the opening quote of the value.
   *
   * Returns false when the answer is "not yet" — either the key has not been
   * seen or the characters that would confirm it (the colon, the opening
   * quote) have not arrived. Nothing is consumed in that case, so the caller
   * can simply push more.
   *
   * First match wins. `reply` is the first key the prompt asks for, so by the
   * time a nested object could contain a same-named key we are long past
   * `seeking`.
   */
  #enterValue(): boolean {
    let from = 0;
    for (;;) {
      const at = this.#pending.indexOf(this.#needle, from);
      if (at === -1) {
        // No match yet, but one could still START inside the tail we are
        // holding — `{"repl` is a prefix of `{"reply"`. Keep exactly enough
        // for that and drop the rest, so a model that prefixes the JSON with
        // prose cannot grow this buffer without bound.
        const keep = this.#needle.length - 1;
        if (this.#pending.length > keep) this.#pending = this.#pending.slice(-keep);
        return false;
      }
      let i = at + this.#needle.length;
      while (i < this.#pending.length && isJsonSpace(this.#pending[i])) i++;
      if (i >= this.#pending.length) return false; // wait for the colon
      if (this.#pending[i] !== ':') {
        // The key text appeared somewhere that is not a key position — inside
        // an earlier string value, say. Keep looking.
        from = at + 1;
        continue;
      }
      i++;
      while (i < this.#pending.length && isJsonSpace(this.#pending[i])) i++;
      if (i >= this.#pending.length) return false; // wait for the value
      if (this.#pending[i] !== '"') {
        // Right key, wrong type (null, a number, an object). Not ours.
        from = at + 1;
        continue;
      }
      this.#pending = this.#pending.slice(i + 1);
      this.#phase = 'value';
      return true;
    }
  }

  /** Decode as much of `#pending` as is unambiguous, leaving any partial
   *  escape in place for the next chunk. */
  #decode(): string {
    const raw = this.#pending;
    let out = '';
    let i = 0;
    for (; i < raw.length; i++) {
      const ch = raw[i];

      if (this.#inHex) {
        this.#hex += ch;
        if (this.#hex.length === 4) {
          const code = Number.parseInt(this.#hex, 16);
          this.#inHex = false;
          this.#hex = '';
          // A malformed escape yields NaN; skip it rather than emit U+0000.
          if (Number.isFinite(code)) out += this.#emit(String.fromCharCode(code));
        }
        continue;
      }

      if (this.#escaping) {
        this.#escaping = false;
        if (ch === 'u') {
          this.#inHex = true;
          this.#hex = '';
          continue;
        }
        out += this.#emit(unescape(ch));
        continue;
      }

      if (ch === '\\') {
        this.#escaping = true;
        continue;
      }

      if (ch === '"') {
        this.#phase = 'closed';
        out += this.end();
        this.#pending = '';
        return out;
      }

      out += this.#emit(ch);
    }
    // Whatever is left is a suspended escape's worth of state, already
    // recorded in the fields above; the characters themselves are consumed.
    this.#pending = '';
    return out;
  }

  /** Emit one decoded code unit, pairing surrogates. See `#highSurrogate`. */
  #emit(unit: string): string {
    if (this.#highSurrogate) {
      const paired = this.#highSurrogate + unit;
      this.#highSurrogate = '';
      return paired;
    }
    const code = unit.charCodeAt(0);
    if (code >= 0xd800 && code <= 0xdbff) {
      this.#highSurrogate = unit;
      return '';
    }
    return unit;
  }
}
