/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Match, Prediction, UserProfile, Group, CompetitionStats } from '../types';

// ============================================================================
// FOOTBALL-DATA.ORG / API-FOOTBALL CONFIGURATION & INTEGRATION GUIDELINES
// ============================================================================
// To consume live results over the web from official streams:
//
// 1. Football-Data.org Client Example:
//    - Headers: { 'X-Auth-Token': 'YOUR_FOOTBALL_DATA_API_KEY' }
//    - Matches API Endpoint: 'https://api.football-data.org/v4/competitions/WC/matches'
//
// 2. API-Football (RapidAPI) Client Example:
//    - Headers: { 'x-rapidapi-key': 'YOUR_API_FOOTBALL_KEY', 'x-rapidapi-host': 'api-football-v1.p.rapidapi.com' }
//    - Live/Schedule Endpoint: 'https://api-football-v1.p.rapidapi.com/v3/fixtures?league=1&season=2026'
// ============================================================================

const FOOTBALL_DATA_API_KEY = ''; // Insert your token here
const API_FOOTBALL_KEY = '';      // Insert your RapidAPI key here

/**
 * Calculates score points based on prediction and final match scores:
 * - 5 points: Exact match score (e.g., predicted 2-1, final 2-1)
 * - 2 points: Correct outcome (home win, draw, or away win) but wrong scoreline
 * - 0 points: Incorrect outcome
 */
export function calculatePredictionPoints(
  prediction: Prediction,
  actualHome: number,
  actualAway: number
): number {
  const actualOutcome = Math.sign(actualHome - actualAway); // 1 = Home win, 0 = Draw, -1 = Away win

  if (prediction.predictionType === 'winner') {
    const predWinner = prediction.predictedWinner; // 'home' | 'away' | 'draw'
    const predOutcome = predWinner === 'home' ? 1 : predWinner === 'away' ? -1 : 0;
    return predOutcome === actualOutcome ? 2 : 0;
  }

  return calculateRawPoints(
    prediction.homeScore ?? 0,
    prediction.awayScore ?? 0,
    actualHome,
    actualAway
  );
}

/**
 * Same rules, applied to the raw column values as they are stored in the
 * database. A negative predicted pair encodes a winner-only pick:
 * (-1,-2) home, (-2,-1) away, anything else negative means draw.
 *
 * Used when scoring other players' predictions straight off their database
 * rows, without first rebuilding them into Prediction objects.
 */
export function calculateRawPoints(
  predHome: number,
  predAway: number,
  actualHome: number,
  actualAway: number
): number {
  const actualOutcome = Math.sign(actualHome - actualAway);

  if (predHome < 0 || predAway < 0) {
    let predOutcome = 0;
    if (predHome === -1 && predAway === -2) predOutcome = 1;
    else if (predHome === -2 && predAway === -1) predOutcome = -1;
    return predOutcome === actualOutcome ? 2 : 0;
  }

  // 1. Exact match score
  if (predHome === actualHome && predAway === actualAway) {
    return 5;
  }

  // 2. Calculated outcome
  if (Math.sign(predHome - predAway) === actualOutcome) {
    return 2;
  }

  return 0;
}

/**
 * Live Fetch Matches from Football-Data.org
 */
export async function fetchLiveMatchesFromExternalApi(): Promise<Partial<Match>[]> {
  if (FOOTBALL_DATA_API_KEY) {
    try {
      const response = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
        headers: { 'X-Auth-Token': FOOTBALL_DATA_API_KEY }
      });
      const data = await response.json();
      
      // Parse to standard format
      return (data.matches || []).map((m: any) => ({
        id: String(m.id),
        homeScore: m.score?.fullTime?.home ?? null,
        awayScore: m.score?.fullTime?.away ?? null,
        status: m.status === 'FINISHED' ? 'FINISHED' : (m.status === 'IN_PLAY' ? 'LIVE' : 'PENDING'),
      }));
    } catch (e) {
      console.error('Error fetching from Football-data.org:', e);
    }
  }

  if (API_FOOTBALL_KEY) {
    try {
      const response = await fetch('https://api-football-v1.p.rapidapi.com/v3/fixtures?league=1&season=2026', {
        headers: {
          'x-rapidapi-key': API_FOOTBALL_KEY,
          'x-rapidapi-host': 'api-football-v1.p.rapidapi.com'
        }
      });
      const data = await response.json();
      
      return (data.response || []).map((f: any) => ({
        id: String(f.fixture.id),
        homeScore: f.goals.home,
        awayScore: f.goals.away,
        status: f.fixture.status.short === 'FT' ? 'FINISHED' : (['1H', '2H', 'HT'].includes(f.fixture.status.short) ? 'LIVE' : 'PENDING'),
      }));
    } catch (e) {
      console.error('Error fetching from API-Football:', e);
    }
  }

  return [];
}

/**
 * Turn a raw points value into its scoring bucket.
 */
export function emptyCompetitionStats(): CompetitionStats {
  return { points: 0, exactScores: 0, correctOutcomes: 0, settled: 0 };
}

/**
 * Automate points calculation & apply updates directly into user profiles.
 * This runs when results are imported or simulated.
 *
 * Totals stay global (one shared leaderboard) while `competitionStats` keeps
 * the same record split per tournament, so a predictor can see where they are
 * actually scoring.
 */
export function processPredictionsWithResults(
  matches: Match[],
  predictions: { [matchId: string]: Prediction },
  user: UserProfile
): {
  updatedPredictions: { [matchId: string]: Prediction };
  updatedUser: UserProfile;
} {
  const updatedPredictions = { ...predictions };
  let pointsAdded = 0;
  let exactCount = 0;
  let outcomeCount = 0;
  const competitionStats: { [competition: string]: CompetitionStats } = {};

  // Let's reset before recalculating finished matches
  // So we calculate dynamically depending on what matches are completed in state
  matches.forEach((match) => {
    if (match.status === 'FINISHED' && match.homeScore !== null && match.awayScore !== null) {
      const pred = updatedPredictions[match.id];
      if (pred) {
        const points = calculatePredictionPoints(
          pred,
          match.homeScore,
          match.awayScore
        );

        updatedPredictions[match.id] = {
          ...pred,
          pointsEarned: points
        };

        pointsAdded += points;
        if (points === 5) {
          exactCount++;
        } else if (points === 2) {
          outcomeCount++;
        }

        const compId = match.competition;
        if (compId) {
          if (!competitionStats[compId]) competitionStats[compId] = emptyCompetitionStats();
          const slice = competitionStats[compId];
          slice.points += points;
          slice.settled += 1;
          if (points === 5) slice.exactScores += 1;
          else if (points === 2) slice.correctOutcomes += 1;
        }
      }
    }
  });

  // Base points starts at 0 + whatever matches got solved
  const updatedUser: UserProfile = {
    ...user,
    // Add dynamically
    totalPoints: pointsAdded,
    exactScoresCount: exactCount,
    correctOutcomesCount: outcomeCount,
    competitionStats,
  };

  return {
    updatedPredictions,
    updatedUser,
  };
}

/**
 * Dynamic standings generation based on match results
 */
export function recalculateGroupStandings(groups: Group[], matches: Match[]): Group[] {
  return groups.map((group) => {
    const standingsMap = new Map<string, typeof group.standings[0]>();
    
    // Initialize stats for each team
    group.teams.forEach((team) => {
      standingsMap.set(team.id, {
        teamId: team.id,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
        form: [],
      });
    });

    // Populate stats from finished LEAGUE-PHASE matches of this competition.
    // Knockout fixtures carry a `group` ('1/8', 'Final', ...) and must never
    // feed the league table.
    const groupCompetition = (group as any).competition;
    matches
      .filter((m) =>
        m.status === 'FINISHED' &&
        (groupCompetition
          ? m.competition === groupCompetition && !m.group
          : m.group === group.id)
      )
      .forEach((match) => {
        const homeStat = standingsMap.get(match.homeTeam.id);
        const awayStat = standingsMap.get(match.awayTeam.id);
        
        if (homeStat && awayStat && match.homeScore !== null && match.awayScore !== null) {
          homeStat.played++;
          awayStat.played++;
          
          homeStat.goalsFor += match.homeScore;
          homeStat.goalsAgainst += match.awayScore;
          awayStat.goalsFor += match.awayScore;
          awayStat.goalsAgainst += match.homeScore;

          homeStat.goalDifference = homeStat.goalsFor - homeStat.goalsAgainst;
          awayStat.goalDifference = awayStat.goalsFor - awayStat.goalsAgainst;

          if (match.homeScore > match.awayScore) {
            homeStat.won++;
            homeStat.points += 3;
            homeStat.form.push('W');
            
            awayStat.lost++;
            awayStat.form.push('L');
          } else if (match.homeScore < match.awayScore) {
            awayStat.won++;
            awayStat.points += 3;
            awayStat.form.push('W');
            
            homeStat.lost++;
            homeStat.form.push('L');
          } else {
            homeStat.drawn++;
            homeStat.points += 1;
            homeStat.form.push('D');
            
            awayStat.drawn++;
            awayStat.points += 1;
            awayStat.form.push('D');
          }
        }
      });

    // Sort standings based on FIFA tie-breakers: Points, GD, GF, then alphabetical
    const sortedStandings = Array.from(standingsMap.values()).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.teamId.localeCompare(b.teamId); // Deterministic alphabet tie-breaker for mockup
    });

    return {
      ...group,
      standings: sortedStandings
    };
  });
}
