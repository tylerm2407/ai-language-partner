/**
 * What your tutor remembers — the learner's view of `tutor_memory`, and their pen.
 *
 * Three things live on this screen, and they are three different claims:
 *
 *  1. **Notes.** Written by the live tutor after a session (migration 108),
 *     seeded from the sign-up answers (142), or typed here by the learner
 *     (141). Each says who wrote it, because "you told your tutor this" and
 *     "your tutor noticed this" are not the same statement and only one of
 *     them is the learner's own.
 *  2. **From your practice.** NOT notes, and deliberately not stored as notes:
 *     recurring mistakes and struggling words are computed live from
 *     `correction_log` and `review_items` by `useLearnerInsights`, which reads
 *     exactly what the paid tutor prompt reads. Writing them into this table
 *     would produce a copy that goes stale the moment the learner fixes the
 *     mistake, and that competes for space with the biography.
 *  3. **Forgetting.** Any note can be deleted, and all of them at once.
 *
 * A memory you cannot see and delete is surveillance rather than attention;
 * a memory you can see but cannot correct leaves the tutor believing something
 * wrong about you with deletion as the only remedy. So this screen now writes
 * too — through the `tutor-memory` edge function, never by a client table
 * write, because a note becomes part of a future system prompt and RLS refuses
 * client INSERT and UPDATE for exactly that reason.
 *
 * Deleting costs personalisation and nothing else: progress and SRS records are
 * not derived from these rows.
 */
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeBack } from '../../../hooks/useSafeBack';
import { useAuth } from '../../../hooks/useAuth';
import { useAppStore } from '../../../stores/useAppStore';
import { useTutorMemory, TUTOR_MEMORY_LEARNER_KEEP } from '../../../hooks/useTutorMemory';
import { useLearnerInsights } from '../../../hooks/useLearnerInsights';
import { useScreenView } from '../../../hooks/useScreenView';
import { useUi2Theme } from '../../../hooks/useUi2Theme';
import { Ui2Header } from '../../../components/ui2/Ui2Header';
import { SlabCard } from '../../../components/ui2/SlabCard';
import { SlabButton } from '../../../components/ui2/SlabButton';
import { Ui2ListRow } from '../../../components/ui2/Ui2ListRow';
import { Ui2EmptyState } from '../../../components/ui2/Ui2EmptyState';
import { Ui2InlineError } from '../../../components/ui2/Ui2InlineError';
import { Ui2Sheet } from '../../../components/ui2/Ui2Sheet';
import { Ui2Input } from '../../../components/ui2/Ui2Input';
import { Body, Caption } from '../../../components/ui2/Ui2Text';
import { Ui2Mascot } from '../../../components/ui2/Ui2Mascot';
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
  recurring_error: { title: 'Mistakes your tutor listens for', icon: 'ear-outline' },
  preference: { title: 'How you like to be taught', icon: 'options-outline' },
  topic_thread: { title: 'Things you have talked about', icon: 'chatbubble-ellipses-outline' },
};

/**
 * The three kinds a learner may write, mirroring `LEARNER_KINDS` in the
 * `tutor-memory` function. `recurring_error` is absent on both sides on
 * purpose: what the learner gets wrong is measured from their corrections, and
 * a hand-typed claim would be a second, unverifiable copy of it.
 */
const WRITABLE_KINDS: { kind: TutorMemoryKind; label: string; placeholder: string }[] = [
  {
    kind: 'personal_fact',
    label: 'About me',
    placeholder: 'I am a nurse and I work night shifts.',
  },
  {
    kind: 'goal',
    label: 'What I want',
    placeholder: 'I want to talk to my partner’s family at Christmas.',
  },
  {
    kind: 'preference',
    label: 'How to teach me',
    placeholder: 'Please let me finish before correcting me.',
  },
];

/** Mirrors the DB `CHECK (char_length(content) BETWEEN 3 AND 200)`. */
const MAX_NOTE_CHARS = 200;
const MIN_NOTE_CHARS = 3;

const SOURCE_LABEL: Record<TutorMemory['source'], string> = {
  learner: 'You wrote this',
  onboarding: 'From your sign-up answers',
  tutor: 'Your tutor noticed this',
};

export default function TutorMemoryScreen() {
  useScreenView('tutor_memory');
  const { c, type } = useUi2Theme();
  const router = useRouter();
  const goBack = useSafeBack('/(app)/profile');
  const { user } = useAuth();
  const { profile } = useAppStore();
  const language = getTargetLanguage(profile);
  const {
    notes, loading, error, forgetError, retry, forget, forgetAll, add, edit, canAddNote, ownNoteCount,
  } = useTutorMemory(user?.id, language);
  // Read-only, and a failure here must not take the notes down with it: the
  // practice section simply does not render. The notes are the screen.
  const insights = useLearnerInsights(user?.id, language);
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);

  const confirmForget = (note: TutorMemory) => {
    Alert.alert(
      'Forget this note?',
      `Your tutor will stop remembering: “${note.content}”. Your progress is not affected.`,
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
      `Your tutor will start the next session knowing nothing about you beyond your level and language. ${notes.length} ${notes.length === 1 ? 'note' : 'notes'} will be deleted. Your progress is not affected.`,
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

  const saveEditor = async (draft: EditorState, text: string) => {
    setBusy(true);
    try {
      if (draft.mode === 'add') {
        await add(draft.kind, text);
        // `outcome` rather than a new property: the event schema is closed on
        // purpose, and 'add' / 'edit' is exactly the durable-stage distinction
        // it already carries.
        trackEvent('tutor_memory_written', { outcome: 'add', language: language ?? undefined });
      } else {
        await edit(draft.id, text);
        trackEvent('tutor_memory_written', { outcome: 'edit', language: language ?? undefined });
      }
      setEditor(null);
    } catch {
      // `forgetError` carries the server's refusal — the eight-note cap, a
      // rejected note, a dropped connection. The sheet stays open with the
      // text still in it so the learner can fix it rather than retype it.
    } finally {
      setBusy(false);
    }
  };

  const groups = KIND_ORDER
    .map((kind) => ({ kind, notes: notes.filter((n) => n.kind === kind) }))
    .filter((g) => g.notes.length > 0);

  const practice = usePracticeLines(insights, language);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <Ui2Header title="What your tutor remembers" subtitle="Everything it knows about you" onBack={() => goBack()} />

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={c.primary} />
            <Body size="sm" tone="tertiary" style={{ marginTop: 12 }}>Asking your tutor…</Body>
          </View>
        ) : error ? (
          <Ui2InlineError copy={error} onRetry={retry} />
        ) : (
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {notes.length === 0 ? (
              <Ui2EmptyState
                icon="moon-outline"
                title="No notes yet"
                description="Tell your tutor something about you, or have a session — what it learns about your goals, the mistakes to listen for and what you like talking about shows up here, and you can change or delete any of it."
                actionLabel="Tell your tutor something"
                onAction={() => setEditor({ mode: 'add', kind: 'personal_fact' })}
              />
            ) : (
              <SlabCard tint="primary" style={styles.intro}>
                <Ui2Mascot size={56} mood="idle" />
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <Text style={{ fontFamily: type.heading, fontSize: 16, lineHeight: 20, color: c.ink }}>
                    {notes.length} {notes.length === 1 ? 'thing' : 'things'} your tutor carries into your next conversation
                  </Text>
                  <Text style={{ fontFamily: type.ui, fontSize: 13, lineHeight: 18, color: c.muted }}>
                    Used in your chats and live sessions. Edit any note, or forget it for good.
                  </Text>
                </View>
              </SlabCard>
            )}

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
                    <NoteRow
                      key={note.id}
                      note={note}
                      last={i === group.length - 1}
                      onForget={() => confirmForget(note)}
                      onEdit={() => setEditor({ mode: 'edit', id: note.id, kind: note.kind, initial: note.content })}
                    />
                  ))}
                </SlabCard>
              </View>
            ))}

            {/* Add sits under the notes rather than in the header: the point of
                the screen is what the tutor already knows, and an "add" affordance
                above that would read as a form to fill in. */}
            <View style={styles.section}>
              <SlabButton
                label="Tell your tutor something"
                variant="tint"
                arrow={false}
                disabled={!canAddNote || busy}
                onPress={() => setEditor({ mode: 'add', kind: 'personal_fact' })}
              />
              <Caption tone="tertiary" style={{ lineHeight: 18 }}>
                {canAddNote
                  ? `You can keep ${TUTOR_MEMORY_LEARNER_KEEP} notes of your own — ${ownNoteCount} used so far.`
                  : `You are keeping all ${TUTOR_MEMORY_LEARNER_KEEP} of your own notes. Delete one to write another.`}
              </Caption>
            </View>

            {practice.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <Ionicons name="pulse-outline" size={16} color={c.muted} />
                  <Text accessibilityRole="header" style={{ fontFamily: type.heading, fontSize: 16, color: c.ink }}>
                    From your practice
                  </Text>
                </View>
                <SlabCard style={{ gap: 10 }}>
                  <Text style={{ fontFamily: type.ui, fontSize: 13, lineHeight: 18, color: c.muted }}>
                    Worked out from your corrections and reviews every time you practise, so there is nothing here to
                    edit — fix the mistake and it leaves the list.
                  </Text>
                  {practice.map((line) => (
                    <View key={line} style={styles.practiceRow}>
                      <View style={[styles.dot, { backgroundColor: c.primary }]} />
                      <Text style={{ flex: 1, fontFamily: type.ui, fontSize: 14, lineHeight: 19, color: c.ink }}>
                        {line}
                      </Text>
                    </View>
                  ))}
                </SlabCard>
                <Ui2ListRow
                  icon="stats-chart-outline"
                  title="See your patterns"
                  subtitle="The full list, with examples"
                  onPress={() => router.push('/(app)/profile/patterns' as never)}
                />
              </View>
            )}

            {notes.length > 0 && (
              <View style={styles.section}>
                <Ui2ListRow
                  icon="trash-outline"
                  title="Forget everything"
                  subtitle="Your tutor starts the next session with a blank page"
                  destructive
                  disabled={busy}
                  onPress={confirmForgetAll}
                  accessibilityLabel="Forget everything your tutor remembers"
                />
                <Caption tone="tertiary" style={{ lineHeight: 18 }}>
                  Notes your tutor wrote are kept for at most 180 days; yours are kept until you delete them. Your name and how
                  you like to be taught follow you into every language you study; goals and mistakes stay with the
                  language they came from. Your lessons, reviews and level are separate records and are not changed by
                  anything here.
                </Caption>
              </View>
            )}
          </ScrollView>
        )}

        <NoteEditorSheet
          state={editor}
          busy={busy}
          onDismiss={() => (busy ? undefined : setEditor(null))}
          onSave={saveEditor}
        />
      </SafeAreaView>
    </View>
  );
}

// ─── The editor ───────────────────────────────────────────────────────────

type EditorState =
  | { mode: 'add'; kind: TutorMemoryKind }
  | { mode: 'edit'; id: string; kind: TutorMemoryKind; initial: string };

/**
 * One sheet for both writing and rewriting.
 *
 * Kind is chosen only when adding: an edit never changes a note's kind, both
 * because `edit_learner_memory` does not take one and because moving a note
 * between kinds would move it between scopes, which is a different note.
 */
function NoteEditorSheet({
  state,
  busy,
  onDismiss,
  onSave,
}: {
  state: EditorState | null;
  busy: boolean;
  onDismiss: () => void;
  onSave: (state: EditorState, text: string) => void;
}) {
  const { c, type } = useUi2Theme();
  const [text, setText] = useState('');
  const [kind, setKind] = useState<TutorMemoryKind>('personal_fact');

  // The draft belongs to the note the sheet was opened for, so it is seeded
  // when `state` changes identity — which happens on open and on nothing else.
  // A `key` remount would do the same job and would also throw the text away
  // whenever the parent re-rendered mid-typing, which is the failure this
  // avoids: `busy` flips during a save.
  useEffect(() => {
    if (!state) return;
    setText(state.mode === 'edit' ? state.initial : '');
    setKind(state.kind);
  }, [state]);

  const spec = WRITABLE_KINDS.find((k) => k.kind === kind) ?? WRITABLE_KINDS[0];
  const trimmed = text.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < MIN_NOTE_CHARS;

  return (
    <Ui2Sheet visible={state !== null} onDismiss={onDismiss} dismissOnBackdrop={!busy} avoidKeyboard>
      <View style={styles.sheet}>
        <Text accessibilityRole="header" style={{ fontFamily: type.heading, fontSize: 18, color: c.ink }}>
          {state?.mode === 'edit' ? 'Rewrite this note' : 'Tell your tutor something'}
        </Text>
        <Text style={{ fontFamily: type.ui, fontSize: 13, lineHeight: 18, color: c.muted }}>
          Write it the way you would say it to a person. Your tutor reads these before your conversations; it will never read
          them back to you.
        </Text>

        {state?.mode === 'add' && (
          <View style={styles.kindRow}>
            {WRITABLE_KINDS.map((option) => {
              const active = option.kind === kind;
              return (
                <Pressable
                  key={option.kind}
                  onPress={() => setKind(option.kind)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.kindChip,
                    {
                      backgroundColor: active ? c.primaryTint : c.card,
                      borderColor: active ? c.primary : c.trackOnCard,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontFamily: active ? type.uiBold : type.ui,
                      fontSize: 13,
                      color: active ? c.primary : c.muted,
                    }}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <Ui2Input
          value={text}
          onChangeText={setText}
          placeholder={spec.placeholder}
          multiline
          maxLength={MAX_NOTE_CHARS}
          editable={!busy}
          error={tooShort ? 'A few more words, please.' : undefined}
          helper={`${trimmed.length}/${MAX_NOTE_CHARS}`}
          inputStyle={{ minHeight: 76, textAlignVertical: 'top' }}
        />

        <SlabButton
          label={state?.mode === 'edit' ? 'Save note' : 'Remember this'}
          arrow={false}
          loading={busy}
          disabled={busy || trimmed.length < MIN_NOTE_CHARS}
          onPress={() => state && onSave(state.mode === 'add' ? { mode: 'add', kind } : state, trimmed)}
        />
      </View>
    </Ui2Sheet>
  );
}

// ─── Derived, not stored ──────────────────────────────────────────────────

/**
 * The practice lines, in the learner's words.
 *
 * Same thresholds as `lib/insights.ts`, which mirrors
 * `supabase/functions/_shared/learner-context.ts` — so what this section shows
 * is what the tutor prompt is actually handed, not a second opinion about it.
 */
function usePracticeLines(
  insights: ReturnType<typeof useLearnerInsights>,
  language: string | null,
): string[] {
  return useMemo(() => {
    if (insights.loading || insights.error || !language) return [];
    const lines: string[] = [];
    for (const mistake of insights.mistakes.slice(0, 3)) {
      lines.push(`${mistake.label} — ${mistake.count} times recently`);
    }
    const words = insights.words.slice(0, 4).map((w) => w.card.targetText).filter(Boolean);
    if (words.length > 0) lines.push(`Words you keep slipping on: ${words.join(', ')}`);
    return lines;
  }, [insights.loading, insights.error, insights.mistakes, insights.words, language]);
}

// ─── Rows ─────────────────────────────────────────────────────────────────

function NoteRow({
  note,
  last,
  onForget,
  onEdit,
}: {
  note: TutorMemory;
  last: boolean;
  onForget: () => void;
  onEdit: () => void;
}) {
  const { c, type } = useUi2Theme();
  const when = formatRelativeDay(note.lastSeenAt).toLowerCase();
  const mentions = note.mentionCount === 1 ? 'Came up once' : `Came up ${note.mentionCount} times`;
  // Provenance first, because it qualifies everything after it: a note the tutor
  // inferred and a note the learner typed deserve different amounts of trust.
  // A count of one from the learner's own pen is not "came up once" — they
  // said it, so the sighting count is noise on their rows.
  const meta = note.source === 'tutor'
    ? `${SOURCE_LABEL.tutor} · ${mentions} · last ${when}`
    : `${SOURCE_LABEL[note.source]}${note.updatedAt ? ' · edited' : ''}`;

  return (
    <View
      style={[styles.noteRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.trackOnCard }]}
    >
      <Pressable
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={`${note.content}. ${meta}.`}
        accessibilityHint="Rewrite this note"
        style={{ flex: 1, minWidth: 0, gap: 3 }}
      >
        <Text style={{ fontFamily: type.uiBold, fontSize: 15, lineHeight: 20, color: c.ink }}>{note.content}</Text>
        <Text style={{ fontFamily: type.ui, fontSize: 12, color: c.muted }}>{meta}</Text>
      </Pressable>
      <Pressable
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={`Rewrite: ${note.content}`}
        hitSlop={6}
        style={[styles.iconBtn, { backgroundColor: c.primaryTint }]}
      >
        <Ionicons name="pencil" size={16} color={c.primary} />
      </Pressable>
      <Pressable
        onPress={onForget}
        accessibilityRole="button"
        accessibilityLabel={`Forget: ${note.content}`}
        hitSlop={6}
        style={[styles.iconBtn, { backgroundColor: c.pinkTint }]}
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
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  iconBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  practiceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  sheet: { padding: 20, gap: 14 },
  kindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kindChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1 },
});
