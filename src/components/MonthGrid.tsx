import { Pressable, StyleSheet, Text, View } from 'react-native';

import { monthGrid, today } from '@/lib/dates';
import { colors } from './theme';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

interface Props {
  year: number;
  month: number;
  /** YYYY-MM-DD -> total cents spent that day. */
  totals: Record<string, number>;
  onSelectDay: (date: string) => void;
}

export function MonthGrid({ year, month, totals, onSelectDay }: Props) {
  const todayIso = today();

  return (
    <View>
      <View style={styles.row}>
        {WEEKDAYS.map((d) => (
          <Text key={d} style={[styles.cell, styles.weekday]}>
            {d}
          </Text>
        ))}
      </View>
      {monthGrid(year, month).map((week, i) => (
        <View key={i} style={styles.row}>
          {week.map((date, j) =>
            date ? (
              <Pressable
                key={date}
                onPress={() => onSelectDay(date)}
                style={[styles.cell, styles.day, date === todayIso && styles.today]}
              >
                <Text style={styles.dayNumber}>{Number(date.slice(8))}</Text>
                {totals[date] ? (
                  <Text style={styles.total} numberOfLines={1}>
                    {Math.round(totals[date] / 100)}
                  </Text>
                ) : null}
              </Pressable>
            ) : (
              <View key={`empty-${j}`} style={styles.cell} />
            ),
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  cell: { flex: 1, aspectRatio: 1, margin: 2 },
  weekday: { aspectRatio: undefined, textAlign: 'center', color: colors.muted, fontSize: 12, paddingVertical: 4 },
  day: {
    backgroundColor: colors.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    justifyContent: 'space-between',
  },
  today: { backgroundColor: colors.today, borderColor: colors.primary },
  dayNumber: { fontSize: 13, color: colors.text },
  total: { fontSize: 11, color: colors.primary, fontWeight: '600', textAlign: 'right' },
});
