// Made-up schools and games so the app runs with no backend. Not real UIL data.
import type { ForumPost, ForumThread, Game, School } from '../types.ts';

const s = (
  id: string, name: string, mascot: string, city: string,
  classification: School['classification'], division: School['division'], district: number,
  colors: [string, string], sixMan = false,
): School => ({ id, name, mascot, city, classification, division, district, region: 2, sixMan, colors });

export const demoSchools: School[] = [
  s('s1', 'Pecan Creek', 'Panthers', 'Pecan Creek', '6A', null, 8, ['#5B1A2E', '#E8B84A']),
  s('s2', 'Lone Oak North', 'Mustangs', 'Lone Oak', '6A', null, 8, ['#0B3D91', '#FFFFFF']),
  s('s3', 'Brazos Ridge', 'Rattlers', 'Brazos Ridge', '6A', null, 8, ['#1E5B2E', '#C9C9C9']),
  s('s4', 'Caddo Lake', 'Bulldogs', 'Caddo', '6A', null, 8, ['#000000', '#D4AF37']),
  s('s5', 'Mesquite Flats', 'Longhorns', 'Mesquite Flats', '4A', 'II', 11, ['#BF5700', '#FFFFFF']),
  s('s6', 'Sabine Valley', 'Eagles', 'Sabine', '4A', 'II', 11, ['#4B2E83', '#FFD100']),
  s('s7', 'Llano Bend', 'Hornets', 'Llano Bend', '4A', 'II', 11, ['#C8102E', '#000000']),
  s('s8', 'Comanche Springs', 'Wildcats', 'Comanche', '4A', 'II', 11, ['#006747', '#FFFFFF']),
  s('s9', 'Prairie Hill', 'Owls', 'Prairie Hill', '1A', 'I', 5, ['#003366', '#C0C0C0'], true),
  s('s10', 'Red Mesa', 'Coyotes', 'Red Mesa', '1A', 'I', 5, ['#8B0000', '#FFFFFF'], true),
];

// Week 6 is "tonight"; earlier weeks are finals so standings have something to show.
function kickoff(daysFromToday: number, hour = 19) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

let gid = 0;
const g = (week: number, day: number, home: string, away: string, district: boolean, score?: [number, number]): Game => ({
  id: `g${++gid}`,
  seasonYear: 2026,
  week,
  kickoff: kickoff(day),
  homeSchoolId: home,
  awaySchoolId: away,
  isDistrictGame: district,
  venue: null,
  status: score ? 'final' : 'scheduled',
  homeScore: score?.[0] ?? null,
  awayScore: score?.[1] ?? null,
  period: score ? 'FINAL' : null,
  confidence: score ? 'confirmed' : 'none',
  pending: null,
  updatedAt: null,
});

export const demoGames: Game[] = [
  g(5, -7, 's1', 's2', true, [35, 28]),
  g(5, -7, 's3', 's4', true, [14, 17]),
  g(5, -7, 's5', 's6', true, [42, 7]),
  g(5, -7, 's7', 's8', true, [21, 24]),
  g(5, -8, 's9', 's10', true, [58, 52]),
  g(6, 0, 's1', 's3', true),
  g(6, 0, 's4', 's2', true),
  g(6, 0, 's6', 's7', true),
  g(6, 0, 's8', 's5', true),
  g(6, 0, 's10', 's9', false),
];
// Kick the first two "tonight" games off already so there is something live.
for (const game of demoGames.filter((x) => x.week === 6).slice(0, 2)) {
  game.kickoff = kickoff(0, new Date().getHours() - 1);
}

export const demoThreads: ForumThread[] = [
  { id: 't1', scope: { kind: 'general' }, title: 'Who wins 6A DI state this year?', authorName: 'FridayNightFan', createdAt: kickoff(-2), replyCount: 2 },
  { id: 't2', scope: { kind: 'school', schoolId: 's1' }, title: 'Panthers O-line looking legit', authorName: 'PantherDad', createdAt: kickoff(-1), replyCount: 1 },
];

export const demoPosts: ForumPost[] = [
  { id: 'p1', threadId: 't1', authorName: 'FridayNightFan', body: 'Pecan Creek has the defense for a deep run.', createdAt: kickoff(-2) },
  { id: 'p2', threadId: 't1', authorName: 'BrazosBand', body: 'Not after what the Rattlers did in week 4.', createdAt: kickoff(-2) },
  { id: 'p3', threadId: 't2', authorName: 'PantherDad', body: 'Haven\'t given up a sack in three games.', createdAt: kickoff(-1) },
];
