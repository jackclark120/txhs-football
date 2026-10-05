import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { Chips } from '../components/Chips';
import { GameCard } from '../components/GameCard';
import { currentWeek, listGames, subscribeGames } from '../data/api';
import { useSchools } from '../data/useSchools';
import { isDemo } from '../lib/supabase';
import type { RootStackParamList } from '../navigation';
import { colors, space } from '../theme';
import type { Classification, Game } from '../types';

const CLASSES = ['All', '6A', '5A', '4A', '3A', '2A', '1A'] as const;

export function ScoresScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const schools = useSchools();
  const [week, setWeek] = useState<number | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [cls, setCls] = useState<(typeof CLASSES)[number]>('All');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const w = week ?? (await currentWeek());
    if (week == null) setWeek(w);
    setGames(await listGames(w));
  }, [week]);

  useEffect(() => {
    load();
    return subscribeGames(load);
  }, [load]);

  const visible = games.filter((g) => cls === 'All' || schools.get(g.homeSchoolId)?.classification === (cls as Classification));
  const sections = [
    { title: 'Live', data: visible.filter((g) => g.status === 'live') },
    { title: 'Upcoming', data: visible.filter((g) => g.status === 'scheduled') },
    { title: 'Final', data: visible.filter((g) => g.status === 'final') },
  ].filter((s) => s.data.length > 0);

  return (
    <View style={styles.screen}>
      {isDemo && <Text style={styles.demo}>Demo data. Connect Supabase to see real games.</Text>}
      <Chips options={CLASSES} value={cls} onChange={setCls} />
      {week != null && (
        <Chips
          options={[week - 1, week, week + 1].filter((w) => w >= 0)}
          value={week}
          onChange={setWeek}
          label={(w) => (w === 0 ? 'Week 0' : `Week ${w}`)}
        />
      )}
      <SectionList
        sections={sections}
        keyExtractor={(g) => g.id}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.text} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title}</Text>}
        renderItem={({ item }) => (
          <GameCard
            game={item}
            home={schools.get(item.homeSchoolId)}
            away={schools.get(item.awaySchoolId)}
            onPress={() => nav.navigate('Game', { gameId: item.id })}
          />
        )}
        ListEmptyComponent={<Text style={styles.empty}>No games this week.</Text>}
        stickySectionHeadersEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space(4) },
  demo: { color: colors.accent, fontSize: 12, marginTop: space(2) },
  section: { color: colors.muted, fontWeight: '700', textTransform: 'uppercase', fontSize: 12, marginVertical: space(2) },
  empty: { color: colors.muted, textAlign: 'center', marginTop: space(10) },
});
