import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from './theme';

interface Props<T extends string> {
  options: readonly T[];
  labels: Record<T, string>;
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({ options, labels, value, onChange }: Props<T>) {
  return (
    <View style={styles.container} accessibilityRole="radiogroup">
      {options.map((option) => (
        <Pressable
          key={option}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === option }}
          onPress={() => onChange(option)}
          style={[styles.option, value === option && styles.selected]}
        >
          <Text style={[styles.text, value === option && styles.selectedText]}>{labels[option]}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', borderWidth: 1, borderColor: colors.primary, borderRadius: 8, overflow: 'hidden' },
  option: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: colors.surface },
  selected: { backgroundColor: colors.primary },
  text: { color: colors.primary, fontWeight: '600' },
  selectedText: { color: colors.primaryText },
});
