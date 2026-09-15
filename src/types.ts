/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type CompetitionId = 'UCL' | 'UEL' | 'UECL';

export interface Team {
  id: string; // namespaced per competition, e.g. "UCL:ARS"
  name: string;
  flag: string;
  code: string; // ISO or 3-letter abbreviation
  competition?: CompetitionId;
}

/** Per-tournament slice of a predictor's record. */
export interface CompetitionStats {
  points: number;
  exactScores: number;
  correctOutcomes: number;
  settled: number; // predictions on matches that already finished
}

export interface GroupTeamStats {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: ('W' | 'D' | 'L')[];
}

export interface Group {
  id: string; // 'A' | 'B' | ... | 'L'
  name: string; // 'Group A', 'Group B', ...
  color: string; // Color code for FIFA styling
  borderColor: string; // Tailwind class
  glowColor: string; // Glow styling
  teams: Team[];
  standings: GroupTeamStats[]; // Array of stats, sorted by position
}

export interface Match {
  id: string;
  competition: CompetitionId;
  matchday: number; // league-phase round, 1..8 (1..6 in the Conference League)
  group?: string; // legacy playoff bucket: '1/8', 'Final', ...
  date: string; // ISO date or localized string
  time: string; // e.g. "22:00"
  match_date?: string;
  stage: string; // e.g. "First Stage"
  homeTeam: Team;
  awayTeam: Team;
  homeScore?: number | null; // actual result
  awayScore?: number | null; // actual result
  stadium: string;
  city: string;
  status: 'PENDING' | 'LIVE' | 'FINISHED';
}

export interface Prediction {
  id: string;
  matchId: string;
  userId: string;
  homeScore?: number | null;
  awayScore?: number | null;
  predictionType?: 'score' | 'winner';
  predictedWinner?: 'home' | 'away' | 'draw';
  advance_team?: 'home' | 'away' | null;
  createdAt: string;
  pointsEarned?: number | null; // null if match is not finished
}

export interface UserProfile {
  id: string;
  username: string;
  totalPoints: number;
  exactScoresCount: number;
  correctOutcomesCount: number;
  rank?: number;
  isCurrentUser?: boolean;
  /** Breakdown of the same record split by tournament. */
  competitionStats?: { [competition: string]: CompetitionStats };
}
