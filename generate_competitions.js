/**
 * Regenerates src/data.ts for all three UEFA club competitions (league phase, season 2026/27).
 *
 * Source: public ESPN site API — same one the original single-competition
 * generator used, just iterated over three league slugs.
 *
 * Run with:  node generate_competitions.js
 */
import fs from 'fs';

// ESPN rejects a full-season date range and answers `dates=YYYYMM` with the
// whole month, so the season is walked month by month.
const SEASON_MONTHS = [
  '202609', '202610', '202611', '202612',
  '202701', '202702', '202703', '202704', '202705', '202706',
];

// site.api.espn.com started answering 403 to every caller; this host still
// serves the same payload. Kept as a list so a future switch is one line.
const ESPN_HOSTS = [
  'https://site.web.api.espn.com',
  'https://site.api.espn.com',
];

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://www.espn.com/',
};

// Expected shape of a league phase. A run that falls short of this is treated
// as a bad source rather than written over a good dataset.
const MIN_TEAMS_PER_COMPETITION = 30;
const MIN_LEAGUE_FIXTURES = { UCL: 144, UEL: 144, UECL: 108 };

const COMPETITIONS = [
  {
    id: 'UCL',
    slug: 'uefa.champions',
    matchdays: 8,
    name: { en: 'UEFA Champions League', ru: 'Лига чемпионов УЕФА' },
    short: { en: 'UCL', ru: 'ЛЧ' },
    accent: '#00E676',
  },
  {
    id: 'UEL',
    slug: 'uefa.europa',
    matchdays: 8,
    name: { en: 'UEFA Europa League', ru: 'Лига Европы УЕФА' },
    short: { en: 'UEL', ru: 'ЛЕ' },
    accent: '#FF9100',
  },
  {
    id: 'UECL',
    slug: 'uefa.europa.conf',
    matchdays: 6,
    name: { en: 'UEFA Conference League', ru: 'Лига конференций УЕФА' },
    short: { en: 'UECL', ru: 'ЛК' },
    accent: '#26C6DA',
  },
];

// Teams whose ESPN logo is missing or broken — patched at the source instead of
// being fixed up at runtime in App.tsx.
const LOGO_OVERRIDES = {
  BRU: 'https://tmssl.akamaized.net/images/wappen/head/2282.png',
};

const MATCHES_PER_MATCHDAY = 18;

// ESPN labels each fixture's stage in `season.slug`. Everything other than the
// league phase is a knockout round and maps onto the bracket buckets the app's
// Playoffs tab already renders. UEFA club competitions have no third-place
// match, so that bucket stays unused.
const STAGE_BY_SLUG = {
  'league-phase': null,
  'knockout-round-playoffs': '1/16',
  'round-of-16': '1/8',
  'quarterfinals': '1/4',
  'semifinals': '1/2',
  'final': 'Final',
};

function playoffGroupOf(event) {
  const slug = event.season?.slug || '';
  if (slug in STAGE_BY_SLUG) return STAGE_BY_SLUG[slug];
  // Unknown stage: keep it out of the league table rather than guessing.
  return slug ? slug : null;
}

function normalizeStatus(espnStatusName) {
  if (espnStatusName === 'STATUS_FULL_TIME') return 'FINISHED';
  if (
    [
      'STATUS_FIRST_HALF',
      'STATUS_SECOND_HALF',
      'STATUS_HALFTIME',
      'STATUS_IN_PROGRESS',
      'STATUS_EXTRA_TIME',
      'STATUS_SHOOTOUT',
    ].includes(espnStatusName)
  ) {
    return 'LIVE';
  }
  return 'PENDING';
}

function abbrOf(team) {
  const raw = (team.abbreviation || '').trim();
  if (raw.length >= 2) return raw.toUpperCase();
  return (team.displayName || team.name || 'UNK').substring(0, 3).toUpperCase();
}

async function fetchMonth(slug, month) {
  const failures = [];
  for (const host of ESPN_HOSTS) {
    const url = `${host}/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${month}`;
    try {
      const res = await fetch(url, { headers: BROWSER_HEADERS });
      if (!res.ok) {
        failures.push(`${res.status} @ ${new URL(url).host}`);
        continue;
      }
      const data = await res.json();
      return data.events || [];
    } catch (err) {
      failures.push(`${err.message} @ ${new URL(url).host}`);
    }
  }
  throw new Error(`${month}: ${failures.join(' | ')}`);
}

async function loadCompetition(comp) {
  const collected = new Map();
  for (const month of SEASON_MONTHS) {
    for (const ev of await fetchMonth(comp.slug, month)) {
      collected.set(ev.id, ev);
    }
  }

  const events = [...collected.values()].sort((a, b) => new Date(a.date) - new Date(b.date));

  const teams = {};
  const matches = [];
  // ESPN abbreviation -> namespaced team id, so two clubs sharing an
  // abbreviation inside one competition never collapse into one entry.
  const abbrToId = new Map();

  // Counts only league-phase fixtures, so matchday numbering survives the
  // arrival of the knockout rounds.
  let leaguePhaseIndex = 0;

  const registerTeam = (espnTeam) => {
    const existing = abbrToId.get(espnTeam.id);
    if (existing) return existing;

    let code = abbrOf(espnTeam);
    let id = `${comp.id}:${code}`;
    let suffix = 2;
    while (teams[id] && teams[id].espnId !== espnTeam.id) {
      id = `${comp.id}:${code}${suffix}`;
      suffix += 1;
    }

    teams[id] = {
      espnId: espnTeam.id,
      name: espnTeam.displayName || espnTeam.name,
      code,
      flag: LOGO_OVERRIDES[code] || espnTeam.logos?.[0]?.href || espnTeam.logo || '',
      competition: comp.id,
    };
    abbrToId.set(espnTeam.id, id);
    return id;
  };

  events.forEach((ev) => {
    const competition = ev.competitions[0];
    const home = competition.competitors.find((c) => c.homeAway === 'home');
    const away = competition.competitors.find((c) => c.homeAway === 'away');
    if (!home || !away) return;

    const homeId = registerTeam(home.team);
    const awayId = registerTeam(away.team);

    const parseScore = (competitor) => {
      const n = parseInt(competitor.score, 10);
      return Number.isNaN(n) ? null : n;
    };

    // ESPN exposes no matchday field for the league phase. Every matchday is
    // exactly 18 fixtures played in one date cluster, so chunking the
    // date-sorted list reproduces the official round numbering. Knockout
    // fixtures must not take part in that count, or they shift every round.
    const group = playoffGroupOf(ev);
    let matchday = null;
    if (group === null) {
      matchday = Math.floor(leaguePhaseIndex / MATCHES_PER_MATCHDAY) + 1;
      leaguePhaseIndex += 1;
    }

    matches.push({
      id: ev.id,
      competition: comp.id,
      matchday,
      group,
      date: ev.date,
      homeId,
      awayId,
      homeScore: parseScore(home),
      awayScore: parseScore(away),
      stadium: competition.venue?.fullName || 'Stadium',
      status: normalizeStatus(ev.status.type.name),
    });
  });

  return { teams, matches };
}

function serializeTeams(teams) {
  const entries = Object.entries(teams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([id, t]) =>
        `  ${JSON.stringify(id)}: { name: ${JSON.stringify(t.name)}, code: ${JSON.stringify(
          t.code
        )}, flag: ${JSON.stringify(t.flag)}, competition: ${JSON.stringify(t.competition)} },`
    );
  return entries.join('\n');
}

function serializeMatches(matches) {
  return matches
    .map(
      (m) =>
        `  [${JSON.stringify(m.id)}, ${JSON.stringify(m.competition)}, ${m.matchday}, ${JSON.stringify(
          m.group
        )}, ${JSON.stringify(m.date)}, ${JSON.stringify(m.homeId)}, ${JSON.stringify(m.awayId)}, ${
          m.homeScore
        }, ${m.awayScore}, ${JSON.stringify(m.stadium)}, ${JSON.stringify(m.status)}],`
    )
    .join('\n');
}

async function run() {
  const allTeams = {};
  const allMatches = [];

  for (const comp of COMPETITIONS) {
    const { teams, matches } = await loadCompetition(comp);

    // Guard against a degraded source silently replacing a good dataset:
    // better to fail loudly than to publish half a season.
    const leagueFixtures = matches.filter((m) => !m.group).length;
    if (Object.keys(teams).length < MIN_TEAMS_PER_COMPETITION) {
      throw new Error(
        `${comp.id}: only ${Object.keys(teams).length} teams, expected at least ${MIN_TEAMS_PER_COMPETITION}. Refusing to write.`
      );
    }
    if (leagueFixtures < MIN_LEAGUE_FIXTURES[comp.id]) {
      throw new Error(
        `${comp.id}: only ${leagueFixtures} league-phase fixtures, expected ${MIN_LEAGUE_FIXTURES[comp.id]}. Refusing to write.`
      );
    }

    Object.assign(allTeams, teams);
    allMatches.push(...matches);
    const finished = matches.filter((m) => m.status === 'FINISHED').length;
    console.log(
      `${comp.id}: ${Object.keys(teams).length} teams, ${matches.length} matches ` +
        `(${finished} finished), league matchdays 1..${Math.max(
          ...matches.filter((m) => m.matchday).map((m) => m.matchday)
        )}, knockout fixtures ${matches.filter((m) => m.group).length}`
    );
  }

  const competitionsLiteral = COMPETITIONS.map(
    (c) =>
      `  { id: '${c.id}', slug: ${JSON.stringify(c.slug)}, matchdays: ${c.matchdays}, ` +
      `name: { en: ${JSON.stringify(c.name.en)}, ru: ${JSON.stringify(c.name.ru)} }, ` +
      `short: { en: ${JSON.stringify(c.short.en)}, ru: ${JSON.stringify(c.short.ru)} }, ` +
      `accent: ${JSON.stringify(c.accent)} },`
  ).join('\n');

  const out = `/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GENERATED FILE — do not edit by hand.
 * Regenerate with: node generate_competitions.js
 */

export type CompetitionId = ${COMPETITIONS.map((c) => `'${c.id}'`).join(' | ')};

export interface CompetitionMeta {
  id: CompetitionId;
  slug: string;
  matchdays: number;
  name: { en: string; ru: string };
  short: { en: string; ru: string };
  accent: string;
}

export const COMPETITIONS: CompetitionMeta[] = [
${competitionsLiteral}
];

export const DEFAULT_COMPETITION: CompetitionId = '${COMPETITIONS[0].id}';

export function getCompetition(id: string): CompetitionMeta {
  return COMPETITIONS.find(c => c.id === id) || COMPETITIONS[0];
}

export interface TeamEntry {
  name: string;
  code: string;
  flag: string;
  competition: CompetitionId;
}

/** Team ids are namespaced by competition ("UCL:ARS"), because the same club
 *  abbreviation can appear in more than one tournament. */
export const TEAMS: { [id: string]: TeamEntry } = {
${serializeTeams(allTeams)}
};

type RawMatch = [
  id: string,
  competition: CompetitionId,
  /** League-phase round, or null for a knockout fixture. */
  matchday: number | null,
  /** Knockout bucket ('1/16', '1/8', '1/4', '1/2', 'Final'), or null in the league phase. */
  group: string | null,
  date: string,
  homeId: string,
  awayId: string,
  homeScore: number | null,
  awayScore: number | null,
  stadium: string,
  status: 'PENDING' | 'LIVE' | 'FINISHED'
];

const RAW_MATCHES: RawMatch[] = [
${serializeMatches(allMatches)}
];

const teamRef = (id: string) => ({ id, ...TEAMS[id] });

export const INITIAL_MATCHES: any[] = RAW_MATCHES.map(
  ([id, competition, matchday, group, date, homeId, awayId, homeScore, awayScore, stadium, status]) => ({
    id,
    competition,
    matchday,
    group,
    match_date: date,
    stage: group ? 'Knockout' : 'League Phase',
    homeTeam: teamRef(homeId),
    awayTeam: teamRef(awayId),
    homeScore,
    awayScore,
    stadium,
    status,
  })
);

export interface Group {
  id: string;
  name: string;
  competition: CompetitionId;
  teams: any[];
  color: string;
  borderColor: string;
  glowColor: string;
  standings: any[];
}

const emptyStanding = (teamId: string) => ({
  teamId, played: 0, won: 0, drawn: 0, lost: 0,
  goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0, form: []
});

/** One league-phase table per competition. */
export const INITIAL_GROUPS: Group[] = COMPETITIONS.map(comp => {
  const teamIds = Object.keys(TEAMS).filter(key => TEAMS[key].competition === comp.id);
  return {
    id: \`LEAGUE_\${comp.id}\`,
    name: comp.name.en,
    competition: comp.id,
    color: comp.accent,
    borderColor: 'border-blue-500/80',
    glowColor: 'shadow-[0_0_15px_rgba(14,165,233,0.35)]',
    teams: teamIds.map(key => ({ id: key, ...TEAMS[key] })),
    standings: teamIds.map(emptyStanding),
  };
});

export const MOCK_LEADERBOARD: any[] = [
  { id: '1', display_name: 'Alex D.', username: 'alex_d', avatar_url: '', total_points: 1250, exact_guesses: 42 },
  { id: '2', display_name: 'Sarah M.', username: 'sarah_m', avatar_url: '', total_points: 1180, exact_guesses: 38 },
  { id: '3', display_name: 'John K.', username: 'johnk99', avatar_url: '', total_points: 1050, exact_guesses: 31 },
  { id: '4', display_name: 'Maria G.', username: 'maria_g', avatar_url: '', total_points: 980, exact_guesses: 29 },
  { id: '5', display_name: 'David L.', username: 'david_l', avatar_url: '', total_points: 920, exact_guesses: 25 },
];
`;

  fs.writeFileSync('src/data.ts', out);
  console.log(
    `\nWrote src/data.ts — ${Object.keys(allTeams).length} teams, ${allMatches.length} matches across ${COMPETITIONS.length} competitions.`
  );
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
