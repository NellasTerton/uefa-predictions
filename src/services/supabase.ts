/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';
import { Prediction, UserProfile, CompetitionStats } from '../types';
import { calculateRawPoints } from './footballApi';
import { MOCK_LEADERBOARD } from '../data.ts';

// ============================================================================
// SUPABASE CLIENT INITIALIZATION WITH RECOVERY & ZERO-CRASH SAFETY
// ============================================================================

export let isSupabaseConfigured = false;
export let configErrorMessage = '';

const rawUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const rawKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

let supabaseUrl = rawUrl.trim() || 'https://ezbdvtzxlgnrciniovzl.supabase.co';
let supabaseAnonKey = rawKey.trim();

// Detect placeholders and unconfigured keys
if (!supabaseAnonKey || supabaseAnonKey === 'ВСТАВЬТЕ_ВАШ_КЛЮЧ_СЮДА' || supabaseAnonKey.includes('ВАШ_КЛЮЧ')) {
  isSupabaseConfigured = false;
  configErrorMessage = 'VITE_SUPABASE_ANON_KEY is not configured or is a placeholder in settings.';
  // A standard, structurally valid JWT format to prevent libraries from throwing sync parsing errors
  supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjAwMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwMCIsInVzZXJuYW1lIjoiZHVtbXkifQ.signature';
} else {
  isSupabaseConfigured = true;
}

export let supabase: any;

try {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} catch (error: any) {
  isSupabaseConfigured = false;
  configErrorMessage = error?.message || 'Failed to instantiate Supabase client.';
  
  // Ultimate zero-crash default object
  supabase = {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      signInWithPassword: async () => ({ data: { user: null }, error: new Error('Supabase is not configured yet') }),
      signUp: async () => ({ data: { user: null }, error: new Error('Supabase is not configured yet') }),
      signOut: async () => {},
      updateUser: async () => ({ data: { user: null }, error: new Error('Supabase is not configured yet') }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: new Error('Supabase is not configured yet') }),
          order: () => ({
            order: () => ({
              limit: async () => ({ data: [], error: new Error('Supabase is not configured yet') })
            })
          })
        })
      }),
      insert: async () => ({ error: new Error('Supabase is not configured yet') }),
      update: () => ({
        eq: async () => ({ error: new Error('Supabase is not configured yet') })
      }),
      upsert: () => ({
        select: () => ({
          single: async () => ({ data: null, error: new Error('Supabase is not configured yet') })
        })
      })
    })
  };
}

function transliterate(text: string): string {
  const rus = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y',
    'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f',
    'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo', 'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y',
    'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F',
    'Х': 'Kh', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sch', 'Ъ': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya'
  };
  return text.split('').map(char => rus[char as keyof typeof rus] !== undefined ? rus[char as keyof typeof rus] : char).join('');
}

function getLatinEmail(username: string): string {
  const latin = transliterate(username.trim().toLowerCase())
    .replace(/[^a-z0-9]/g, ''); // keep only numbers/chars
  return `${latin || 'user'}@app.local`;
}

/**
 * Register a user profile with PIN validation
 */
export async function registerWithPin(username: string, pin: string): Promise<UserProfile> {
  const name = username.trim();
  const cleanPin = pin.trim();

  if (name.length < 2) {
    throw new Error('Имя должно быть не менее 2 символов / Name must be at least 2 characters');
  }

  if (cleanPin.length !== 6) {
    throw new Error('ПИН-код должен быть ровно 6 символов / PIN must be exactly 6 characters');
  }

  // 1. Check if name already taken in Profiles database table
  const { data: existingProf } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', name)
    .maybeSingle();

  if (existingProf) {
    throw new Error('Имя уже занято! Придумайте другое.');
  }

  const fakeEmail = getLatinEmail(name);
  const password = `${cleanPin}_WC2026`;

  // 2. Perform Supabase Auth SignUp
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: fakeEmail,
    password: password,
    options: {
      data: {
        username: name,
      },
    },
  });

  if (signUpError) {
    if (signUpError.message.toLowerCase().includes('already registered') || signUpError.message.toLowerCase().includes('already exists')) {
      throw new Error('Имя уже занято! Придумайте другое.');
    }
    throw new Error(signUpError.message);
  }

  const authUser = signUpData?.user;
  if (!authUser) {
    throw new Error('Registration failed');
  }

  // 3. Ensure profile row is inserted inside profiles table
  const { error: insertError } = await supabase
    .from('profiles')
    .insert({
      id: authUser.id,
      username: name,
      total_points: 0,
      exact_guesses: 0,
    });

  if (insertError) {
    console.warn('Profiles table insert warning:', insertError.message);
  }

  return {
    id: authUser.id,
    username: name,
    totalPoints: 0,
    exactScoresCount: 0,
    correctOutcomesCount: 0,
    isCurrentUser: true,
  };
}

/**
 * Secure authorization with PIN code and auto Latin email mapping
 */
export async function loginWithPin(username: string, pin: string): Promise<UserProfile> {
  const name = username.trim();
  const cleanPin = pin.trim();

  if (!name || !cleanPin) {
    throw new Error('Необходимо ввести Имя и ПИН-код');
  }

  const fakeEmail = getLatinEmail(name);
  const password = `${cleanPin}_WC2026`;

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: fakeEmail,
    password: password,
  });

  if (signInError || !signInData?.user) {
    throw new Error('Неверное Имя или ПИН');
  }

  const authUser = signInData.user;

  // Retrieve existing metrics from DB profiles table
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();

  if (error || !profile) {
    // Fallsafe profile insertion if it is somehow missing
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: authUser.id,
        username: name,
        total_points: 0,
        exact_guesses: 0,
      });

    if (insertError) {
      console.warn('Failsafe profiles insert failed:', insertError.message);
    }

    return {
      id: authUser.id,
      username: name,
      totalPoints: 0,
      exactScoresCount: 0,
      correctOutcomesCount: 0,
      isCurrentUser: true,
    };
  }

  return {
    id: profile.id,
    username: profile.username || name,
    totalPoints: profile.total_points ?? 0,
    exactScoresCount: profile.exact_guesses ?? 0,
    correctOutcomesCount: 0,
    isCurrentUser: true,
  };
}

/**
 * Deprecated loginWithUsername for backwards-compatibility or migration
 */
export async function loginWithUsername(username: string): Promise<UserProfile> {
  return loginWithPin(username, "1111");
}

/**
 * Current User Authentication & Creation lookup
 */
export async function getCurrentUser(): Promise<UserProfile | null> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return null;
    }
    
    // Auto-seed matches in background
    seedMatchesIfEmpty().catch(err => console.warn('Background seed matches warning:', err));

    // Attempt to load profile attributes from public.profiles
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
      
    if (error || !profile) {
      const userDisplayName = user.user_metadata?.username || 'Player';
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          username: userDisplayName,
          total_points: 0,
          exact_guesses: 0,
        });

      if (insertError) {
        console.warn('Auto-creating profile row during getCurrentUser warning:', insertError.message);
      }

      return {
        id: user.id,
        username: userDisplayName,
        totalPoints: 0,
        exactScoresCount: 0,
        correctOutcomesCount: 0,
        isCurrentUser: true,
      };
    }
    
    return {
      id: profile.id,
      username: profile.username,
      totalPoints: profile.total_points ?? 0,
      exactScoresCount: profile.exact_guesses ?? 0,
      correctOutcomesCount: 0,
      isCurrentUser: true,
    };
  } catch (err) {
    console.error('Failed to resolve current logged in user state:', err);
    return null;
  }
}

/**
 * Update Current User Profile Username
 */
export async function updateUsername(newUsername: string): Promise<UserProfile> {
  const cleanUsername = newUsername.trim() || 'Player';
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: profileRow } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
  let error;
  if (!profileRow) {
    const res = await supabase.from('profiles').insert({ id: user.id, username: cleanUsername, total_points: 0, exact_guesses: 0 });
    error = res.error;
  } else {
    const res = await supabase.from('profiles').update({ username: cleanUsername }).eq('id', user.id);
    error = res.error;
  }

  if (error) throw error;

  // Also sync user metadata
  await supabase.auth.updateUser({
    data: { username: cleanUsername },
  });

  return {
    id: user.id,
    username: cleanUsername,
    totalPoints: 0,
    exactScoresCount: 0,
    correctOutcomesCount: 0,
    isCurrentUser: true
  };
}

/**
 * Update current user's points and guesses in profiles table
 * maps exactScoresCount to exact_guesses
 */
export async function updateUserProfileStats(totalPoints: number, exactGuesses: number): Promise<void> {
  try {
    if (!isSupabaseConfigured) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({
        total_points: totalPoints,
        exact_guesses: exactGuesses
      })
      .eq('id', user.id);

    if (error) {
      console.warn('Could not update profile points in DB:', error.message);
    }
  } catch (err) {
    console.error('Failed to update profile stats in db:', err);
  }
}

/**
 * Handle direct sign out
 */
export async function logoutUser(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Permanently deletes the signed-in player's account: the login itself, their
 * profile and every forecast they made.
 *
 * The work happens in the delete-account Edge Function, which needs the service
 * role to remove an auth user — the browser never holds that key. The function
 * derives the account from the caller's own token, so this can only ever delete
 * the person asking.
 *
 * Irreversible. Callers must confirm with the user first.
 */
export async function deleteOwnAccount(): Promise<{ deletedPredictions: number }> {
  if (!isSupabaseConfigured) {
    throw new Error(configErrorMessage || 'Supabase is not configured');
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase.functions.invoke('delete-account', {
    method: 'POST',
  });

  if (error) {
    throw new Error(error.message || 'Failed to delete account');
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Failed to delete account');
  }

  // Drop the local session and any cached state belonging to that player.
  await supabase.auth.signOut().catch(() => {});
  localStorage.removeItem('fifa_user_profile');
  localStorage.removeItem('fifa_predictions');

  return { deletedPredictions: data.deletedPredictions ?? 0 };
}

/**
 * Save prediction for a match
 * Column mapping:
 * - user_id (UUID references profiles.id)
 * - match_id (INT references matches.id)
 * - predicted_home (INT)
 * - predicted_away (INT)
 * - points_earned (INT)
 */
export async function savePrediction(
  matchId: string, 
  homeScore: number | null, 
  awayScore: number | null,
  predictionType: 'score' | 'winner' = 'score',
  predictedWinner?: 'home' | 'away' | 'draw',
  advanceTeam?: 'home' | 'away' | null
): Promise<Prediction> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const numericMatchId = parseInt(matchId.replace(/\D/g, ''), 10) || 1;
  let pHome = homeScore !== null ? homeScore : 0;
  let pAway = awayScore !== null ? awayScore : 0;

  if (predictionType === 'winner') {
    if (predictedWinner === 'home') {
      pHome = -1;
      pAway = -2;
    } else if (predictedWinner === 'away') {
      pHome = -2;
      pAway = -1;
    } else {
      pHome = -1;
      pAway = -1;
    }
  }

  // Try to seed matches first just in case
  await seedMatchesIfEmpty().catch(() => {});

  // Double-check profile presence before saving the prediction to never fail foreign key constraint
  const { data: profileRow, error: profileErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (profileErr || !profileRow) {
    const { error: insertErr } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        username: user.username,
        total_points: user.totalPoints,
        exact_guesses: user.exactScoresCount
      });
    if (insertErr) {
      console.warn('Fallback profile insert failed:', insertErr.message);
    }
  }

  // Real write to predictions table matching exact db schema columns
  const { data, error } = await supabase
    .from('predictions')
    .upsert({
      user_id: user.id,
      match_id: numericMatchId,
      predicted_home: pHome,
      predicted_away: pAway,
      points_earned: 0,
      advance_team: advanceTeam ?? null
    }, { onConflict: 'user_id,match_id' })
    .select()
    .single();

  if (error) {
    console.error("Supabase upsert error matching columns:", error.message);
    throw new Error(`Failed to save prediction: ${error.message}`);
  }

  let parsedType: 'score' | 'winner' = 'score';
  let parsedWinner: 'home' | 'away' | 'draw' | undefined = undefined;
  let resHome: number | null = data.predicted_home;
  let resAway: number | null = data.predicted_away;

  if (data.predicted_home < 0 || data.predicted_away < 0) {
    parsedType = 'winner';
    resHome = null;
    resAway = null;
    if (data.predicted_home === -1 && data.predicted_away === -2) {
      parsedWinner = 'home';
    } else if (data.predicted_home === -2 && data.predicted_away === -1) {
      parsedWinner = 'away';
    } else {
      parsedWinner = 'draw';
    }
  }

  const res: Prediction = {
    id: data.id,
    matchId: String(data.match_id),
    userId: data.user_id,
    homeScore: resHome,
    awayScore: resAway,
    predictionType: parsedType,
    predictedWinner: parsedWinner,
    advance_team: data.advance_team,
    createdAt: new Date().toISOString(),
    pointsEarned: data.points_earned
  };

  // dispatch notification for react rerender trigger
  window.dispatchEvent(new Event('predictions_updated'));

  return res;
}

/**
 * Fetch all predictions of the authenticated user
 */
export async function fetchUserPredictions(): Promise<{ [matchId: string]: Prediction }> {
  try {
    const user = await getCurrentUser();
    if (!user) return {};

    const { data, error } = await supabase
      .from('predictions')
      .select('*')
      .eq('user_id', user.id);

    if (error) throw error;
    
    const cache: { [matchId: string]: Prediction } = {};
    data.forEach(p => {
      const matchIdStr = String(p.match_id);
      let parsedType: 'score' | 'winner' = 'score';
      let parsedWinner: 'home' | 'away' | 'draw' | undefined = undefined;
      let resHome: number | null = p.predicted_home;
      let resAway: number | null = p.predicted_away;

      if (p.predicted_home < 0 || p.predicted_away < 0) {
         parsedType = 'winner';
         resHome = null;
         resAway = null;
         if (p.predicted_home === -1 && p.predicted_away === -2) {
           parsedWinner = 'home';
         } else if (p.predicted_home === -2 && p.predicted_away === -1) {
           parsedWinner = 'away';
         } else {
           parsedWinner = 'draw';
         }
      }

      cache[matchIdStr] = {
        id: p.id,
        matchId: matchIdStr,
        userId: p.user_id,
        homeScore: resHome,
        awayScore: resAway,
        predictionType: parsedType,
        predictedWinner: parsedWinner,
        advance_team: p.advance_team,
        createdAt: new Date().toISOString(),
        pointsEarned: p.points_earned
      };
    });
    return cache;
  } catch (err) {
    console.error('Error fetching real Predictions from database:', err);
    return {};
  }
}

/**
 * Fetch all predictions of a specific user ID
 */
export async function fetchUserPredictionsById(userId: string): Promise<{ [matchId: string]: Prediction }> {
  try {
    if (!isSupabaseConfigured) return {};

    const { data, error } = await supabase
      .from('predictions')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    
    const cache: { [matchId: string]: Prediction } = {};
    data.forEach((p: any) => {
      const matchIdStr = String(p.match_id);
      let parsedType: 'score' | 'winner' = 'score';
      let parsedWinner: 'home' | 'away' | 'draw' | undefined = undefined;
      let resHome: number | null = p.predicted_home;
      let resAway: number | null = p.predicted_away;

      if (p.predicted_home < 0 || p.predicted_away < 0) {
        parsedType = 'winner';
        resHome = null;
        resAway = null;
        if (p.predicted_home === -1 && p.predicted_away === -2) {
          parsedWinner = 'home';
        } else if (p.predicted_home === -2 && p.predicted_away === -1) {
          parsedWinner = 'away';
        } else {
          parsedWinner = 'draw';
        }
      }

      cache[matchIdStr] = {
        id: p.id,
        matchId: matchIdStr,
        userId: p.user_id,
        homeScore: resHome,
        awayScore: resAway,
        predictionType: parsedType,
        predictedWinner: parsedWinner,
        advance_team: p.advance_team,
        createdAt: new Date().toISOString(),
        pointsEarned: p.points_earned
      };
    });
    return cache;
  } catch (err) {
    console.error('Error fetching real Predictions for user id:', userId, err);
    return {};
  }
}

/**
 * Aggregates every stored prediction into a per-user, per-tournament breakdown.
 *
 * One query for the whole board: the shared leaderboard stays ranked on the
 * global total from `profiles`, and this supplies the "where did I score"
 * split that sits underneath it.
 *
 * Points are recomputed here from each player's raw forecast against the
 * result the client already holds, rather than trusting `points_earned`. That
 * column is filled by the uefa-sync cron job, so reading it would leave the
 * split blank in the window between a match ending and the next sync run.
 */
export async function fetchAllPredictionStats(
  matches: any[]
): Promise<{ [userId: string]: { [competition: string]: CompetitionStats } }> {
  try {
    if (!isSupabaseConfigured) return {};

    const { data, error } = await supabase
      .from('predictions')
      .select('user_id, match_id, predicted_home, predicted_away, points_earned');

    if (error) throw error;

    const byMatch = new Map<string, any>();
    (matches || []).forEach(m => byMatch.set(String(m.id), m));

    const byUser: { [userId: string]: { [competition: string]: CompetitionStats } } = {};

    (data || []).forEach((row: any) => {
      const match = byMatch.get(String(row.match_id));
      if (!match || !match.competition) return; // fixture no longer in the dataset

      const isFinished = (match.status || '').toUpperCase() === 'FINISHED';
      if (!isFinished || match.homeScore === null || match.awayScore === null) return;

      const points = calculateRawPoints(
        row.predicted_home,
        row.predicted_away,
        match.homeScore,
        match.awayScore
      );

      if (!byUser[row.user_id]) byUser[row.user_id] = {};
      if (!byUser[row.user_id][match.competition]) {
        byUser[row.user_id][match.competition] = {
          points: 0, exactScores: 0, correctOutcomes: 0, settled: 0
        };
      }

      const slice = byUser[row.user_id][match.competition];
      slice.points += points;
      slice.settled += 1;
      if (points === 5) slice.exactScores += 1;
      else if (points === 2) slice.correctOutcomes += 1;
    });

    return byUser;
  } catch (err) {
    console.error('Failed to aggregate per-competition prediction stats:', err);
    return {};
  }
}

/**
 * Visual placeholder board used when Supabase is unreachable. The mock rows are
 * stored in the database's snake_case shape, so map them onto UserProfile
 * instead of spreading them straight through.
 */
function mockLeaderboard(): UserProfile[] {
  return MOCK_LEADERBOARD.map((item, index) => ({
    id: item.id,
    username: item.display_name || item.username,
    totalPoints: item.total_points ?? 0,
    exactScoresCount: item.exact_guesses ?? 0,
    correctOutcomesCount: 0,
    rank: index + 1,
  }));
}

/**
 * Fetch leaderboard ranking list matching scores
 */
export async function fetchLeaderboard(): Promise<UserProfile[]> {
  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .order('total_points', { ascending: false })
      .order('exact_guesses', { ascending: false })
      .limit(50);

    if (error || !profiles || profiles.length === 0) {
      return mockLeaderboard();
    }

    return profiles.map((p, index) => ({
      id: p.id,
      username: p.username,
      totalPoints: p.total_points ?? 0,
      exactScoresCount: p.exact_guesses ?? 0,
      correctOutcomesCount: 0,
      rank: index + 1
    }));
  } catch (err) {
    console.error('Failed to query leaderboard rankings:', err);
    return mockLeaderboard();
  }
}

/**
 * Seeds the matches table if it is empty, so the foreign key on predictions
 * can never block a forecast.
 *
 * Normally redundant: the uefa-sync cron job upserts all 396 fixtures every
 * run. This is the safety net for a brand new database whose first sync has
 * not fired yet.
 */
export async function seedMatchesIfEmpty(): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { count, error } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.warn('Could not count matches:', error);
    return;
  }

  if (count !== 0) return;

  const { INITIAL_MATCHES } = await import('../data');

  const rows = INITIAL_MATCHES.map((match: any) => ({
    id: parseInt(String(match.id).replace(/\D/g, ''), 10),
    competition: match.competition,
    matchday: match.matchday,
    group_name: match.stage || 'League Phase',
    home_team: match.homeTeam.name,
    away_team: match.awayTeam.name,
    home_flag: match.homeTeam.flag,
    away_flag: match.awayTeam.flag,
    match_date: match.match_date,
    status: (match.status || 'PENDING').toLowerCase(),
    home_score: match.homeScore ?? null,
    away_score: match.awayScore ?? null,
  }));

  const { error: seedError } = await supabase.from('matches').upsert(rows, { onConflict: 'id' });
  if (seedError) {
    console.warn('Could not seed matches table:', seedError.message);
  }
}

/**
 * Returns the full fixture list with live results applied.
 *
 * Teams, logos, matchdays and kick-off times come from the generated dataset —
 * they do not change during a season. Only what actually moves (status and the
 * score) is read from the database, where the uefa-sync cron job keeps it
 * current. A fixture the database does not know about simply keeps its
 * dataset values.
 */
export async function fetchMatchesFromDB(): Promise<any[]> {
  const { INITIAL_MATCHES } = await import('../data');

  if (!isSupabaseConfigured) return INITIAL_MATCHES;

  try {
    const { data: rows, error } = await supabase
      .from('matches')
      .select('id, status, home_score, away_score');

    if (error) {
      console.error('Error fetching live results from DB:', error.message);
      return INITIAL_MATCHES;
    }

    if (!rows || rows.length === 0) return INITIAL_MATCHES;

    const liveById = new Map<string, any>();
    rows.forEach((row: any) => liveById.set(String(row.id), row));

    return INITIAL_MATCHES.map((match: any) => {
      const row = liveById.get(String(match.id));
      if (!row) return match;

      const status = (row.status || 'pending').toUpperCase();
      return {
        ...match,
        status: status === 'UPCOMING' ? 'PENDING' : status,
        homeScore: row.home_score ?? null,
        awayScore: row.away_score ?? null,
      };
    });
  } catch (err) {
    console.error('Exception in fetchMatchesFromDB:', err);
    return INITIAL_MATCHES;
  }
}
