// Supabase Edge Function: POST { gameId, homeScore, awayScore, period }
// Validates a fan's score report, stores it, and rewrites the game's consensus score.
// Runs on Deno inside Supabase. The service role key is provided by Supabase at runtime.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { computeConsensus, validateReport, weightFor } from '../../../src/lib/consensus.ts';
import type { Period, ScoreReport } from '../../../src/types.ts';

const PERIODS: Period[] = ['Q1', 'Q2', 'HALF', 'Q3', 'Q4', 'OT', 'FINAL'];

Deno.serve(async (req) => {
  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
  const { data: auth } = await admin.auth.getUser(jwt);
  if (!auth?.user) return json({ error: 'sign_in_required' }, 401);

  const body = await req.json().catch(() => null);
  if (!body || typeof body.gameId !== 'string' || !PERIODS.includes(body.period)) {
    return json({ error: 'bad_request' }, 400);
  }

  const { data: profile } = await admin.from('profiles').select('*').eq('id', auth.user.id).single();
  if (!profile) return json({ error: 'profile_required' }, 403);
  if (profile.banned_until && Date.parse(profile.banned_until) > Date.now()) return json({ error: 'banned' }, 403);

  const { data: game } = await admin.from('games').select('*').eq('id', body.gameId).single();
  if (!game) return json({ error: 'no_such_game' }, 404);
  if (Date.now() < Date.parse(game.kickoff) - 30 * 60 * 1000) return json({ error: 'not_started' }, 409);

  const { data: rows } = await admin
    .from('score_reports')
    .select('*')
    .eq('game_id', game.id)
    .order('created_at', { ascending: false })
    .limit(500);
  const reports: ScoreReport[] = (rows ?? []).map(fromRow);

  // A school official only counts as official for their own school's games.
  const role =
    profile.role === 'school_official' &&
    profile.official_school_id !== game.home_school_id &&
    profile.official_school_id !== game.away_school_id
      ? 'trusted'
      : profile.role;

  const now = new Date();
  const report = {
    reporterId: profile.id,
    homeScore: body.homeScore,
    awayScore: body.awayScore,
    period: body.period as Period,
    createdAt: now.toISOString(),
  };
  const invalid = validateReport(report, reports.filter((r) => r.reporterId === profile.id));
  if (invalid) return json({ error: invalid }, 422);

  const weight = weightFor(role, profile.reputation);
  const { data: inserted, error } = await admin
    .from('score_reports')
    .insert({
      game_id: game.id,
      reporter_id: profile.id,
      home_score: report.homeScore,
      away_score: report.awayScore,
      period: report.period,
      weight,
    })
    .select()
    .single();
  if (error) return json({ error: 'save_failed' }, 500);

  const previous = game.home_score == null ? null : { homeScore: game.home_score, awayScore: game.away_score };
  const consensus = computeConsensus([fromRow(inserted), ...reports], now, previous);
  if (consensus) {
    await admin
      .from('games')
      .update({
        status: consensus.period === 'FINAL' ? 'final' : 'live',
        home_score: consensus.homeScore,
        away_score: consensus.awayScore,
        period: consensus.period,
        confidence: consensus.confidence,
        pending_home_score: consensus.pending?.homeScore ?? null,
        pending_away_score: consensus.pending?.awayScore ?? null,
        score_updated_at: now.toISOString(),
      })
      .eq('id', game.id);
  }
  return json({ ok: true, consensus });
});

function fromRow(r: any): ScoreReport {
  return {
    id: r.id,
    gameId: r.game_id,
    reporterId: r.reporter_id,
    homeScore: r.home_score,
    awayScore: r.away_score,
    period: r.period,
    createdAt: r.created_at,
    weight: Number(r.weight),
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
