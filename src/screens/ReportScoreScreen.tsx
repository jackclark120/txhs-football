import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Chips } from '../components/Chips';
import { getGame, reportScore } from '../data/api';
import { useSchools } from '../data/useSchools';
import type { ScreenProps } from '../navigation';
import { colors, space } from '../theme';
import type { Period, School } from '../types';

const PERIODS: Period[] = ['Q1', 'Q2', 'HALF', 'Q3', 'Q4', 'OT', 'FINAL'];
const PERIOD_LABEL: Record<Period, string> = { Q1: '1st', Q2: '2nd', HALF: 'Half', Q3: '3rd', Q4: '4th', OT: 'OT', FINAL: 'Final' };

const ERRORS: Record<string, string> = {
  too_soon: 'You just reported this game. Give it 30 seconds.',
  too_high: 'That score looks too high.',
  negative: 'Scores can’t be negative.',
  not_integer: 'Scores must be whole numbers.',
  sign_in_required: 'Sign in on the Account tab to report scores.',
  banned: 'Your account can’t report scores right now.',
  not_started: 'This game hasn’t started yet.',
};

export function ReportScoreScreen({ route, navigation }: ScreenProps<'ReportScore'>) {
  const { gameId } = route.params;
  const schools = useSchools();
  const [home, setHome] = useState(0);
  const [away, setAway] = useState(0);
  const [period, setPeriod] = useState<Period>('Q1');
  const [teams, setTeams] = useState<{ home?: School; away?: School }>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getGame(gameId).then((g) => {
      if (!g) return;
      setHome(g.homeScore ?? 0);
      setAway(g.awayScore ?? 0);
      if (g.period) setPeriod(g.period);
      setTeams({ home: schools.get(g.homeSchoolId), away: schools.get(g.awaySchoolId) });
    });
  }, [gameId, schools]);

  async function submit() {
    setBusy(true);
    const result = await reportScore(gameId, home, away, period);
    setBusy(false);
    if (result.ok) navigation.goBack();
    else Alert.alert('Not sent', ERRORS[result.error] ?? 'Something went wrong. Try again.');
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.help}>Report what the stadium scoreboard shows right now.</Text>
      <Stepper label={teams.away?.name ?? 'Away'} value={away} onChange={setAway} />
      <Stepper label={`${teams.home?.name ?? 'Home'} (home)`} value={home} onChange={setHome} />
      <Text style={styles.label}>Quarter</Text>
      <Chips options={PERIODS} value={period} onChange={setPeriod} label={(p) => PERIOD_LABEL[p]} />
      <Pressable style={[styles.button, busy && { opacity: 0.5 }]} disabled={busy} onPress={submit}>
        <Text style={styles.buttonText}>{period === 'FINAL' ? 'Report final score' : 'Report score'}</Text>
      </Pressable>
    </View>
  );
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <View style={styles.stepper}>
      <View style={styles.stepperTop}>
        <Text style={styles.team} numberOfLines={1}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
      <View style={styles.buttons}>
        {[-1, 1, 2, 3, 6, 7].map((d) => (
          <Pressable key={d} style={styles.small} onPress={() => onChange(Math.max(0, value + d))}>
            <Text style={styles.smallText}>{d > 0 ? `+${d}` : d}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: space(4), gap: space(3) },
  help: { color: colors.muted },
  label: { color: colors.muted, fontWeight: '700', marginTop: space(2) },
  stepper: { backgroundColor: colors.card, borderRadius: 12, padding: space(3), gap: space(2) },
  stepperTop: { flexDirection: 'row', alignItems: 'center' },
  team: { color: colors.text, fontSize: 16, fontWeight: '700', flex: 1 },
  value: { color: colors.text, fontSize: 36, fontWeight: '800', fontVariant: ['tabular-nums'] },
  buttons: { flexDirection: 'row', gap: space(2) },
  small: { flex: 1, backgroundColor: colors.cardAlt, borderRadius: 8, paddingVertical: space(2.5), alignItems: 'center' },
  smallText: { color: colors.text, fontWeight: '700' },
  button: { backgroundColor: colors.accent, borderRadius: 12, padding: space(4), alignItems: 'center', marginTop: space(4) },
  buttonText: { color: '#1B1300', fontWeight: '800', fontSize: 16 },
});
