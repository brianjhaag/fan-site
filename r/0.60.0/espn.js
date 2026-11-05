// Layer 1's data: the games, scores, venues, forecasts and team stats, pulled by this browser from ESPN's public addresses. Nothing like it ships with the page: the user sees their own data (CLAUDE.md).
// It runs before the rest of the page. Each browser keeps what it pulled in localStorage, so a finished week is asked for once, and a problem falls back on the last copy.
// A 429 or 5xx stops further pulls until the page is reloaded: never a retry loop (CLAUDE.md rule 7).
import { SHARED } from "./shared.js?v=mw46i2a7";
import { LEAGUE_DEFS, leagueCodes, teamName } from "./leagues.js?v=mw46i2a7";
const SITE = "https://site.api.espn.com/apis/site/v2/sports";
const NEUTRAL_LINE = () => ({ sp: 0, spj: [-110, -110], tot: 45, toj: [-110, -110], ml: [-110, -110] });   // what a game holds before the user's own prices: never shown
const STALE_MS = 6 * 3600e3, TEAMS_MS = 24 * 3600e3, WEEK8 = SHARED.season.week8, NFL_WEEKS = 18;
let stopped = false;
let pullAt = 0, pullFailed = "";
async function getJson(url) {
  if (stopped) throw new Error("ESPN pulls stopped");
  let r;
  try { r = await fetch(url, { signal: AbortSignal.timeout(30000) }); } catch (e) { pullFailed = "Couldn't reach ESPN"; throw e; }
  if (r.status === 429 || r.status >= 500) stopped = true;
  if (!r.ok) { pullFailed = "ESPN answered " + r.status; throw new Error(pullFailed); }
  pullAt = Date.now(); pullFailed = "";
  return r.json();
}
const keptPull = key => { try { return JSON.parse(localStorage.getItem("fan.espn." + key)); } catch (e) { return null; } };
const keepPull = (key, data) => { try { localStorage.setItem("fan.espn." + key, JSON.stringify({ at: Date.now(), data })); } catch (e) {} };

// A kickoff as Eastern local time with its offset. A saved ticket's key holds this text.
const etFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "shortOffset" });
function etIso(utc) {
  const p = Object.fromEntries(etFmt.formatToParts(new Date(utc)).map(x => [x.type, x.value]));
  const off = p.timeZoneName.replace("GMT", ""), sign = off[0], h = off.slice(1).padStart(2, "0");
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}${sign}${h}:00`;
}
const tvName = n => ({ "NFL Net": "NFL Network", "NHL Net": "NHL Network" }[n] || n);
const sides = c => [c.competitors.find(x => x.homeAway === "away"), c.competitors.find(x => x.homeAway === "home")];

// A game's venue and forecast, as each pulled row keeps them (r.env, a list): its slots by name. The forecast and the stadium's and city's names are ESPN's text, so they're only ever shown as text.
const VENUE = { stadium: 0, city: 1, indoor: 2, forecast: 3, temperature: 4, condition: 5 };

// One NFL scoreboard event as a row: what the cards, game details and team schedules need.
function nflRow(e) {
  const c = e.competitions[0], [A, H] = sides(c), v = c.venue || {}, a = v.address || {}, wx = e.weather || c.weather || null, finished = !!e.status.type.completed, ms = Date.parse(e.date);
  return {
    ms, eid: e.id, t: etIso(e.date), away: A.team.displayName, home: H.team.displayName, aa: A.team.abbreviation, ha: H.team.abbreviation,
    tv: [...new Set((c.broadcasts || []).flatMap(b => b.names))].map(tvName).join(" / "),
    final: finished ? [Number(A.score), Number(H.score)] : null, now: e.status.type.state === "in" ? { score: [Number(A.score), Number(H.score)], clock: e.status.type.shortDetail || "" } : null, note: c.neutralSite && a.city ? a.city : "",
    env: [v.fullName || "", [a.city, a.state || a.country].filter(Boolean).join(", "), v.indoor ? 1 : 0, wx ? wx.displayValue : "", wx && typeof wx.temperature === "number" ? wx.temperature : null, wx ? String(wx.conditionId || "") : ""]
  };
}
const gameOfRow = r => ({ eid: r.eid, t: r.t, away: r.away, home: r.home, tv: r.tv, ...(r.note ? { note: r.note } : {}), ...(r.final ? { final: r.final } : { noLine: true }), ...(r.now ? { now: r.now } : {}), line: NEUTRAL_LINE() });
const lastName = n => n.split(" ").pop();
const envKey = (w, r) => `${w}|${lastName(r.away)}|${lastName(r.home)}`;
const pullWeek = async w => {
  const rows = ((await getJson(`${SITE}/football/nfl/scoreboard?seasontype=2&week=${w}&dates=${SHARED.season.year}`)).events || []).map(nflRow).sort((p, q) => p.ms - q.ms);
  keepPull("nfl" + w, rows);
  return rows;
};

const WEEK_GAMES = {}, GAME_VENUES = {}, TEAM_INFO = {}, nflRows = {};
let pullProblem = "", onRefresh = () => {};
const setRefresh = fn => { onRefresh = fn; };
// The leagues that are on (base.js setLeagueOn): the minute's scores are read for theirs alone, so a league turned off stops being asked for at once, not at the next load.
let scoresFor = new Set(["nfl"]);
const wantScores = list => { scoresFor = new Set(list); };
const pullStatus = () => pullProblem;
const espnState = () => ({ at: pullAt, problem: pullFailed || pullProblem });   // for the status indicators

// Blocks the page only for a week this browser has never seen.
for (let w = 1; w <= NFL_WEEKS; w++) {
  const had = keptPull("nfl" + w);
  let rows = had && had.data;
  if (!rows) { try { rows = await pullWeek(w); } catch (e) { pullProblem = "Couldn't reach ESPN for the schedule."; rows = []; } }
  nflRows[w] = rows;
  if (rows.length) WEEK_GAMES[w] = rows.map(gameOfRow);
  rows.forEach(r => { GAME_VENUES[envKey(w, r)] = r.env; });
}
// A fresh read of one week onto the games on the page. A moved kickoff waits for the next load, since tickets are matched to it then.
async function refreshWeek(w) {
  const rows = await pullWeek(w), list = WEEK_GAMES[w] || [];
  nflRows[w] = rows;
  rows.forEach(r => {
    GAME_VENUES[envKey(w, r)] = r.env;
    const g = list.find(x => x.away === r.away && x.home === r.home);
    if (!g) return;
    g.eid = r.eid;
    g.tv = r.tv;
    if (r.final) g.final = r.final;
    if (r.now) g.now = r.now; else delete g.now;
  });
}
const espnWeek = () => 8 + Math.floor((Date.now() - WEEK8) / (7 * 864e5));
async function refreshStale() {
  const now = espnWeek(), due = [];
  for (let w = 1; w <= NFL_WEEKS; w++) {
    const had = keptPull("nfl" + w), rows = nflRows[w] || [];
    if (!had || w === now || w === now + 1 || rows.some(r => !r.eid) || (!rows.every(r => r.final) && Date.now() - had.at > STALE_MS)) due.push(w);   // a week kept before rows had ESPN's id is asked for once more
  }
  try { for (const w of due) await refreshWeek(w); onRefresh(); } catch (e) {}
}
setTimeout(refreshStale, 2000);
// Every 10 minutes, or every minute [C] while a game is on and this tab is showing.
let lastWeekPull = 0;
const gameOn = w => (nflRows[w] || []).some(r => r.now || (!r.final && Date.now() >= r.ms && Date.now() - r.ms < 5 * 3600e3));
setInterval(() => {
  const w = espnWeek();
  if (w < 1 || w > NFL_WEEKS || document.hidden || !scoresFor.has("nfl")) return;
  if (!gameOn(w) && Date.now() - lastWeekPull < 10 * 60e3) return;
  lastWeekPull = Date.now();
  refreshWeek(w).then(() => onRefresh(), () => {});
}, 60e3);

// Team stats and injuries, for a game detail: standings, one request a team and one large injury report, asked for only when one opens, at most once a day.
let teamsPull = null;
function ensureTeams() {
  const had = keptPull("teams");
  if (had && !Object.keys(TEAM_INFO).length) Object.assign(TEAM_INFO, had.data);
  if (Object.keys(TEAM_INFO).length && Date.now() - (had ? had.at : 0) < TEAMS_MS) return Promise.resolve(true);
  return teamsPull = teamsPull || pullTeams().then(() => true, () => Object.keys(TEAM_INFO).length > 0).finally(() => { teamsPull = null; });
}
const round1 = x => (x === null ? null : Math.round(x * 10) / 10);
const statOf = (statGroups, category, name) => { const c = statGroups.find(x => x.name === category), s = c && c.stats.find(x => x.name === name); return s && typeof s.value === "number" ? s.value : null; };
const SEVERITY = { Out: 0, Doubtful: 1, Questionable: 2, "Day-To-Day": 2, "Injured Reserve": 3 };   // Day-To-Day is the NBA's and the NHL's
function injuryList(report) {
  const by = {};
  report.injuries.forEach(t => {
    const list = t.injuries.filter(i => i.status in SEVERITY).sort((p, q) => SEVERITY[p.status] - SEVERITY[q.status]);
    by[t.id] = { ir: t.injuries.filter(i => i.status === "Injured Reserve").length, more: Math.max(0, list.length - 7), list: list.slice(0, 40).map(i => { const positionCode = (i.athlete.position && i.athlete.position.abbreviation) || ""; return [i.athlete.displayName, positionCode, i.status, (i.details && i.details.type) || (i.type && i.type.description) || "", positionCode === "QB" ? 1 : 0]; }).sort((p, q) => SEVERITY[p[2]] - SEVERITY[q[2]] || q[4] - p[4]) };
  });
  return by;
}
// The whole schedule: [week, opponent, home?, points for, points against], scores null until played; weeks missing from it are byes.
function teamSchedule(code) {
  const out = [];
  Object.entries(nflRows).forEach(([w, rows]) => rows.forEach(r => {
    const home = r.ha === code;
    if (!home && r.aa !== code) return;
    out.push([Number(w), home ? r.aa : r.ha, home ? 1 : 0, r.final ? r.final[home ? 1 : 0] : null, r.final ? r.final[home ? 0 : 1] : null]);
  }));
  return out.sort((p, q) => p[0] - q[0]);
}
const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");
// ESPN's plain team address refuses browsers; standings, statistics and injuries answer. Standings gives every team in one request.
async function pullTeams() {
  const standings = await getJson(`https://site.api.espn.com/apis/v2/sports/football/nfl/standings?level=3&season=${SHARED.season.year}&seasontype=2`), injuries = injuryList(await getJson(`${SITE}/football/nfl/injuries`)), out = {};
  for (const conference of standings.children) for (const div of conference.children) for (const [i, row] of div.standings.entries.entries()) {
    const t = row.team, st = await getJson(`${SITE}/football/nfl/teams/${t.id}/statistics`), stat = n => row.stats.find(x => x.name === n) || {}, streak = String(stat("streak").displayValue || "");
    const statGroups = st.results.stats.categories, inj = injuries[t.id] || { list: [] }, sch = teamSchedule(t.abbreviation);
    out[t.name] = {
      "abbr": t.abbreviation, r: stat("overall").summary, h: stat("Home").summary, a: stat("Road").summary, stand: `${ordinal(i + 1)} in ${div.name}`, streak: (streak[0] === "L" ? -1 : 1) * (Number(streak.slice(1)) || 0),
      gp: statOf(statGroups, "passing", "teamGamesPlayed"), pf: stat("pointsFor").value ?? null, pa: stat("pointsAgainst").value ?? null, ypg: round1(statOf(statGroups, "passing", "yardsPerGame")), pass: round1(statOf(statGroups, "passing", "netPassingYardsPerGame")), rush: round1(statOf(statGroups, "rushing", "rushingYardsPerGame")),
      qbr: round1(statOf(statGroups, "passing", "QBRating")), td3: round1(statOf(statGroups, "miscellaneous", "thirdDownConvPct")), rz: round1(statOf(statGroups, "miscellaneous", "redzoneTouchdownPct")), tk: statOf(statGroups, "miscellaneous", "totalTakeaways"), gv: statOf(statGroups, "miscellaneous", "totalGiveaways"),
      skt: statOf(statGroups, "passing", "sacks"), sk: statOf(statGroups, "defensive", "sacks"), pen: statOf(statGroups, "miscellaneous", "totalPenaltyYards"), sch, res: sch.filter(x => x[3] !== null), inj: inj.list, injMore: inj.more || 0, ir: inj.ir || 0
    };
  }
  Object.assign(TEAM_INFO, out);
  keepPull("teams", out);
}

// A daily league's team stats and injuries, for its game preview, by Kalshi's code: standings, one injury report and one request a team, asked for only when one opens, at most once a day.
const DAILY_TEAMS = { nba: {}, nhl: {} }, dailyTeamsPull = {};
const DAILY_STATS = {
  nba: { ppg: ["offensive", "avgPoints"], fg: ["offensive", "fieldGoalPct"], tp: ["offensive", "threePointPct"], tpm: ["offensive", "avgThreePointFieldGoalsMade"], ft: ["offensive", "freeThrowPct"], reb: ["general", "avgRebounds"], ast: ["offensive", "avgAssists"], tov: ["offensive", "avgTurnovers"], stl: ["defensive", "avgSteals"], blk: ["defensive", "avgBlocks"] },
  nhl: { sgp: ["general", "games"], shots: ["offensive", "shotsTotal"], sa: ["defensive", "shotsAgainst"], shp: ["offensive", "shootingPct"], svp: ["defensive", "savePct"], ppg: ["offensive", "powerPlayGoals"], fo: ["offensive", "faceoffPercent"], pim: ["penalties", "penaltyMinutes"] }
};
function ensureDailyTeams(l) {
  const had = keptPull("teams-" + l), have = DAILY_TEAMS[l] || (DAILY_TEAMS[l] = {});
  if (had && !Object.keys(have).length) Object.assign(have, had.data);
  if (Object.keys(have).length && Date.now() - (had ? had.at : 0) < TEAMS_MS) return Promise.resolve(true);
  return dailyTeamsPull[l] = dailyTeamsPull[l] || pullDailyTeams(l).then(() => true, () => Object.keys(have).length > 0).finally(() => { dailyTeamsPull[l] = null; });
}
async function pullDailyTeams(l) {
  const def = LEAGUE_DEFS[l], code = a => def.espnCodes[a] || a, codes = leagueCodes(l), out = {};
  const standings = await getJson(`https://site.api.espn.com/apis/v2/sports/${def.espn}/standings`), report = await getJson(`${SITE}/${def.espn}/injuries`), inj = {};
  report.injuries.forEach(t => { inj[t.id] = t.injuries.filter(i => i.status in SEVERITY).sort((p, q) => SEVERITY[p.status] - SEVERITY[q.status]).slice(0, 30).map(i => { const positionCode = (i.athlete.position && i.athlete.position.abbreviation) || ""; return [i.athlete.displayName, positionCode, i.status, (i.details && i.details.type) || "", l === "nhl" && positionCode === "G" ? 1 : 0]; }); });
  // the teams' statistics four at a time, so the first preview doesn't wait on 32 requests in a row
  const rows = standings.children.flatMap(conference => conference.standings.entries.map((row, i) => [conference, row, i])).filter(([, row]) => codes.has(code(row.team.abbreviation))), stats = {};
  for (let k = 0; k < rows.length; k += 4) await Promise.all(rows.slice(k, k + 4).map(([, row]) => { const c = code(row.team.abbreviation); return (stats[c] = getJson(`${SITE}/${def.espn}/teams/${row.team.id}/statistics`)); }));
  for (const [conference, row, i] of rows) {
    const t = row.team, c = code(t.abbreviation);
    const stat = n => row.stats.find(x => x.name === n) || {}, streak = String(stat("streak").displayValue || "");
    const statGroups = (await stats[c]).results.stats.categories, st = {};
    Object.entries(DAILY_STATS[l]).forEach(([k, [category, name]]) => { st[k] = statOf(statGroups, category, name); });
    out[c] = {
      called: t.name, r: stat("overall").summary, h: stat("Home").summary, a: stat("Road").summary, l10: stat("Last Ten Games").summary || "", stand: `${ordinal(stat("playoffSeed").value || i + 1)} in the ${conference.abbreviation || conference.name}`, streak: (streak[0] === "L" ? -1 : 1) * (Number(streak.slice(1)) || 0),
      gp: (stat("wins").value || 0) + (stat("losses").value || 0) + (stat("otLosses").value || 0), pf: stat("pointsFor").value ?? null, pa: stat("pointsAgainst").value ?? null, standPts: l === "nhl" ? stat("points").value ?? null : null, ...st, inj: inj[t.id] || []
    };
  }
  Object.assign(DAILY_TEAMS[l], out);
  keepPull("teams-" + l, out);
}

// A daily league's games (the NBA, the NHL), only once it's on: one Eastern day a slate, from its season's start through its last day tab, each day kept so a finished one is asked for once.
// Codes are Kalshi's, because its tickers end in them (leagues.js's espnCodes); a game with a team not in the league's table, an exhibition or an All-Star game, is left out. Every network ESPN names, as for the NFL.
const ymd = ms => new Date(ms).toISOString().slice(0, 10).replace(/-/g, "");
// One day's scoreboard of a daily league, as rows. As for the NFL, a game under way carries its score and clock, and a finished one its final score (Nov 2 2026).
async function dayGames(l, date) {
  const def = LEAGUE_DEFS[l], codes = leagueCodes(l), code = x => def.espnCodes[x.abbreviation] || x.abbreviation;
  return ((await getJson(`${SITE}/${def.espn}/scoreboard?dates=${date}&limit=40`)).events || []).map(e => ({ e, c: e.competitions && e.competitions[0] })).filter(({ c }) => c && c.competitors.every(x => codes.has(code(x.team)))).map(({ e, c }) => {
    const [A, H] = sides(c), score = [Number(A.score), Number(H.score)], v = c.venue || {}, at = v.address || {};
    return { eid: e.id, t: etIso(e.date), a: code(A.team), h: code(H.team), tv: [...new Set((c.broadcasts || []).flatMap(b => b.names || []))].map(tvName).join(" / "), venue: [v.fullName || "", [at.city, at.state || at.country].filter(Boolean).join(", ")], final: e.status.type.completed ? score : null, now: e.status.type.state === "in" ? { score, clock: e.status.type.shortDetail || "" } : null };
  });
}
async function pullDaily(l) {
  const def = LEAGUE_DEFS[l];
  const rows = [], today = Math.floor(Date.now() / 864e5) * 864e5;
  for (let d = def.start; d <= today + def.days * 864e5; d += 864e5) {
    const key = l + ymd(d), had = keptPull(key);
    let day = had && had.data.every(r => r.eid) && (d < today - 864e5 && had.at > d + 2 * 864e5 || d === today - 864e5 && had.data.every(r => r.final) || d >= today && Date.now() - had.at < TEAMS_MS) ? had.data : null;   // yesterday's tab is read again until every game on it is final   // a day kept before rows had ESPN's id, and so their scores, is asked for once more
    if (!day) {
      try { day = await dayGames(l, ymd(d)); keepPull(key, day); } catch (e) { day = had ? had.data : []; }
    }
    rows.push(...day);
  }
  return rows;
}
// A daily league's live scores (the user asked, Nov 2 2026): every minute [C] while one of its games is on and this tab is showing, the Eastern day's scoreboard, and the day before's
// until 6 AM, onto the games on the page. A league that's off has no games here, so it's never asked for.
const dailyGames = l => Object.values(WEEK_GAMES).flat().filter(g => g.league === l);
const dailyOn = g => !g.final && (!!g.now || (Date.now() >= Date.parse(g.t) && Date.now() - Date.parse(g.t) < 5 * 3600e3));
const easternDay = ms => etIso(ms).slice(0, 10).replace(/-/g, "");
async function refreshDaily(l) {
  const games = dailyGames(l);
  for (const date of new Set([easternDay(Date.now() - 6 * 3600e3), easternDay(Date.now())])) {
    (await dayGames(l, date)).forEach(r => {
      const g = games.find(x => (x.eid && x.eid === r.eid) || (x.t === r.t && x.away === teamName(l, r.a) && x.home === teamName(l, r.h)));
      if (!g) return;
      g.eid = r.eid;
      if (r.final) { g.final = r.final; delete g.now; } else if (r.now) g.now = r.now; else delete g.now;
    });
  }
}
setInterval(() => {
  if (document.hidden) return;
  for (const l of scoresFor) if (l !== "nfl" && dailyGames(l).some(dailyOn)) refreshDaily(l).then(() => onRefresh(), () => {});
}, 60e3);

// Past seasons, for Season stats (the user, Nov 4 2026): the finals of the last five complete regular seasons, this browser's own pull, asked for once and kept, since a finished season doesn't change.
// The NFL from nflverse's public games table, one file (the same table Playbook reads); the NBA and the NHL from ESPN's team schedules, one request a team a season, two at a time (gentle on a free address), each game kept once.
// No bulk file for those two answers a browser: the NHL's own stats address refuses one, and the NBA has none.
const PAST_N = 5, PAST = {}, pastPulls = {};
let onPast = () => {};
const setPastRefresh = fn => { onPast = fn; };
// The seasons, by the year ESPN names them: the NFL's by its fall, the NBA's and the NHL's by the spring they end in (2025–26 is 2026), so the season under way is SHARED.season.year + 1.
const pastYears = l => Array.from({ length: PAST_N }, (_, i) => SHARED.season.year - (l === "nfl" ? PAST_N : PAST_N - 1) + i);
const seasonName = (l, y) => (l === "nfl" ? String(y) : `${y - 1}–${String(y).slice(2)}`);
// Whether this browser already keeps every one of the five seasons, without asking for any.
const pastKept = l => { const have = PAST[l] || (PAST[l] = (keptPull("past-" + l) || {}).data || {}); return pastYears(l).every(y => have[y]); };
// { ready, years, seasons: { year: [[away, home], ...] }, done, of, problem }: what's kept, and while a pull runs how far it has got.
function pastSeasons(l) {
  const years = pastYears(l), have = PAST[l] || (PAST[l] = (keptPull("past-" + l) || {}).data || {});
  if (years.every(y => have[y])) return { ready: true, years, seasons: have };
  const p = pastPulls[l] || (pastPulls[l] = { done: 0, of: 0, problem: "" });
  if (!p.running && !p.problem) { p.running = true; pullPast(l, years.filter(y => !have[y]), have, p).catch(e => { p.problem = pullFailed || e.message || "Couldn't reach ESPN"; }).finally(() => { p.running = false; onPast(); }); }
  return { ready: false, years, seasons: have, done: p.done, of: p.of, problem: p.problem };
}
const keepPast = (l, have) => keepPull("past-" + l, have);
// nflverse's games table, one file: every finished regular-season game of the last five seasons as [kickoff ms, away, home, away score, home score, closing line], by season,
// the closing line nflverse's spread_line, the points the home team was favored by (null where it has none),
// kept for the Handicap's fits (the games' own teams and dates) as well as Season stats' scores. Kickoffs are Eastern, taken at -5 hours all year: only rest days use them.
const PAST_NFL_GAMES = { have: null, pull: null, problem: "" };
async function pullNflverse() {
  const r = await fetch("https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv", { signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error("nflverse answered " + r.status);
  const years = pastYears("nfl"), lines = (await r.text()).trim().split("\n"), head = lines.shift().split(","), col = n => head.indexOf(n);
  const [S, T, A, H, D, K, AT, HT, L] = ["season", "game_type", "away_score", "home_score", "gameday", "gametime", "away_team", "home_team", "spread_line"].map(col), got = {}, ok = v => v !== "" && v !== "NA" && v !== undefined;
  lines.forEach(line => { const c = line.split(","), y = Number(c[S]); if (years.includes(y) && c[T] === "REG" && ok(c[A]) && ok(c[H])) (got[y] = got[y] || []).push([Date.parse(`${c[D]}T${ok(c[K]) ? c[K] : "13:00"}:00-05:00`), c[AT], c[HT], Number(c[A]), Number(c[H]), ok(c[L]) ? Number(c[L]) : null]); });
  PAST_NFL_GAMES.have = got;
  keepPull("pastgames-nfl", got);
  return got;
}
// { ready, games: { season: [[ms, away, home, as, hs], ...] }, problem }: asks nflverse once, when first wanted, and keeps it.
function pastNflGames() {
  const P = PAST_NFL_GAMES, years = pastYears("nfl");
  if (!P.have) { const had = keptPull("pastgames-nfl"); if (had) P.have = had.data; }
  if (P.have && years.every(y => P.have[y] && P.have[y].length && P.have[y][0].length >= 6)) return { ready: true, games: P.have, years };   // a copy kept before the closing lines (0.48.15) is read once more
  if (!P.pull && !P.problem) P.pull = pullNflverse().catch(e => { P.problem = e.message || "Couldn't reach nflverse"; }).finally(() => { P.pull = null; onPast(); });
  return { ready: false, years, problem: P.problem };
}
async function pullPast(l, years, have, p) {
  if (l === "nfl") {
    p.of = 1;
    const got = await pullNflverse();
    years.forEach(y => { if (got[y]) have[y] = got[y].map(r => [r[3], r[4]]); });
    p.done = 1;
    keepPast(l, have);
    return;
  }
  const def = LEAGUE_DEFS[l], ids = (await getJson(`https://site.api.espn.com/apis/v2/sports/${def.espn}/standings`)).children.flatMap(conference => conference.standings.entries.map(row => row.team.id));
  p.of = ids.length * years.length;
  const score = x => Number(x.score && typeof x.score === "object" ? x.score.value : x.score);
  for (const y of years) {
    const games = new Map();
    for (let k = 0; k < ids.length; k += 2) {
      await Promise.all(ids.slice(k, k + 2).map(async id => {
        let j;
        try { j = await getJson(`${SITE}/${def.espn}/teams/${id}/schedule?season=${y}&seasontype=2`); } catch (e) { if (stopped) throw e; j = { events: [] }; }   // a team missing from a season (a new club): its games are on its opponents' schedules too
        (j.events || []).forEach(e => { const c = e.competitions && e.competitions[0]; if (!c || !c.status || !c.status.type.completed || games.has(e.id)) return; const [A, H] = sides(c); if (A && H) games.set(e.id, [score(A), score(H)]); });
        p.done++; onPast();
      }));
    }
    have[y] = [...games.values()];
    keepPast(l, have);
  }
}

// FTN's total DVOA, for the Handicap's DVOA difference (the user, Nov 4 2026: "Total DVOA only"): this browser's own pull of the JSON behind FTN's free Team Total DVOA
// page, which answers Fan's addresses. Only this season's total DVOA for each team, at FTN's latest week, is kept; nothing else in that file is kept, shown or used.
// Asked for when the Handicap opens, at most every 6 hours; a 429 or 5xx, or any failure, stops it until the page is reloaded (CLAUDE.md rule 7).
const DVOA = { have: null, pull: null, problem: "" };
async function pullDvoa() {
  const r = await fetch("https://fantasydata.ftnfantasy.com/api/ftn/dvoa/rankings", { credentials: "omit", signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error("FTN answered " + r.status);
  const season = (await r.json())[String(SHARED.season.year)], codes = SHARED.leagues.nfl.codes, teams = {};
  if (!season) throw new Error(`FTN has no ${SHARED.season.year} yet`);
  let week = 0;
  Object.values(season).forEach(t => { const v = parseFloat(String(t.total_dvoa)); if (t.team && Number.isFinite(v)) { teams[codes[t.team] || t.team] = v; week = Math.max(week, Number(t.week) || 0); } });   // FTN's codes take shared.js's NFL fixes (WAS is Fan's WSH)
  DVOA.have = { at: Date.now(), week, teams };
  keepPull("dvoa", DVOA.have);
}
// { ready, week, teams: { code: total DVOA in percent }, at, problem }
function dvoaNow() {
  if (!DVOA.have) { const had = keptPull("dvoa"); if (had) DVOA.have = had.data; }
  if ((!DVOA.have || Date.now() - DVOA.have.at > STALE_MS) && !DVOA.pull && !DVOA.problem) DVOA.pull = pullDvoa().catch(e => { DVOA.problem = e.message || "Couldn't reach FTN"; }).finally(() => { DVOA.pull = null; onPast(); });
  return { ready: !!DVOA.have, ...(DVOA.have || {}), problem: DVOA.problem };
}

// NCAA FB's list: today's games involving a top 25 team, asked for when its page opens.
async function pullNcaafb() {
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }).replace(/-/g, "");
  const side = x => ({ name: x.team.displayName, rank: x.curatedRank && x.curatedRank.current <= 25 ? x.curatedRank.current : null, score: x.score === "" || x.score == null ? null : Number(x.score) });
  const games = ((await getJson(`${SITE}/football/college-football/scoreboard?dates=${day}&limit=100`)).events || []).map(e => {
    const c = e.competitions[0], [A, H] = sides(c);
    return { t: e.date, away: side(A), home: side(H), tv: (c.broadcasts || []).flatMap(b => b.names).join(" / "), state: e.status.type.state, detail: e.status.type.shortDetail };
  }).filter(g => g.away.rank || g.home.rank).sort((a, b) => a.t.localeCompare(b.t));
  return { asOf: Date.now(), games };
}
export { DAILY_TEAMS, dvoaNow, ensureDailyTeams, pastKept, pastNflGames, pastSeasons, seasonName, setPastRefresh, espnState, GAME_VENUES, TEAM_INFO, VENUE, WEEK_GAMES, ensureTeams, etIso, nflRow, gameOfRow, pullDaily, pullNcaafb, pullStatus, setRefresh, teamSchedule, wantScores };
