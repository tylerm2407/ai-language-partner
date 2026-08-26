import { useCallback, useState } from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Body, Caption } from '../ui/Text';
import { AudioScrubber } from './AudioScrubber';
import { useArticlePlayer, SKIP_SECONDS } from '../../hooks/useArticlePlayer';
import { fetchNewsAudio } from '../../lib/supabase-queries';
import { loadErrorCopy } from '../../lib/error-copy';
import { colors, spacing, radii, typography } from '../../config/theme';
import type { DailyNewsArticle } from '../../types';

/** mm:ss. Hours are not a case here — the longest article runs about 3 minutes. */
function timecode(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface ArticleAudioPlayerProps {
  article: DailyNewsArticle;
}

/**
 * "Listen to this article" for the daily news.
 *
 * The audio is fetched only on an explicit tap, never on render. That is a
 * cost decision as much as a UX one: the signed URL is served unmetered, so a
 * fetch sitting in a bare effect would bill egress for every learner who
 * merely opened the article, and a render loop would have nothing but the
 * server's burst limit to stop it.
 */
export function ArticleAudioPlayer({ article }: ArticleAudioPlayerProps) {
  const player = useArticlePlayer();
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<{ title: string; message: string } | null>(null);
  const [loaded, setLoaded] = useState(false);

  const start = useCallback(async () => {
    setFetching(true);
    setFetchError(null);
    try {
      const audio = await fetchNewsAudio(article.id);
      if (!audio) {
        // The narration is still rendering. Not an error — say so plainly
        // rather than showing a failure for something that is simply not ready.
        setFetchError({
          title: 'Still being recorded',
          message: 'The audio for this article is being prepared. Try again in a moment.',
        });
        return;
      }
      await player.load({
        id: article.id,
        url: audio.url,
        title: article.title,
        subtitle: 'Fluenci · Daily News',
        artworkUrl: article.imageUrl,
        durationMs: audio.durationMs,
      });
      setLoaded(true);
      await player.playPause();
    } catch (err) {
      setFetchError(loadErrorCopy(err, 'this article’s audio'));
    } finally {
      setFetching(false);
    }
  }, [article, player]);

  const busy = fetching || player.status === 'loading';
  const playing = player.status === 'playing';

  // Before the first tap this is a single invitation, not a transport bar —
  // controls for audio that does not exist yet would be dead affordances.
  if (!loaded && !fetchError) {
    return (
      <View style={{ marginBottom: spacing.lg }}>
        <Pressable
          onPress={start}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={
            article.audioDurationMs
              ? `Listen to this article, ${timecode(article.audioDurationMs)}`
              : 'Listen to this article'
          }
          accessibilityState={{ disabled: busy, busy }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            minHeight: 44,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: radii.lg,
            backgroundColor: colors.surface.card,
          }}
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.action.primaryFill} />
          ) : (
            <Ionicons name="headset" size={20} color={colors.action.primaryFill} />
          )}
          <Body size="sm" style={{ color: colors.text.primary }}>
            {busy ? 'Loading audio…' : 'Listen to this article'}
          </Body>
          {article.audioDurationMs ? (
            <Caption
              style={{
                marginLeft: 'auto',
                fontFamily: typography.family.mono,
                color: colors.text.tertiary,
              }}
            >
              {timecode(article.audioDurationMs)}
            </Caption>
          ) : null}
        </Pressable>
      </View>
    );
  }

  const problem = fetchError ?? (player.error ? { title: 'Playback failed', message: player.error } : null);

  return (
    <View
      style={{
        marginBottom: spacing.lg,
        padding: spacing.md,
        borderRadius: radii.xl,
        backgroundColor: colors.surface.card,
        gap: spacing.xs,
      }}
    >
      {problem ? (
        <View accessibilityRole="alert" style={{ gap: spacing.xxs }}>
          <Body size="sm" style={{ color: colors.error.light }}>
            {problem.title}
          </Body>
          <Caption style={{ color: colors.text.secondary }}>{problem.message}</Caption>
          <Pressable
            onPress={start}
            accessibilityRole="button"
            accessibilityLabel="Try loading the audio again"
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <Body size="sm" style={{ color: colors.action.primaryFill }}>
              Try again
            </Body>
          </Pressable>
        </View>
      ) : (
        <>
          <AudioScrubber
            positionMs={player.positionMs}
            durationMs={player.durationMs}
            onSeek={player.seekToMs}
            stepSeconds={SKIP_SECONDS}
            disabled={player.durationMs <= 0}
          />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Caption style={{ fontFamily: typography.family.mono, color: colors.text.tertiary }}>
              {timecode(player.positionMs)}
            </Caption>
            <Caption style={{ fontFamily: typography.family.mono, color: colors.text.tertiary }}>
              {timecode(player.durationMs)}
            </Caption>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.lg,
              marginTop: spacing.xs,
            }}
          >
            <Pressable
              onPress={() => player.skipBy(-SKIP_SECONDS)}
              accessibilityRole="button"
              accessibilityLabel={`Back ${SKIP_SECONDS} seconds`}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="play-back" size={22} color={colors.text.secondary} />
            </Pressable>

            <Pressable
              onPress={player.playPause}
              accessibilityRole="button"
              accessibilityLabel={playing ? 'Pause' : 'Play'}
              accessibilityState={{ busy: player.status === 'loading' }}
              style={{
                width: 56,
                height: 56,
                borderRadius: radii.pill,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.action.primaryFill,
              }}
            >
              {player.status === 'loading' ? (
                <ActivityIndicator size="small" color={colors.text.onPrimary} />
              ) : (
                <Ionicons
                  name={playing ? 'pause' : 'play'}
                  size={26}
                  color={colors.text.onPrimary}
                />
              )}
            </Pressable>

            <Pressable
              onPress={() => player.skipBy(SKIP_SECONDS)}
              accessibilityRole="button"
              accessibilityLabel={`Forward ${SKIP_SECONDS} seconds`}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="play-forward" size={22} color={colors.text.secondary} />
            </Pressable>

            <Pressable
              onPress={player.cycleRate}
              accessibilityRole="button"
              accessibilityLabel={`Playback speed ${player.rate} times. Tap to change.`}
              style={{
                minWidth: 44,
                height: 44,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Body
                size="sm"
                style={{ fontFamily: typography.family.mono, color: colors.text.secondary }}
              >
                {player.rate}×
              </Body>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}
