// Layer 1's data: the games, scores, venues, forecasts and team stats, pulled by this browser from ESPN's public addresses. Nothing like it ships with the page: the user sees their own data (CLAUDE.md).
// It runs before the rest of the page. Each browser keeps what it pulled in localStorage, so a finished week is asked for once, and a problem falls back on the last copy.
// A 429 or 5xx stops further pulls until the page is reloaded: never a retry loop (CLAUDE.md rule 7).
import { SHARED } from "./shared.js?v=mw1enwee";
import { LEAGUE_DEFS, leagueCodes, teamName } from "./leagues.js?v=mw1enwee";
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

// One NFL scoreboard event as a row: what the cards, game details and team schedules need.
function nflRow(e) {
  const c = e.competitions[0], [A, H] = sides(c), v = c.venue || {}, a = v.address || {}, wx = e.weather || c.weather || null, fin = !!e.status.type.completed, ms = Date.parse(e.date);
  return {
    ms, eid: e.id, t: etIso(e.date), away: A.team.displayName, home: H.team.displayName, aa: A.team.abbreviation, ha: H.team.abbreviation,
    tv: [...new Set((c.broadcasts || []).flatMap(b => b.names))].map(tvName).join(" / "),
    final: fin ? [Number(A.score), Number(H.score)] : null, now: e.status.type.state === "in" ? { score: [Number(A.score), Number(H.score)], clock: e.status.type.shortDetail || "" } : null, note: c.neutralSite && a.city ? a.city : "",
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

const WEEK_GAMES = {}, GAME_ENV = {}, TEAM_INFO = {}, nflRows = {};
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
  rows.forEach(r => { GAME_ENV[envKey(w, r)] = r.env; });
}
// A fresh read of one week onto the games on the page. A moved kickoff waits for the next load, since tickets are matched to it then.
async function refreshWeek(w) {
  const rows = await pullWeek(w), list = WEEK_GAMES[w] || [];
  nflRows[w] = rows;
  rows.forEach(r => {
    GAME_ENV[envKey(w, r)] = r.env;
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
const statOf = (cats, cat, name) => { const c = cats.find(x => x.name === cat), s = c && c.stats.find(x => x.name === name); return s && typeof s.value === "number" ? s.value : null; };
const SEVERITY = { Out: 0, Doubtful: 1, Questionable: 2, "Day-To-Day": 2, "Injured Reserve": 3 };   // Day-To-Day is the NBA's and the NHL's
function injuryList(report) {
  const by = {};
  report.injuries.forEach(t => {
    const list = t.injuries.filter(i => i.status in SEVERITY).sort((p, q) => SEVERITY[p.status] - SEVERITY[q.status]);
    by[t.id] = { ir: t.injuries.filter(i => i.status === "Injured Reserve").length, more: Math.max(0, list.length - 7), list: list.slice(0, 40).map(i => { const pos = (i.athlete.position && i.athlete.position.abbreviation) || ""; return [i.athlete.displayName, pos, i.status, (i.details && i.details.type) || (i.type && i.type.description) || "", pos === "QB" ? 1 : 0]; }).sort((p, q) => SEVERITY[p[2]] - SEVERITY[q[2]] || q[4] - p[4]) };
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
  for (const conf of standings.children) for (const div of conf.children) for (const [i, row] of div.standings.entries.entries()) {
    const t = row.team, st = await getJson(`${SITE}/football/nfl/teams/${t.id}/statistics`), stat = n => row.stats.find(x => x.name === n) || {}, streak = String(stat("streak").displayValue || "");
    const cats = st.results.stats.categories, inj = injuries[t.id] || { list: [] }, sch = teamSchedule(t.abbreviation);
    out[t.name] = {
      "abbr": t.abbreviation, r: stat("overall").summary, h: stat("Home").summary, a: stat("Road").summary, stand: `${ordinal(i + 1)} in ${div.name}`, streak: (streak[0] === "L" ? -1 : 1) * (Number(streak.slice(1)) || 0),
      gp: statOf(cats, "passing", "teamGamesPlayed"), pf: stat("pointsFor").value ?? null, pa: stat("pointsAgainst").value ?? null, ypg: round1(statOf(cats, "passing", "yardsPerGame")), pass: round1(statOf(cats, "passing", "netPassingYardsPerGame")), rush: round1(statOf(cats, "rushing", "rushingYardsPerGame")),
      qbr: round1(statOf(cats, "passing", "QBRating")), td3: round1(statOf(cats, "miscellaneous", "thirdDownConvPct")), rz: round1(statOf(cats, "miscellaneous", "redzoneTouchdownPct")), tk: statOf(cats, "miscellaneous", "totalTakeaways"), gv: statOf(cats, "miscellaneous", "totalGiveaways"),
      skt: statOf(cats, "passing", "sacks"), sk: statOf(cats, "defensive", "sacks"), pen: statOf(cats, "miscellaneous", "totalPenaltyYards"), sch, res: sch.filter(x => x[3] !== null), inj: inj.list, injMore: inj.more || 0, ir: inj.ir || 0
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
  report.injuries.forEach(t => { inj[t.id] = t.injuries.filter(i => i.status in SEVERITY).sort((p, q) => SEVERITY[p.status] - SEVERITY[q.status]).slice(0, 30).map(i => { const pos = (i.athlete.position && i.athlete.position.abbreviation) || ""; return [i.athlete.displayName, pos, i.status, (i.details && i.details.type) || "", l === "nhl" && pos === "G" ? 1 : 0]; }); });
  // the teams' statistics four at a time, so the first preview doesn't wait on 32 requests in a row
  const rows = standings.children.flatMap(conf => conf.standings.entries.map((row, i) => [conf, row, i])).filter(([, row]) => codes.has(code(row.team.abbreviation))), stats = {};
  for (let k = 0; k < rows.length; k += 4) await Promise.all(rows.slice(k, k + 4).map(([, row]) => { const c = code(row.team.abbreviation); return (stats[c] = getJson(`${SITE}/${def.espn}/teams/${row.team.id}/statistics`)); }));
  for (const [conf, row, i] of rows) {
    const t = row.team, c = code(t.abbreviation);
    const stat = n => row.stats.find(x => x.name === n) || {}, streak = String(stat("streak").displayValue || "");
    const cats = (await stats[c]).results.stats.categories, st = {};
    Object.entries(DAILY_STATS[l]).forEach(([k, [cat, name]]) => { st[k] = statOf(cats, cat, name); });
    out[c] = {
      called: t.name, r: stat("overall").summary, h: stat("Home").summary, a: stat("Road").summary, l10: stat("Last Ten Games").summary || "", stand: `${ordinal(stat("playoffSeed").value || i + 1)} in the ${conf.abbreviation || conf.name}`, streak: (streak[0] === "L" ? -1 : 1) * (Number(streak.slice(1)) || 0),
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
export { DAILY_TEAMS, ensureDailyTeams, espnState, GAME_ENV, TEAM_INFO, WEEK_GAMES, ensureTeams, etIso, nflRow, gameOfRow, pullDaily, pullNcaafb, pullStatus, setRefresh, teamSchedule, wantScores };
