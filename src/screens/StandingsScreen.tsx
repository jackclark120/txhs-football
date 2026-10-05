import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Chips } from '../components/Chips';
import { getStandings } from '../data/api';
import { useSchools } from '../data/useSchools';
import type { RootStackParamList } from '../navigation';
import { colors, space } from '../theme';
import type { Classification, StandingRow } from '../types';

const CLASSES: Classification[] = ['6A', '5A', '4A', '3A', '2A', '1A'];

export function StandingsScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const schools = useSchools();
  const [cls, setCls] = useState<Classification>('6A');
  const districts = useMemo(
    () => [...new Set([...schools.values()].filter((s) => s.classification === cls).map((s) => s.district))].sort((a, b) => a - b),
    [schools, cls],
  );
  const [district, setDistrict] = useState<number | null>(null);
  const [rows, setRows] = useState<StandingRow[]>([]);

  useEffect(() => setDistrict(districts[0] ?? null), [districts]);
  useEffect(() => {
    if (district == null) return setRows([]);
    getStandings(cls, district).then(setRows);
  }, [cls, district]);

  return (
    <View style={styles.screen}>
      <Chips options={CLASSES} value={cls} onChange={setCls} />
      {district != null && <Chips options={districts} value={district} onChange={setDistrict} label={(d) => `District ${d}`} />}
      <View style={[styles.row, styles.head]}>
        <Text style={[styles.team, styles.headText]}>Team</Text>
        <Text style={[styles.cell, styles.headText]}>Dist</Text>
        <Text style={[styles.cell, styles.headText]}>All</Text>
        <Text style={[styles.cell, styles.headText]}>PF</Text>
        <Text style={[styles.cell, styles.headText]}>PA</Text>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.schoolId}
        renderItem={({ item, index }) => {
          const s = schools.get(item.schoolId);
          return (
            <Pressable style={styles.row} onPress={() => nav.navigate('School', { schoolId: item.schoolId })}>
              <Text style={styles.team} numberOfLines={1}>{index + 1}. {s?.name}</Text>
              <Text style={styles.cell}>{item.districtWins}-{item.districtLosses}</Text>
              <Text style={styles.cell}>{item.overallWins}-{item.overallLosses}</Text>
              <Text style={styles.cell}>{item.pointsFor}</Text>
              <Text style={styles.cell}>{item.pointsAgainst}</Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>No {cls} schools loaded yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space(4) },
  row: { flexDirection: 'row', paddingVertical: space(3), borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  head: { marginTop: space(2) },
  headText: { color: colors.muted, fontWeight: '700', fontSize: 12 },
  team: { flex: 1, color: colors.text, fontWeight: '600' },
  cell: { width: 44, color: colors.text, textAlign: 'right', fontVariant: ['tabular-nums'] },
  empty: { color: colors.muted, textAlign: 'center', marginTop: space(10) },
});
