// Supabase Edge Function: Audiobook
//
// Narrates a book, one segment at a time, shared by every listener.
//
// Actions:
//   list  — the segment map for a book, with a signed URL for whatever is ready.
//   play  — render one segment if nobody has yet, then return its signed URL.
//
// WHY ON FIRST LISTEN RATHER THAN PRE-GENERATED
//
// The settled design said "pre-generated per chapter". Two measurements say
// otherwise: `chapter_breaks` is populated on 384 of 9,864 books (3.9%), so
// there are no chapters to key on; and fish bills ~$15 per 1M UTF-8 bytes, so
// narrating the library up front is ~$31,000 for audio nobody asked for. A
// listener cannot tell the difference — the first person to play a segment
// waits, everyone after them does not — and the spend follows what is played.
//
// Entitlement is premium and up (`audiobookNarration` in get_effective_limits),
// checked before any synthesis. This is NOT expo-speech: it is real narration
// in the language's own voice, the same narrator the news uses.
//
// Deploy: npx supabase functions deploy audiobook --project-ref <ref>

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, corsResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { checkBurstLimit } from '../_shared/burst-limit.ts';
import { isValidUUID } from '../_shared/validation.ts';
import { synthesizeSpeech } from '../_shared/tts-synth.ts';
import { segmentBook, segmentText, type Segment } from './segment.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const BOOK_AUDIO_BUCKET = 'book-audio';
const SIGNED_URL_TTL_SECONDS = 1800;

/** Playing is cheap; rendering is not. Two separate ceilings. */
const PLAY_BURST_MAX = 30;
const PLAY_BURST_WINDOW = 60;
const RENDER_BURST_MAX = 6;
const RENDER_BURST_WINDOW = 300;

/** A stale 'generating' claim is reclaimed after this, so one crashed render
 *  does not wedge a segment forever. */
const CLAIM_STALE_MINUTES = 5;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// deno-lint-ignore no-explicit-any
type Db = any;

async function isEntitled(supabase: Db, userId: string): Promise<boolean> {
  const { data } = await supabase.rpc('get_effective_limits', { p_user_id: userId });
  const row = Array.isArray(data) ? data[0] : data;
  return row?.audiobookNarration === true;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsResponse();

  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return json({ error: 'Unauthorized' }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const bookId = String(body.bookId ?? '');
  if (!isValidUUID(bookId)) return json({ error: 'Invalid request' }, 400);

  const playOk = await checkBurstLimit(
    supabase, authUser.userId, 'audiobook-play', PLAY_BURST_MAX, PLAY_BURST_WINDOW,
  );
  if (!playOk) {
    return json({ error: 'Too many requests. Please slow down.', code: 'RATE_LIMITED' }, 429);
  }

  // Entitlement before anything else: narration is premium and up, and a free
  // account must not be able to trigger a render it cannot listen to.
  if (!(await isEntitled(supabase, authUser.userId))) {
    return json(
      { error: 'Audiobook narration is part of Premium.', code: 'UPGRADE_REQUIRED' },
      403,
    );
  }

  if (body.action === 'list') return handleList(supabase, bookId);
  if (body.action === 'play') return handlePlay(supabase, authUser.userId, bookId, body);
  return json({ error: 'Unknown action' }, 400);
});

/** The book's segment map, computed from its text and reconciled with what has
 *  already been rendered. Segmentation is deterministic, so the map is stable
 *  across calls without being stored. */
async function loadSegments(
  supabase: Db,
  bookId: string,
): Promise<{ language: string; segments: Segment[]; content: string } | null> {
  const { data: book } = await supabase
    .from('reading_books')
    .select('id, language, content')
    .eq('id', bookId)
    .maybeSingle();
  if (!book || typeof book.content !== 'string' || book.content.length === 0) return null;
  return {
    language: book.language as string,
    content: book.content as string,
    segments: segmentBook(book.content as string),
  };
}

async function handleList(supabase: Db, bookId: string): Promise<Response> {
  const loaded = await loadSegments(supabase, bookId);
  if (!loaded) return json({ error: 'Book not found' }, 404);

  const { data: rendered } = await supabase
    .from('book_audio')
    .select('segment_index, status, duration_ms, audio_path')
    .eq('book_id', bookId);

  const byIndex = new Map<number, Record<string, unknown>>();
  for (const r of rendered ?? []) byIndex.set(r.segment_index as number, r);

  const segments = await Promise.all(
    loaded.segments.map(async (s) => {
      const row = byIndex.get(s.index);
      const status = (row?.status as string) ?? 'pending';
      let url: string | null = null;
      if (status === 'ready' && row?.audio_path) {
        const { data: signed } = await supabase.storage
          .from(BOOK_AUDIO_BUCKET)
          .createSignedUrl(row.audio_path as string, SIGNED_URL_TTL_SECONDS);
        url = signed?.signedUrl ?? null;
      }
      return {
        index: s.index,
        charStart: s.start,
        charEnd: s.end,
        status,
        durationMs: (row?.duration_ms as number) ?? null,
        url,
      };
    }),
  );

  return json({ bookId, language: loaded.language, segments });
}

async function handlePlay(
  supabase: Db,
  userId: string,
  bookId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const index = Number(body.segmentIndex);
  if (!Number.isInteger(index) || index < 0) return json({ error: 'Invalid request' }, 400);

  const loaded = await loadSegments(supabase, bookId);
  if (!loaded) return json({ error: 'Book not found' }, 404);
  const segment = loaded.segments[index];
  if (!segment) return json({ error: 'No such segment' }, 404);

  // Already rendered by whoever got here first.
  const { data: existing } = await supabase
    .from('book_audio')
    .select('status, audio_path, duration_ms, generated_at')
    .eq('book_id', bookId)
    .eq('segment_index', index)
    .maybeSingle();

  if (existing?.status === 'ready' && existing.audio_path) {
    const { data: signed } = await supabase.storage
      .from(BOOK_AUDIO_BUCKET)
      .createSignedUrl(existing.audio_path as string, SIGNED_URL_TTL_SECONDS);
    return json({
      status: 'ready',
      url: signed?.signedUrl ?? null,
      durationMs: existing.duration_ms ?? null,
      rendered: false,
    });
  }

  if (existing?.status === 'generating') {
    const startedAt = existing.generated_at ? new Date(existing.generated_at as string).getTime() : 0;
    const stale = Date.now() - startedAt > CLAIM_STALE_MINUTES * 60_000;
    if (!stale) return json({ status: 'generating' }, 202);
  }

  const renderOk = await checkBurstLimit(
    supabase, userId, 'audiobook-render', RENDER_BURST_MAX, RENDER_BURST_WINDOW,
  );
  if (!renderOk) {
    return json({ error: 'Too many new tracks at once. Try again shortly.', code: 'RATE_LIMITED' }, 429);
  }

  // Claim it, so two listeners reaching the same segment do not both pay.
  const { error: claimError } = await supabase.from('book_audio').upsert(
    {
      book_id: bookId,
      segment_index: index,
      char_start: segment.start,
      char_end: segment.end,
      status: 'generating',
      generated_at: new Date().toISOString(),
    },
    { onConflict: 'book_id,segment_index' },
  );
  if (claimError) {
    console.error('[audiobook] claim failed:', claimError.message);
    return json({ error: 'Could not start narration.', code: 'RENDER_FAILED' }, 502);
  }

  const text = segmentText(loaded.content, segment);
  if (!text) {
    await supabase
      .from('book_audio')
      .update({ status: 'failed' })
      .eq('book_id', bookId)
      .eq('segment_index', index);
    return json({ error: 'Nothing to narrate in this segment.', code: 'EMPTY_SEGMENT' }, 422);
  }

  try {
    const speech = await synthesizeSpeech(text, loaded.language);
    const path = `${bookId}/${String(index).padStart(4, '0')}.mp3`;
    const { error: uploadError } = await supabase.storage
      .from(BOOK_AUDIO_BUCKET)
      .upload(path, new Uint8Array(speech.audio), { contentType: 'audio/mpeg', upsert: true });
    if (uploadError) throw new Error(uploadError.message);

    await supabase
      .from('book_audio')
      .update({
        status: 'ready',
        audio_path: path,
        provider: speech.provider,
        voice_id: speech.voiceId,
        generated_at: new Date().toISOString(),
      })
      .eq('book_id', bookId)
      .eq('segment_index', index);

    const { data: signed } = await supabase.storage
      .from(BOOK_AUDIO_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

    return json({ status: 'ready', url: signed?.signedUrl ?? null, rendered: true });
  } catch (err) {
    // Back to 'pending', not 'failed': the usual cause is a provider having a
    // bad minute, and leaving it failed would make one outage permanent for
    // that segment for everyone.
    await supabase
      .from('book_audio')
      .update({ status: 'pending' })
      .eq('book_id', bookId)
      .eq('segment_index', index);
    console.error('[audiobook] synthesis failed:', (err as Error).message);
    return json({ error: 'Narration is unavailable right now.', code: 'RENDER_UNAVAILABLE' }, 503);
  }
}
