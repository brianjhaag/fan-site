


import { SHARED } from "./shared.js?v=mw5nr7x2";
import { LEAGUE_DEFS, leagueCodes, teamName } from "./leagues.js?v=mw5nr7x2";
const SITE = "https://site.api.espn.com/apis/site/v2/sports";
const NEUTRAL_LINE = () => ({ sp: 0, spj: [-110, -110], tot: 45, toj: [-110, -110], ml: [-110, -110] });   
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


const etFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "shortOffset" });
function etIso(utc) {
  const p = Object.fromEntries(etFmt.formatToParts(new Date(utc)).map(x => [x.type, x.value]));
  const off = p.timeZoneName.replace("GMT", ""), sign = off[0], h = off.slice(1).padStart(2, "0");
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}${sign}${h}:00`;
}
const tvName = n => ({ "NFL Net": "NFL Network", "NHL Net": "NHL Network" }[n] || n);
const sides = c => [c.competitors.find(x => x.homeAway === "away"), c.competitors.find(x => x.homeAway === "home")];


const VENUE = { stadium: 0, city: 1, indoor: 2, forecast: 3, temperature: 4, condition: 5 };


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

let scoresFor = new Set(["nfl"]);
const wantScores = list => { scoresFor = new Set(list); };
const pullStatus = () => pullProblem;

const NEWS_LINK = /^https?:\/\/([a-z0-9-]+\.)*espn\.com\//i, NEWS_IMAGE = /^https:\/\/([a-z0-9-]+\.)*espncdn\.com\//i;

const leaderPulls = {};
function pullLeaders(l) {
  const def = LEAGUE_DEFS[l], fanCode = c => (def.espnCodes || {})[c] || c;
  const leader = x => {
    const a = x.athlete || {}, card = (a.links || []).find(k => (k.rel || []).includes("playercard")), image = a.headshot && a.headshot.href || "";
    return { name: a.shortName || a.displayName || "", code: x.team && x.team.abbreviation ? fanCode(x.team.abbreviation) : "", value: x.displayValue || "", link: card && NEWS_LINK.test(card.href) ? card.href.replace(/^http:/i, "https:") : "", image: NEWS_IMAGE.test(image) ? image : "" };
  };
  return leaderPulls[l] = leaderPulls[l] || getJson(`${SITE.replace("/v2/", "/v3/")}/${def.espn}/leaders`).then(data => ((data.leaders || {}).categories || []).map(c => ({ name: c.displayName || c.name || "", leaders: (c.leaders || []).map(leader).filter(x => x.name) })).filter(c => c.leaders.length), e => { delete leaderPulls[l]; throw e; });
}

const divisionPulls = {};
function pullDivisions(l) {
  const def = LEAGUE_DEFS[l], fanCode = c => (def.espnCodes || {})[c] || c;
  return divisionPulls[l] = divisionPulls[l] || getJson(`https://site.api.espn.com/apis/v2/sports/${def.espn}/standings?level=3`).then(data => data.children.flatMap(conference => (conference.children || []).map(division => {
    const name = division.name.replace(/ Division$/, "");
    return { name: name.startsWith(conference.abbreviation) ? name : conference.abbreviation + " " + name, codes: division.standings.entries.map(row => fanCode(row.team.abbreviation)) };
  })), e => { delete divisionPulls[l]; throw e; });
}


async function pullEspnNews(l, teams) {
  const def = LEAGUE_DEFS[l], fanCode = c => (def.espnCodes || {})[c] || c, all = leagueCodes(l);
  const item = a => {
    const link = a.links && a.links.web && a.links.web.href || "", images = a.images || [], image = (images.find(i => i.ratio === "16x9") || images.find(i => i.type !== "stitcher") || images[0] || {}).url || "";
    const codes = (a.categories || []).filter(c => c.type === "team" && c.team && c.team.abbreviation).map(c => fanCode(c.team.abbreviation)).filter(c => all.has(c));
    return { title: a.headline || "", kind: a.type || "", source: "ESPN", ms: Date.parse(a.published), link: NEWS_LINK.test(link) ? link.replace(/^http:/i, "https:") : "", image: NEWS_IMAGE.test(image) ? image : "", codes };
  };
  const list = async q => ((await getJson(`${SITE}/${def.espn}/news?${q}`)).articles || []).map(item).filter(n => n.title);
  if (!teams) return list("limit=50");
  const on = new Set(teams.map(fanCode));
  if (teams.length * 2 > all.size) return (await list("limit=50")).filter(n => !n.codes.length || n.codes.some(c => on.has(c)));
  const seen = new Set(), out = [];
  for (const t of teams) for (const n of await list("limit=12&team=" + t.toLowerCase())) if (!seen.has(n.link || n.title)) { seen.add(n.link || n.title); out.push(n); }
  return out.sort((p, q) => (q.ms || 0) - (p.ms || 0));
}
const espnState = () => ({ at: pullAt, problem: pullFailed || pullProblem });   


for (let w = 1; w <= NFL_WEEKS; w++) {
  const had = keptPull("nfl" + w);
  let rows = had && had.data;
  if (!rows) { try { rows = await pullWeek(w); } catch (e) { pullProblem = "Couldn't reach ESPN for the schedule."; rows = []; } }
  nflRows[w] = rows;
  if (rows.length) WEEK_GAMES[w] = rows.map(gameOfRow);
  rows.forEach(r => { GAME_VENUES[envKey(w, r)] = r.env; });
}

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
    if (!had || w === now || w === now + 1 || rows.some(r => !r.eid) || (!rows.every(r => r.final) && Date.now() - had.at > STALE_MS)) due.push(w);   
  }
  try { for (const w of due) await refreshWeek(w); onRefresh(); } catch (e) {}
}
setTimeout(refreshStale, 2000);

let lastWeekPull = 0;
const gameOn = w => (nflRows[w] || []).some(r => r.now || (!r.final && Date.now() >= r.ms && Date.now() - r.ms < 5 * 3600e3));
setInterval(() => {
  const w = espnWeek();
  if (w < 1 || w > NFL_WEEKS || document.hidden || !scoresFor.has("nfl")) return;
  if (!gameOn(w) && Date.now() - lastWeekPull < 10 * 60e3) return;
  lastWeekPull = Date.now();
  refreshWeek(w).then(() => onRefresh(), () => {});
}, 60e3);


let teamsPull = null;
function ensureTeams() {
  const had = keptPull("teams");
  if (had && !Object.keys(TEAM_INFO).length) Object.assign(TEAM_INFO, had.data);
  if (Object.keys(TEAM_INFO).length && Date.now() - (had ? had.at : 0) < TEAMS_MS) return Promise.resolve(true);
  return teamsPull = teamsPull || pullTeams().then(() => true, () => Object.keys(TEAM_INFO).length > 0).finally(() => { teamsPull = null; });
}
const round1 = x => (x === null ? null : Math.round(x * 10) / 10);
const statOf = (statGroups, category, name) => { const c = statGroups.find(x => x.name === category), s = c && c.stats.find(x => x.name === name); return s && typeof s.value === "number" ? s.value : null; };
const SEVERITY = { Out: 0, Doubtful: 1, Questionable: 2, "Day-To-Day": 2, "Injured Reserve": 3 };   
function injuryList(report) {
  const by = {};
  report.injuries.forEach(t => {
    const list = t.injuries.filter(i => i.status in SEVERITY).sort((p, q) => SEVERITY[p.status] - SEVERITY[q.status]);
    by[t.id] = { ir: t.injuries.filter(i => i.status === "Injured Reserve").length, more: Math.max(0, list.length - 7), list: list.slice(0, 40).map(i => { const positionCode = (i.athlete.position && i.athlete.position.abbreviation) || ""; return [i.athlete.displayName, positionCode, i.status, (i.details && i.details.type) || (i.type && i.type.description) || "", positionCode === "QB" ? 1 : 0]; }).sort((p, q) => SEVERITY[p[2]] - SEVERITY[q[2]] || q[4] - p[4]) };
  });
  return by;
}

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



const ymd = ms => new Date(ms).toISOString().slice(0, 10).replace(/-/g, "");

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
    let day = had && had.data.every(r => r.eid) && (d < today - 864e5 && had.at > d + 2 * 864e5 || d === today - 864e5 && had.data.every(r => r.final) || d >= today && Date.now() - had.at < TEAMS_MS) ? had.data : null;   
    if (!day) {
      try { day = await dayGames(l, ymd(d)); keepPull(key, day); } catch (e) { day = had ? had.data : []; }
    }
    rows.push(...day);
  }
  return rows;
}


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


const PAST_N = 5;
let onPast = () => {};
const setPastRefresh = fn => { onPast = fn; };

const pastYears = () => Array.from({ length: PAST_N }, (_, i) => SHARED.season.year - PAST_N + i);



const PAST_NFL_GAMES = { have: null, pull: null, problem: "" };
async function pullNflverse() {
  const r = await fetch("https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv", { signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error("nflverse answered " + r.status);
  const years = pastYears(), lines = (await r.text()).trim().split("\n"), head = lines.shift().split(","), col = n => head.indexOf(n);
  const [S, T, A, H, D, K, AT, HT, L] = ["season", "game_type", "away_score", "home_score", "gameday", "gametime", "away_team", "home_team", "spread_line"].map(col), got = {}, ok = v => v !== "" && v !== "NA" && v !== undefined;
  lines.forEach(line => { const c = line.split(","), y = Number(c[S]); if (years.includes(y) && c[T] === "REG" && ok(c[A]) && ok(c[H])) (got[y] = got[y] || []).push([Date.parse(`${c[D]}T${ok(c[K]) ? c[K] : "13:00"}:00-05:00`), c[AT], c[HT], Number(c[A]), Number(c[H]), ok(c[L]) ? Number(c[L]) : null]); });
  PAST_NFL_GAMES.have = got;
  keepPull("pastgames-nfl", got);
  return got;
}

function pastNflGames() {
  const P = PAST_NFL_GAMES, years = pastYears();
  if (!P.have) { const had = keptPull("pastgames-nfl"); if (had) P.have = had.data; }
  if (P.have && years.every(y => P.have[y] && P.have[y].length && P.have[y][0].length >= 6)) return { ready: true, games: P.have, years };   
  if (!P.pull && !P.problem) P.pull = pullNflverse().catch(e => { P.problem = e.message || "Couldn't reach nflverse"; }).finally(() => { P.pull = null; onPast(); });
  return { ready: false, years, problem: P.problem };
}




const DVOA = { have: null, pull: null, problem: "" };
async function pullDvoa() {
  const r = await fetch("https://fantasydata.ftnfantasy.com/api/ftn/dvoa/rankings", { credentials: "omit", signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error("FTN answered " + r.status);
  const season = (await r.json())[String(SHARED.season.year)], codes = SHARED.leagues.nfl.codes, teams = {};
  if (!season) throw new Error(`FTN has no ${SHARED.season.year} yet`);
  let week = 0;
  Object.values(season).forEach(t => { const v = parseFloat(String(t.total_dvoa)); if (t.team && Number.isFinite(v)) { teams[codes[t.team] || t.team] = v; week = Math.max(week, Number(t.week) || 0); } });   
  DVOA.have = { at: Date.now(), week, teams };
  keepPull("dvoa", DVOA.have);
}

function dvoaNow() {
  if (!DVOA.have) { const had = keptPull("dvoa"); if (had) DVOA.have = had.data; }
  if ((!DVOA.have || Date.now() - DVOA.have.at > STALE_MS) && !DVOA.pull && !DVOA.problem) DVOA.pull = pullDvoa().catch(e => { DVOA.problem = e.message || "Couldn't reach FTN"; }).finally(() => { DVOA.pull = null; onPast(); });
  return { ready: !!DVOA.have, ...(DVOA.have || {}), problem: DVOA.problem };
}


async function pullNcaafb() {
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }).replace(/-/g, "");
  const side = x => ({ name: x.team.displayName, rank: x.curatedRank && x.curatedRank.current <= 25 ? x.curatedRank.current : null, score: x.score === "" || x.score == null ? null : Number(x.score) });
  const games = ((await getJson(`${SITE}/football/college-football/scoreboard?dates=${day}&limit=100`)).events || []).map(e => {
    const c = e.competitions[0], [A, H] = sides(c);
    return { t: e.date, away: side(A), home: side(H), tv: (c.broadcasts || []).flatMap(b => b.names).join(" / "), state: e.status.type.state, detail: e.status.type.shortDetail };
  }).filter(g => g.away.rank || g.home.rank).sort((a, b) => a.t.localeCompare(b.t));
  return { asOf: Date.now(), games };
}




const HISTORY_GAP_MS = 60e3;
const lastSeason = (at = Date.now()) => { const d = new Date(at); return d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1; };   
const seasonHistory = (l, season = lastSeason()) => { const h = keptPull(`history-${l}-${season}`); return h && h.data ? { ...h.data, season, at: h.at } : null; };
let historyTimer = null;
function pullHistory(leagues, ready, onStep) {
  clearTimeout(historyTimer);
  const step = async () => {
    const season = lastSeason(), l = leagues().find(x => !(seasonHistory(x, season) || {}).complete);
    if (!l || stopped) return;
    const was = seasonHistory(l, season), h = was ? { teams: was.teams, done: was.done, games: was.games } : { teams: null, done: [], games: {} }, wait = (was ? was.at : 0) + HISTORY_GAP_MS - Date.now();
    if (wait > 0 || !ready()) { historyTimer = setTimeout(step, Math.max(wait, 15e3)); return; }
    const def = LEAGUE_DEFS[l];
    try {
      if (!h.teams) { const s = await getJson(`https://site.api.espn.com/apis/v2/sports/${def.espn}/standings`); h.teams = [...new Set(s.children.flatMap(c => c.standings.entries.map(r => String(r.team.id))))]; }
      else {
        const id = h.teams.find(t => !h.done.includes(t)), d = await getJson(`${SITE}/${def.espn}/teams/${id}/schedule?season=${season}&seasontype=2`);
        for (const e of d.events || []) {
          const c = e.competitions && e.competitions[0], at = side => c.competitors.find(x => x.homeAway === side), score = x => Number(x && x.score && x.score.value);
          if (!c || !c.status || !c.status.type.completed) continue;
          const a = score(at("away")), hm = score(at("home"));
          if (Number.isFinite(a) && Number.isFinite(hm)) h.games[e.id] = [a, hm];
        }
        h.done.push(id);
      }
      h.complete = h.teams.length > 0 && h.teams.every(t => h.done.includes(t));
      keepPull(`history-${l}-${season}`, h);
    } catch (e) { return; }
    if (onStep) onStep(l);
    historyTimer = setTimeout(step, HISTORY_GAP_MS);
  };
  historyTimer = setTimeout(step, 5e3);
}
export { lastSeason, pullHistory, seasonHistory, DAILY_TEAMS, dvoaNow, ensureDailyTeams, pastNflGames, setPastRefresh, espnState, GAME_VENUES, TEAM_INFO, VENUE, WEEK_GAMES, ensureTeams, etIso, nflRow, gameOfRow, pullDaily, pullDivisions, pullLeaders, pullNcaafb, pullEspnNews, pullStatus, setRefresh, teamSchedule, wantScores };
