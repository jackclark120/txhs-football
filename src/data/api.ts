// One data API for the screens. Uses Supabase when configured, otherwise in-memory demo data.
import { computeConsensus, validateReport, weightFor, type ValidationError } from '../lib/consensus.ts';
import { supabase } from '../lib/supabase.ts';
import type { Classification, Division, ForumPost, ForumThread, Game, Period, School, ScoreReport, StandingRow } from '../types.ts';
import { demoGames, demoPosts, demoSchools, demoThreads } from './demo.ts';

// ---- Mapping from database rows ---------------------------------------------------

const toGame = (r: any): Game => ({
  id: r.id,
  seasonYear: r.season_year,
  week: r.week,
  kickoff: r.kickoff,
  homeSchoolId: r.home_school_id,
  awaySchoolId: r.away_school_id,
  isDistrictGame: r.is_district_game,
  venue: r.venue,
  status: r.status,
  homeScore: r.home_score,
  awayScore: r.away_score,
  period: r.period,
  confidence: r.confidence,
  pending: r.pending_home_score == null ? null : { homeScore: r.pending_home_score, awayScore: r.pending_away_score },
  updatedAt: r.score_updated_at,
});

const toSchool = (r: any): School => {
  const ss = r.school_seasons?.[0] ?? {};
  return {
    id: r.id,
    name: r.name,
    mascot: r.mascot,
    city: r.city,
    colors: [r.colors?.[0] ?? '#333333', r.colors?.[1] ?? '#FFFFFF'],
    classification: ss.classification,
    division: ss.division ?? null,
    district: ss.district,
    region: ss.region,
    sixMan: ss.six_man ?? false,
  };
};

export const SEASON = 2026;

// ---- Demo state -------------------------------------------------------------------

const demo = {
  games: demoGames.map((g) => ({ ...g })),
  threads: demoThreads.map((t) => ({ ...t })),
  posts: demoPosts.map((p) => ({ ...p })),
  reports: [] as ScoreReport[],
  listeners: new Set<() => void>(),
};
const DEMO_USER = 'demo-user';
const notify = () => demo.listeners.forEach((l) => l());

function demoReport(gameId: string, reporterId: string, home: number, away: number, period: Period, minsAgo: number, weight = 1) {
  demo.reports.push({
    id: `r${demo.reports.length + 1}`, gameId, reporterId, homeScore: home, awayScore: away, period,
    createdAt: new Date(Date.now() - minsAgo * 60_000).toISOString(), weight,
  });
}
function recomputeDemo(gameId: string) {
  const game = demo.games.find((g) => g.id === gameId)!;
  const previous = game.homeScore == null ? null : { homeScore: game.homeScore, awayScore: game.awayScore! };
  const c = computeConsensus(demo.reports.filter((r) => r.gameId === gameId), new Date(), previous);
  if (!c) return;
  Object.assign(game, {
    homeScore: c.homeScore, awayScore: c.awayScore, period: c.period, confidence: c.confidence,
    pending: c.pending && { homeScore: c.pending.homeScore, awayScore: c.pending.awayScore },
    status: c.period === 'FINAL' ? 'final' : 'live', updatedAt: new Date().toISOString(),
  });
}
// Two live games: one confirmed by two fans, one with a single unconfirmed report.
demoReport('g6', 'fan-a', 14, 7, 'Q2', 3);
demoReport('g6', 'fan-b', 14, 7, 'Q2', 2);
demoReport('g7', 'fan-c', 3, 0, 'Q1', 1);
recomputeDemo('g6');
recomputeDemo('g7');

// ---- Public API -------------------------------------------------------------------

export async function listSchools(): Promise<School[]> {
  if (!supabase) return demoSchools;
  const { data, error } = await supabase
    .from('schools')
    .select('*, school_seasons!inner(*)')
    .eq('school_seasons.season_year', SEASON)
    .order('name');
  if (error) throw error;
  return data.map(toSchool);
}

export async function listGames(week?: number): Promise<Game[]> {
  // Copies, so React sees a new object after a demo score changes.
  if (!supabase) return demo.games.filter((g) => week == null || g.week === week).map((g) => ({ ...g }));
  let q = supabase.from('games').select('*').eq('season_year', SEASON).order('kickoff');
  if (week != null) q = q.eq('week', week);
  const { data, error } = await q;
  if (error) throw error;
  return data.map(toGame);
}

export async function currentWeek(): Promise<number> {
  const games = await listGames();
  const now = Date.now();
  const upcoming = games.find((g) => Date.parse(g.kickoff) > now - 12 * 3600_000);
  return upcoming?.week ?? games[games.length - 1]?.week ?? 1;
}

export async function getGame(id: string): Promise<Game | null> {
  if (!supabase) {
    const g = demo.games.find((x) => x.id === id);
    return g ? { ...g } : null;
  }
  const { data } = await supabase.from('games').select('*').eq('id', id).single();
  return data ? toGame(data) : null;
}

/** Calls back whenever any game changes. Returns an unsubscribe function. */
export function subscribeGames(onChange: () => void): () => void {
  if (!supabase) {
    demo.listeners.add(onChange);
    return () => demo.listeners.delete(onChange);
  }
  const client = supabase;
  const channel = client
    .channel('games')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, onChange)
    .subscribe();
  return () => {
    client.removeChannel(channel);
  };
}

export type ReportResult = { ok: true } | { ok: false; error: ValidationError | string };

export async function reportScore(gameId: string, homeScore: number, awayScore: number, period: Period): Promise<ReportResult> {
  if (!supabase) {
    const report = { reporterId: DEMO_USER, homeScore, awayScore, period, createdAt: new Date().toISOString() };
    const invalid = validateReport(report, demo.reports.filter((r) => r.reporterId === DEMO_USER && r.gameId === gameId));
    if (invalid) return { ok: false, error: invalid };
    demo.reports.push({ ...report, id: `r${demo.reports.length + 1}`, gameId, weight: weightFor('fan', 0) });
    recomputeDemo(gameId);
    notify();
    return { ok: true };
  }
  const { data, error } = await supabase.functions.invoke('report-score', { body: { gameId, homeScore, awayScore, period } });
  if (error) {
    const body = await (error as any).context?.json?.().catch(() => null);
    return { ok: false, error: body?.error ?? error.message };
  }
  return data?.ok ? { ok: true } : { ok: false, error: data?.error ?? 'unknown' };
}

// 2A-5A football (and 1A) split each conference into Division I and II, each with its own districts.
export async function getStandings(classification: Classification, division: Division | null, district: number): Promise<StandingRow[]> {
  if (!supabase) {
    const schools = demoSchools.filter((s) => s.classification === classification && s.division === division && s.district === district);
    return schools.map((s) => {
      const row: StandingRow = { schoolId: s.id, districtWins: 0, districtLosses: 0, overallWins: 0, overallLosses: 0, pointsFor: 0, pointsAgainst: 0 };
      for (const g of demo.games) {
        if (g.status !== 'final' || g.homeScore == null || g.awayScore == null) continue;
        const home = g.homeSchoolId === s.id;
        if (!home && g.awaySchoolId !== s.id) continue;
        const pf = home ? g.homeScore : g.awayScore;
        const pa = home ? g.awayScore : g.homeScore;
        row.pointsFor += pf;
        row.pointsAgainst += pa;
        if (pf > pa) row.overallWins++; else if (pf < pa) row.overallLosses++;
        if (g.isDistrictGame) { if (pf > pa) row.districtWins++; else if (pf < pa) row.districtLosses++; }
      }
      return row;
    }).sort(byStanding);
  }
  let q = supabase
    .from('standings')
    .select('*')
    .eq('season_year', SEASON)
    .eq('classification', classification)
    .eq('district', district);
  q = division ? q.eq('division', division) : q.is('division', null);
  const { data, error } = await q;
  if (error) throw error;
  return data
    .map((r: any): StandingRow => ({
      schoolId: r.school_id, districtWins: r.district_wins, districtLosses: r.district_losses,
      overallWins: r.overall_wins, overallLosses: r.overall_losses, pointsFor: r.points_for, pointsAgainst: r.points_against,
    }))
    .sort(byStanding);
}

const byStanding = (a: StandingRow, b: StandingRow) =>
  b.districtWins - b.districtLosses - (a.districtWins - a.districtLosses) ||
  b.overallWins - b.overallLosses - (a.overallWins - a.overallLosses) ||
  b.pointsFor - b.pointsAgainst - (a.pointsFor - a.pointsAgainst);

export async function listThreads(schoolId?: string): Promise<ForumThread[]> {
  if (!supabase) {
    return demo.threads.filter((t) => (schoolId ? t.scope.kind === 'school' && t.scope.schoolId === schoolId : true));
  }
  let q = supabase.from('forum_threads').select('*, profiles(display_name)').order('last_post_at', { ascending: false }).limit(50);
  if (schoolId) q = q.eq('school_id', schoolId);
  const { data, error } = await q;
  if (error) throw error;
  return data.map((r: any) => ({
    id: r.id,
    scope: r.school_id ? { kind: 'school', schoolId: r.school_id } : r.game_id ? { kind: 'game', gameId: r.game_id } : { kind: 'general' },
    title: r.title,
    authorName: r.profiles?.display_name ?? 'Fan',
    createdAt: r.created_at,
    replyCount: r.reply_count,
  }));
}

export async function listPosts(threadId: string): Promise<ForumPost[]> {
  if (!supabase) return demo.posts.filter((p) => p.threadId === threadId);
  const { data, error } = await supabase.from('forum_posts').select('*, profiles(display_name)').eq('thread_id', threadId).order('created_at');
  if (error) throw error;
  return data.map((r: any) => ({ id: r.id, threadId: r.thread_id, authorName: r.profiles?.display_name ?? 'Fan', body: r.body, createdAt: r.created_at }));
}

export async function createPost(threadId: string, body: string): Promise<void> {
  if (!supabase) {
    demo.posts.push({ id: `p${demo.posts.length + 1}`, threadId, authorName: 'You', body, createdAt: new Date().toISOString() });
    const t = demo.threads.find((x) => x.id === threadId);
    if (t) t.replyCount++;
    return;
  }
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Sign in to post.');
  const { error } = await supabase.from('forum_posts').insert({ thread_id: threadId, author_id: auth.user.id, body });
  if (error) throw error;
}

export async function createThread(title: string, body: string, schoolId?: string): Promise<string> {
  if (!supabase) {
    const id = `t${demo.threads.length + 1}`;
    demo.threads.unshift({
      id, title, authorName: 'You', createdAt: new Date().toISOString(), replyCount: 0,
      scope: schoolId ? { kind: 'school', schoolId } : { kind: 'general' },
    });
    await createPost(id, body);
    return id;
  }
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Sign in to post.');
  const { data, error } = await supabase
    .from('forum_threads')
    .insert({ title, author_id: auth.user.id, school_id: schoolId ?? null })
    .select('id')
    .single();
  if (error) throw error;
  await createPost(data.id, body);
  return data.id;
}
