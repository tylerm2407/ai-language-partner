/**
 * useTutorMemory — the learner's view of `tutor_memory`, with forgetting.
 *
 * A memory the learner cannot see and delete is surveillance, not
 * personalisation (migration 108 says the same). So this hook is read +
 * delete only, and a delete is optimistic: the row leaves the screen at once
 * and comes back with an error if the server refused, because "I asked it to
 * forget and it is still there" is the one outcome that must never be silent.
 */
import { useCallback, useEffect, useState } from 'react';
import { deleteAllTutorMemories, deleteTutorMemory, fetchTutorMemories } from '../lib/supabase-queries';
import { loadErrorCopy, saveErrorCopy, type ErrorCopy } from '../lib/error-copy';
import type { TutorMemory } from '../types';

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
        if (!cancelled) setError(loadErrorCopy(err, 'what Sol remembers'));
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

  return { notes, loading, error, forgetError, retry, forget, forgetAll };
}
