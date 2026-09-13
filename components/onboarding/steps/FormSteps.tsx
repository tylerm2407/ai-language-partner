/**
 * The option-row steps of onboarding: language, level, course, daily goal,
 * notifications. Each renders only its body — the footer button is the
 * screen's, because it is what moves the flow on and the screen owns `step`.
 */
import { Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useUi2Theme } from '../../../hooks/useUi2Theme';
import { cefrBandForProficiencyLevel } from '../../../lib/cefr-proficiency';
import type { PlacementChoice, PlacementOption } from '../../../lib/course-placement';
import type { NotificationPrefs } from '../../../lib/notification-prefs';
import { SUPPORTED_LANGUAGES, DAILY_GOALS } from '../../../config/app';
import type { LanguageCode, ProficiencyLevel } from '../../../types';
import { OptionRow } from '../../ui2/OptionRow';
import { Chip } from '../../ui2/Chip';
import { NotificationBuilder } from '../NotificationBuilder';
import { FlagTile, LevelBars, stepStyles, type StepFrame } from './bits';
import { LEVELS, LEVEL_BARS } from './config';

function Lede({ children }: { children: React.ReactNode }) {
  const { c, type } = useUi2Theme();
  return (
    <Text style={{ fontFamily: type.ui, fontSize: 14, lineHeight: 20, color: c.muted }}>{children}</Text>
  );
}

export function LanguageStep({
  frame,
  value,
  onChange,
}: {
  frame: StepFrame;
  value: LanguageCode;
  onChange: (code: LanguageCode) => void;
}) {
  return (
    <>
      {frame.hero('What language do you want to learn?', 'slide')}
      <Animated.View entering={frame.enter(0)}>
        <Lede>You can add another later.</Lede>
      </Animated.View>
      {/* Short labels, so two columns: the grid is a different silhouette
          from a stacked list, and eight rows plus the hero did not fit
          above the CTA on the canvas. */}
      <View style={stepStyles.tiles}>
        {SUPPORTED_LANGUAGES.map((lang, i) => (
          <OptionRow
            key={lang.code}
            index={i}
            title={lang.name}
            selected={value === lang.code}
            onSelect={() => {
              onChange(lang.code as LanguageCode);
              frame.cheer();
            }}
            lead={<FlagTile flag={lang.flag} selected={value === lang.code} />}
            style={stepStyles.tile}
            tile
          />
        ))}
      </View>
    </>
  );
}

export function LevelStep({
  frame,
  value,
  onChange,
}: {
  frame: StepFrame;
  value: ProficiencyLevel;
  onChange: (level: ProficiencyLevel) => void;
}) {
  return (
    <>
      {frame.hero("What's your level?", 'pop')}
      {/* The acronym used to be introduced on the removed mode step, and
          this is now the first and only place a new user meets it — so it
          defines itself here or nowhere. */}
      <Animated.View entering={frame.enter(0)}>
        <Lede>
          Pick whichever is closest. Nothing here is a test, and you can change it any time. From
          here on your progress is shown as a CEFR level — the A1 to C2 scale — stated as what you
          can actually do.
        </Lede>
      </Animated.View>
      <View style={stepStyles.rows}>
        {LEVELS.map((l, i) => (
          <OptionRow
            key={l.value}
            index={i + 1}
            title={l.label}
            subtitle={l.description}
            selected={value === l.value}
            onSelect={() => {
              onChange(l.value);
              frame.cheer();
            }}
            lead={<LevelBars lit={LEVEL_BARS[l.value]} selected={value === l.value} />}
            trail={<Chip label={cefrBandForProficiencyLevel(l.value)} />}
          />
        ))}
      </View>
    </>
  );
}

/*
  Where the lessons start. Only reached when the declared level has a band
  below it (see `placementOptionsFor`); a beginner goes straight to identity.
  The self-report is trusted — this is the learner's chance to hedge it, not
  a test. Advanced learners are told plainly that no C1 path exists yet.
*/
export function CourseStep({
  frame,
  options,
  value,
  onChange,
}: {
  frame: StepFrame;
  options: PlacementOption[];
  value: PlacementChoice;
  onChange: (choice: PlacementChoice) => void;
}) {
  return (
    <>
      {frame.hero('Where should your lessons start?', 'pop')}
      <Animated.View entering={frame.enter(0)}>
        <Lede>
          Reading, chat and the tutor already follow your level. This only sets where the lesson
          path opens, and you can switch levels any time from the Learn tab.
        </Lede>
      </Animated.View>
      <View style={stepStyles.rows}>
        {options.map((o, i) => (
          <OptionRow
            key={o.choice}
            index={i + 1}
            title={o.title}
            subtitle={o.subtitle}
            selected={value === o.choice}
            onSelect={() => {
              onChange(o.choice);
              frame.cheer();
            }}
            trail={o.band ? <Chip label={o.band} /> : undefined}
          />
        ))}
      </View>
    </>
  );
}

export function GoalStep({
  frame,
  value,
  onChange,
}: {
  frame: StepFrame;
  value: number;
  onChange: (minutes: number) => void;
}) {
  return (
    <>
      {frame.hero('How much time do you have?', 'drop')}
      <Animated.View entering={frame.enter(0)}>
        <Lede>This sets the length of your daily session. Nothing breaks if you skip a day.</Lede>
      </Animated.View>
      <View style={stepStyles.rows}>
        {/* No commitment labels. The scale used to end at "Insane", which
            dares the learner into a budget they will miss, and a missed
            daily goal is the first step out of the habit. */}
        {DAILY_GOALS.map((goal, i) => (
          <OptionRow
            key={goal}
            index={i + 1}
            title={`${goal} minutes`}
            subtitle={goal <= 5 ? 'One quick exercise' : goal <= 10 ? 'A short session' : goal <= 15 ? 'A full session' : 'Session plus a read'}
            selected={value === goal}
            onSelect={() => {
              onChange(goal);
              frame.cheer();
            }}
            lead={<Chip label={`${goal}`} />}
            accessibilityLabel={`${goal} minutes per day`}
          />
        ))}
      </View>
    </>
  );
}

export function NotificationsStep({
  frame,
  prefs,
  onChange,
  dailyGoalMinutes,
}: {
  frame: StepFrame;
  prefs: NotificationPrefs;
  onChange: (prefs: NotificationPrefs) => void;
  dailyGoalMinutes: number;
}) {
  return (
    <>
      {frame.hero('When should Sol nudge you?', 'meet')}
      <Animated.View entering={frame.enter(0)}>
        <Lede>
          Switch on only what you want. Each one has its own time. Change any of it later in
          Settings.
        </Lede>
      </Animated.View>
      <Animated.View entering={frame.enter(1)}>
        <NotificationBuilder prefs={prefs} onChange={onChange} dailyGoalMinutes={dailyGoalMinutes} />
      </Animated.View>
    </>
  );
}
