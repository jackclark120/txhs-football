import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ConfidenceBadge } from '../components/ConfidenceBadge';
import { statusLine } from '../components/GameCard';
import { getGame, subscribeGames } from '../data/api';
import { useSchools } from '../data/useSchools';
import type { ScreenProps } from '../navigation';
import { colors, space } from '../theme';
import type { Game, School } from '../types';

export function GameScreen({ route, navigation }: ScreenProps<'Game'>) {
  const { gameId } = route.params;
  const schools = useSchools();
  const [game, setGame] = useState<Game | null>(null);

  const load = useCallback(() => getGame(gameId).then(setGame), [gameId]);
  useEffect(() => {
    load();
    return subscribeGames(load);
  }, [load]);

  if (!game) return <View style={styles.screen} />;
  const home = schools.get(game.homeSchoolId);
  const away = schools.get(game.awaySchoolId);
  const started = Date.now() > Date.parse(game.kickoff) - 30 * 60_000;

  return (
    <View style={styles.screen}>
      <Text style={[styles.status, game.status === 'live' && { color: colors.live }]}>{statusLine(game)}</Text>
      <View style={styles.scoreboard}>
        <Side school={away} score={game.awayScore} onPress={() => away && navigation.navigate('School', { schoolId: away.id })} />
        <Text style={styles.dash}>–</Text>
        <Side school={home} score={game.homeScore} onPress={() => home && navigation.navigate('School', { schoolId: home.id })} />
      </View>
      <ConfidenceBadge confidence={game.confidence} centered />
      {game.pending && (
        <Text style={styles.note}>
          A fan just reported {game.pending.awayScore}–{game.pending.homeScore}. It replaces this score once someone else confirms it.
        </Text>
      )}
      {game.confidence === 'unconfirmed' && (
        <Text style={styles.note}>Only one fan has reported this score so far. It firms up when another fan or the school agrees.</Text>
      )}
      {game.status !== 'final' && started && (
        <Pressable style={styles.button} onPress={() => navigation.navigate('ReportScore', { gameId })}>
          <Text style={styles.buttonText}>At the game? Report the score</Text>
        </Pressable>
      )}
      {!started && <Text style={styles.note}>Score reporting opens 30 minutes before kickoff.</Text>}
    </View>
  );
}

function Side({ school, score, onPress }: { school?: School; score: number | null; onPress: () => void }) {
  return (
    <Pressable style={styles.side} onPress={onPress}>
      <View style={[styles.logo, { backgroundColor: school?.colors[0] ?? colors.border, borderColor: school?.colors[1] ?? colors.border }]}>
        <Text style={[styles.logoText, { color: school?.colors[1] ?? colors.text }]}>{school?.name.slice(0, 2).toUpperCase()}</Text>
      </View>
      <Text style={styles.name} numberOfLines={2}>{school?.name}</Text>
      {school?.mascot ? <Text style={styles.mascot}>{school.mascot}</Text> : null}
      <Text style={styles.big}>{score ?? '–'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: space(4), gap: space(4) },
  status: { color: colors.text, textAlign: 'center', fontWeight: '700', fontSize: 16 },
  scoreboard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  side: { alignItems: 'center', width: 130, gap: space(1) },
  logo: { width: 64, height: 64, borderRadius: 32, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontWeight: '900', fontSize: 20 },
  name: { color: colors.text, fontWeight: '700', textAlign: 'center' },
  mascot: { color: colors.muted, fontSize: 12 },
  big: { color: colors.text, fontSize: 48, fontWeight: '800', fontVariant: ['tabular-nums'] },
  dash: { color: colors.muted, fontSize: 32 },
  note: { color: colors.muted, textAlign: 'center', fontSize: 13 },
  button: { backgroundColor: colors.accent, borderRadius: 12, padding: space(4), alignItems: 'center' },
  buttonText: { color: '#1B1300', fontWeight: '800', fontSize: 16 },
});
