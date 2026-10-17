import { Pressable, StyleSheet, Text, View } from 'react-native';

import { monthGrid, today } from '@/lib/dates';
import { colors } from './theme';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
/** A month spans at most 6 weeks; always render 6 so the grid height never changes. */
const WEEKS_SHOWN = 6;

interface Props {
  year: number;
  month: number;
  /** YYYY-MM-DD -> total cents spent that day. */
  totals: Record<string, number>;
  onSelectDay: (date: string) => void;
}

export function MonthGrid({ year, month, totals, onSelectDay }: Props) {
  const todayIso = today();
  const weeks = monthGrid(year, month);
  while (weeks.length < WEEKS_SHOWN) weeks.push(Array(7).fill(null));

  return (
    <View>
      <View style={styles.row}>
        {WEEKDAYS.map((d) => (
          <Text key={d} style={styles.weekday}>
            {d}
          </Text>
        ))}
      </View>
      {weeks.map((week, i) => (
        <View key={i} style={styles.row}>
          {week.map((date, j) => (
            <View key={date ?? `empty-${j}`} style={styles.cell}>
              {date ? (
                <Pressable
                  onPress={() => onSelectDay(date)}
                  style={[styles.day, date === todayIso && styles.today]}
                >
                  <Text style={styles.dayNumber}>{Number(date.slice(8))}</Text>
                  {totals[date] ? (
                    <Text style={styles.total} numberOfLines={1}>
                      {Math.round(totals[date] / 100)}
                    </Text>
                  ) : null}
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const CELL_WIDTH = `${100 / 7}%` as const;

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  // Fixed percentage widths (not flex) so every column is exactly 1/7 of the
  // row, whatever the cell contains.
  cell: { width: CELL_WIDTH, aspectRatio: 1, padding: 2 },
  weekday: { width: CELL_WIDTH, textAlign: 'center', color: colors.muted, fontSize: 12, paddingVertical: 4 },
  day: {
    flex: 1,
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
