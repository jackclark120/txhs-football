import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, space } from '../theme';
import type { Game, School } from '../types';
import { ConfidenceBadge } from './ConfidenceBadge';

export function statusLine(game: Game): string {
  if (game.status === 'final') return 'Final';
  if (game.status === 'live') return game.period === 'HALF' ? 'Halftime' : game.period ?? 'Live';
  return new Date(game.kickoff).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

export function GameCard({ game, home, away, onPress }: { game: Game; home?: School; away?: School; onPress: () => void }) {
  const showScore = game.homeScore != null;
  const winner = game.status === 'final' && showScore ? (game.homeScore! > game.awayScore! ? 'home' : game.awayScore! > game.homeScore! ? 'away' : null) : null;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}>
      <View style={styles.header}>
        <Text style={[styles.status, game.status === 'live' && { color: colors.live }]}>
          {game.status === 'live' ? '● ' : ''}
          {statusLine(game)}
        </Text>
        <Text style={styles.meta}>
          {home?.classification}
          {game.isDistrictGame ? ` · District ${home?.district}` : ' · Non-district'}
        </Text>
      </View>
      <TeamRow school={away} score={showScore ? game.awayScore : null} bold={winner === 'away'} />
      <TeamRow school={home} score={showScore ? game.homeScore : null} bold={winner === 'home'} home />
      {game.status !== 'scheduled' && <ConfidenceBadge confidence={game.confidence} />}
    </Pressable>
  );
}

function TeamRow({ school, score, bold, home }: { school?: School; score: number | null; bold: boolean; home?: boolean }) {
  return (
    <View style={styles.row}>
      <View style={[styles.swatch, { backgroundColor: school?.colors[0] ?? colors.border }]} />
      <Text style={[styles.team, bold && styles.bold]} numberOfLines={1}>
        {school ? `${school.name} ${school.mascot}` : '…'}
        {home ? <Text style={styles.meta}>  (home)</Text> : null}
      </Text>
      <Text style={[styles.score, bold && styles.bold]}>{score ?? ''}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 12, padding: space(3), marginBottom: space(3), gap: space(2) },
  header: { flexDirection: 'row', justifyContent: 'space-between' },
  status: { color: colors.text, fontWeight: '700', fontSize: 13 },
  meta: { color: colors.muted, fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  swatch: { width: 10, height: 24, borderRadius: 3 },
  team: { color: colors.text, fontSize: 16, flex: 1 },
  score: { color: colors.text, fontSize: 20, fontVariant: ['tabular-nums'], minWidth: 32, textAlign: 'right' },
  bold: { fontWeight: '800' },
});
