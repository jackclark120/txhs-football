// Run with: npm test  (uses Node's built-in test runner and type stripping)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeConsensus, validateReport, weightFor } from '../src/lib/consensus.ts';
import type { ScoreReport } from '../src/types.ts';

const now = new Date('2026-10-09T21:00:00Z');
const minsAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();
let n = 0;
const r = (reporterId: string, home: number, away: number, period: ScoreReport['period'], mins: number, weight = 1): ScoreReport => ({
  id: String(++n),
  gameId: 'g1',
  reporterId,
  homeScore: home,
  awayScore: away,
  period,
  createdAt: minsAgo(mins),
  weight,
});

test('no reports gives no score', () => {
  assert.equal(computeConsensus([], now), null);
});

test('one fan is unconfirmed, two agreeing fans confirm', () => {
  assert.equal(computeConsensus([r('a', 7, 0, 'Q1', 2)], now)?.confidence, 'unconfirmed');
  const c = computeConsensus([r('a', 7, 0, 'Q1', 2), r('b', 7, 0, 'Q1', 1)], now);
  assert.equal(c?.confidence, 'confirmed');
  assert.equal(c?.reporterCount, 2);
});

test('a person only counts once, using their latest report', () => {
  const c = computeConsensus([r('a', 7, 0, 'Q1', 5), r('a', 14, 0, 'Q2', 1)], now);
  assert.deepEqual([c?.homeScore, c?.awayScore, c?.confidence], [14, 0, 'unconfirmed']);
});

test('majority beats a lone troll', () => {
  const c = computeConsensus([r('a', 14, 7, 'Q2', 2), r('b', 14, 7, 'Q2', 2), r('troll', 0, 70, 'Q2', 1)], now);
  assert.deepEqual([c?.homeScore, c?.awayScore], [14, 7]);
});

test('a school official is official on their own', () => {
  const c = computeConsensus([r('coach', 21, 14, 'Q3', 1, weightFor('school_official', 0)), r('a', 21, 7, 'Q3', 1)], now);
  assert.equal(c?.confidence, 'official');
  assert.deepEqual([c?.homeScore, c?.awayScore], [21, 14]);
});

test('stale live reports drop out of the window', () => {
  assert.equal(computeConsensus([r('a', 7, 0, 'Q1', 30)], now), null);
});

test('final reports win over live ones and never expire', () => {
  const c = computeConsensus([r('a', 28, 21, 'FINAL', 120), r('b', 28, 21, 'FINAL', 90), r('c', 21, 21, 'Q4', 1)], now);
  assert.deepEqual([c?.homeScore, c?.awayScore, c?.period, c?.confidence], [28, 21, 'FINAL', 'confirmed']);
});

test('a big unconfirmed jump is held back', () => {
  assert.equal(computeConsensus([r('a', 56, 0, 'Q2', 1)], now, { homeScore: 7, awayScore: 0 }), null);
  const ok = computeConsensus([r('a', 14, 0, 'Q2', 1)], now, { homeScore: 7, awayScore: 0 });
  assert.equal(ok?.homeScore, 14);
});

test('a newer higher score shows as pending', () => {
  const c = computeConsensus([r('a', 7, 0, 'Q1', 5), r('b', 7, 0, 'Q1', 4), r('c', 14, 0, 'Q1', 1)], now);
  assert.deepEqual([c?.homeScore, c?.pending?.homeScore], [7, 14]);
});

test('validation rejects bad input and spam', () => {
  const base = { reporterId: 'a', period: 'Q1' as const, createdAt: now.toISOString() };
  assert.equal(validateReport({ ...base, homeScore: -1, awayScore: 0 }, []), 'negative');
  assert.equal(validateReport({ ...base, homeScore: 3.5, awayScore: 0 }, []), 'not_integer');
  assert.equal(validateReport({ ...base, homeScore: 200, awayScore: 0 }, []), 'too_high');
  assert.equal(validateReport({ ...base, homeScore: 7, awayScore: 0 }, [r('a', 0, 0, 'Q1', 0.1)]), 'too_soon');
  assert.equal(validateReport({ ...base, homeScore: 7, awayScore: 0 }, [r('a', 0, 0, 'Q1', 5)]), null);
});
