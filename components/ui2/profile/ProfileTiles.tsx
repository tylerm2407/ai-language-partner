/**
 * Profile · Dashboard (canvas "Fluenci Home, Talk and Profile", picked
 * 2026-09-14): the identity row and the four stat tiles above the lists.
 *
 * The tiles are a summary, not a second source of truth. Each number is the
 * one the section further down the page already shows — the band and ring
 * come from the same `useNextBandProgress` Home uses, the week from the
 * strands fetch, achievements from the grid's own hook, lessons from the
 * completed-lessons section's fetch — so a tile can never disagree with the
 * card it summarises. Level is the only tile that navigates (to the report);
 * the other three describe what is already on the page.
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SlabCard } from '../SlabCard';
import { ProgressRing, levelEyebrow } from '../home/HomeSections';
import { displayMinutes } from '../../../lib/active-time';
import { STRAND_LABELS, type Strand, type StrandMinutes } from '../../../lib/four-strands';
import { formatRelativeDay } from '../../../lib/dates';
import { useUi2Theme } from '../../../hooks/useUi2Theme';
import type { Ui2Palette } from '../../../config/theme';

// ─── Identity ──────────────────────────────────────────────────────────────
interface IdentityRowProps {
  name: string;
  email: string | null;
  languageLabel: string | null;
  avatar: ReactNode;
  onAvatar: () => void;
  onSettings: () => void;
}

export function IdentityRow({ name, email, languageLabel, avatar, onAvatar, onSettings }: IdentityRowProps) {
  const { c, type } = useUi2Theme();
  return (
    <View style={styles.identity}>
      <Pressable
        onPress={onAvatar}
        accessibilityLabel="Change avatar"
        accessibilityRole="button"
        style={[styles.avatarRing, { backgroundColor: c.primaryTint, borderColor: c.primary }]}
      >
        {avatar}
      </Pressable>
      <View style={styles.identityText}>
        <Text style={{ fontFamily: type.heading, fontSize: 18, lineHeight: 22, color: c.ink }} numberOfLines={1}>
          {name}
        </Text>
        {email ? (
          <Text style={{ fontFamily: type.ui, fontSize: 11, lineHeight: 15, color: c.idle }} numberOfLines={1}>
            {email}
          </Text>
        ) : null}
        {languageLabel ? (
          <View style={[styles.chip, { backgroundColor: c.primaryTint }]}>
            <Text style={{ fontFamily: type.uiHeavy, fontSize: 12, color: c.onTint }}>{languageLabel.toUpperCase()}</Text>
          </View>
        ) : null}
      </View>
      <Pressable
        onPress={onSettings}
        accessibilityRole="button"
        accessibilityLabel="Settings"
        style={[styles.gear, { backgroundColor: c.card }]}
        hitSlop={8}
      >
        <Ionicons name="settings-outline" size={18} color={c.muted} />
      </Pressable>
    </View>
  );
}

// ─── Stat tiles ────────────────────────────────────────────────────────────
const STRAND_ORDER = Object.keys(STRAND_LABELS) as Strand[];

const strandColor = (c: Ui2Palette): Record<Strand, string> => ({
  meaning_input: c.primary,
  meaning_output: c.green,
  language_focus: c.yellow,
  fluency: c.pink,
});

interface StatTilesProps {
  band: string;
  nextBand: string | null;
  progressPercent: number | null;
  measured: boolean;
  levelLabel: string;
  onLevel: () => void;
  /** This week's strand minutes; null while loading or failed. */
  strands: StrandMinutes | null;
  /** Earned / total; null while loading. */
  achievements: { earned: number; total: number } | null;
  /** From the completed-lessons section; null while loading or unreadable. */
  lessons: { total: number; latestAt: string | null } | null;
}

function Eyebrow({ children, color }: { children: string; color: string }) {
  const { type } = useUi2Theme();
  return (
    <Text style={{ fontFamily: type.uiHeavy, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color }} numberOfLines={1}>
      {children}
    </Text>
  );
}

function Big({ children, unit }: { children: string; unit?: string }) {
  const { c, type } = useUi2Theme();
  return (
    <Text style={{ fontFamily: type.heading, fontSize: 26, lineHeight: 28, color: c.ink }} numberOfLines={1}>
      {children}
      {unit ? <Text style={{ fontFamily: type.uiBold, fontSize: 13, color: c.muted }}> {unit}</Text> : null}
    </Text>
  );
}

export function StatTiles({ band, nextBand, progressPercent, measured, levelLabel, onLevel, strands, achievements, lessons }: StatTilesProps) {
  const { c, type } = useUi2Theme();
  const weekTotal = strands ? STRAND_ORDER.reduce((n, k) => n + strands[k], 0) : 0;
  const shownAchievements = Math.min(achievements?.earned ?? 0, 3);
  return (
    <View style={styles.grid}>
      {/* Level — the only tile that goes somewhere. */}
      <Pressable
        onPress={onLevel}
        accessibilityRole="button"
        accessibilityLabel={`${measured ? 'Measured level' : 'Placed at'} ${band}, ${levelLabel}. ${levelEyebrow(nextBand, progressPercent, measured)}. Opens your proficiency report`}
        style={styles.cell}
      >
        <SlabCard tint="primary" style={styles.tile}>
          <View style={styles.levelTop}>
            <ProgressRing pct={progressPercent === null ? 0 : progressPercent / 100} size={48} stroke={5} color={c.primary} track={c.primaryTintBorder}>
              <Text style={{ fontFamily: type.heading, fontSize: 15, lineHeight: 18, color: c.onTint }}>{band}</Text>
            </ProgressRing>
            <View style={styles.levelText}>
              <Eyebrow color={c.onTint}>Level</Eyebrow>
              <Text style={{ fontFamily: type.uiHeavy, fontSize: 14, color: c.ink }} numberOfLines={2}>
                {levelLabel}
              </Text>
            </View>
          </View>
          <Text style={{ fontFamily: type.ui, fontSize: 12, color: c.muted }} numberOfLines={1}>
            {levelEyebrow(nextBand, progressPercent, measured)}
          </Text>
        </SlabCard>
      </Pressable>

      {/* This week — the strands card below has the breakdown. */}
      <View style={styles.cell} accessible accessibilityLabel={strands ? `This week: ${displayMinutes(weekTotal)} minutes across four strands` : 'This week: loading'}>
        <SlabCard style={styles.tile}>
          <Eyebrow color={c.muted}>This week</Eyebrow>
          <Big unit="min">{strands ? String(displayMinutes(weekTotal)) : '—'}</Big>
          <View style={styles.segments}>
            {STRAND_ORDER.map((k) => {
              const pct = strands && weekTotal > 0 ? (strands[k] / weekTotal) * 100 : 25;
              return <View key={k} style={{ flex: pct, backgroundColor: strands && weekTotal > 0 ? strandColor(c)[k] : c.trackOnCard }} />;
            })}
          </View>
          <Text style={{ fontFamily: type.ui, fontSize: 12, color: c.muted }}>4 strands</Text>
        </SlabCard>
      </View>

      {/* Achievements — the grid below is the detail. */}
      <View style={styles.cell} accessible accessibilityLabel={achievements ? `Achievements: ${achievements.earned} of ${achievements.total}` : 'Achievements: loading'}>
        <SlabCard style={styles.tile}>
          <Eyebrow color={c.muted}>Achievements</Eyebrow>
          <Big unit={achievements ? `/ ${achievements.total}` : undefined}>{achievements ? String(achievements.earned) : '—'}</Big>
          <View style={styles.trophies}>
            {Array.from({ length: shownAchievements }).map((_, i) => (
              <View key={i} style={[styles.trophy, { backgroundColor: c.primaryTint }]}>
                <Ionicons name="trophy" size={13} color={c.onTint} />
              </View>
            ))}
            {shownAchievements === 0 ? (
              <Text style={{ fontFamily: type.ui, fontSize: 12, color: c.muted }}>None yet</Text>
            ) : null}
          </View>
        </SlabCard>
      </View>

      {/* Lessons — the completed-lessons row below opens the list. */}
      <View style={styles.cell} accessible accessibilityLabel={lessons ? `${lessons.total} completed lessons${lessons.latestAt ? `, latest ${formatRelativeDay(lessons.latestAt)}` : ''}` : 'Lessons: loading'}>
        <SlabCard tint="green" style={styles.tile}>
          <Eyebrow color={c.muted}>Lessons</Eyebrow>
          <Big>{lessons ? String(lessons.total) : '—'}</Big>
          <Text style={{ fontFamily: type.ui, fontSize: 12, color: c.muted }} numberOfLines={1}>
            {lessons ? (lessons.latestAt ? `latest ${formatRelativeDay(lessons.latestAt)}` : 'none finished yet') : ' '}
          </Text>
        </SlabCard>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarRing: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  identityText: { flex: 1, minWidth: 0, gap: 2 },
  chip: { alignSelf: 'flex-start', height: 26, paddingHorizontal: 10, borderRadius: 999, justifyContent: 'center', marginTop: 4 },
  gear: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  // Two per row: (width − gap) / 2 via flexBasis, so the grid survives any font size.
  cell: { flexBasis: '47%', flexGrow: 1 },
  tile: { flex: 1, padding: 14, gap: 8, minHeight: 118 },
  levelTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  levelText: { flex: 1, minWidth: 0, gap: 2 },
  segments: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2 },
  trophies: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 24 },
  trophy: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
