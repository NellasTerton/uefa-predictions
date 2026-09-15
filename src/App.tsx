/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Trophy, 
  Calendar, 
  Users, 
  Award, 
  Edit3, 
  Check, 
  Sparkles, 
  Dribbble, 
  Loader2,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Play,
  X
} from 'lucide-react';

import PhoneContainer from './components/PhoneContainer';
import PredictModal from './components/PredictModal';
import OtherPredictionsModal from './components/OtherPredictionsModal';
import { formatMatchDate, formatMatchTime, getMatchDateObject } from './services/dateUtils';
import { INITIAL_GROUPS, INITIAL_MATCHES, COMPETITIONS, DEFAULT_COMPETITION, getCompetition } from './data';
import { CompetitionId, CompetitionStats, Group, Match, Prediction, UserProfile } from './types';

// Import our decoupled services & translations
import { 
  getCurrentUser, 
  updateUsername, 
  fetchUserPredictions, 
  savePrediction, 
  fetchLeaderboard,
  loginWithUsername,
  logoutUser,
  isSupabaseConfigured,
  configErrorMessage,
  updateUserProfileStats,
  fetchMatchesFromDB,
  registerWithPin,
  loginWithPin,
  fetchUserPredictionsById,
  fetchAllPredictionStats,
  deleteOwnAccount
} from './services/supabase';

import { 
  processPredictionsWithResults, 
  recalculateGroupStandings,
  calculatePredictionPoints
} from './services/footballApi';

import { 
  Language, 
  getSavedLanguage, 
  saveLanguage, 
  TRANSLATIONS 
} from './services/language';

import { TeamFlag } from './components/TeamFlag';

const COMPETITION_STORAGE_KEY = 'uefa_active_competition';

// Bumped when the cached fixture shape changed (namespaced team ids +
// `competition`/`matchday` fields). Old caches are discarded on load.
const MATCHES_STORAGE_KEY = 'uefa_matches_v2';
const LEGACY_MATCHES_STORAGE_KEY = 'fifa_matches';

const PLAYOFF_GROUPS = ['1/16', '1/8', '1/4', '1/2', '3rd', 'Final'];

const PLAYOFF_STAGE_LABELS: { [lang: string]: { [group: string]: string } } = {
  en: {
    '1/16': 'Round of 32 (1/16)',
    '1/8': 'Round of 16 (1/8)',
    '1/4': 'Quarterfinals',
    '1/2': 'Semifinals',
    '3rd': 'Third Place Match',
    'Final': 'Final'
  },
  ru: {
    '1/16': '1/16 Финала',
    '1/8': '1/8 Финала',
    '1/4': 'Четвертьфинал',
    '1/2': 'Полуфинал',
    '3rd': 'Матч за 3-е место',
    'Final': 'Финал'
  }
};

export default function App() {
  // Localization states
  const [lang, setLang] = useState<Language>('ru');

  // Active translation dictionary
  const t = TRANSLATIONS[lang];

  // Navigation & UI tabs
  const [activeTab, setActiveTab] = useState<'matches' | 'groups' | 'leaderboard' | 'playoffs'>('matches');

  // Which of the three UEFA competitions the Matches/Table tabs are showing.
  // The leaderboard stays global and is never filtered by this.
  const [activeCompetition, setActiveCompetition] = useState<CompetitionId>(() => {
    const saved = localStorage.getItem(COMPETITION_STORAGE_KEY);
    return (COMPETITIONS.some(c => c.id === saved) ? saved : DEFAULT_COMPETITION) as CompetitionId;
  });

  // Per-tournament breakdown for every predictor on the board, keyed by user id.
  const [statsByUser, setStatsByUser] = useState<{ [userId: string]: { [competition: string]: CompetitionStats } }>({});
  
  // Simulated state layers (swappable with Supabase/API)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [predictions, setPredictions] = useState<{ [matchId: string]: Prediction }>({});
  const [leaderboard, setLeaderboard] = useState<UserProfile[]>([]);
  
  // Detail Overlay triggers
  
  const [predictingMatch, setPredictingMatch] = useState<Match | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // States for viewing other player's predictions
  const [selectedLeaderboardUser, setSelectedLeaderboardUser] = useState<UserProfile | null>(null);
  const [selectedUserPredictions, setSelectedUserPredictions] = useState<{ [matchId: string]: Prediction }>({});
  const [isLoadingSelectedUserPreds, setIsLoadingSelectedUserPreds] = useState<boolean>(false);

  // Account deletion flow: 'idle' shows the menu, 'confirm' the danger panel
  const [deleteAccountStep, setDeleteAccountStep] = useState<'idle' | 'confirm'>('idle');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // States for interactive actions
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [editingUsernameVal, setEditingUsernameVal] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Short celebration shown the instant a forecast is submitted.
  const [betBurst, setBetBurst] = useState<{ id: number; label: string } | null>(null);

  // Passwordless Username authentication states
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [authScreenState, setAuthScreenState] = useState<'choice' | 'register' | 'login'>('choice');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginErrorState, setLoginErrorState] = useState<string | null>(null);

  // Matches filter
  const [matchFilter, setMatchFilter] = useState<'upcoming' | 'completed' | 'all'>('all');
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const [expandedMatchdays, setExpandedMatchdays] = useState<Record<number, boolean>>({ 1: true });

  const matchesRef = useRef<Match[]>([]);
  const userProfileRef = useRef<UserProfile | null>(null);

  useEffect(() => {
    matchesRef.current = matches;
  }, [matches]);

  useEffect(() => {
    userProfileRef.current = userProfile;
  }, [userProfile]);

  // Load selected other user's predictions
  useEffect(() => {
    if (!selectedLeaderboardUser) {
      setSelectedUserPredictions({});
      return;
    }

    const loadOtherUserPreds = async () => {
      setIsLoadingSelectedUserPreds(true);
      try {
        if (selectedLeaderboardUser.isCurrentUser || selectedLeaderboardUser.id === userProfile?.id) {
          setSelectedUserPredictions(predictions);
        } else {
          // If Supabase is active, check database first
          let fetched: { [matchId: string]: Prediction } = {};
          if (isSupabaseConfigured) {
            fetched = await fetchUserPredictionsById(selectedLeaderboardUser.id);
          }
          setSelectedUserPredictions(fetched);
        }
      } catch (err) {
        console.error('Error loading other user forecasts:', err);
      } finally {
        setIsLoadingSelectedUserPreds(false);
      }
    };

    loadOtherUserPreds();
  }, [selectedLeaderboardUser, predictions, matches, userProfile]);

  // Load Initial App State
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        // 1. Language preference check
        const savedLang = getSavedLanguage();
        if (savedLang) {
          setLang(savedLang);
        } else {
          // Default to Russian, no onboarding modal shown
          setLang('ru');
          saveLanguage('ru');
        }

        // 2. Fetch user profile (uses Supabase with localStorage backup)
        const profile = await getCurrentUser();
        setUserProfile(profile);
        if (profile) {
          setEditingUsernameVal(profile.username);
        }

        // 3. Load matches from Supabase DB if configured, else fallback
        let initialMatchesList: any[] = [];
        if (isSupabaseConfigured) {
          try {
            const dbMatches = await fetchMatchesFromDB();
            initialMatchesList = dbMatches && dbMatches.length > 0 ? dbMatches : INITIAL_MATCHES;
          } catch (dbErr) {
            console.warn('Could not load matches from DB:', dbErr);
            initialMatchesList = INITIAL_MATCHES;
          }
        } else {
          localStorage.removeItem(LEGACY_MATCHES_STORAGE_KEY);
          const storedMatches = localStorage.getItem(MATCHES_STORAGE_KEY);
          if (storedMatches) {
            try {
              const parsed = JSON.parse(storedMatches);
              // Reject caches written before fixtures carried a competition.
              initialMatchesList = Array.isArray(parsed) && parsed.every((m: any) => m?.competition)
                ? parsed
                : INITIAL_MATCHES;
            } catch {
              initialMatchesList = INITIAL_MATCHES;
            }
          } else {
            initialMatchesList = INITIAL_MATCHES;
            localStorage.setItem(MATCHES_STORAGE_KEY, JSON.stringify(INITIAL_MATCHES));
          }
        }

        // Normalize match status strings to uppercase for robust tag filtering.
        // Logos now come correct from the generated dataset, so no runtime patching.
        initialMatchesList = (initialMatchesList || []).map((m: any) => ({
          ...m,
          status: (m.status || 'PENDING').toUpperCase()
        }));

        setMatches(initialMatchesList);

        // 4. Fetch user predictions (uses Supabase client guidelines)
        const userPredictions = await fetchUserPredictions();
        setPredictions(userPredictions);

        // 5. Calculate initial group standings based on matches list
        const processedGroups = recalculateGroupStandings(INITIAL_GROUPS, initialMatchesList);
        setGroups(processedGroups);

        // 6. Fetch leaderboard (combines simulated and user ranking)
        const board = await fetchLeaderboard();
        setLeaderboard(board);

        // 7. Per-tournament breakdown for everyone on the board
        setStatsByUser(await fetchAllPredictionStats(initialMatchesList));

        // Run sync processing
        if (profile) {
          syncUserPointsAndState(initialMatchesList, userPredictions, profile);
        }

      } catch (err) {
        console.error('Failed to load predictions client engine state', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();

    // Listen to changes in predictions globally
    const handlePredsChange = async () => {
      const updated = await fetchUserPredictions();
      if (userProfileRef.current) {
        const { updatedPredictions, updatedUser } = processPredictionsWithResults(
          matchesRef.current,
          updated,
          userProfileRef.current
        );
        setPredictions(updatedPredictions);
        setUserProfile(updatedUser);
      } else {
        setPredictions(updated);
      }
    };
    window.addEventListener('predictions_updated', handlePredsChange);
    return () => window.removeEventListener('predictions_updated', handlePredsChange);
  }, []);

  // Language onboarding choice handler
  const chooseLanguage = (selected: Language) => {
    setLang(selected);
    saveLanguage(selected);
  };

  // Inline dynamic Russian Team names translator for premium localized UX
  const getTeamName = (teamId: string, defaultName: string) => {
    if (lang !== 'ru') return defaultName;
    const ruNames: { [key: string]: string } = {
      'MEX': 'Мексика',
      'RSA': 'ЮАР',
      'KOR': 'Южная Корея',
      'CZE': 'Чехия',
      'CAN': 'Канада',
      'BIH': 'Босния и Герц.',
      'QAT': 'Катар',
      'SUI': 'Швейцария',
      'BRA': 'Бразилия',
      'MAR': 'Марокко',
      'HAI': 'Гаити',
      'SCO': 'Шотландия',
      'USA': 'США',
      'PAR': 'Парагвай',
      'AUS': 'Австралия',
      'TUR': 'Турция',
      'GER': 'Германия',
      'CUW': 'Кюрасао',
      'CIV': 'Кот-д\'Ивуар',
      'ECU': 'Эквадор',
      'NED': 'Нидерланды',
      'JPN': 'Япония',
      'SWE': 'Швеция',
      'TUN': 'Тунис',
      'BEL': 'Бельгия',
      'EGY': 'Египет',
      'IRN': 'Иран',
      'NZL': 'Новая Зеландия',
      'ESP': 'Испания',
      'CPV': 'Кабо-Верде',
      'KSA': 'Саудовская Аравия',
      'URU': 'Уругвай',
      'FRA': 'Франция',
      'SEN': 'Сенегал',
      'IRQ': 'Ирак',
      'NOR': 'Норвегия',
      'ARG': 'Аргентина',
      'ALG': 'Алжир',
      'AUT': 'Австрия',
      'JOR': 'Иордания',
      'POR': 'Португалия',
      'COD': 'ДР Конго',
      'UZB': 'Узбекистан',
      'COL': 'Колумбия',
      'ENG': 'Англия',
      'CRO': 'Хорватия',
      'GHA': 'Гана',
      'PAN': 'Панама'
    };
    return ruNames[teamId] || defaultName;
  };

  // Inline interactive Russian Date format parser
  const formatDate = (dateStr: string) => {
    if (lang !== 'ru') return dateStr;
    return dateStr
      .replace('Thursday', 'Четверг,')
      .replace('Friday', 'Пятница,')
      .replace('Saturday', 'Суббота,')
      .replace('Sunday', 'Воскресенье,')
      .replace('Monday', 'Понедельник,')
      .replace('Tuesday', 'Вторник,')
      .replace('Wednesday', 'Среда,')
      .replace('June', 'Июня');
  };

  // Match stage name localizer: "UCL • Matchday 3", or the playoff round once
  // knockout fixtures land in the dataset.
  const formatStageLabel = (match: Match) => {
    const comp = getCompetition(match.competition);
    if (match.group) {
      const stage = PLAYOFF_STAGE_LABELS[lang]?.[match.group] || match.group;
      return `${comp.short[lang]} • ${stage}`;
    }
    const round = lang === 'ru' ? `Тур ${match.matchday}` : `Matchday ${match.matchday}`;
    return `${comp.short[lang]} • ${round}`;
  };

  // Utility to sync user points with completed matches
  const syncUserPointsAndState = (
    currentMatches: Match[],
    currentPredictions: { [matchId: string]: Prediction },
    profile: UserProfile | null
  ) => {
    if (!profile) return;
    const { updatedPredictions, updatedUser } = processPredictionsWithResults(
      currentMatches,
      currentPredictions,
      profile
    );

    // Save user point progression & update local predictions state with computed points
    setPredictions(updatedPredictions);
    setUserProfile(updatedUser);
    localStorage.setItem('fifa_user_profile', JSON.stringify(updatedUser));

    // Save statistics in Supabase database public.profiles
    updateUserProfileStats(updatedUser.totalPoints, updatedUser.exactScoresCount)
      .then(() => fetchLeaderboard())
      .then(updatedBoard => {
        setLeaderboard(updatedBoard);
        return fetchAllPredictionStats(currentMatches);
      })
      .then(setStatsByUser);

    // Refresh groups
    const processedGroups = recalculateGroupStandings(INITIAL_GROUPS, currentMatches);
    setGroups(processedGroups);
  };

  // Profile Username Edit Action
  const handleSaveUsername = async () => {
    if (!editingUsernameVal.trim()) return;
    try {
      const updated = await updateUsername(editingUsernameVal);
      setUserProfile(updated);
      setIsEditingUsername(false);
      triggerToast(t.usernameUpdated);
      
      // Refresh ranking
      const board = await fetchLeaderboard();
      setLeaderboard(board);
    } catch {
      triggerToast(t.errorUpdatingName);
    }
  };

  // Submit registration or login with Name and PIN support
  const handleAuthSubmit = async (e: React.FormEvent, mode: 'login' | 'register') => {
    e.preventDefault();
    const name = loginUsername.trim();
    const pin = loginPin.trim();

    if (!name) {
      setLoginErrorState(lang === 'ru' ? 'Введите имя!' : 'Enter username!');
      return;
    }
    if (name.length < 2) {
      setLoginErrorState(lang === 'ru' ? 'Имя должно быть от 2 символов!' : 'Username must contain at least 2 chars!');
      return;
    }
    if (!pin) {
      setLoginErrorState(lang === 'ru' ? 'Введите ПИН-код!' : 'Enter PIN code!');
      return;
    }
    if (mode === 'register' && pin.length !== 6) {
      setLoginErrorState(
        lang === 'ru'
          ? 'ПИН-код должен быть ровно 6 символов (цифры или буквы)'
          : 'PIN must be exactly 6 characters (digits or letters)'
      );
      return;
    }

    setIsLoggingIn(true);
    setLoginErrorState(null);
    try {
      let profile;
      if (mode === 'register') {
        profile = await registerWithPin(name, pin);
        triggerToast(lang === 'ru' ? 'Профиль создан успешно!' : 'Profile created successfully!');
      } else {
        profile = await loginWithPin(name, pin);
        triggerToast(lang === 'ru' ? 'С возвращением!' : 'Welcome back!');
      }

      setUserProfile(profile);
      setEditingUsernameVal(profile.username);
      
      // Load user forecasts from real Supabase DB
      const userPredictions = await fetchUserPredictions();
      setPredictions(userPredictions);

      // Load leaderboards
      const board = await fetchLeaderboard();
      setLeaderboard(board);

      // Sync points if applicable
      syncUserPointsAndState(matches, userPredictions, profile);
    } catch (err: any) {
      console.error(err);
      setLoginErrorState(err.message || (lang === 'ru' ? 'Ошибка авторизации' : 'Authorization failed'));
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Permanently delete the signed-in account. Guarded by a typed confirmation
  // in the UI; this only runs once the player retyped their own nickname.
  const handleDeleteAccount = async () => {
    if (!userProfile) return;
    if (deleteConfirmText.trim().toLowerCase() !== userProfile.username.trim().toLowerCase()) {
      triggerToast(t.deleteAccountMismatch);
      return;
    }

    setIsDeletingAccount(true);
    try {
      await deleteOwnAccount();

      // Tear the session down locally the same way a logout would.
      setShowProfileModal(false);
      setDeleteAccountStep('idle');
      setDeleteConfirmText('');
      setUserProfile(null);
      setPredictions({});
      setSelectedLeaderboardUser(null);
      setLoginUsername('');
      setLoginPin('');
      setAuthScreenState('choice');

      const board = await fetchLeaderboard();
      setLeaderboard(board);
      setStatsByUser(await fetchAllPredictionStats(matches));

      triggerToast(t.deleteAccountDone);
    } catch (err: any) {
      console.error('Account deletion failed:', err);
      triggerToast(err?.message ? `${t.deleteAccountFailed}: ${err.message}` : t.deleteAccountFailed);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  // Log out current session
  const handleLogout = async () => {
    try {
      await logoutUser();
      setUserProfile(null);
      setPredictions({});
      setLoginUsername('');
      setLoginPin('');
      setAuthScreenState('choice');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  // Action Save Forecast prediction
  const handleSavePrediction = async (
    matchId: string, 
    homeScore: number | null, 
    awayScore: number | null,
    predictionType: 'score' | 'winner' = 'score',
    predictedWinner?: 'home' | 'away' | 'draw',
    advanceTeam?: 'home' | 'away' | null
  ) => {
    try {
      // Direct guard against cheating: enforce strict lock time validation before saving
      const targetMatch = matches.find(m => m.id === matchId);
      if (targetMatch) {
        const isFinished = (targetMatch.status || 'PENDING').toUpperCase() === 'FINISHED';
        const isLive = (targetMatch.status || 'PENDING').toUpperCase() === 'LIVE';
        const isMatchStarted = new Date() >= (targetMatch.match_date ? new Date(targetMatch.match_date) : getMatchDateObject(targetMatch));
        
        if (isFinished || isLive || isMatchStarted) {
          triggerToast(lang === 'ru' ? 'Матч уже начался. Прогнозы заблокированы!' : 'Match has started. Predictions are locked!');
          return;
        }
      }

      // Show the forecast immediately and celebrate, then persist. Waiting for
      // the round trip first is what made the app feel sluggish after a bet.
      const optimistic: Prediction = {
        id: `pending_${matchId}`,
        matchId,
        userId: userProfile?.id || '',
        homeScore,
        awayScore,
        predictionType,
        predictedWinner,
        advance_team: advanceTeam ?? null,
        createdAt: new Date().toISOString(),
        pointsEarned: null,
      };

      const previousPrediction = predictions[matchId];
      setPredictions(prev => ({ ...prev, [matchId]: optimistic }));
      celebrateBet(optimistic);

      try {
        const newPred = await savePrediction(matchId, homeScore, awayScore, predictionType, predictedWinner, advanceTeam);

        const updatedPreds = {
          ...predictions,
          [matchId]: newPred
        };
        setPredictions(updatedPreds);

        if (userProfile) {
          syncUserPointsAndState(matches, updatedPreds, userProfile);
        }
      } catch (saveErr) {
        // Put the card back the way it was so nobody is left believing a
        // forecast was stored when it was not.
        setPredictions(prev => {
          const rolledBack = { ...prev };
          if (previousPrediction) rolledBack[matchId] = previousPrediction;
          else delete rolledBack[matchId];
          return rolledBack;
        });
        setBetBurst(null);
        throw saveErr;
      }
    } catch (err) {
      console.error(err);
      triggerToast(t.forecastFailed);
    }
  };

  // Fire the confirmation burst. Self-clears well under a second.
  const celebrateBet = (pred: Prediction) => {
    const label = pred.predictionType === 'winner'
      ? (pred.predictedWinner === 'draw' ? t.drawText : t.winText)
      : `${pred.homeScore}:${pred.awayScore}`;

    setBetBurst({ id: Date.now(), label });
    setTimeout(() => setBetBurst(null), 950);
  };

  // Helper toast notifier
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  // SIMULATOR HANDLER: Runs live results updates for demo purposes!
  const handleSimulateMatchResult = (matchId: string) => {
    const matchedIndex = matches.findIndex(m => m.id === matchId);
    if (matchedIndex === -1) return;

    // Generate random realistic football score
    const simHome = Math.floor(Math.random() * 4); // 0 to 3
    const simAway = Math.floor(Math.random() * 3); // 0 to 2

    const updatedMatches = [...matches];
    updatedMatches[matchedIndex] = {
      ...updatedMatches[matchedIndex],
      homeScore: simHome,
      awayScore: simAway,
      status: 'FINISHED'
    };

    setMatches(updatedMatches);
    localStorage.setItem(MATCHES_STORAGE_KEY, JSON.stringify(updatedMatches));

    const homeT = getTeamName(updatedMatches[matchedIndex].homeTeam.id, updatedMatches[matchedIndex].homeTeam.name);
    const awayT = getTeamName(updatedMatches[matchedIndex].awayTeam.id, updatedMatches[matchedIndex].awayTeam.name);
    triggerToast(`${lang === 'ru' ? 'Симуляция:' : 'Simulation:'} ${homeT} ${simHome}-${simAway} ${awayT}!`);

    if (userProfile) {
      syncUserPointsAndState(updatedMatches, predictions, userProfile);
    }
  };

  // Reset simulation to fresh state
  const handleResetSimulation = () => {
    localStorage.removeItem(MATCHES_STORAGE_KEY);
    localStorage.removeItem('fifa_predictions');
    
    // reset current user scores too
    const freshUser: UserProfile = {
      id: 'user_current',
      username: userProfile?.username || t.guestPredictor,
      totalPoints: 0,
      exactScoresCount: 0,
      correctOutcomesCount: 0,
      isCurrentUser: true,
    };
    
    localStorage.setItem('fifa_user_profile', JSON.stringify(freshUser));
    setUserProfile(freshUser);
    setMatches(INITIAL_MATCHES);
    setPredictions({});
    
    const freshGroups = recalculateGroupStandings(INITIAL_GROUPS, INITIAL_MATCHES);
    setGroups(freshGroups);

    fetchLeaderboard().then(updatedBoard => {
      setLeaderboard(updatedBoard);
    });

    triggerToast(t.allMatchesReset);
  };

  const competitionMeta = getCompetition(activeCompetition);

  // Fixtures of the tournament currently on screen
  const competitionMatches = matches.filter(m => m.competition === activeCompetition);

  // Switch the Matches/Table tabs to another competition, clearing any filter
  // that only made sense inside the previous one.
  const changeCompetition = (id: CompetitionId) => {
    if (id === activeCompetition) return;
    setActiveCompetition(id);
    setTeamFilter(null);
    setExpandedMatchdays({ 1: true });
  };

  // Group the current user's settled predictions by tournament. Computed from
  // local state so it is always available, even without Supabase.
  const myCompetitionStats = userProfile?.competitionStats || {};

  // Per-tournament breakdown for any predictor on the board.
  const statsForUser = (user: UserProfile): { [competition: string]: CompetitionStats } => {
    if (user.isCurrentUser || user.id === userProfile?.id) return myCompetitionStats;
    return statsByUser[user.id] || {};
  };

  // Tournament the current user is scoring best in (ties go to the first listed).
  const bestCompetition = COMPETITIONS.reduce<string | null>((best, comp) => {
    const points = myCompetitionStats[comp.id]?.points ?? 0;
    if (points <= 0) return best;
    const bestPoints = best ? (myCompetitionStats[best]?.points ?? 0) : 0;
    return points > bestPoints ? comp.id : best;
  }, null);

  const hasSettledPredictions = COMPETITIONS.some(
    comp => (myCompetitionStats[comp.id]?.settled ?? 0) > 0
  );

  // Filter matches matching search tab criteria
  const filteredMatches = competitionMatches.filter(m => {
    if (teamFilter) {
      if (m.homeTeam.id !== teamFilter && m.awayTeam.id !== teamFilter) {
        return false;
      }
    }
    const statusUpper = (m.status || 'PENDING').toUpperCase();
    if (matchFilter === 'upcoming') return statusUpper === 'PENDING';
    if (matchFilter === 'completed') return statusUpper === 'FINISHED';
    return true; // 'all'
  });

  // Reusable match card renderer used across both Matches and Playoffs tabs
  const renderMatchCard = (match: Match) => {
    const pred = predictions[match.id];
    const isFinished = (match.status || 'PENDING').toUpperCase() === 'FINISHED';
    const isLive = (match.status || 'PENDING').toUpperCase() === 'LIVE';
    const isMatchStarted = new Date() >= (match.match_date ? new Date(match.match_date) : getMatchDateObject(match));
    const isLocked = isFinished || isLive || isMatchStarted;
    
    const homeTrans = getTeamName(match.homeTeam.id, match.homeTeam.name);
    const awayTrans = getTeamName(match.awayTeam.id, match.awayTeam.name);
    
    // Card interactive styling based on predictions & results
    let cardBgClass = 'bg-[#0b1227]';
    let cardBorderClass = 'border-slate-800/90';
    let cardGlowClass = '';
    let cursorClass = 'cursor-pointer hover:border-[#00e676]/30';
    
    if (pred) {
      if (!isFinished) {
        // Highlight with Purple for active predictions
        cardBgClass = 'bg-[#140f35]';
        cardBorderClass = 'border-violet-500/60 border-l-4 border-l-violet-500 hover:border-violet-400/80';
        cardGlowClass = 'shadow-[0_0_15px_rgba(139,92,246,0.18)]';
      } else {
        const pointsEarned = pred.pointsEarned ?? 0;
        if (pointsEarned > 0) {
          // Highlight with Green for correct predictions
          cardBgClass = 'bg-[#092415]';
          cardBorderClass = 'border-emerald-500/60 border-l-4 border-l-emerald-500 hover:border-emerald-400/80';
          cardGlowClass = 'shadow-[0_0_15px_rgba(16,185,129,0.18)]';
        } else {
          // Highlight with Red for incorrect predictions
          cardBgClass = 'bg-[#250d11]';
          cardBorderClass = 'border-rose-500/60 border-l-4 border-l-rose-500 hover:border-rose-400/80';
          cardGlowClass = 'shadow-[0_0_15px_rgba(239,68,68,0.18)]';
        }
      }
    }
    if (isLocked) {
      cursorClass = 'cursor-default';
    }

    return (
      <div 
        key={match.id} 
        onClick={() => !isLocked && setPredictingMatch(match)}
        className={`${cardBgClass} ${cardBorderClass} ${cardGlowClass} ${cursorClass} p-3 rounded-2xl border shadow-md relative group transition-all duration-200 active:scale-[0.99] flex flex-col justify-between gap-2`}
      >
        
        {/* Venue & Stage label details */}
        <div className="flex justify-between items-center text-[8px] text-slate-500 font-bold border-b border-slate-800/30 pb-1.5 uppercase tracking-wide">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="truncate">{formatStageLabel(match)}</span>
            {pred && !isFinished && (
              <span className="text-[7.5px] bg-violet-500/25 text-violet-300 border border-violet-500/40 px-1 py-0.5 rounded font-black tracking-widest shrink-0 animate-pulse">
                {lang === 'ru' ? 'ПРОГНОЗ ПРИНЯТ' : 'PREDICTION ACTIVE'}
              </span>
            )}
          </div>
          <span className="text-sky-400 font-medium truncate max-w-[150px]">{match.stadium}</span>
        </div>

        {/* Core versus scores */}
        <div className="grid grid-cols-5 items-center my-1 select-none">
          
          {/* Home */}
          <div className="col-span-2 flex items-center gap-2">
            <TeamFlag code={match.homeTeam.code} fallback={match.homeTeam.flag} className="w-8 h-8 object-contain rounded-sm" />
            <span className="text-xs font-extrabold text-slate-200 truncate">{homeTrans}</span>
          </div>

          {/* Scores or Center timing details */}
          <div className="col-span-1 flex flex-col items-center justify-center">
            {isFinished ? (
              <div className="font-mono text-xs font-black text-slate-200 bg-slate-900 border border-slate-800 px-2 py-1 rounded-lg flex items-center justify-center gap-1 shadow-inner">
                <span>{match.homeScore}</span>
                <span className="text-[#00E676] font-bold">:</span>
                <span>{match.awayScore}</span>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <span className="font-mono text-xs font-bold text-amber-500 bg-amber-500/5 border border-amber-500/20 px-2 py-0.5 rounded-md">{formatMatchTime(match, lang)}</span>
              </div>
            )}
          </div>

          {/* Away */}
          <div className="col-span-2 flex items-center justify-end gap-2 text-right">
            <span className="text-xs font-extrabold text-slate-200 truncate">{awayTrans}</span>
            <TeamFlag code={match.awayTeam.code} fallback={match.awayTeam.flag} className="w-8 h-8 object-contain rounded-sm" />
          </div>

        </div>

        {/* Bottom status predict ribbon */}
        <div className="flex justify-between items-center bg-slate-950/40 p-1.5 rounded-xl border border-slate-900 mt-1">
          
          <div className="text-[10px] text-slate-400 line-clamp-1 truncate max-w-[190px]">
            {pred ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <Check size={12} className="text-emerald-400" />
                <span>
                  {t.forecast}:{' '}
                  <strong className="font-bold bg-emerald-500/10 px-1.5 py-0.5 border border-emerald-500/20 rounded text-emerald-400">
                    {pred.predictionType === 'winner' ? (
                      pred.predictedWinner === 'home' ? (
                        <span className="inline-flex items-center gap-1">
                          <TeamFlag code={match.homeTeam.code} fallback={match.homeTeam.flag} className="w-4 h-4 object-contain rounded-sm" />
                          <span>{t.winText}</span>
                        </span>
                      ) : pred.predictedWinner === 'away' ? (
                        <span className="inline-flex items-center gap-1">
                          <TeamFlag code={match.awayTeam.code} fallback={match.awayTeam.flag} className="w-4 h-4 object-contain rounded-sm" />
                          <span>{t.winText}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <span>🤝</span>
                          <span>{t.drawText}</span>
                        </span>
                      )
                    ) : (
                      <span className="font-mono">{pred.homeScore}-{pred.awayScore}</span>
                    )}
                  </strong>
                </span>
              </span>
            ) : (
              <span className="text-slate-500 italic">{t.noForecast}</span>
            )}
          </div>

          {/* Button flow */}
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            {isLocked ? (
              isFinished ? (
                <span className={`px-2 py-0.5 rounded font-black text-[8px] font-mono tracking-wider ${pred ? (pred.pointsEarned !== undefined && pred.pointsEarned !== null && pred.pointsEarned > 0 ? 'bg-[#1b2b1d] text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500') : 'bg-slate-800 text-slate-500 text-[7px] uppercase'}`}>
                  {pred ? `${t.result}: +${pred.pointsEarned ?? 0} ${t.pts.toUpperCase()}` : t.locked}
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-md font-extrabold uppercase text-[9px] tracking-wide bg-slate-800 text-slate-500 border border-slate-700/80 shadow-inner select-none">
                  {t.locked}
                </span>
              )
            ) : (
              <button
                id={`btn-predict-match-${match.id}`}
                onClick={() => setPredictingMatch(match)}
                className={`px-2.5 py-1 rounded-md font-extrabold uppercase text-[9px] tracking-wide transition-all active:scale-95 ${pred ? 'bg-[#0f2420] text-emerald-300 border border-emerald-500/30' : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm hover:brightness-105'}`}
              >
                {pred ? t.forecastEdit : t.forecastPredict}
              </button>
            )}
          </div>

        </div>

      </div>
    );
  };


  useEffect(() => {
    // Recompute every competition's table whenever results change.
    if (matches.length === 0 || groups.length === 0) return;

    const recomputed = recalculateGroupStandings(groups, matches);

    const changed = recomputed.some((g, i) =>
      JSON.stringify(g.standings) !== JSON.stringify(groups[i].standings)
    );

    if (changed) {
      setGroups(recomputed);
    }
  }, [matches, groups]);

  // Remember the last tournament the user was looking at.
  useEffect(() => {
    localStorage.setItem(COMPETITION_STORAGE_KEY, activeCompetition);
  }, [activeCompetition]);

  return (
    <PhoneContainer>
      
      {/* Bet confirmation burst - fires on submit, never waits for the network */}
      {betBurst && (
        <div
          key={betBurst.id}
          className="absolute inset-0 z-[60] flex flex-col items-center justify-center pointer-events-none select-none"
        >
          {/* Screen flash */}
          <div className="absolute inset-0 bg-[#00E676] animate-bet-flash" />

          <div className="relative flex items-center justify-center">
            {/* Expanding rings */}
            <span className="absolute w-24 h-24 rounded-full border-2 border-[#00E676] animate-bet-ring" />
            <span
              className="absolute w-24 h-24 rounded-full border-2 border-emerald-300/70 animate-bet-ring"
              style={{ animationDelay: '120ms' }}
            />

            {/* Sparks flying outward */}
            {[...Array(10)].map((_, i) => {
              const angle = (i / 10) * Math.PI * 2;
              return (
                <span
                  key={i}
                  className="absolute w-1.5 h-1.5 rounded-full bg-amber-300 animate-bet-spark"
                  style={{
                    ['--dx' as any]: `${Math.cos(angle) * 78}px`,
                    ['--dy' as any]: `${Math.sin(angle) * 78}px`,
                    animationDelay: `${i * 18}ms`,
                  }}
                />
              );
            })}

            {/* Badge */}
            <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-[0_0_45px_rgba(0,230,118,0.65)] animate-bet-pop">
              <Check size={46} strokeWidth={3.5} className="text-slate-950" />
            </div>
          </div>

          <div className="mt-6 flex flex-col items-center gap-1 animate-bet-rise">
            <span className="text-lg font-black uppercase tracking-widest text-[#00E676] drop-shadow-[0_0_12px_rgba(0,230,118,0.5)]">
              {t.betAccepted}
            </span>
            <span className="font-mono text-2xl font-black text-white tracking-wider">
              {betBurst.label}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
              {t.betAcceptedSub}
            </span>
          </div>
        </div>
      )}

      {/* Toast Notice */}
      {toastMessage && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 bg-[#00E676] border border-emerald-400/30 text-indigo-950 font-black text-xs uppercase tracking-widest px-4 py-2.5 rounded-full shadow-lg z-50 animate-bounce flex items-center gap-1.5 whitespace-nowrap">
          <Sparkles size={14} className="animate-spin text-amber-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {userProfile === null ? (
        <div className="flex-1 flex flex-col justify-between bg-[#060b1b] p-6 text-center select-none animate-fade-in z-40 w-full min-h-[500px]">
          {/* Logo brand and styling */}
          <div className="flex flex-col items-center mt-8 gap-4">
            <img 
              src="https://i.ibb.co/twXg7ycM/Chat-GPT-Image-10-2026-18-35-27-removebg-preview.png"
              alt="UEFA Predict"
              referrerPolicy="no-referrer"
              className="w-36 h-36 object-contain filter drop-shadow-[0_0_20px_rgba(0,230,118,0.3)] select-none pointer-events-none animate-pulse-slow"
            />
            <div className="flex flex-col items-center gap-2">
              <h1 className="text-2xl font-black text-[#00E676] tracking-widest uppercase leading-tight">
                {lang === 'ru' ? 'Еврокубки 26/27' : 'UEFA 26/27'}
              </h1>
              <div className="flex items-center gap-1.5">
                {COMPETITIONS.map((comp) => (
                  <span
                    key={comp.id}
                    className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border"
                    style={{ color: comp.accent, borderColor: `${comp.accent}55`, backgroundColor: `${comp.accent}14` }}
                  >
                    {comp.short[lang]}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {!isSupabaseConfigured && (
            <div className="bg-amber-950/40 border border-amber-500/30 text-amber-300 text-[11px] p-3 rounded-xl text-left space-y-1 max-w-sm mx-auto my-2">
              <p className="font-extrabold uppercase">⚠️ {lang === 'ru' ? 'Ключи базы данных не настроены' : 'Supabase Credentials Needed'}</p>
              <p className="opacity-90 leading-relaxed">
                {lang === 'ru' 
                  ? 'Пожалуйста, укажите ваши реальные значения VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY в меню Settings -> Environment Variables.'
                  : 'Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Settings -> Environment Variables.'}
              </p>
            </div>
          )}

          {authScreenState === 'choice' && (
            <div className="w-full max-w-sm mx-auto flex flex-col gap-4 my-auto px-2">
              <button
                id="btn-auth-goto-register"
                onClick={() => {
                  setAuthScreenState('register');
                  setLoginErrorState(null);
                }}
                className="w-full p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 to-[#0d1630] border border-emerald-500/35 hover:border-emerald-400/70 text-left transition-all active:scale-95 group relative overflow-hidden shadow-lg cursor-pointer"
              >
                <div className="absolute right-5 top-1/2 -translate-y-1/2 text-emerald-400/20 text-3xl font-bold group-hover:text-emerald-400/40 transition-colors">
                  👤
                </div>
                <h4 className="text-base font-black text-[#00E676] uppercase tracking-wider">
                  {lang === 'ru' ? 'Создать профиль' : 'Create Profile'}
                </h4>
              </button>

              <button
                id="btn-auth-goto-login"
                onClick={() => {
                  setAuthScreenState('login');
                  setLoginErrorState(null);
                }}
                className="w-full p-5 rounded-2xl bg-[#0d1630] border border-slate-700/80 hover:border-indigo-500/60 text-left transition-all active:scale-95 group relative overflow-hidden shadow-lg cursor-pointer"
              >
                <div className="absolute right-5 top-1/2 -translate-y-1/2 text-indigo-400/20 text-3xl font-bold group-hover:text-indigo-400/40 transition-colors">
                  🔑
                </div>
                <h4 className="text-base font-black text-indigo-400 uppercase tracking-wider">
                  {lang === 'ru' ? 'Войти' : 'Log In'}
                </h4>
              </button>
            </div>
          )}

          {authScreenState === 'register' && (
            <form 
              onSubmit={(e) => handleAuthSubmit(e, 'register')} 
              className="flex flex-col gap-4 w-full max-w-sm mx-auto my-auto bg-[#0d1630] border border-slate-800/80 p-6 rounded-3xl shadow-2xl relative"
            >
              <button
                type="button"
                id="btn-register-back"
                onClick={() => {
                  setAuthScreenState('choice');
                  setLoginErrorState(null);
                }}
                className="absolute top-4 left-4 text-xs font-black uppercase text-[#00E676] bg-slate-950/60 border border-emerald-500/30 hover:border-emerald-500/60 px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 active:scale-95"
              >
                ← {lang === 'ru' ? 'Назад' : 'Back'}
              </button>

              <div className="text-left space-y-1 mb-2 mt-8">
                <h3 className="text-sm font-black text-emerald-400 uppercase tracking-wider">
                  {lang === 'ru' ? 'Регистрация' : 'Register Profile'}
                </h3>
                <p className="text-[11px] text-slate-400 leading-normal">
                  {lang === 'ru' 
                    ? 'Никнейм и ПИН-код из 6 символов — цифры, буквы или вперемешку'
                    : 'Pick a nickname and a 6-character PIN — digits, letters or both'}
                </p>
              </div>

              <div className="space-y-3.5 text-left">
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-1 tracking-wider">
                    {lang === 'ru' ? 'Имя участника' : 'Username'}
                  </label>
                  <input
                    id="register-username-input"
                    type="text"
                    maxLength={16}
                    required
                    placeholder={lang === 'ru' ? 'Ваш никнейм' : 'Choose nickname'}
                    value={loginUsername}
                    onChange={(e) => {
                      setLoginUsername(e.target.value);
                      if (loginErrorState) setLoginErrorState(null);
                    }}
                    disabled={isLoggingIn}
                    className="w-full bg-[#060b1b] text-slate-100 text-sm font-black px-4 py-3 rounded-xl border border-slate-800 focus:border-[#00E676] focus:outline-none transition-all placeholder:text-slate-600 shadow-inner"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-1 tracking-wider">
                    {lang === 'ru' ? 'ПИН-код (ровно 6 символов)' : 'PIN Access Code (exactly 6 characters)'}
                  </label>
                  <input
                    id="register-pin-input"
                    type="password"
                    maxLength={6}
                    required
                    placeholder="••••••"
                    value={loginPin}
                    onChange={(e) => {
                      setLoginPin(e.target.value);
                      if (loginErrorState) setLoginErrorState(null);
                    }}
                    disabled={isLoggingIn}
                    className="w-full bg-[#060b1b] text-slate-100 text-sm font-black tracking-widest px-4 py-3 rounded-xl border border-slate-800 focus:border-[#00E676] focus:outline-none transition-all placeholder:text-slate-600 shadow-inner"
                  />
                </div>

                {loginErrorState && (
                  <p className="text-[11px] text-rose-500 font-bold pl-1">{loginErrorState}</p>
                )}
              </div>

              <button
                id="btn-register-submit"
                type="submit"
                disabled={isLoggingIn}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 text-sm font-black text-white active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#00E676]/20 cursor-pointer"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="animate-spin text-white" size={16} />
                    <span>{lang === 'ru' ? 'Создание...' : 'Creating...'}</span>
                  </>
                ) : (
                  <span>{lang === 'ru' ? 'Создать профиль' : 'Create Profile'}</span>
                )}
              </button>
            </form>
          )}

           {authScreenState === 'login' && (
            <form 
              onSubmit={(e) => handleAuthSubmit(e, 'login')} 
              className="flex flex-col gap-4 w-full max-w-sm mx-auto my-auto bg-[#0d1630] border border-slate-800/80 p-6 rounded-3xl shadow-2xl relative"
            >
              <button
                type="button"
                id="btn-login-back"
                onClick={() => {
                  setAuthScreenState('choice');
                  setLoginErrorState(null);
                }}
                className="absolute top-4 left-4 text-xs font-black uppercase text-indigo-400 bg-slate-950/60 border border-indigo-500/30 hover:border-indigo-500/60 px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 active:scale-95"
              >
                ← {lang === 'ru' ? 'Назад' : 'Back'}
              </button>

              <div className="text-left space-y-1 mb-2 mt-8">
                <h3 className="text-sm font-black text-indigo-400 uppercase tracking-wider">
                  {lang === 'ru' ? 'Войти в профиль' : 'Login Profile'}
                </h3>
                <p className="text-[11px] text-slate-400 leading-normal">
                  {lang === 'ru' 
                    ? 'Укажите ваше зарегистрированное Имя и ПИН-код' 
                    : 'Provide registered handle name and access PIN code'}
                </p>
              </div>

              <div className="space-y-3.5 text-left">
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-1 tracking-wider">
                    {lang === 'ru' ? 'Имя или Никнейм' : 'Username'}
                  </label>
                  <input
                    id="login-username-input"
                    type="text"
                    maxLength={16}
                    required
                    placeholder={lang === 'ru' ? 'Ваш никнейм' : 'Enter registered name'}
                    value={loginUsername}
                    onChange={(e) => {
                      setLoginUsername(e.target.value);
                      if (loginErrorState) setLoginErrorState(null);
                    }}
                    disabled={isLoggingIn}
                    className="w-full bg-[#060b1b] text-slate-100 text-sm font-black px-4 py-3 rounded-xl border border-slate-800 focus:border-indigo-500 focus:outline-none transition-all placeholder:text-slate-600 shadow-inner"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-1 tracking-wider">
                    {lang === 'ru' ? 'Введите ПИН-код' : 'Secret PIN'}
                  </label>
                  <input
                    id="login-pin-input"
                    type="password"
                    maxLength={6}
                    required
                    placeholder="••••••"
                    value={loginPin}
                    onChange={(e) => {
                      setLoginPin(e.target.value);
                      if (loginErrorState) setLoginErrorState(null);
                    }}
                    disabled={isLoggingIn}
                    className="w-full bg-[#060b1b] text-slate-100 text-sm font-black tracking-widest px-4 py-3 rounded-xl border border-slate-800 focus:border-indigo-500 focus:outline-none transition-all placeholder:text-slate-600 shadow-inner"
                  />
                </div>

                {loginErrorState && (
                  <p className="text-[11px] text-rose-500 font-bold pl-1">{loginErrorState}</p>
                )}
              </div>

              <button
                id="btn-login-submit"
                type="submit"
                disabled={isLoggingIn}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 hover:brightness-110 text-sm font-black text-white active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 cursor-pointer"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="animate-spin text-white" size={16} />
                    <span>{lang === 'ru' ? 'Вход...' : 'Connecting...'}</span>
                  </>
                ) : (
                  <span>{lang === 'ru' ? 'Войти' : 'Verify & Enter'}</span>
                )}
              </button>
            </form>
          )}

          {/* Language Switcher on Auth page */}
          <div className="flex items-center justify-center gap-3 mb-2 shrink-0">
            <button
              id="btn-login-lang-en"
              onClick={() => chooseLanguage('en')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black tracking-wider transition-all shadow-md flex items-center gap-2 cursor-pointer ${lang === 'en' ? 'bg-gradient-to-r from-[#00E676] to-[#00c853] text-indigo-950' : 'bg-slate-950 text-slate-400 border border-slate-800/80 hover:border-slate-700/60'}`}
            >
              <img src="https://flagcdn.com/w40/gb.png" className="w-4.5 h-3 object-cover rounded shadow-sm" alt="GB" referrerPolicy="no-referrer" />
              <span>ENGLISH</span>
            </button>
            <button
              id="btn-login-lang-ru"
              onClick={() => chooseLanguage('ru')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black tracking-wider transition-all shadow-md flex items-center gap-2 cursor-pointer ${lang === 'ru' ? 'bg-gradient-to-r from-[#00E676] to-[#00c853] text-indigo-950' : 'bg-slate-950 text-slate-400 border border-slate-800/80 hover:border-slate-700/60'}`}
            >
              <img src="https://flagcdn.com/w40/ru.png" className="w-4.5 h-3 object-cover rounded shadow-sm" alt="RU" referrerPolicy="no-referrer" />
              <span>РУССКИЙ</span>
            </button>
          </div>

          <p className="text-[10px] text-slate-500 font-bold tracking-wide mt-2">
            Made by <span className="text-[#00E676] font-extrabold text-[10.5px]">Egor Iakobson</span> for all football lovers
          </p>
        </div>
      ) : (
        <>
          {/* Screen Header - Custom FIFA 2026 Motif */}
          <header className="p-4 bg-[#0a1128] border-b border-slate-800 flex flex-col gap-3 select-none">
        
        <div className="flex justify-between items-center">
          {/* Logo brand */}
          <div className="flex items-center gap-2">
            <img 
              src="https://i.ibb.co/twXg7ycM/Chat-GPT-Image-10-2026-18-35-27-removebg-preview.png"
              alt="WC 2026"
              referrerPolicy="no-referrer"
              className="w-8 h-8 object-contain filter drop-shadow-[0_0_5px_rgba(0,230,118,0.2)] select-none pointer-events-none"
            />
            <div className="min-w-0">
              <h1 className="text-sm font-black tracking-wider uppercase text-slate-100 leading-tight">
                {competitionMeta.short[lang]} 26/27
              </h1>
              <p className="text-[8px] font-bold uppercase tracking-widest text-slate-500 leading-tight truncate max-w-[130px]">
                {lang === 'ru' ? 'Прогнозы' : 'Predictions'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* NEAT LANGUAGE SELECTOR IN TOP-RIGHT CORNER (RU / EN) - slightly larger */}
            <div className="flex items-center gap-1 bg-[#0b1633] p-1 rounded-xl border border-slate-700/60 shadow-inner shrink-0">
              <button
                id="btn-lang-en"
                onClick={() => chooseLanguage('en')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black tracking-wider transition-all leading-none ${lang === 'en' ? 'bg-gradient-to-r from-[#00E676] to-teal-500 text-indigo-950 font-black shadow' : 'text-slate-400 hover:text-slate-200'}`}
              >
                EN
              </button>
              <button
                id="btn-lang-ru"
                onClick={() => chooseLanguage('ru')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black tracking-wider transition-all leading-none ${lang === 'ru' ? 'bg-gradient-to-r from-[#00E676] to-teal-500 text-indigo-950 font-black shadow' : 'text-slate-400 hover:text-slate-200'}`}
              >
                RU
              </button>
            </div>

            {/* Profile trigger button (with visual spacing to avoid accidental clicks) */}
            <button
              id="btn-header-profile"
              onClick={() => {
                setEditingUsernameVal(userProfile?.username || '');
                setIsEditingUsername(false); // Reset editing mode
                setDeleteAccountStep('idle');
                setDeleteConfirmText('');
                setShowProfileModal(true);
              }}
              className="w-10 h-10 rounded-full bg-[#1e293b] hover:bg-slate-700 border-2 border-indigo-500/40 hover:border-indigo-400 active:scale-95 flex items-center justify-center font-black text-xs text-indigo-300 uppercase transition-all shadow-md shrink-0 cursor-pointer"
              title={lang === 'ru' ? 'Профиль' : 'Profile'}
            >
              {(userProfile?.username || 'GP').substring(0, 2)}
            </button>
          </div>
        </div>

        {/* Tournament switcher - scopes the Matches and Table tabs */}
        <div className="flex gap-1 bg-[#0b1633] p-1 rounded-xl border border-slate-700/60 shadow-inner">
          {COMPETITIONS.map((comp) => {
            const isActive = comp.id === activeCompetition;
            return (
              <button
                key={comp.id}
                id={`btn-competition-${comp.id}`}
                onClick={() => changeCompetition(comp.id)}
                title={comp.name[lang]}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 ${isActive ? 'text-slate-950 shadow' : 'text-slate-400 hover:text-slate-200'}`}
                style={isActive ? { backgroundColor: comp.accent } : undefined}
              >
                {comp.short[lang]}
              </button>
            );
          })}
        </div>

        {/* User profile metadata bar - Compact 3-stats overview only */}
        <div className="bg-gradient-to-r from-slate-900/90 to-slate-900/40 p-3 rounded-2xl border border-slate-800/80">
          
          {/* Stats overview - exact count, outcomes, yellow points */}
          <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono select-none">
            
            <div className="flex flex-col items-center">
              <span className="text-[8px] text-slate-500 font-sans uppercase font-black tracking-wider">{lang === 'ru' ? 'точный счет' : 'exact score'}</span>
              <span className="font-extrabold text-emerald-400 mt-1 text-xs">{userProfile?.exactScoresCount ?? 0}</span>
            </div>

            <div className="flex flex-col items-center border-x border-slate-800">
              <span className="text-[8px] text-slate-500 font-sans uppercase font-black tracking-wider">{lang === 'ru' ? 'победитель' : 'winner outcome'}</span>
              <span className="font-extrabold text-[#00E676] mt-1 text-xs">{userProfile?.correctOutcomesCount ?? 0}</span>
            </div>

            <div className="flex flex-col items-center">
              <span className="text-[8px] text-slate-500 font-sans uppercase font-black tracking-wider">{lang === 'ru' ? 'очки' : 'total points'}</span>
              <span className="font-black text-amber-400 mt-0.5 text-xs bg-amber-400/10 px-2.5 py-0.5 rounded-md border border-amber-400/25 shadow-inner">
                {userProfile?.totalPoints ?? 0}
              </span>
            </div>

          </div>

        </div>

      </header>

      {/* Main viewports */}
      <div className="flex-1 overflow-y-auto px-4 py-3 pb-8 bg-[#060b1b] relative">
        
        {isLoading ? (
          <div className="h-44 w-full flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="animate-spin text-emerald-500" size={24} />
            <span className="text-xs font-bold uppercase tracking-wider">{lang === 'ru' ? 'Синхронизация арены...' : 'Syncing Arena...'}</span>
          </div>
        ) : (
          <>
            
            {/* 1. MATCHES VIEW */}
            {activeTab === 'matches' && (
              <div className="space-y-4 animate-fade-in select-none">
                
                {/* Matches Filters bar */}
                <div className="flex gap-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800/80">
                  {(['all', 'upcoming', 'completed'] as const).map((filter) => (
                    <button
                      key={filter}
                      id={`btn-filter-matches-${filter}`}
                      onClick={() => setMatchFilter(filter)}
                      className={`flex-1 py-1.5 rounded-lg text-[9px] tracking-wider uppercase font-extrabold transition-all ${matchFilter === filter ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      {filter === 'all' ? t.filterAll : filter === 'upcoming' ? t.filterUpcoming : t.filterCompleted}
                    </button>
                  ))}
                </div>

                {teamFilter && (
                  <div className="flex items-center justify-between bg-indigo-500/10 border border-indigo-500/20 px-3 py-2 rounded-xl">
                    <div className="flex items-center gap-2">
                      <TeamFlag code={teamFilter} fallback="🏳️" className="w-5 h-5 object-contain" />
                      <span className="text-xs font-bold text-indigo-300">
                        {groups.flatMap(g => g.teams).find(tm => tm.id === teamFilter)?.name || teamFilter}
                      </span>
                    </div>
                    <button 
                      onClick={() => setTeamFilter(null)}
                      className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center hover:bg-indigo-500/40"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* Fixture list */}
                <div className="space-y-4">
                  {filteredMatches.length === 0 ? (
                    <div className="p-10 text-center text-slate-500 text-xs italic">
                      {lang === 'ru' ? 'Нет матчей, соответствующих критериям.' : 'No matches match this criteria.'}
                    </div>
                  ) : (
                    // Group by matchday. The round count differs per tournament
                    // (8 in the Champions/Europa League, 6 in the Conference League).
                    Array.from({ length: competitionMeta.matchdays }, (_, i) => i + 1).map((matchday) => {
                      const matchdayMatches = filteredMatches.filter(m => m.matchday === matchday);
                      
                      if (matchdayMatches.length === 0) return null;
                      
                      const isExpanded = expandedMatchdays[matchday] || false;
                      const toggleMatchday = () => {
                        setExpandedMatchdays(prev => ({ ...prev, [matchday]: !isExpanded }));
                      };

                      return (
                        <div key={matchday} className="mb-4">
                          <button 
                            onClick={toggleMatchday}
                            className="w-full flex items-center justify-between bg-[#121a2f] p-3 rounded-xl border border-slate-800/60 mb-2 active:scale-[0.98] transition-transform"
                          >
                            <h3 className="text-[11px] uppercase font-black tracking-widest text-[#00E676] flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                              {lang === 'ru' ? `Тур ${matchday}` : `Matchday ${matchday}`}
                            </h3>
                            {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                          </button>
                          
                          {isExpanded && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                              {/* Sub-group by dates within the matchday for better readability */}
                              {(Array.from(new Set(matchdayMatches.map(m => formatMatchDate(m, lang)))) as string[]).map((formattedDate) => {
                                const matchesOnDate = matchdayMatches.filter(m => formatMatchDate(m, lang) === formattedDate);
                                return (
                                  <div key={formattedDate} className="space-y-1.5 mb-3">
                                    <h4 className="text-[9px] uppercase font-bold tracking-widest text-slate-400 pl-2 mb-1.5 flex items-center gap-1">
                                      {formattedDate}
                                    </h4>
                                    {matchesOnDate.map(match => renderMatchCard(match))}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* PLAYOFFS VIEW */}
            {activeTab === 'playoffs' && (
              <div className="space-y-4 animate-fade-in select-none">
                
                {/* Playoff stage lists */}
                <div className="space-y-6">
                  {PLAYOFF_GROUPS.map((groupKey) => {
                    const groupMatches = competitionMatches.filter(m => m.group === groupKey);
                    if (groupMatches.length === 0) return null;
                    
                    const stageTitle = PLAYOFF_STAGE_LABELS[lang]?.[groupKey] || groupKey;
                    
                    return (
                      <div key={groupKey} className="space-y-2.5">
                        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-1 mt-2">
                          <Award size={14} className="text-amber-400 shrink-0" />
                          <h3 className="text-xs uppercase font-extrabold tracking-widest text-[#00E676] drop-shadow-sm">
                            {stageTitle}
                          </h3>
                          <span className="text-[9px] font-bold text-slate-500 font-mono ml-auto">
                            {groupMatches.length} {lang === 'ru' ? 'МАТЧЕЙ' : 'MATCHES'}
                          </span>
                        </div>
                        
                        <div className="space-y-2">
                          {groupMatches.map((match) => renderMatchCard(match))}
                        </div>
                      </div>
                    );
                  })}
                  
                  {competitionMatches.filter(m => m.group && PLAYOFF_GROUPS.includes(m.group)).length === 0 && (
                    <div className="p-10 text-center text-slate-500 text-xs italic">
                      {lang === 'ru' ? 'Сетка плей-офф еще не сформирована.' : 'Playoff brackets have not been formed yet.'}
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* 2. GROUPS GRID VIEW */}
            {activeTab === 'groups' && (
              <div className="space-y-4 animate-fade-in select-none w-full">
                <div className="flex flex-col gap-4 pb-8 w-full">
                  {groups.filter(g => (g as any).competition === activeCompetition).map((group) => {
                    return (
                      <div key={group.id} className="w-full flex flex-col">
                        {/* Full League Table */}
                        <div className="w-full pb-2">
                          <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-slate-800/70">
                            <h3 className="text-xs font-black uppercase tracking-widest truncate" style={{ color: competitionMeta.accent }}>
                              {competitionMeta.name[lang]}
                            </h3>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 shrink-0 ml-2">
                              {t.leaguePhaseTable} 26/27
                            </span>
                          </div>
                          <div className="flex flex-col w-full">
                            {/* Table Header */}
                            <div className="flex items-center text-[9px] sm:text-xs font-mono text-slate-500 mb-2 px-1 sm:px-2 uppercase tracking-tighter">
                              <div className="w-4 sm:w-5 text-center shrink-0">#</div>
                              <div className="flex-1 ml-1 sm:ml-2 shrink-0">{lang === 'ru' ? 'КЛУБ' : 'CLUB'}</div>
                              <div className="flex items-center justify-end gap-0.5 sm:gap-2 ml-1 sm:ml-2 w-[120px] sm:w-[160px] shrink-0">
                                <span className="w-4 sm:w-5 text-center" title={lang === 'ru' ? 'Матчи' : 'Played'}>{lang === 'ru' ? 'И' : 'P'}</span>
                                <span className="w-4 sm:w-5 text-center text-slate-600" title={lang === 'ru' ? 'Победы' : 'Wins'}>{lang === 'ru' ? 'В' : 'W'}</span>
                                <span className="w-4 sm:w-5 text-center text-slate-600" title={lang === 'ru' ? 'Ничьи' : 'Draws'}>{lang === 'ru' ? 'Н' : 'D'}</span>
                                <span className="w-4 sm:w-5 text-center text-slate-600" title={lang === 'ru' ? 'Поражения' : 'Losses'}>{lang === 'ru' ? 'П' : 'L'}</span>
                                <span className="w-5 sm:w-8 text-center" title={lang === 'ru' ? 'Разница мячей' : 'Goal Difference'}>{lang === 'ru' ? 'РМ' : 'GD'}</span>
                                <span className="w-6 sm:w-8 text-center text-amber-400 font-bold" title={lang === 'ru' ? 'Очки' : 'Points'}>{lang === 'ru' ? 'О' : 'PTS'}</span>
                              </div>
                            </div>
                            
                            {/* Table Rows */}
                            <div className="flex flex-col gap-1">
                              {group.standings.map((stat, idx) => {
                                const team = group.teams.find(t => t.id === stat.teamId) || { name: 'Unknown', flag: '🏳️', code: 'UNK' };
                                let localizedName = team.name;
                                
                                const rowBg = idx < 8 ? 'bg-emerald-950/20 border-l-2 border-emerald-500/60' : 
                                              (idx < 24 ? 'bg-blue-950/10 border-l-2 border-blue-500/50' : 
                                              'bg-transparent border-l-2 border-transparent');
                                
                                return (
                                  <div 
                                    key={stat.teamId} 
                                    className={`flex items-center text-xs sm:text-sm px-1 sm:px-2 py-2 rounded-r-lg ${rowBg} hover:bg-slate-800/60 transition-colors cursor-pointer`}
                                    onClick={() => {
                                      setTeamFilter(team.id);
                                      setActiveTab('matches');
                                    }}
                                  >
                                    <span className={`font-black font-mono w-4 sm:w-5 text-center shrink-0 text-[10px] sm:text-sm ${idx < 8 ? 'text-emerald-400' : (idx < 24 ? 'text-blue-400' : 'text-slate-600')}`}>{idx + 1}</span>
                                    <TeamFlag code={team.code} fallback={team.flag} className="w-4 h-4 sm:w-6 sm:h-6 object-contain rounded-sm ml-1 shrink-0" />
                                    <span className="font-bold text-slate-200 flex-1 ml-1 sm:ml-2 text-[10px] sm:text-sm tracking-tighter sm:tracking-normal min-w-0 leading-tight">{localizedName}</span>
                                    
                                    <div className="flex items-center justify-end gap-0.5 sm:gap-2 ml-1 sm:ml-2 font-mono text-[10px] sm:text-sm w-[120px] sm:w-[160px] shrink-0">
                                      <span className="w-4 sm:w-5 text-center text-slate-300">{stat.played}</span>
                                      <span className="w-4 sm:w-5 text-center text-slate-500">{stat.won}</span>
                                      <span className="w-4 sm:w-5 text-center text-slate-500">{stat.drawn}</span>
                                      <span className="w-4 sm:w-5 text-center text-slate-500">{stat.lost}</span>
                                      <span className={`w-5 sm:w-8 text-center font-semibold text-[9px] sm:text-sm ${stat.goalDifference > 0 ? 'text-emerald-400' : stat.goalDifference < 0 ? 'text-red-400' : 'text-slate-500'}`}>{stat.goalDifference > 0 ? `+${stat.goalDifference}` : stat.goalDifference}</span>
                                      <span className="w-6 sm:w-8 text-center text-amber-400 font-black text-[11px] sm:text-base">{stat.points}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. LEADERBOARD VIEW */}
            {activeTab === 'leaderboard' && (
              <div className="space-y-4 animate-fade-in select-none">
                
                {/* Score rules cheat-sheet */}
                <div className="grid grid-cols-2 gap-3 text-center text-[10px]">
                  <div className="bg-[#0a1128] p-2 sm:p-3 rounded-2xl border border-slate-800/80 shadow-[0_0_15px_rgba(14,165,233,0.05)]">
                    <span className="font-mono text-amber-400 font-extrabold block text-xs sm:text-sm">5 {t.pts.toUpperCase()}</span>
                    <span className="text-[8px] sm:text-[10px] text-slate-500 uppercase font-bold tracking-wider mt-0.5 block">{t.exactScoreFull}</span>
                  </div>
                  <div className="bg-[#0a1128] p-2 sm:p-3 rounded-2xl border border-slate-800/80 shadow-[0_0_15px_rgba(0,230,118,0.05)]">
                    <span className="font-mono text-[#00E676] font-extrabold block text-xs sm:text-sm">2 {t.pts.toUpperCase()}</span>
                    <span className="text-[8px] sm:text-[10px] text-slate-500 uppercase font-bold tracking-wider mt-0.5 block">{t.correctOutcomeFull}</span>
                  </div>
                </div>

                {/* Per-tournament breakdown of the signed-in predictor's own record */}
                <div className="bg-[#0b1227] rounded-3xl border border-slate-800/90 overflow-hidden shadow-md">
                  <div className="px-4 py-3 bg-[#0a1128] border-b border-slate-800/50">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-200">{t.breakdownTitle}</h3>
                    <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">{t.breakdownDesc}</p>
                  </div>

                  {hasSettledPredictions ? (
                    <>
                      <div className="px-4 py-1.5 flex items-center justify-between text-[7.5px] font-black text-slate-500 tracking-widest uppercase border-b border-slate-800/40">
                        <span>{t.competitionSwitcher}</span>
                        <div className="flex items-center gap-3">
                          <span className="w-8 text-center">{lang === 'ru' ? 'ТОЧН' : 'EXACT'}</span>
                          <span className="w-8 text-center">{lang === 'ru' ? 'ИСХОД' : 'WIN'}</span>
                          <span className="w-10 text-center text-amber-400">{lang === 'ru' ? 'ОЧКИ' : 'PTS'}</span>
                        </div>
                      </div>

                      <div className="divide-y divide-slate-800/50">
                        {COMPETITIONS.map((comp) => {
                          const slice = myCompetitionStats[comp.id];
                          const points = slice?.points ?? 0;
                          const isBest = bestCompetition === comp.id;

                          return (
                            <div key={comp.id} className="px-4 py-2.5 flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-1.5 h-7 rounded-full shrink-0" style={{ backgroundColor: comp.accent }} />
                                <div className="min-w-0">
                                  <span className="block text-[11px] font-black text-slate-100 leading-tight">
                                    {comp.short[lang]}
                                    {isBest && (
                                      <span className="ml-1.5 text-[7px] font-black uppercase tracking-wider px-1 py-[1px] rounded bg-amber-400/15 text-amber-400 border border-amber-400/25 align-middle">
                                        {t.breakdownBest}
                                      </span>
                                    )}
                                  </span>
                                  <span className="block text-[8px] text-slate-500 uppercase font-bold tracking-wider truncate max-w-[120px] leading-tight">
                                    {slice?.settled ?? 0} {t.breakdownSettled}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 font-mono text-[11px] font-bold shrink-0">
                                <span className="w-8 text-center text-emerald-400">{slice?.exactScores ?? 0}</span>
                                <span className="w-8 text-center text-[#00E676]">{slice?.correctOutcomes ?? 0}</span>
                                <span className="w-10 text-center text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded px-1 py-0.5 font-black">
                                  {points}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="px-4 py-2 bg-[#0a1128]/70 border-t border-slate-800/50 flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">{t.overallLabel}</span>
                        <div className="flex items-center gap-3 font-mono text-[11px] font-bold">
                          <span className="w-8 text-center text-emerald-400">{userProfile?.exactScoresCount ?? 0}</span>
                          <span className="w-8 text-center text-[#00E676]">{userProfile?.correctOutcomesCount ?? 0}</span>
                          <span className="w-10 text-center text-amber-400 font-black">{userProfile?.totalPoints ?? 0}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="px-4 py-5 text-center text-[10px] text-slate-500 italic leading-relaxed">
                      {t.breakdownEmpty}
                    </p>
                  )}
                </div>

                {/* Ranking table rows */}
                <div className="bg-[#0b1227] rounded-3xl border border-slate-800/90 overflow-hidden shadow-md">
                  
                  <div className="px-4 py-3 bg-[#0a1128] border-b border-slate-800/50 flex items-center justify-between text-[8px] font-black text-slate-500 tracking-widest uppercase">
                    <span className="min-w-0 truncate">{t.rankUser}</span>
                    <div className="flex items-center gap-2 text-right shrink-0">
                      <span className="w-12 text-center leading-tight">{lang === 'ru' ? 'ТОЧН' : 'EXACT'}</span>
                      <span className="w-12 text-center leading-tight">{lang === 'ru' ? 'ИСХОД' : 'WIN'}</span>
                      <span className="w-10 text-center text-amber-400">{lang === 'ru' ? 'ОЧКИ' : 'PTS'}</span>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-800/50">
                    {leaderboard.map((user, idx) => {
                      const isMe = user.isCurrentUser;
                      let rankBadge = `${user.rank}`;
                      if (user.rank === 1) rankBadge = '🥇';
                      if (user.rank === 2) rankBadge = '🥈';
                      if (user.rank === 3) rankBadge = '🥉';

                      const displayUsername = isMe ? (user.username === 'Guest_Predictor' ? t.guestPredictor : user.username) : user.username;

                      return (
                        <div 
                          key={user.id} 
                          onClick={() => setSelectedLeaderboardUser(user)}
                          className={`px-4 py-3 flex items-center justify-between transition-all cursor-pointer hover:bg-slate-800/20 active:scale-99 ${isMe ? 'bg-indigo-600/15 border-y border-indigo-500/25' : ''}`}
                        >
                          {/* Rank + Username */}
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <span className="w-5 shrink-0 text-center text-xs font-black font-mono text-slate-400">{rankBadge}</span>
                            <div className="flex flex-col min-w-0">
                              <span className={`text-xs font-bold line-clamp-1 truncate ${isMe ? 'text-indigo-300 font-black' : 'text-slate-100'}`}>
                                {displayUsername} {isMe && <span className="text-[8px] font-black uppercase text-emerald-400 bg-emerald-500/10 px-1 border border-emerald-500/20 rounded ml-1">{t.youBadge}</span>}
                              </span>
                              {isMe && <span className="text-[8px] text-slate-500 uppercase font-medium">{t.localProfile}</span>}

                              {/* Points split across the three tournaments */}
                              <div className="flex items-center flex-wrap gap-1 mt-0.5">
                                {COMPETITIONS.map((comp) => {
                                  const points = statsForUser(user)[comp.id]?.points ?? 0;
                                  return (
                                    <span
                                      key={comp.id}
                                      title={comp.name[lang]}
                                      className="text-[7.5px] font-black uppercase tracking-wider px-1 py-[1px] rounded border font-mono whitespace-nowrap"
                                      style={{
                                        color: comp.accent,
                                        borderColor: `${comp.accent}55`,
                                        backgroundColor: `${comp.accent}14`,
                                      }}
                                    >
                                      {comp.short[lang]} {points}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          {/* Stat outputs */}
                          <div className="flex items-center gap-2 text-xs font-bold font-mono shrink-0">
                            <span className="w-12 text-center text-slate-400">{user.exactScoresCount ?? 0}</span>
                            <span className="w-12 text-center text-slate-400">{user.correctOutcomesCount ?? 0}</span>
                            <span className={`w-10 text-center font-black rounded px-1 py-0.5 ${isMe ? 'bg-amber-400 text-indigo-950 font-extrabold' : 'text-amber-400 bg-amber-400/10 border border-amber-400/20'}`}>
                              {user.totalPoints ?? 0}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                </div>

              </div>
            )}

          </>
        )}
      </div>

      {/* Screen Footer Tab-Bar navigation */}
      <footer className="h-20 bg-[#0a1128] border-t border-slate-800 px-4 flex items-center justify-between select-none z-30">
        
        {/* MATCHES */}
        <button
          id={`btn-tab-matches`}
          onClick={() => setActiveTab('matches')}
          className="flex flex-col items-center justify-center gap-1 flex-1 relative"
        >
          <Calendar size={18} className={activeTab === 'matches' ? 'text-[#00E676] animate-pulse' : 'text-slate-500'} />
          <span className={`text-[9px] font-black uppercase tracking-wider ${activeTab === 'matches' ? 'text-[#00E676]' : 'text-slate-500'}`}>{t.tabMatches}</span>
          {activeTab === 'matches' && <span className="absolute -bottom-4 w-6 h-[3px] bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full"></span>}
        </button>

        {/* GROUPS */}
        <button
          id={`btn-tab-groups`}
          onClick={() => setActiveTab('groups')}
          className="flex flex-col items-center justify-center gap-1 flex-1 relative"
        >
          <Trophy size={18} className={activeTab === 'groups' ? 'text-[#00E676] animate-pulse' : 'text-slate-500'} />
          <span className={`text-[9px] font-black uppercase tracking-wider ${activeTab === 'groups' ? 'text-[#00E676]' : 'text-slate-500'}`}>{t.tabGroups}</span>
          {activeTab === 'groups' && <span className="absolute -bottom-4 w-6 h-[3px] bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full"></span>}
        </button>

        {/* PLAYOFFS */}
        <button
          id={`btn-tab-playoffs`}
          onClick={() => setActiveTab('playoffs')}
          className="flex flex-col items-center justify-center gap-1 flex-1 relative"
        >
          <Award size={18} className={activeTab === 'playoffs' ? 'text-[#00E676] animate-pulse' : 'text-slate-500'} />
          <span className={`text-[9px] font-black uppercase tracking-wider ${activeTab === 'playoffs' ? 'text-[#00E676]' : 'text-slate-500'}`}>{t.tabPlayoffs}</span>
          {activeTab === 'playoffs' && <span className="absolute -bottom-4 w-6 h-[3px] bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full"></span>}
        </button>

        {/* LEADERBOARD */}
        <button
          id={`btn-tab-leaderboard`}
          onClick={() => setActiveTab('leaderboard')}
          className="flex flex-col items-center justify-center gap-1 flex-1 relative"
        >
          <Users size={18} className={activeTab === 'leaderboard' ? 'text-[#00E676] animate-pulse' : 'text-slate-500'} />
          <span className={`text-[9px] font-black uppercase tracking-wider ${activeTab === 'leaderboard' ? 'text-[#00E676]' : 'text-slate-500'}`}>{t.tabLeaderboard}</span>
          {activeTab === 'leaderboard' && <span className="absolute -bottom-4 w-6 h-[3px] bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full"></span>}
        </button>

      </footer>
      </>
      )}

      {/* ==================================================================== */}
      {/* OVERLAY COMPONENT DETECTORS */}
      {/* ==================================================================== */}

      {/* Predict Dialog Sheet component */}
      {predictingMatch && (
        <PredictModal
          match={predictingMatch}
          existingPrediction={predictions[predictingMatch.id] || null}
          onClose={() => setPredictingMatch(null)}
          onSave={handleSavePrediction}
          lang={lang}
        />
      )}

      {/* Custom Profile Menu Options Overlay */}
      {showProfileModal && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 select-none animate-fade-in">
          <div className="w-full max-w-xs bg-[#0d1630] border border-slate-800/90 rounded-3xl p-6 text-center shadow-2xl flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center text-xl font-bold">
              👤
            </div>
            
            <div className="space-y-1 w-full">
              <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider text-center">
                {lang === 'ru' ? 'Личный профиль' : 'User profile'}
              </h3>
            </div>

            {deleteAccountStep === 'confirm' ? (
              <div className="space-y-3 w-full text-left">
                <div className="bg-rose-950/40 border border-rose-500/30 rounded-xl p-3 space-y-1.5">
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-rose-300">
                    ⚠️ {t.deleteAccountTitle}
                  </h4>
                  <p className="text-[10px] text-rose-200/80 leading-relaxed">
                    {t.deleteAccountWarning}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] text-slate-400 uppercase font-black block tracking-wider">
                    {t.deleteAccountConfirmLabel}
                  </label>
                  <input
                    id="modal-input-delete-confirm"
                    type="text"
                    autoComplete="off"
                    placeholder={userProfile?.username || ''}
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    disabled={isDeletingAccount}
                    className="bg-slate-950 text-slate-200 text-xs px-3 py-2 rounded-xl border border-rose-500/40 focus:outline-rose-500 focus:outline-none w-full font-semibold disabled:opacity-50"
                  />
                </div>

                <button
                  id="modal-btn-delete-account-confirm"
                  onClick={handleDeleteAccount}
                  disabled={
                    isDeletingAccount ||
                    deleteConfirmText.trim().toLowerCase() !== (userProfile?.username || '').trim().toLowerCase()
                  }
                  className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-rose-600"
                >
                  {isDeletingAccount ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      {t.deleteAccountWorking}
                    </>
                  ) : (
                    t.deleteAccountConfirmBtn
                  )}
                </button>

                <button
                  id="modal-btn-delete-account-cancel"
                  onClick={() => {
                    setDeleteAccountStep('idle');
                    setDeleteConfirmText('');
                  }}
                  disabled={isDeletingAccount}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer active:scale-98 disabled:opacity-50"
                >
                  {t.deleteAccountCancel}
                </button>
              </div>
            ) : isEditingUsername ? (
              <div className="space-y-2 w-full text-left">
                <label className="text-[9px] text-slate-400 uppercase font-black block tracking-wider">
                  {lang === 'ru' ? 'Новое Имя' : 'New name'}
                </label>
                <div className="flex gap-1.5 w-full">
                  <input
                    id="modal-input-username-val"
                    type="text"
                    maxLength={16}
                    value={editingUsernameVal}
                    onChange={(e) => setEditingUsernameVal(e.target.value)}
                    className="bg-slate-950 text-slate-200 text-xs px-3 py-2 rounded-xl border border-emerald-500/50 focus:outline-emerald-500 focus:outline-none flex-1 font-semibold"
                  />
                  <button
                    id="modal-btn-confirm-username"
                    onClick={async () => {
                      if (editingUsernameVal.trim()) {
                        await handleSaveUsername();
                        setIsEditingUsername(false);
                      }
                    }}
                    className="p-2 rounded-xl bg-[#00E676] text-slate-950 hover:brightness-110 flex items-center justify-center active:scale-95 transition-all cursor-pointer shadow-sm"
                  >
                    <Check size={16} className="text-slate-950 font-black" />
                  </button>
                </div>
                <button
                  id="modal-btn-cancel-username"
                  onClick={() => {
                    setEditingUsernameVal(userProfile?.username || '');
                    setIsEditingUsername(false);
                  }}
                  className="text-[10px] text-slate-400 hover:text-slate-200 transition-colors underline block cursor-pointer"
                >
                  {lang === 'ru' ? 'Отмена' : 'Cancel'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 w-full">
                {/* Current Display name detail */}
                <div className="bg-slate-950/60 py-3 px-3 rounded-xl border border-slate-800/80 text-xs text-slate-200 font-bold truncate">
                  <span className="text-[9px] block text-slate-500 uppercase tracking-wider mb-0.5">{lang === 'ru' ? 'Текущее имя' : 'Current name'}</span>
                  {userProfile?.username}
                </div>

                {/* Option 1: Изменить имя */}
                <button
                  id="btn-profile-change-name"
                  onClick={() => {
                    setEditingUsernameVal(userProfile?.username || '');
                    setIsEditingUsername(true);
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#1e293b] hover:bg-slate-700 text-indigo-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-indigo-500/20 cursor-pointer active:scale-98"
                >
                  ✏️ {lang === 'ru' ? 'Изменить имя' : 'Change name'}
                </button>

                {/* Option 2: Выйти */}
                <button
                  id="btn-profile-logout"
                  onClick={() => {
                    handleLogout();
                    setShowProfileModal(false);
                  }}
                  className="w-full py-2.5 rounded-xl bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/20 text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                >
                  🚪 {lang === 'ru' ? 'Выйти' : 'Logout'}
                </button>

                {/* Option 3: Удалить аккаунт */}
                <button
                  id="btn-profile-delete-account"
                  onClick={() => {
                    setDeleteConfirmText('');
                    setDeleteAccountStep('confirm');
                  }}
                  className="w-full py-2.5 rounded-xl bg-transparent hover:bg-rose-950/40 text-rose-500/80 hover:text-rose-400 border border-rose-900/50 text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                >
                  🗑️ {t.deleteAccount}
                </button>

                {/* Close modal */}
                <button
                  id="btn-profile-close"
                  onClick={() => setShowProfileModal(false)}
                  className="w-full py-2.5 mt-1 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold transition-all cursor-pointer active:scale-98"
                >
                  {lang === 'ru' ? 'Закрыть' : 'Close'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Slide detailed group standing carousel */}
      

      {/* Other Predictions Modal Overlay */}
      {selectedLeaderboardUser && (
        <OtherPredictionsModal
          user={selectedLeaderboardUser}
          predictions={selectedUserPredictions}
          matches={matches}
          onClose={() => setSelectedLeaderboardUser(null)}
          lang={lang}
          competitionStats={statsForUser(selectedLeaderboardUser)}
        />
      )}

      {/* Loading Overlay for Other predictions */}
      {isLoadingSelectedUserPreds && (
        <div className="absolute inset-0 bg-[#060c1d]/85 backdrop-blur-sm z-50 flex flex-col items-center justify-center select-none text-white animate-fade-in">
          <div className="bg-[#0d1630] border border-slate-800 p-6 rounded-3xl flex flex-col items-center gap-3 shadow-2xl">
            <Loader2 className="w-8 h-8 text-[#00E676] animate-spin" />
            <span className="text-xs font-bold text-slate-300">
              {lang === 'ru' ? 'Загрузка прогнозов...' : 'Loading predictions...'}
            </span>
          </div>
        </div>
      )}



    </PhoneContainer>
  );
}
