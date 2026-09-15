/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Language = 'en' | 'ru';

export const TRANSLATIONS = {
  en: {
    // Header & Navigation
    logoTitle: 'UEFA CHAMPIONS LEAGUE',
    logoBadge: 'PREDICTIONS',
    logoSub: 'Champions League Predictions',
    pts: 'Pts',
    yourProfile: 'Your Profile',
    exact: 'Exact',
    points: 'Points',
    guestPredictor: 'Guest_Predictor',
    
    // Tabs
    tabMatches: 'Matches',
    tabGroups: 'Table',
    tabLeaderboard: 'Predictors',
    tabPlayoffs: 'Playoffs',

    // Matches filters
    filterAll: 'All',
    filterUpcoming: 'Upcoming',
    filterCompleted: 'Completed',

    // Sandbox
    sandboxTitle: 'Interactive Sandbox',
    sandboxDesc: 'Simulate match-day results below to see automatic score points calculations, stats updates, and rankings synchronized!',
    resetAll: 'Reset All',

    // List & states
    forecast: 'Forecast',
    forecastEdit: 'Edit',
    forecastPredict: 'Predict',
    noForecast: 'No forecast predicted',
    result: 'Result',
    locked: 'Locked',
    simPlay: 'Sim Play',

    // Groups Tab
    groupStageGrid: 'League Phase Table',
    groupStageDesc: 'Click the table to see league fixtures and make match forecasts!',
    openDetails: 'Open Details',
    detailedStandings: 'Detailed Standings',
    topTwoPromo: '★ Top 8 advance to RO16, 9-24 to playoffs',
    groupFixtures: 'League Fixtures & Preds',
    back: 'Back',
    noPredYet: 'No prediction yet',
    changePredict: 'Change Predict',

    // Standings columns
    posTeam: 'POS & TEAM',
    playedAbbr: 'P',
    gdAbbr: 'GD',
    ptsAbbr: 'PTS',
    formLabel: 'FORM',

    // Predict Modal Dialog
    makeYourPrediction: 'Make Your Prediction',
    predicted: 'Predicted',
    confirmForecast: 'Confirm Forecast',
    exactReward: 'Exact Score: +5 Pts',
    outcomeReward: 'Correct Outcome: +2 Pts',
    savedSuccessfully: 'Saved Successfully!',
    predictTypeScore: 'Exact Score',
    predictTypeWinner: 'Match Winner',
    winText: 'Win',
    drawText: 'Draw',

    // Leaderboard Tab
    worldRankings: 'World Rankings',
    leaderboardDesc: 'Compete on point calculations (5 exact, 2 outcomes) with football predictors worldwide!',
    exactScoreFull: 'Exact Score',
    correctOutcomeFull: 'Correct Outcome',
    rankUser: 'RANK & USER',
    exactCountHeader: 'EXACT',
    pointsHeader: 'POINTS',
    youBadge: 'You',
    localProfile: 'Local Profile',
    challengerLabel: 'Challenger',

    // Tournament breakdown (one shared leaderboard, split per competition)
    competitionSwitcher: 'Tournament',
    breakdownTitle: 'Your record by tournament',
    breakdownDesc: 'Same points, split across the three UEFA competitions.',
    breakdownBest: 'Strongest tournament',
    breakdownEmpty: 'No settled predictions yet — the split appears once matches finish.',
    breakdownSettled: 'settled',
    overallLabel: 'Overall',
    leaguePhaseTable: 'League Phase Table',

    // Account deletion
    deleteAccount: 'Delete account',
    deleteAccountTitle: 'Delete account permanently?',
    deleteAccountWarning: 'This removes your login, your nickname and every forecast you have made. Your points disappear from the leaderboard. It cannot be undone.',
    deleteAccountConfirmLabel: 'Type your nickname to confirm',
    deleteAccountConfirmBtn: 'Delete permanently',
    deleteAccountCancel: 'Cancel',
    deleteAccountWorking: 'Deleting…',
    deleteAccountDone: 'Account deleted',
    deleteAccountFailed: 'Could not delete the account',
    deleteAccountMismatch: 'The nickname does not match',

    // Bet confirmation burst
    betAccepted: 'Bet accepted!',
    betAcceptedSub: 'Good luck',

    // Onboarding Language Selector
    onboardingTitle: 'Welcome / Добро пожаловать!',
    onboardingSubTitle: 'Champions League Predictions',
    onboardingDesc: 'Select your preferred language to start predicting UCL matches and competing in the Leaderboard! / Выберите язык для прогнозов на матчи ЛЧ и участия в рейтинге!',
    onboardingBtnEn: 'English 🇬🇧',
    onboardingBtnRu: 'Русский 🇷🇺',

    // Dialog messages
    usernameUpdated: 'Username updated!',
    errorUpdatingName: 'Error updating username',
    predictionSaved: 'Prediction Saved!',
    forecastFailed: 'Forecast failed to save',
    simulationNotice: 'Simulation: finished',
    allMatchesReset: 'All matches reset to UPCOMING state.',

    // Authentication Page
    loginTitle: 'Stadium Entry',
    loginDesc: 'Join the matches forecast crew! Enter a custom nickname to log in or register instantly.',
    loginUsernamePlaceholder: 'Your Nickname / Username',
    loginRequired: 'Username is required',
    loginTooShort: 'Username must be at least 2 characters',
    loginButton: 'Enter Stadium',
    loggingIn: 'Connecting to stadium locker...',
    loginError: 'Failed to access matches database',
  },
  ru: {
    // Header & Navigation
    logoTitle: 'ЛИГА ЧЕМПИОНОВ',
    logoBadge: 'ПРОГНОЗЫ',
    logoSub: 'Прогнозы ЛЧ 2026/27',
    pts: 'Очк',
    yourProfile: 'Ваш профиль',
    exact: 'Точные',
    points: 'Очки',
    guestPredictor: 'Гость_Прогнозист',
    
    // Tabs
    tabMatches: 'Матчи',
    tabGroups: 'Таблица',
    tabLeaderboard: 'Рейтинг',
    tabPlayoffs: 'Плей-офф',

    // Matches filters
    filterAll: 'Все',
    filterUpcoming: 'Предстоящие',
    filterCompleted: 'Завершенные',

    // Sandbox
    sandboxTitle: 'Интерактивная песочница',
    sandboxDesc: 'Симулируйте результаты матчей ниже, чтобы увидеть автоматический расчет очков, статистики групп и рейтингов в реальном времени!',
    resetAll: 'Сбросить всё',

    // List & states
    forecast: 'Прогноз',
    forecastEdit: 'Изменить',
    forecastPredict: 'Прогноз',
    noForecast: 'Прогноз не сделан',
    result: 'Результат',
    locked: 'Прошел',
    simPlay: 'Сыграть',

    // Groups Tab
    groupStageGrid: 'Общий этап (Швейцарская система)',
    groupStageDesc: 'Нажмите на карточку лиги, чтобы открыть подробную таблицу результатов, форму команд и сделать прогнозы!',
    openDetails: 'Подробнее',
    detailedStandings: 'Турнирная таблица',
    topTwoPromo: '★ 1-8 места в 1/8 финала, 9-24 места в стыковые матчи',
    groupFixtures: 'Матчи этапа и прогнозы',
    back: 'Назад',
    noPredYet: 'Нет прогноза',
    changePredict: 'Изменить прогноз',

    // Standings columns
    posTeam: 'М  КОМАНДА',
    playedAbbr: 'И',
    gdAbbr: 'РМ',
    ptsAbbr: 'О',
    formLabel: 'ФОРМА',

    // Predict Modal Dialog
    makeYourPrediction: 'Сделать прогноз',
    predicted: 'Прогноз',
    confirmForecast: 'Подтвердить прогноз',
    exactReward: 'Точный счет: +5 очков',
    outcomeReward: 'Исход матча: +2 очка',
    savedSuccessfully: 'Прогноз сохранен!',
    predictTypeScore: 'Точный счет',
    predictTypeWinner: 'Победитель',
    winText: 'Победа',
    drawText: 'Ничья',

    // Leaderboard Tab
    worldRankings: 'Мировой рейтинг',
    leaderboardDesc: 'Соревнуйтесь по очкам (5 за точный счет, 2 за исход) с прогнозистами со всего мира!',
    exactScoreFull: 'Точный счет',
    correctOutcomeFull: 'Исход матча',
    rankUser: 'РАНГ И УЧАСТНИК',
    exactCountHeader: 'ТОЧНЫХ',
    pointsHeader: 'ОЧКИ',
    youBadge: 'Вы',
    localProfile: 'Локальный профиль',
    challengerLabel: 'Соперник',

    // Разбивка по турнирам (лидерборд общий, статистика — по каждому турниру)
    competitionSwitcher: 'Турнир',
    breakdownTitle: 'Ваша статистика по турнирам',
    breakdownDesc: 'Те же очки, разложенные по трем турнирам УЕФА.',
    breakdownBest: 'Лучший турнир',
    breakdownEmpty: 'Пока нет сыгранных прогнозов — разбивка появится после первых результатов.',
    breakdownSettled: 'сыграно',
    overallLabel: 'Всего',
    leaguePhaseTable: 'Таблица общего этапа',

    // Удаление аккаунта
    deleteAccount: 'Удалить аккаунт',
    deleteAccountTitle: 'Удалить аккаунт навсегда?',
    deleteAccountWarning: 'Удалится вход, никнейм и все ваши прогнозы. Очки исчезнут из рейтинга. Отменить это нельзя.',
    deleteAccountConfirmLabel: 'Введите свой никнейм для подтверждения',
    deleteAccountConfirmBtn: 'Удалить навсегда',
    deleteAccountCancel: 'Отмена',
    deleteAccountWorking: 'Удаляем…',
    deleteAccountDone: 'Аккаунт удален',
    deleteAccountFailed: 'Не удалось удалить аккаунт',
    deleteAccountMismatch: 'Никнейм не совпадает',

    // Всплеск подтверждения ставки
    betAccepted: 'Ставка принята!',
    betAcceptedSub: 'Удачи',

    // Onboarding Language Selector
    onboardingTitle: 'Добро пожаловать!',
    onboardingSubTitle: 'Прогнозы Лиги Чемпионов',
    onboardingDesc: 'Выберите предпочтительный язык для составления прогнозов и борьбы за лидерство в рейтинговой таблице!',
    onboardingBtnEn: 'English 🇬🇧',
    onboardingBtnRu: 'Русский 🇷🇺',

    // Dialog messages
    usernameUpdated: 'Имя пользователя обновлено!',
    errorUpdatingName: 'Ошибка при обновлении имени',
    predictionSaved: 'Прогноз сохранен!',
    forecastFailed: 'Не удалось сохранить прогноз',
    simulationNotice: 'Симуляция: завершен матч',
    allMatchesReset: 'Все матчи сброшены в состояние ПРЕДСТОЯЩИХ.',

    // Authentication Page
    loginTitle: 'Вход на Стадион',
    loginDesc: 'Присоединяйтесь к прогнозам ЛЧ! Введите уникальный никнейм для мгновенного входа или регистрации.',
    loginUsernamePlaceholder: 'Ваш Никнейм / Имя',
    loginRequired: 'Никнейм обязателен',
    loginTooShort: 'Никнейм должен быть не менее 2 символов',
    loginButton: 'Войти на Стадион',
    loggingIn: 'Вход в раздевалку стадиона...',
    loginError: 'Не удалось подключиться к базе данных ЧМ',
  }
};

/**
 * Get saved language from localStorage (defaults to null to trigger onboarding)
 */
export function getSavedLanguage(): Language | null {
  const lang = localStorage.getItem('fifa_app_lang');
  if (lang === 'en' || lang === 'ru') {
    return lang;
  }
  return null;
}

/**
 * Save language configuration
 */
export function saveLanguage(lang: Language): void {
  localStorage.setItem('fifa_app_lang', lang);
}
