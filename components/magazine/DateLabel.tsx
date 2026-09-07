import { Text, StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { typography, spacing, ui2Dark, ui2Light, type Ui2Palette } from '../../config/theme';
import { useUi2Theme } from '../../hooks/useUi2Theme';

const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function DateLabel({ style }: { style?: StyleProp<TextStyle> }) {
  const { scheme } = useUi2Theme();
  const now = new Date();
  const dayName = DAYS[now.getDay()];
  const month = MONTHS[now.getMonth()];
  const date = now.getDate();

  return (
    <Text style={[themed[scheme].label, style]}>
      {dayName} {'·'} {month} {date}
    </Text>
  );
}

const makeStyles = (c: Ui2Palette) =>
  StyleSheet.create({
    label: {
      fontFamily: typography.family.mono,
      fontSize: 12,
      letterSpacing: typography.tracking.dateLabel,
      color: c.muted,
      textTransform: 'uppercase',
      marginBottom: spacing.xs,
    },
  });

/**
 * Both schemes are built once, at module load, and picked by index at render.
 * `StyleSheet.create` registers what it is given; rebuilding it inside the
 * component would throw that registration away on every render, and a plain
 * inline object would do it twice per element.
 */
const themed = { light: makeStyles(ui2Light), dark: makeStyles(ui2Dark) } as const;
