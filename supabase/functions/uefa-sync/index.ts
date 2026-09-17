// Supabase Edge Function: uefa-sync
// SPDX-License-Identifier: Apache-2.0
//
// Keeps the `matches` table in step with the three UEFA club competitions and
// re-scores every prediction affected by a finished match.
//
// Replaces api-sports-sync, which was written for the World Cup: it matched
// fixtures by national-team NAME against a translation table. Here we pull the
// same ESPN scoreboards the app's dataset is generated from, so a fixture is
// matched by its ESPN event id — exact, no name mapping, no drift.
//
// Called by the `smart-night-football-sync` cron job every 10 minutes.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const COMPETITIONS = [
  { id: "UCL", slug: "uefa.champions" },
  { id: "UEL", slug: "uefa.europa" },
  { id: "UECL", slug: "uefa.europa.conf" },
];

// ESPN accepts `dates=YYYYMM` and answers with the whole month. A full-season
// range (`dates=A-B`) is rejected by this host, and the host that did accept it
// (site.api.espn.com) now answers 403 to everyone, so the sync walks months.
function monthsToSync(now: Date): string[] {
  const stamp = (d: Date) =>
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

  const current = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const months = [stamp(current), stamp(next)];

  // Early in a month, results from the tail of the previous one may still be
  // settling, so pick it up too.
  if (now.getUTCDate() <= 5) {
    months.unshift(stamp(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))));
  }
  return months;
}

// Every matchday is exactly 18 fixtures in one date cluster, so chunking the
// date-sorted list reproduces the official round numbering (ESPN exposes none).
const MATCHES_PER_MATCHDAY = 18;

// ESPN labels each fixture's stage in `season.slug`. Anything that is not the
// league phase is a knockout round and goes into the bracket buckets the app's
// Playoffs tab renders. Knockout fixtures are excluded from matchday counting,
// otherwise they would shift the league-phase round numbers.
const STAGE_BY_SLUG: Record<string, string | null> = {
  "league-phase": null,
  "knockout-round-playoffs": "1/16",
  "round-of-16": "1/8",
  "quarterfinals": "1/4",
  "semifinals": "1/2",
  "final": "Final",
};

function playoffGroupOf(event: any): string | null {
  const slug = event.season?.slug || "";
  if (slug in STAGE_BY_SLUG) return STAGE_BY_SLUG[slug];
  return slug ? slug : null;
}

// Club Brugge's ESPN crest is missing; patched here as well as in the dataset.
const LOGO_OVERRIDES: Record<string, string> = {
  BRU: "https://tmssl.akamaized.net/images/wappen/head/2282.png",
};

function normalizeStatus(espnStatusName: string): "pending" | "live" | "finished" {
  const name = (espnStatusName || "").toUpperCase();
  if (name.includes("FULL") || name.includes("FINAL") || name.includes("FINISHED")) {
    return "finished";
  }
  if (
    name.includes("PROGRESS") ||
    name.includes("HALF") ||
    name.includes("AET") ||
    name.includes("PEN") ||
    name.includes("SHOOTOUT")
  ) {
    return "live";
  }
  return "pending";
}

function teamCode(team: any): string {
  const raw = (team.abbreviation || "").trim();
  if (raw.length >= 2) return raw.toUpperCase();
  return (team.displayName || team.name || "UNK").substring(0, 3).toUpperCase();
}

function teamLogo(team: any): string {
  const code = teamCode(team);
  return LOGO_OVERRIDES[code] || team.logos?.[0]?.href || team.logo || "";
}

/**
 * Same scoring rules as the client: 5 for the exact score, 2 for the right
 * outcome. A negative predicted pair encodes a winner-only pick.
 */
function calculatePoints(
  predHome: number,
  predAway: number,
  actualHome: number,
  actualAway: number,
): number {
  const actualOutcome = Math.sign(actualHome - actualAway);

  if (predHome < 0 || predAway < 0) {
    let predOutcome = 0;
    if (predHome === -1 && predAway === -2) predOutcome = 1;
    else if (predHome === -2 && predAway === -1) predOutcome = -1;
    return predOutcome === actualOutcome ? 2 : 0;
  }

  if (predHome === actualHome && predAway === actualAway) return 5;
  if (Math.sign(predHome - predAway) === actualOutcome) return 2;
  return 0;
}

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer": "https://www.espn.com/",
  "Origin": "https://www.espn.com",
};

/**
 * ESPN blocks datacenter traffic on some of its hostnames, and site.api.espn.com
 * now answers 403 to everyone. Try the hosts in turn and use whichever answers,
 * so one of them going strict does not stop the sync.
 */
async function fetchEspnMonth(slug: string, month: string): Promise<any[]> {
  const hosts = [
    "https://site.web.api.espn.com",
    "https://site.api.espn.com",
  ];

  const failures: string[] = [];

  for (const host of hosts) {
    const url = `${host}/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${month}`;
    try {
      const res = await fetch(url, { headers: BROWSER_HEADERS });
      if (!res.ok) {
        failures.push(`${res.status} @ ${new URL(url).host}`);
        continue;
      }
      const json = await res.json();
      // An empty month is a valid answer, not a failure.
      return json.events || [];
    } catch (err) {
      failures.push(`${(err as Error).message} @ ${new URL(url).host}`);
    }
  }

  throw new Error(`${month}: ${failures.join(" | ")}`);
}

async function loadCompetition(comp: { id: string; slug: string }, months: string[]) {
  const events: any[] = [];
  for (const month of months) {
    events.push(...(await fetchEspnMonth(comp.slug, month)));
  }

  const rows = events.map((ev: any) => {
    const competition = ev.competitions?.[0];
    const home = competition?.competitors?.find((c: any) => c.homeAway === "home");
    const away = competition?.competitors?.find((c: any) => c.homeAway === "away");
    if (!home || !away) return null;

    const status = normalizeStatus(ev.status?.type?.name);
    const parseScore = (competitor: any) => {
      const n = parseInt(competitor.score, 10);
      return Number.isNaN(n) ? null : n;
    };

    // `matchday` is deliberately absent: a month slice cannot reproduce the
    // round numbering, and on conflict PostgREST only writes the columns sent,
    // so the value already stored survives. New knockout rows have none anyway.
    return {
      id: parseInt(ev.id, 10),
      competition: comp.id,
      group_name: playoffGroupOf(ev) ?? "League Phase",
      home_team: home.team.displayName || home.team.name,
      away_team: away.team.displayName || away.team.name,
      home_flag: teamLogo(home.team),
      away_flag: teamLogo(away.team),
      match_date: ev.date,
      status,
      // Keep scores null until the match is actually under way, so an unplayed
      // fixture never reads as a 0-0 draw.
      home_score: status === "pending" ? null : parseScore(home),
      away_score: status === "pending" ? null : parseScore(away),
    };
  }).filter(Boolean);

  // A month can be returned more than once across overlapping windows.
  const byId = new Map<number, any>();
  rows.forEach((r: any) => byId.set(r.id, r));
  return [...byId.values()];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceKey) {
      throw new Error("Missing Supabase environment configuration.");
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Pull all three competitions. One failing source must not take the
    //    other two down with it.
    const months = monthsToSync(new Date());
    const rows: any[] = [];
    const sourceErrors: string[] = [];

    for (const comp of COMPETITIONS) {
      try {
        rows.push(...(await loadCompetition(comp, months)));
      } catch (err) {
        console.error(`Failed to load ${comp.id}:`, (err as Error).message);
        sourceErrors.push(`${comp.id}: ${(err as Error).message}`);
      }
    }

    if (rows.length === 0) {
      throw new Error(`No fixtures fetched. ${sourceErrors.join("; ")}`);
    }

    // 2. Upsert fixtures and their current scores. This doubles as the seed:
    //    predictions carry a foreign key to matches, so the rows have to exist
    //    before anyone can place a forecast.
    const { error: upsertError } = await supabase
      .from("matches")
      .upsert(rows, { onConflict: "id" });

    if (upsertError) {
      throw new Error(`Failed to upsert matches: ${upsertError.message}`);
    }

    // 3. Re-score every prediction on a finished match. The results are read
    //    back from the database rather than from this run's slice, so a match
    //    settled in a month we no longer fetch still scores correctly.
    const { data: finishedRows, error: finishedError } = await supabase
      .from("matches")
      .select("id, home_score, away_score")
      .eq("status", "finished")
      .not("home_score", "is", null)
      .not("away_score", "is", null);

    if (finishedError) {
      throw new Error(`Failed to read finished matches: ${finishedError.message}`);
    }

    const finished = finishedRows || [];
    const resultById = new Map<number, { home: number; away: number }>();
    finished.forEach((m: any) => resultById.set(m.id, { home: m.home_score, away: m.away_score }));

    let rescored = 0;

    if (finished.length > 0) {
      const { data: predictions, error: predError } = await supabase
        .from("predictions")
        .select("*")
        .in("match_id", finished.map((m: any) => m.id));

      if (predError) {
        throw new Error(`Failed to read predictions: ${predError.message}`);
      }

      const changed = (predictions || [])
        .map((pred: any) => {
          const result = resultById.get(pred.match_id);
          if (!result) return null;

          const points = calculatePoints(
            pred.predicted_home,
            pred.predicted_away,
            result.home,
            result.away,
          );
          if (points === (pred.points_earned ?? 0)) return null;

          return { ...pred, points_earned: points };
        })
        .filter(Boolean);

      if (changed.length > 0) {
        const { error: predUpsertError } = await supabase
          .from("predictions")
          .upsert(changed, { onConflict: "user_id,match_id" });

        if (predUpsertError) {
          throw new Error(`Failed to write prediction points: ${predUpsertError.message}`);
        }
        rescored = changed.length;
      }
    }

    // 4. Rebuild the shared leaderboard totals from the predictions table.
    const { data: allPredictions, error: sumError } = await supabase
      .from("predictions")
      .select("user_id, points_earned");

    if (sumError) {
      throw new Error(`Failed to aggregate predictions: ${sumError.message}`);
    }

    const totals: Record<string, { total_points: number; exact_guesses: number }> = {};
    for (const p of allPredictions || []) {
      if (!totals[p.user_id]) totals[p.user_id] = { total_points: 0, exact_guesses: 0 };
      const points = p.points_earned || 0;
      totals[p.user_id].total_points += points;
      if (points === 5) totals[p.user_id].exact_guesses += 1;
    }

    for (const [userId, stats] of Object.entries(totals)) {
      const { error: profileError } = await supabase
        .from("profiles")
        .update(stats)
        .eq("id", userId);

      if (profileError) {
        console.error(`Could not update profile ${userId}:`, profileError.message);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        months,
        fixtures: rows.length,
        finished: finished.length,
        rescoredPredictions: rescored,
        profilesUpdated: Object.keys(totals).length,
        sourceErrors,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("uefa-sync failed:", (error as Error).message);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
