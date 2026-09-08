/**
 * Your patterns — the full view behind Home's "Your patterns" card.
 *
 * Everything on this screen already existed as data the tutor was told on
 * every paid turn (`_shared/learner-context.ts`); this is the first time the
 * learner gets to read it. Recurring mistakes come from `correction_log` with
 * their most recent real example, struggling words from the SRS. No numbers
 * are scores: the one count that reads as achievement — words learned — only
 * ever goes up.
 */
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeBack } from '../../../hooks/useSafeBack';
import { useAuth } from '../../../hooks/useAuth';
import { useAppStore } from '../../../stores/useAppStore';
import { useLearnerInsights } from '../../../hooks/useLearnerInsights';
import { useScreenView } from '../../../hooks/useScreenView';
import { useUi2Theme } from '../../../hooks/useUi2Theme';
import { Ui2Header } from '../../../components/ui2/Ui2Header';
import { SlabCard } from '../../../components/ui2/SlabCard';
import { SlabButton } from '../../../components/ui2/SlabButton';
import { Chip } from '../../../components/ui2/Chip';
import { Ui2EmptyState } from '../../../components/ui2/Ui2EmptyState';
import { Ui2InlineError } from '../../../components/ui2/Ui2InlineError';
import { Body, Caption } from '../../../components/ui2/Ui2Text';
import { getTargetLanguage } from '../../../lib/language';
import { formatRelativeDay } from '../../../lib/dates';
import { trackEvent } from '../../../lib/analytics';
import {
  errorTypeIcon,
  errorTypeLabel,
  strugglingReasonLabel,
  type RecurringMistake,
  type StrugglingWord,
} from '../../../lib/insights';
import { INSIGHTS_WINDOW_DAYS } from '../../../lib/supabase-queries';
import { SUPPORTED_LANGUAGES } from '../../../config/app';

function languageName(code: string | null): string | null {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.name ?? null;
}

export default function PatternsScreen() {
  useScreenView('patterns');
  const { c, type } = useUi2Theme();
  const router = useRouter();
  const goBack = useSafeBack('/(app)');
  const { user } = useAuth();
  const { profile } = useAppStore();
  const language = getTargetLanguage(profile);
  const { mistakes, words, wordsLearned, loading, error, retry } = useLearnerInsights(user?.id, language);

  const startStrugglingReview = () => {
    trackEvent('review_started', { count: words.length, source: 'struggling' });
    router.push({ pathname: '/learn/review', params: { mode: 'struggling' } } as never);
  };

  const empty = !loading && !error && mistakes.length === 0 && words.length === 0;
  const langName = languageName(language);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <Ui2Header
          title="Your patterns"
          subtitle={`Last ${INSIGHTS_WINDOW_DAYS} days${langName ? ` · ${langName}` : ''}`}
          onBack={() => goBack()}
        />

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={c.primary} />
            <Body size="sm" tone="tertiary" style={{ marginTop: 12 }}>Reading your history…</Body>
          </View>
        ) : error ? (
          <Ui2InlineError copy={error} onRetry={retry} />
        ) : empty ? (
          <View style={styles.body}>
            <StatRow wordsLearned={wordsLearned} struggling={0} />
            <Ui2EmptyState
              icon="sparkles-outline"
              title="No patterns yet"
              description="Talk with your tutor or finish a lesson. Mistakes you make more than once, and words that keep slipping, show up here."
              actionLabel="Talk with your tutor"
              onAction={() => router.push('/chat' as never)}
            />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <StatRow wordsLearned={wordsLearned} struggling={words.length} />

            {mistakes.length > 0 && (
              <View style={styles.section}>
                <Text accessibilityRole="header" style={{ fontFamily: type.heading, fontSize: 18, color: c.ink }}>
                  Mistakes that keep coming back
                </Text>
                {mistakes.map((m) => <MistakeCard key={m.label} mistake={m} />)}
              </View>
            )}

            {words.length > 0 && (
              <View style={styles.section}>
                <Text accessibilityRole="header" style={{ fontFamily: type.heading, fontSize: 18, color: c.ink }}>
                  Words that keep slipping
                </Text>
                <SlabCard style={{ gap: 0, paddingVertical: 4 }}>
                  {words.map((w, i) => <WordRow key={w.card.id} word={w} last={i === words.length - 1} />)}
                </SlabCard>
                <SlabButton
                  label={`Review ${words.length === 1 ? 'this word' : `these ${words.length} words`}`}
                  onPress={startStrugglingReview}
                  accessibilityHint="Starts a review session of only these words"
                />
              </View>
            )}

            <Caption tone="tertiary" style={{ lineHeight: 18 }}>
              Built from your chats, lessons and reviews. Fixing one of these moves your level further than a new lesson would.
            </Caption>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

// ─── Pieces ────────────────────────────────────────────────────────────────

function StatRow({ wordsLearned, struggling }: { wordsLearned: number; struggling: number }) {
  const { c, type } = useUi2Theme();
  return (
    <View style={styles.statRow}>
      <SlabCard tint="primary" style={styles.stat} accessibilityRole="text" accessibilityLabel={`${wordsLearned} words learned`}>
        <Text style={{ fontFamily: type.heading, fontSize: 28, lineHeight: 32, color: c.onTint }}>{wordsLearned}</Text>
        <Text style={[styles.eyebrow, { fontFamily: type.uiHeavy, color: c.onTint }]}>Words learned</Text>
      </SlabCard>
      <SlabCard tint={struggling > 0 ? 'pink' : 'green'} style={styles.stat} accessibilityRole="text" accessibilityLabel={`${struggling} words slipping`}>
        <Text style={{ fontFamily: type.heading, fontSize: 28, lineHeight: 32, color: c.ink }}>{struggling}</Text>
        <Text style={[styles.eyebrow, { fontFamily: type.uiHeavy, color: c.muted }]}>Slipping</Text>
      </SlabCard>
    </View>
  );
}

function MistakeCard({ mistake }: { mistake: RecurringMistake }) {
  const { c, type } = useUi2Theme();
  const when = formatRelativeDay(mistake.latest);
  return (
    <SlabCard
      style={{ gap: 12 }}
      accessibilityLabel={`${mistake.label}. ${errorTypeLabel(mistake.errorType)}. Seen ${mistake.count} times, last ${when}.`}
    >
      <View style={styles.row}>
        <View style={[styles.iconTile, { backgroundColor: c.primaryTint }]}>
          <Ionicons name={errorTypeIcon(mistake.errorType)} size={18} color={c.onTint} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={{ fontFamily: type.uiHeavy, fontSize: 15, color: c.ink }} numberOfLines={2}>
            {mistake.label}
          </Text>
          <Text style={{ fontFamily: type.uiBold, fontSize: 12, color: c.muted }}>
            Seen {mistake.count} times · last {when.toLowerCase()}
          </Text>
        </View>
        <Chip label={errorTypeLabel(mistake.errorType)} variant="neutral" />
      </View>

      {mistake.example && (
        <View style={[styles.example, { backgroundColor: c.trackOnCard }]}>
          <View style={styles.exampleLine}>
            <Ionicons name="close-circle" size={14} color={c.error} />
            <Text style={{ fontFamily: type.ui, fontSize: 14, color: c.muted, flex: 1, textDecorationLine: 'line-through' }} numberOfLines={2}>
              {mistake.example.original}
            </Text>
          </View>
          <View style={styles.exampleLine}>
            <Ionicons name="checkmark-circle" size={14} color={c.green} />
            <Text style={{ fontFamily: type.uiBold, fontSize: 14, color: c.ink, flex: 1 }} numberOfLines={2}>
              {mistake.example.corrected}
            </Text>
          </View>
          {mistake.example.explanation ? (
            <Text style={{ fontFamily: type.ui, fontSize: 13, lineHeight: 18, color: c.muted }} numberOfLines={3}>
              {mistake.example.explanation}
            </Text>
          ) : null}
        </View>
      )}
    </SlabCard>
  );
}

function WordRow({ word, last }: { word: StrugglingWord; last: boolean }) {
  const { c, type } = useUi2Theme();
  return (
    <View
      style={[styles.wordRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.trackOnCard }]}
      accessibilityLabel={`${word.card.targetText}, ${word.card.nativeText}. ${strugglingReasonLabel(word.reason)}`}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Text style={{ fontFamily: type.uiHeavy, fontSize: 15, color: c.ink }} numberOfLines={1}>{word.card.targetText}</Text>
        <Text style={{ fontFamily: type.ui, fontSize: 13, color: c.muted }} numberOfLines={1}>{word.card.nativeText}</Text>
      </View>
      <Chip label={strugglingReasonLabel(word.reason)} variant={word.reason === 'leech' ? 'error' : 'warning'} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 48, gap: 18 },
  section: { gap: 10 },
  statRow: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, gap: 6, padding: 14 },
  eyebrow: { fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconTile: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  example: { borderRadius: 14, padding: 12, gap: 8 },
  exampleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
});
