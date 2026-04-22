import { Text, StyleSheet } from 'react-native';
import { colors, typography } from '../../config/theme';

const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function DateLabel() {
  const now = new Date();
  const dayName = DAYS[now.getDay()];
  const month = MONTHS[now.getMonth()];
  const date = now.getDate();

  return (
    <Text style={styles.label}>
      {dayName} {'·'} {month} {date}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: typography.family.mono,
    fontSize: 12,
    letterSpacing: 3,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
});
