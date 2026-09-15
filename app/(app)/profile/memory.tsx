/**
 * What Sol remembers — the learner's view of `tutor_memory`.
 *
 * The live tutor writes up to 24 short notes per language after each session
 * (a fact about you, a goal, a mistake to watch for, a preference, a topic)
 * and reads them back at the start of the next one. Until now those notes were
 * invisible. A memory you cannot see and delete is surveillance, not
 * attention, so this screen shows every note and lets the learner forget any
 * of them — or all of them — for good. Deleting costs personalisation and
 * nothing else: progress, XP and SRS records are not derived from these rows.
 */
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeBack } from '../../../hooks/useSafeBack';
import { useAuth } from '../../../hooks/useAuth';
import { useAppStore } from '../../../stores/useAppStore';
import { useTutorMemory } from '../../../hooks/useTutorMemory';
import { useScreenView } from '../../../hooks/useScreenView';
import { useUi2Theme } from '../../../hooks/useUi2Theme';
import { Ui2Header } from '../../../components/ui2/Ui2Header';
import { SlabCard } from '../../../components/ui2/SlabCard';
import { Ui2ListRow } from '../../../components/ui2/Ui2ListRow';
import { Ui2EmptyState } from '../../../components/ui2/Ui2EmptyState';
import { Ui2InlineError } from '../../../components/ui2/Ui2InlineError';
import { Body, Caption } from '../../../components/ui2/Ui2Text';
import { MascotSol } from '../../../components/ui2/MascotSol';
import { getTargetLanguage } from '../../../lib/language';
import { formatRelativeDay } from '../../../lib/dates';
import { trackEvent } from '../../../lib/analytics';
import { haptic } from '../../../lib/haptics';
import type { TutorMemory, TutorMemoryKind } from '../../../types';

/** Display order and wording per note kind. The tutor's enum, in the learner's words. */
const KIND_ORDER: TutorMemoryKind[] = ['personal_fact', 'goal', 'recurring_error', 'preference', 'topic_thread'];

const KIND_COPY: Record<TutorMemoryKind, { title: string; icon: keyof typeof Ionicons.glyphMap }> = {
  personal_fact: { title: 'About you', icon: 'person-outline' },
  goal: { title: 'What you are working toward', icon: 'flag-outline' },
  recurring_error: { title: 'Mistakes Sol listens for', icon: 'ear-outline' },
  preference: { title: 'How you like to be taught', icon: 'options-outline' },
  topic_thread: { title: 'Things you have talked about', icon: 'chatbubble-ellipses-outline' },
};

export default function TutorMemoryScreen() {
  useScreenView('tutor_memory');
  const { c, type } = useUi2Theme();
  const router = useRouter();
  const goBack = useSafeBack('/(app)/profile');
  const { user } = useAuth();
  const { profile } = useAppStore();
  const language = getTargetLanguage(profile);
  const { notes, loading, error, forgetError, retry, forget, forgetAll } = useTutorMemory(user?.id, language);
  const [busy, setBusy] = useState(false);

  const confirmForget = (note: TutorMemory) => {
    Alert.alert(
      'Forget this note?',
      `Sol will stop remembering: “${note.content}”. Your progress is not affected.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Forget',
          style: 'destructive',
          onPress: async () => {
            haptic('select');
            try {
              await forget(note.id);
              trackEvent('tutor_memory_forgotten', { count: 1, language: language ?? undefined });
            } catch {
              // The hook restored the note and set `forgetError`, rendered below.
            }
          },
        },
      ],
    );
  };

  const confirmForgetAll = () => {
    Alert.alert(
      'Forget everything?',
      `Sol will start the next session knowing nothing about you beyond your level and language. ${notes.length} ${notes.length === 1 ? 'note' : 'notes'} will be deleted. Your progress is not affected.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Forget everything',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            const count = notes.length;
            try {
              await forgetAll();
              trackEvent('tutor_memory_forgotten', { count, language: language ?? undefined });
            } catch {
              // Restored by the hook; `forgetError` says so.
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const groups = KIND_ORDER
    .map((kind) => ({ kind, notes: notes.filter((n) => n.kind === kind) }))
    .filter((g) => g.notes.length > 0);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <Ui2Header title="What Sol remembers" subtitle="Notes from your live tutor sessions" onBack={() => goBack()} />

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={c.primary} />
            <Body size="sm" tone="tertiary" style={{ marginTop: 12 }}>Asking Sol…</Body>
          </View>
        ) : error ? (
          <Ui2InlineError copy={error} onRetry={retry} />
        ) : notes.length === 0 ? (
          <View style={styles.body}>
            <Ui2EmptyState
              icon="moon-outline"
              title="Sol has no notes yet"
              description="After a live tutor session, what Sol learns about you — your goals, the mistakes to listen for, what you like talking about — shows up here, and you can delete any of it."
              actionLabel="Start a session"
              onAction={() => router.push('/tutor' as never)}
            />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <SlabCard tint="primary" style={styles.intro}>
              <MascotSol size={56} mood="idle" />
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <Text style={{ fontFamily: type.heading, fontSize: 16, lineHeight: 20, color: c.ink }}>
                  {notes.length} {notes.length === 1 ? 'thing' : 'things'} Sol carries into your next session
                </Text>
                <Text style={{ fontFamily: type.ui, fontSize: 13, lineHeight: 18, color: c.muted }}>
                  Written after each call, in your own language. Forget any note and it is gone for good.
                </Text>
              </View>
            </SlabCard>

            {forgetError && (
              <SlabCard tint="pink" style={{ gap: 4 }}>
                <Text style={{ fontFamily: type.uiBold, fontSize: 14, color: c.error }}>{forgetError.title}</Text>
                <Text style={{ fontFamily: type.ui, fontSize: 13, color: c.muted }}>{forgetError.message}</Text>
              </SlabCard>
            )}

            {groups.map(({ kind, notes: group }) => (
              <View key={kind} style={styles.section}>
                <View style={styles.sectionHead}>
                  <Ionicons name={KIND_COPY[kind].icon} size={16} color={c.muted} />
                  <Text accessibilityRole="header" style={{ fontFamily: type.heading, fontSize: 16, color: c.ink }}>
                    {KIND_COPY[kind].title}
                  </Text>
                </View>
                <SlabCard style={{ paddingVertical: 4 }}>
                  {group.map((note, i) => (
                    <NoteRow key={note.id} note={note} last={i === group.length - 1} onForget={() => confirmForget(note)} />
                  ))}
                </SlabCard>
              </View>
            ))}

            <View style={styles.section}>
              <Ui2ListRow
                icon="trash-outline"
                title="Forget everything"
                subtitle="Sol starts the next session with a blank page"
                destructive
                disabled={busy}
                onPress={confirmForgetAll}
                accessibilityLabel="Forget everything Sol remembers"
              />
              <Caption tone="tertiary" style={{ lineHeight: 18 }}>
                Notes are kept for at most 180 days and never number more than 24. Your lessons, reviews and level are separate records and are not changed by anything here.
              </Caption>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

function NoteRow({ note, last, onForget }: { note: TutorMemory; last: boolean; onForget: () => void }) {
  const { c, type } = useUi2Theme();
  const when = formatRelativeDay(note.lastSeenAt).toLowerCase();
  const mentions = note.mentionCount === 1 ? 'Came up once' : `Came up ${note.mentionCount} times`;
  return (
    <View
      style={[styles.noteRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.trackOnCard }]}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 3 }} accessibilityLabel={`${note.content}. ${mentions}, last ${when}.`}>
        <Text style={{ fontFamily: type.uiBold, fontSize: 15, lineHeight: 20, color: c.ink }}>{note.content}</Text>
        <Text style={{ fontFamily: type.ui, fontSize: 12, color: c.muted }}>
          {mentions} · last {when}
        </Text>
      </View>
      <Pressable
        onPress={onForget}
        accessibilityRole="button"
        accessibilityLabel={`Forget: ${note.content}`}
        hitSlop={6}
        style={[styles.forgetBtn, { backgroundColor: c.pinkTint }]}
      >
        <Ionicons name="close" size={18} color={c.error} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 48, gap: 18 },
  intro: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  section: { gap: 10 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  forgetBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
