import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, space } from '../theme';

export function Chips<T extends string | number>({ options, value, onChange, label }: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  label?: (v: T) => string;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.row}>
      {options.map((o) => (
        <Pressable key={String(o)} onPress={() => onChange(o)} style={[styles.chip, o === value && styles.active]}>
          <Text style={[styles.text, o === value && styles.activeText]}>{label ? label(o) : String(o)}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  row: { alignItems: 'center', gap: space(2), paddingVertical: space(2) },
  chip: { paddingHorizontal: space(3), paddingVertical: space(1.5), borderRadius: 999, backgroundColor: colors.cardAlt },
  active: { backgroundColor: colors.accent },
  text: { color: colors.text, fontWeight: '600' },
  activeText: { color: '#1B1300' },
});
