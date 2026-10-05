import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import type { Confidence } from '../types';

const LABELS: Record<Confidence, { text: string; color: string } | null> = {
  none: null,
  unconfirmed: { text: 'Unconfirmed', color: colors.muted },
  confirmed: { text: 'Fan confirmed', color: colors.ok },
  official: { text: 'Official', color: colors.accent },
};

export function ConfidenceBadge({ confidence, centered }: { confidence: Confidence; centered?: boolean }) {
  const label = LABELS[confidence];
  if (!label) return null;
  return (
    <View style={[styles.badge, { borderColor: label.color }, centered && { alignSelf: 'center' }]}>
      <Text style={[styles.text, { color: label.color }]}>{label.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  text: { fontSize: 11, fontWeight: '600' },
});
