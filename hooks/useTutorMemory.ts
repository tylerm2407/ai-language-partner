/**
 * useTutorMemory — the learner's view of `tutor_memory`, with forgetting and,
 * since migration 141, with authoring.
 *
 * A memory the learner cannot see and delete is surveillance, not
 * personalisation (migration 108 says the same). A memory they can see but
 * cannot correct is not much better: the tutor goes on believing something
 * about them that is wrong, and the only remedy is deletion. So this hook now
 * adds and edits too — through the `tutor-memory` edge function, never by a
 * client write, because the row it produces becomes part of a future prompt.
 *
 * Deletes stay OPTIMISTIC: the row leaves the screen at once and comes back
 * with an error if the server refused, because "I asked it to forget and it is
 * still there" is the one outcome that must never be silent. Writes are NOT
 * optimistic: the server sanitises, moderates and may refuse or merge the text,
 * so the row that lands is not always the row that was typed, and showing the
 * typed version first would be showing a note that does not exist.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addTutorMemory,
  deleteAllTutorMemories,
  deleteTutorMemory,
  editTutorMemory,
  fetchTutorMemories,
} from '../lib/supabase-queries';
import { loadErrorCopy, saveErrorCopy, type ErrorCopy } from '../lib/error-copy';
import type { TutorMemory, TutorMemoryKind } from '../types';

/** Mirrors the SQL cap in `upsert_learner_memory` (migration 141). Restated so
 *  the screen can disable "add" before a round trip that would 409. */
export const TUTOR_MEMORY_LEARNER_KEEP = 8;

export function useTutorMemory(userId: string | undefined, language: string | null | undefined) {
  const [notes, setNotes] = useState<TutorMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ErrorCopy | null>(null);
  const [forgetError, setForgetError] = useState<ErrorCopy | null>(null);
  const [nonce, setNonce] = useState(0);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!userId || !language) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchTutorMemories(userId, language)
      .then((rows) => {
        if (!cancelled) setNotes(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(loadErrorCopy(err, 'what your tutor remembers'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, language, nonce]);

  const forget = useCallback(
    async (id: string) => {
      if (!userId) return;
      const before = notes;
      setForgetError(null);
      setNotes((n) => n.filter((note) => note.id !== id));
      try {
        await deleteTutorMemory(userId, id);
      } catch (err) {
        setNotes(before);
        setForgetError(saveErrorCopy(err, 'that note'));
        throw err;
      }
    },
    [userId, notes],
  );

  const forgetAll = useCallback(async () => {
    if (!userId || !language) return;
    const before = notes;
    setForgetError(null);
    setNotes([]);
    try {
      await deleteAllTutorMemories(userId, language);
    } catch (err) {
      setNotes(before);
      setForgetError(saveErrorCopy(err, 'those notes'));
      throw err;
    }
  }, [userId, language, notes]);

  /**
   * Add or rewrite a note, then refetch.
   *
   * The refetch is the point: `upsert_learner_memory` dedupes on content and
   * `edit_learner_memory` merges an edit onto an existing note, so the server's
   * answer to "what notes are there now" is the only trustworthy one.
   */
  const write = useCallback(
    async (run: () => Promise<void>, subject: string) => {
      setForgetError(null);
      try {
        await run();
      } catch (err) {
        setForgetError(saveErrorCopy(err, subject));
        throw err;
      }
      retry();
    },
    [retry],
  );

  const add = useCallback(
    async (kind: TutorMemoryKind, content: string) => {
      if (!language) return;
      await write(() => addTutorMemory({ kind, content, targetLanguage: language }), 'that note');
    },
    [language, write],
  );

  const edit = useCallback(
    async (id: string, content: string) => {
      await write(() => editTutorMemory(id, content), 'that note');
    },
    [write],
  );

  /** How many of the learner's own notes are already stored. The cap is
   *  account-wide, matching the SQL, so it counts across languages exactly as
   *  the server does — every note this screen can see is in that count. */
  const ownNoteCount = useMemo(() => notes.filter((n) => n.source === 'learner').length, [notes]);

  return {
    notes,
    loading,
    error,
    forgetError,
    retry,
    forget,
    forgetAll,
    add,
    edit,
    ownNoteCount,
    canAddNote: ownNoteCount < TUTOR_MEMORY_LEARNER_KEEP,
  };
}
