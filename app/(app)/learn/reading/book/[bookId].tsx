import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Pressable, ActivityIndicator, Alert, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeBack } from '../../../../../hooks/useSafeBack';
import { Ionicons } from '@expo/vector-icons';
import * as Sentry from '@sentry/react-native';
import { useAuth } from '../../../../../hooks/useAuth';
import { useProfile } from '../../../../../hooks/useProfile';
import { useWordLookup } from '../../../../../hooks/useWordLookup';
import {
  fetchBookMeta,
  fetchBookContent,
  fetchBookAnnotations,
  fetchUserBookProgress,
  upsertBookProgress,
  addCardFromAnnotation,
  NewCardsCapReachedError,
  fetchSubscription,
  type AnnotationCardSource,
} from '../../../../../lib/supabase-queries';
import { BookReader } from '../../../../../components/reading/BookReader';
import { cachedFetch, getCached, readCacheKey, setCached } from '../../../../../lib/read-cache';
import { touchPack } from '../../../../../lib/offline-packs';
import { OfflineDownloadControl } from '../../../../../components/learn/OfflineDownloadControl';
import { floatingTabBarSpace } from '../../../../../components/navigation/FloatingTabBar';
import { supabase } from '../../../../../lib/supabase';
import { loadErrorCopy, saveErrorCopy, type ErrorCopy } from '../../../../../lib/error-copy';
import { cefrCanDo, cefrAccessibilityLabel } from '../../../../../lib/cefr-labels';
import type { ReadingBook, BookAnnotation, UserBookProgress, Subscription } from '../../../../../types';
// `colors` is deliberately NOT imported: it is the fixed DARK palette, and a
// screen that reads it stays dark whatever the phone is set to.
import { useUi2Theme } from '../../../../../hooks/useUi2Theme';
import { SlabCard } from '../../../../../components/ui2/SlabCard';
import { Heading, Body, Caption } from '../../../../../components/ui2/Ui2Text';
import { useScreenView } from '../../../../../hooks/useScreenView';

export default function BookDetailScreen() {
  useScreenView('book');
  const { c, shape } = useUi2Theme();
  const insets = useSafeAreaInsets();
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const router = useRouter();
  const goBack = useSafeBack('/(app)');
  const { user } = useAuth();
  const { profile } = useProfile();
  const [book, setBook] = useState<ReadingBook | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [annotations, setAnnotations] = useState<BookAnnotation[]>([]);
  const [progress, setProgress] = useState<UserBookProgress | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReading, setIsReading] = useState(false);
  const [error, setError] = useState<ErrorCopy | null>(null);
  // Guards against re-awarding XP when the reader re-fires onComplete (paging
  // back and forth across the last page, narration auto-advance, etc.).
  const hasCompletedRef = useRef(false);

  const isUnlimitedPlan = subscription?.tier === 'vip' && subscription?.isActive;

  const load = useCallback(async () => {
    if (!bookId || !user) return;
    setIsLoading(true);
    setError(null);
    try {
      // Metadata only. `content` is fetched behind the Read button below —
      // it averages 211 kB and reaches 1.8 MB, and making the cover screen
      // wait on the whole book was the slowest thing in the reader.
      // Meta and annotations under the keys an offline pack warms, so a
      // downloaded book opens with no connection; progress and the plan are
      // best-effort there (the reader shows the book, the CTA copy may be
      // conservative until the next online open).
      const [{ data: bookData }, { data: annData }, progressData, sub] = await Promise.all([
        cachedFetch<ReadingBook | null>(readCacheKey('book-meta', bookId), () => fetchBookMeta(bookId)),
        cachedFetch<BookAnnotation[]>(readCacheKey('book-annotations', bookId), () => fetchBookAnnotations(bookId)),
        fetchUserBookProgress(user.id, bookId).catch(() => [] as UserBookProgress[]),
        fetchSubscription(user.id).catch(() => null),
      ]);

      setBook(bookData);
      setAnnotations(annData ?? []);
      setProgress(progressData[0] ?? null);
      setSubscription(sub);
      if (bookData) void touchPack(user.id, 'book', bookId);
    } catch (e) {
      // Was `setError(e.message)`, which rendered the raw Supabase/Postgres
      // string straight into the UI. See lib/error-copy.ts.
      setError(loadErrorCopy(e, 'this book'));
    } finally {
      setIsLoading(false);
    }
  }, [bookId, user]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Fetch the book's text, from the device cache when possible.
   *
   * Published books are immutable, so a cache hit needs no revalidation —
   * which is why this uses getCached/setCached rather than `cachedFetch`,
   * whose whole job is to re-run the fetcher every time.
   */
  const loadContent = useCallback(async (): Promise<string | null> => {
    if (!bookId) return null;
    const key = readCacheKey('book-content', bookId);
    const cached = await getCached<string>(key);
    if (cached) return cached;

    const fetched = await fetchBookContent(bookId);
    if (fetched) await setCached(key, fetched);
    return fetched;
  }, [bookId]);

  const startReading = useCallback(async () => {
    if (content !== null) {
      setIsReading(true);
      return;
    }
    setIsLoadingContent(true);
    try {
      const text = await loadContent();
      if (text === null) {
        setError(loadErrorCopy(new Error('missing content'), 'this book'));
        return;
      }
      setContent(text);
      setIsReading(true);
    } catch (e) {
      setError(loadErrorCopy(e, 'this book'));
    } finally {
      setIsLoadingContent(false);
    }
  }, [content, loadContent]);

  // Every word in the book is tappable; `book_annotations` is a free first
  // hit where it exists (28 of 10,375 books) and the `translate` function
  // answers for the rest.
  const help = useWordLookup({
    sourceLanguage: book?.language ?? profile?.targetLanguage ?? 'en',
    targetLanguage: profile?.nativeLanguage ?? 'en',
    cefrLevel: book?.cefrLevel ?? 'A1',
    annotations,
    bookId: bookId ?? undefined,
  });

  const handlePositionChange = useCallback(async (position: number, percent: number) => {
    if (!user || !bookId) return;
    try {
      const updated = await upsertBookProgress(user.id, bookId, {
        currentPosition: position,
        percentComplete: percent,
      });
      setProgress(updated);
    } catch (err) {
      // Not silent. Losing this is losing the learner's place in a book, which
      // they discover by reopening it at chapter one. Non-fatal — reading
      // continues — but it must be reportable.
      console.warn('[book] position save failed:', err);
      Sentry.captureException(err, { tags: { area: 'book-position-save' } });
    }
  }, [user, bookId]);

  const handleAddToReview = useCallback(async (source: AnnotationCardSource) => {
    if (!user || !book) return null;

    // Find the user's active course for this language to associate the card
    const { data: courses } = await supabase
      .from('courses')
      .select('id')
      .eq('target_language', book.language)
      .eq('is_published', true)
      .limit(1)
      .single();

    if (!courses) {
      // Not a failure — there is genuinely nowhere to file the card yet.
      Alert.alert(
        "Can't save that word",
        `There's no ${book.language.toUpperCase()} course yet, so there's nowhere to add this card. It will work once one is published.`,
      );
      return null;
    }

    // Books used to build the card and review item inline here, which meant
    // the daily new-card cap was enforced on passages but not on books — and
    // since migration 084 that cap IS the free-tier limit, so the book reader
    // was an unmetered way around it. One shared path, one cap.
    try {
      // The book's band and language file the card so it counts toward
      // measured vocabulary, and let the duplicate check find a word the
      // learner already saved from chat or another book.
      return await addCardFromAnnotation(
        user.id,
        source,
        courses.id,
        ['reading', 'book'],
        book.cefrLevel,
        book.language,
      );
    } catch (err) {
      if (err instanceof NewCardsCapReachedError) {
        Alert.alert(
          "That's all your new words for today",
          `You've started ${err.cap} new words today. This one will still be here tomorrow — reviewing what you've already started is always unlimited.`,
        );
        return null;
      }
      const { title, message } = saveErrorCopy(err, 'that word to your reviews');
      Alert.alert(title, message);
      return null;
    }
  }, [user, book]);

  /**
   * Persist how many words were looked up this session.
   *
   * Written on exit rather than per tap: the reader now makes EVERY word
   * tappable, so a per-tap write would be a row update per word. The count
   * comes from the lookup hook, which is the only thing that knows a tap
   * resolved rather than being a stray press on punctuation.
   */
  const saveLookupCount = useCallback(async () => {
    if (!user || !bookId || help.lookupCount === 0) return;
    try {
      await upsertBookProgress(user.id, bookId, {
        wordsLookedUp: (progress?.wordsLookedUp ?? 0) + help.lookupCount,
      });
    } catch (err) {
      // Cosmetic counter, but a swallowed catch here hid a broken write path
      // that also carries the position save above.
      console.warn('[book] word-lookup counter failed:', err);
    }
  }, [user, bookId, progress?.wordsLookedUp, help.lookupCount]);

  const handleComplete = useCallback(async () => {
    if (!user || !bookId || !book) return;
    // Award once per session, and never re-award a book already finished.
    if (hasCompletedRef.current || progress?.completedAt) {
      setIsReading(false);
      return;
    }
    hasCompletedRef.current = true;
    try {
      await upsertBookProgress(user.id, bookId, {
        percentComplete: 100,
        completedAt: new Date().toISOString(),
      });

      Alert.alert(
        'Book finished',
        `You read all ${book.wordCount.toLocaleString()} words of "${book.title}".`,
        [{ text: 'Continue', onPress: () => setIsReading(false) }]
      );
    } catch (err) {
      hasCompletedRef.current = false; // allow a retry if the write failed
      const { title, message } = saveErrorCopy(err, 'your progress on this book');
      Alert.alert(title, message);
    }
  }, [user, bookId, book, progress?.completedAt]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  if (error || !book) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Body weight="semibold" tone="error" style={{ textAlign: 'center' }}>
          {error?.title ?? 'Book not found'}
        </Body>
        <Body tone="tertiary" style={{ textAlign: 'center', marginTop: 8 }}>
          {error?.message ?? "We couldn't find this book. It may have been removed."}
        </Body>
        {/* A failed load is usually transient, so retry comes before leaving. */}
        {error && (
          <Pressable
            onPress={load}
            style={{ marginTop: 16, minHeight: 44, justifyContent: 'center' }}
            accessibilityRole="button"
            accessibilityLabel="Try loading this book again"
          >
            <Body weight="semibold" tone="accent">Try again</Body>
          </Pressable>
        )}
        <Pressable onPress={() => goBack()} style={{ marginTop: 16, minHeight: 44, justifyContent: 'center' }} accessibilityRole="button">
          <Body tone="accent">Go Back</Body>
        </Pressable>
      </View>
    );
  }

  // Reading mode
  if (isReading) {
    return (
      <BookReader
        book={book}
        content={content ?? ''}
        initialPosition={progress?.currentPosition ?? 0}
        isUnlimitedPlan={isUnlimitedPlan}
        onPositionChange={handlePositionChange}
        selectedRef={help.selectedRef}
        lookup={help.state}
        explanation={help.explanation}
        onWordPress={help.onWordPress}
        onExplain={(paragraph) => help.explain(paragraph.index, paragraph.text)}
        onRetryLookup={help.retry}
        onDismissHelp={help.dismiss}
        onAddToReview={() =>
          help.cardSource ? handleAddToReview(help.cardSource) : Promise.resolve(null)
        }
        onUpgrade={() => router.push('/(app)/profile/subscription')}
        onComplete={handleComplete}
        onExit={() => {
          void saveLookupCount();
          setIsReading(false);
        }}
      />
    );
  }

  // Book detail view
  const isStarted = progress && progress.percentComplete > 0;
  const isCompleted = progress?.completedAt !== null && progress?.completedAt !== undefined;
  const estimatedMinutes = Math.round(book.wordCount / 200); // ~200 wpm reading speed

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, flexDirection: 'row', alignItems: 'center' }}>
        <Pressable onPress={() => goBack()} hitSlop={8} style={{ padding: 8 }} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={c.idle} />
        </Pressable>
      </View>

      {/* Book Info */}
      <View style={{ padding: 20, flex: 1 }}>
        {/* Cover Image */}
        {book.imageUrl && (
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <Image
              source={{ uri: book.imageUrl }}
              style={{ width: 140, height: 200, borderRadius: 8 }}
              resizeMode="cover"
              accessibilityLabel={`Cover of ${book.title}`}
            />
          </View>
        )}

        {/* CEFR Badge. The badge is keyed to the band rather than always indigo,
            so it matches the same book's chip in the library grid. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          {/* Hand-rolled rather than <Ui2Badge> because this badge carries its
              own accessibilityLabel — the spelled-out band — and Ui2Badge
              labels itself from the visible code. */}
          <View style={{ backgroundColor: c.primaryTint, borderColor: c.primaryTintBorder, borderWidth: shape.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Body
              size="sm"
              weight="semibold"
              tone="accent"
              accessibilityLabel={cefrAccessibilityLabel(book.cefrLevel)}
            >
              {book.cefrLevel}
            </Body>
          </View>
          <View style={{ backgroundColor: c.track, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 }}>
            <Caption tone="secondary">{book.source === 'ai_generated' ? 'AI Story' : book.source === 'gutenberg' ? 'Classic' : 'Wikisource'}</Caption>
          </View>
        </View>

        {/* This screen is where a learner decides whether a book is for them, so
            it spells the band out rather than making them decode the chip. */}
        {cefrCanDo(book.cefrLevel) ? (
          <Caption
            tone="tertiary"
            style={{ marginBottom: 12 }}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            {cefrCanDo(book.cefrLevel)}
          </Caption>
        ) : null}

        {/* Title & Author */}
        <Heading level={2} style={{ marginBottom: 4 }}>{book.title}</Heading>
        {book.author && (
          <Body tone="tertiary" style={{ marginBottom: 12 }}>by {book.author}</Body>
        )}

        {/* Description */}
        {book.description && (
          <Body tone="tertiary" style={{ lineHeight: 22, marginBottom: 16 }}>{book.description}</Body>
        )}

        {/* Stats */}
        <SlabCard style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <View style={{ alignItems: 'center' }}>
              <Ionicons name="document-text-outline" size={20} color={c.primary} />
              <Body weight="semibold" style={{ marginTop: 4 }}>
                {book.wordCount.toLocaleString()}
              </Body>
              <Caption size="sm" tone="tertiary">words</Caption>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Ionicons name="time-outline" size={20} color={c.primary} />
              <Body weight="semibold" style={{ marginTop: 4 }}>
                ~{estimatedMinutes} min
              </Body>
              <Caption size="sm" tone="tertiary">to read</Caption>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Ionicons name="star-outline" size={20} color={c.primary} />
              <Body weight="semibold" style={{ marginTop: 4 }}>
                {book.cefrLevel}
              </Body>
              <Caption size="sm" tone="tertiary">level</Caption>
            </View>
          </View>
        </SlabCard>

        {/* Progress (if started) */}
        {isStarted && !isCompleted && (
          <SlabCard style={{ marginBottom: 16 }}>
            <Body size="sm" weight="semibold" tone="tertiary" style={{ marginBottom: 8 }}>Your Progress</Body>
            <View style={{ height: 8, backgroundColor: c.track, borderRadius: 4 }}>
              <View style={{
                height: 8, backgroundColor: c.primary, borderRadius: 4,
                width: `${Math.round(progress!.percentComplete)}%`,
              }} />
            </View>
            <Caption tone="tertiary" style={{ marginTop: 4 }}>
              {Math.round(progress!.percentComplete)}% complete
            </Caption>
          </SlabCard>
        )}

        {isCompleted && (
          <SlabCard tint="green" style={{ marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="checkmark-circle" size={24} color={c.green} />
            <Body weight="semibold" style={{ marginLeft: 8 }}>Completed!</Body>
          </SlabCard>
        )}

        {/* Audiobook upsell for non-unlimited users */}
        {!isUnlimitedPlan && (
          <Pressable
            onPress={() => router.push('/(app)/profile/subscription')}
            style={{ backgroundColor: c.primaryTint, borderColor: c.primaryTintBorder, borderWidth: shape.border, borderRadius: 16, padding: 16, marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}
            accessibilityRole="button"
            accessibilityLabel="Upgrade to listen to this book"
          >
            <Ionicons name="headset-outline" size={24} color={c.onTint} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Body weight="semibold" tone="accent">Listen to this book</Body>
              <Caption tone="accent" style={{ marginTop: 2 }}>Upgrade to VIP for audiobook narration</Caption>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.onTint} />
          </Pressable>
        )}
      </View>

      {/* CTA Button */}
      {/* The cover keeps the tab bar (only the pages hide it), so the CTA
          reserves the bar's height instead of a guessed 100. */}
      <View style={{ padding: 20, paddingBottom: 20 + insets.bottom + floatingTabBarSpace(), borderTopWidth: 1, borderTopColor: c.cardBorder }}>
        {book && (
          <View style={{ alignItems: 'flex-start', marginBottom: 12 }}>
            <OfflineDownloadControl
              what={book.title}
              spec={{ kind: 'book', target: { bookId: book.id, title: book.title, language: book.language } }}
            />
          </View>
        )}
        {/* The book's text is fetched here, not with the cover — so this is
            the one button in the app that can legitimately sit spinning for a
            moment on a long novel. */}
        <Pressable
          onPress={() => void startReading()}
          disabled={isLoadingContent}
          style={{
            backgroundColor: c.primary,
            paddingVertical: 16,
            borderRadius: 14,
            alignItems: 'center',
            opacity: isLoadingContent ? 0.7 : 1,
          }}
          accessibilityRole="button"
          accessibilityState={{ disabled: isLoadingContent, busy: isLoadingContent }}
          accessibilityLabel={isStarted ? 'Continue reading' : 'Start reading'}
        >
          {isLoadingContent ? (
            <ActivityIndicator size="small" color={c.onPrimary} />
          ) : (
            <Body size="lg" weight="semibold" tone="onPrimary">
              {isCompleted ? 'Read Again' : isStarted ? 'Continue Reading' : 'Start Reading'}
            </Body>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
