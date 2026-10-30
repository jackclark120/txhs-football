import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GameCard } from '../components/GameCard';
import { listGames, listThreads } from '../data/api';
import { useSchools } from '../data/useSchools';
import type { ScreenProps } from '../navigation';
import { colors, space } from '../theme';
import type { ForumThread, Game } from '../types';

export function SchoolScreen({ route, navigation }: ScreenProps<'School'>) {
  const { schoolId } = route.params;
  const schools = useSchools();
  const school = schools.get(schoolId);
  const [games, setGames] = useState<Game[]>([]);
  const [threads, setThreads] = useState<ForumThread[]>([]);

  useEffect(() => {
    listGames().then((all) => setGames(all.filter((g) => g.homeSchoolId === schoolId || g.awaySchoolId === schoolId)));
    listThreads(schoolId).then(setThreads);
  }, [schoolId]);

  useEffect(() => {
    if (school) navigation.setOptions({ title: school.name });
  }, [school, navigation]);

  if (!school) return <View style={styles.screen} />;
  let wins = 0, losses = 0;
  for (const g of games) {
    if (g.status !== 'final' || g.homeScore == null || g.awayScore == null) continue;
    const mine = g.homeSchoolId === schoolId ? g.homeScore : g.awayScore;
    const theirs = g.homeSchoolId === schoolId ? g.awayScore : g.homeScore;
    if (mine > theirs) wins++; else if (mine < theirs) losses++;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: space(10) }}>
      <View style={[styles.banner, { backgroundColor: school.colors[0] }]}>
        <Text style={[styles.title, { color: school.colors[1] }]}>{[school.name, school.mascot].filter(Boolean).join(' ')}</Text>
        <Text style={[styles.sub, { color: school.colors[1] }]}>
          {school.city ? `${school.city} · ` : ''}{school.classification}{school.division ? ` Division ${school.division}` : ''} · District {school.district}
          {school.sixMan ? ' · Six-man' : ''}
        </Text>
        <Text style={[styles.record, { color: school.colors[1] }]}>{wins}-{losses}</Text>
      </View>
      <Text style={styles.section}>Schedule</Text>
      {games.map((g) => (
        <GameCard key={g.id} game={g} home={schools.get(g.homeSchoolId)} away={schools.get(g.awaySchoolId)} onPress={() => navigation.push('Game', { gameId: g.id })} />
      ))}
      <View style={styles.forumHead}>
        <Text style={styles.section}>Fan board</Text>
        <Pressable onPress={() => navigation.navigate('NewThread', { schoolId })}>
          <Text style={styles.link}>New post</Text>
        </Pressable>
      </View>
      {threads.length === 0 && <Text style={styles.muted}>No posts yet. Start one.</Text>}
      {threads.map((t) => (
        <Pressable key={t.id} style={styles.thread} onPress={() => navigation.navigate('Thread', { threadId: t.id, title: t.title })}>
          <Text style={styles.threadTitle}>{t.title}</Text>
          <Text style={styles.muted}>{t.authorName} · {t.replyCount} posts</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space(4) },
  banner: { borderRadius: 12, padding: space(4), marginTop: space(4), gap: space(1) },
  title: { fontSize: 22, fontWeight: '900' },
  sub: { fontSize: 13, opacity: 0.9 },
  record: { fontSize: 28, fontWeight: '800', marginTop: space(2) },
  section: { color: colors.muted, fontWeight: '700', textTransform: 'uppercase', fontSize: 12, marginVertical: space(3) },
  forumHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { color: colors.accent, fontWeight: '700' },
  thread: { backgroundColor: colors.card, borderRadius: 10, padding: space(3), marginBottom: space(2), gap: space(1) },
  threadTitle: { color: colors.text, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 12 },
});
