// Turns many fan score reports into one displayed score.
//
// Pure TypeScript with only type imports so the app (demo mode), the unit tests and the
// Supabase Edge Function that writes the real consensus can all share it.

import type { Confidence, Period, ReporterRole, ScoreReport } from '../types.ts';

export const RULES = {
  // Only reports this recent count toward a live score.
  liveWindowMs: 15 * 60 * 1000,
  // Combined weight needed before a score shows as confirmed.
  confirmWeight: 2,
  // A single report that jumps the total by more than this is held for confirmation.
  maxJump: 21,
  maxScore: 120,
  // One report per person per game per this many ms (also enforced in the database).
  minReportGapMs: 30 * 1000,
} as const;

export function weightFor(role: ReporterRole, reputation: number): number {
  switch (role) {
    case 'school_official':
      return 5;
    case 'moderator':
    case 'trusted':
      return 2;
    default:
      // Fans with a track record of accurate reports count a bit more, capped below "trusted".
      return 1 + Math.min(Math.max(reputation, 0) / 100, 0.5);
  }
}

const PERIOD_ORDER: Period[] = ['Q1', 'Q2', 'HALF', 'Q3', 'Q4', 'OT', 'FINAL'];
export const periodRank = (p: Period) => PERIOD_ORDER.indexOf(p);

export interface Consensus {
  homeScore: number;
  awayScore: number;
  period: Period;
  confidence: Confidence;
  weight: number;
  reporterCount: number;
  // A newer score that some people report but that is not yet confirmed.
  pending: { homeScore: number; awayScore: number; weight: number } | null;
}

export type ValidationError = 'not_integer' | 'negative' | 'too_high' | 'too_soon' | 'period_backwards';

export function validateReport(
  report: Pick<ScoreReport, 'homeScore' | 'awayScore' | 'period' | 'createdAt' | 'reporterId'>,
  previousByReporter: ScoreReport[],
): ValidationError | null {
  const { homeScore, awayScore } = report;
  if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore)) return 'not_integer';
  if (homeScore < 0 || awayScore < 0) return 'negative';
  if (homeScore > RULES.maxScore || awayScore > RULES.maxScore) return 'too_high';
  const last = latest(previousByReporter);
  if (last) {
    const gap = Date.parse(report.createdAt) - Date.parse(last.createdAt);
    if (gap < RULES.minReportGapMs) return 'too_soon';
  }
  return null;
}

function latest(reports: ScoreReport[]): ScoreReport | undefined {
  let best: ScoreReport | undefined;
  for (const r of reports) if (!best || Date.parse(r.createdAt) > Date.parse(best.createdAt)) best = r;
  return best;
}

export function computeConsensus(
  reports: ScoreReport[],
  now: Date,
  previous: Pick<Consensus, 'homeScore' | 'awayScore'> | null = null,
): Consensus | null {
  const anyFinal = reports.some((r) => r.period === 'FINAL');
  // Once someone reports a final, final reports are judged on their own regardless of age.
  const eligible = anyFinal
    ? reports.filter((r) => r.period === 'FINAL')
    : reports.filter((r) => now.getTime() - Date.parse(r.createdAt) <= RULES.liveWindowMs);

  // Each person counts once: their most recent report.
  const byReporter = new Map<string, ScoreReport>();
  for (const r of eligible) {
    const cur = byReporter.get(r.reporterId);
    if (!cur || Date.parse(r.createdAt) > Date.parse(cur.createdAt)) byReporter.set(r.reporterId, r);
  }
  if (byReporter.size === 0) return null;

  interface Group {
    homeScore: number;
    awayScore: number;
    weight: number;
    reports: ScoreReport[];
    newest: number;
  }
  const groups = new Map<string, Group>();
  for (const r of byReporter.values()) {
    const key = `${r.homeScore}-${r.awayScore}`;
    const g = groups.get(key) ?? { homeScore: r.homeScore, awayScore: r.awayScore, weight: 0, reports: [], newest: 0 };
    g.weight += r.weight;
    g.reports.push(r);
    g.newest = Math.max(g.newest, Date.parse(r.createdAt));
    groups.set(key, g);
  }

  // A big jump from the last shown score needs more than one ordinary fan behind it.
  const plausible = (g: Group) =>
    !previous ||
    g.homeScore + g.awayScore - (previous.homeScore + previous.awayScore) <= RULES.maxJump ||
    g.weight >= RULES.confirmWeight;

  const ranked = [...groups.values()].sort(
    (a, b) =>
      Number(plausible(b)) - Number(plausible(a)) ||
      b.weight - a.weight ||
      b.homeScore + b.awayScore - (a.homeScore + a.awayScore) ||
      b.newest - a.newest,
  );
  const top = ranked[0];
  // Every candidate is a suspicious jump with a single fan behind it: keep showing the old score.
  if (!plausible(top)) return null;

  // Most-weighted period within the winning score, ties go to the later period.
  const periodWeight = new Map<Period, number>();
  for (const r of top.reports) periodWeight.set(r.period, (periodWeight.get(r.period) ?? 0) + r.weight);
  const period = [...periodWeight.entries()].sort((a, b) => b[1] - a[1] || periodRank(b[0]) - periodRank(a[0]))[0][0];

  const hasOfficial = top.reports.some((r) => r.weight >= weightFor('school_official', 0));
  const confidence: Confidence = hasOfficial ? 'official' : top.weight >= RULES.confirmWeight ? 'confirmed' : 'unconfirmed';

  // Surface a newer, higher score that is still waiting for a second reporter.
  const newer = ranked.find(
    (g) => g !== top && g.newest > top.newest && g.homeScore + g.awayScore > top.homeScore + top.awayScore,
  );

  return {
    homeScore: top.homeScore,
    awayScore: top.awayScore,
    period,
    confidence,
    weight: top.weight,
    reporterCount: top.reports.length,
    pending: newer ? { homeScore: newer.homeScore, awayScore: newer.awayScore, weight: newer.weight } : null,
  };
}
