// Shared domain types. These mirror the tables in supabase/migrations/0001_init.sql.

export type Classification = '1A' | '2A' | '3A' | '4A' | '5A' | '6A';
export type Division = 'I' | 'II';

export interface School {
  id: string;
  name: string; // "Katy"
  // UIL lists schools by name only; mascot and city are filled in later.
  mascot: string | null; // "Tigers"
  city: string | null;
  classification: Classification;
  division: Division | null; // 1A-5A football split into DI/DII; 6A also uses DI/DII in playoffs
  district: number; // UIL district number within classification
  region: number;
  sixMan: boolean; // most 1A programs play six-man
  colors: [string, string];
}

export type GameStatus = 'scheduled' | 'live' | 'final';
export type Period = 'Q1' | 'Q2' | 'HALF' | 'Q3' | 'Q4' | 'OT' | 'FINAL';

export interface Game {
  id: string;
  seasonYear: number;
  week: number;
  kickoff: string; // ISO timestamp
  homeSchoolId: string;
  awaySchoolId: string;
  isDistrictGame: boolean;
  venue: string | null;
  // Consensus fields: written only by the server from score_reports.
  status: GameStatus;
  homeScore: number | null;
  awayScore: number | null;
  period: Period | null;
  confidence: Confidence;
  // A newer score some fans report that is not confirmed yet.
  pending: { homeScore: number; awayScore: number } | null;
  updatedAt: string | null;
}

export type Confidence = 'none' | 'unconfirmed' | 'confirmed' | 'official';

export interface ScoreReport {
  id: string;
  gameId: string;
  reporterId: string;
  homeScore: number;
  awayScore: number;
  period: Period;
  createdAt: string; // ISO
  // Snapshot of the reporter's trust weight when they reported.
  weight: number;
}

export type ReporterRole = 'fan' | 'trusted' | 'school_official' | 'moderator';

export interface Profile {
  id: string;
  displayName: string;
  favoriteSchoolId: string | null;
  role: ReporterRole;
  reputation: number; // grows when reports match the final consensus
}

export interface StandingRow {
  schoolId: string;
  districtWins: number;
  districtLosses: number;
  overallWins: number;
  overallLosses: number;
  pointsFor: number;
  pointsAgainst: number;
}

export interface ForumThread {
  id: string;
  // A thread hangs off a school, a district, or a game.
  scope: { kind: 'school'; schoolId: string } | { kind: 'game'; gameId: string } | { kind: 'general' };
  title: string;
  authorName: string;
  createdAt: string;
  replyCount: number;
}

export interface ForumPost {
  id: string;
  threadId: string;
  authorName: string;
  body: string;
  createdAt: string;
}
