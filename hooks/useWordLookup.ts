import { useCallback, useMemo, useRef, useState } from 'react';
import { explainPassage, translateText } from '../lib/ai';
import { getCached, setCached } from '../lib/read-cache';
import {
  annotationMap,
  cardSourceFromLookup,
  isQuotaError,
  lookupWord,
  wordCacheKey,
} from '../lib/word-lookup';
import type { SelectedRef } from '../components/reading/TappableText';
import type { WordLookupState } from '../components/reading/WordTooltip';
import type { BookAnnotation, WordLookup } from '../types';

/**
 * Tap-a-word lookup and paragraph explanation for the reader.
 *
 * Owns the session cache, the tooltip state machine and the two "you are out
 * for today" flags. Both flags are session-scoped on purpose: once the server
 * has said no, every further tap would be a round trip to the same answer, so
 * the reader stops asking until the app is restarted or the day rolls over.
 *
 * `lib/word-lookup.ts` holds the chain itself and is where the ordering is
 * tested; this hook only supplies AsyncStorage and the network to it.
 */

export interface ExplanationState {
  paragraphIndex: number;
  status: 'loading' | 'ready' | 'quota' | 'error';
  text?: string;
}

interface Options {
  sourceLanguage: string;
  targetLanguage: string;
  cefrLevel: string;
  annotations?: BookAnnotation[];
  bookId?: string;
}

export function useWordLookup({
  sourceLanguage,
  targetLanguage,
  cefrLevel,
  annotations,
  bookId,
}: Options) {
  const session = useRef(new Map<string, WordLookup>()).current;
  const [selectedRef, setSelectedRef] = useState<SelectedRef | null>(null);
  const [state, setState] = useState<WordLookupState | null>(null);
  const [explanation, setExplanation] = useState<ExplanationState | null>(null);
  const [lookupsExhausted, setLookupsExhausted] = useState(false);
  const [explanationsExhausted, setExplanationsExhausted] = useState(false);
  const [lookupCount, setLookupCount] = useState(0);

  const annotationsByWord = useMemo(() => annotationMap(annotations ?? []), [annotations]);

  const deps = useMemo(
    () => ({
      session,
      annotations: annotationsByWord,
      getCached: (key: string) => getCached<WordLookup>(key),
      setCached: (key: string, value: WordLookup) => setCached(key, value),
      translate: (word: string) =>
        translateText(word, sourceLanguage, targetLanguage, 'word_lookup'),
    }),
    [session, annotationsByWord, sourceLanguage, targetLanguage],
  );

  const runLookup = useCallback(
    async (raw: string) => {
      const result = await lookupWord({ raw, sourceLanguage, targetLanguage }, deps);
      if (result.ok) {
        setState({ status: 'ready', lookup: result.lookup });
        // Counted for `user_book_progress.words_looked_up`, which is the only
        // measure of how much the reader is actually being used.
        setLookupCount((n) => n + 1);
        return;
      }
      if (result.reason === 'quota') {
        setLookupsExhausted(true);
        setState({ status: 'quota', word: raw });
        return;
      }
      // 'not_a_word' shares the error panel: a learner who tapped an em-dash
      // gets the same "couldn't look that up", which is true and is the only
      // thing worth saying about it.
      setState({ status: 'error', word: raw });
    },
    [deps, sourceLanguage, targetLanguage],
  );

  const onWordPress = useCallback(
    (raw: string, ref: SelectedRef) => {
      setSelectedRef(ref);
      setExplanation(null);

      // A word already in the session map resolves without a state flicker,
      // and — importantly — without a network call even once exhausted.
      const cached = session.get(raw) ?? session.get(raw.toLowerCase());
      if (cached) {
        setState({ status: 'ready', lookup: cached });
        return;
      }
      if (lookupsExhausted) {
        setState({ status: 'quota', word: raw });
        return;
      }

      setState({ status: 'loading', word: raw });
      void runLookup(raw);
    },
    [session, lookupsExhausted, runLookup],
  );

  const retry = useCallback(() => {
    if (!state || state.status === 'ready') return;
    setState({ status: 'loading', word: state.word });
    void runLookup(state.word);
  }, [state, runLookup]);

  const dismiss = useCallback(() => {
    setSelectedRef(null);
    setState(null);
    setExplanation(null);
  }, []);

  const explain = useCallback(
    async (paragraphIndex: number, text: string) => {
      setSelectedRef(null);
      setState(null);

      if (explanationsExhausted) {
        setExplanation({ paragraphIndex, status: 'quota' });
        return;
      }

      setExplanation({ paragraphIndex, status: 'loading' });
      try {
        const result = await explainPassage(
          text,
          sourceLanguage,
          targetLanguage,
          cefrLevel,
          bookId,
        );
        setExplanation({ paragraphIndex, status: 'ready', text: result.explanation });
      } catch (err) {
        if (isQuotaError(err) || (err as { code?: string })?.code === 'DAILY_MESSAGE_LIMIT_REACHED') {
          setExplanationsExhausted(true);
          setExplanation({ paragraphIndex, status: 'quota' });
          return;
        }
        setExplanation({ paragraphIndex, status: 'error' });
      }
    },
    [explanationsExhausted, sourceLanguage, targetLanguage, cefrLevel, bookId],
  );

  return {
    selectedRef,
    state,
    explanation,
    lookupCount,
    onWordPress,
    retry,
    dismiss,
    explain,
    /** The current lookup adapted for `addCardFromAnnotation`. */
    cardSource: state?.status === 'ready' ? cardSourceFromLookup(state.lookup) : null,
    /** Exposed for tests and for cache invalidation. */
    wordCacheKey,
  };
}
