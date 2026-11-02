// Layer 1's data: the games, scores, venues, forecasts and team stats, pulled by this browser from ESPN's public addresses. Nothing like it ships with the page: the user sees their own data (CLAUDE.md).
// It runs before the rest of the page. Each browser keeps what it pulled in localStorage, so a finished week is asked for once, and a problem falls back on the last copy.
// A 429 or 5xx stops further pulls until the page is reloaded: never a retry loop (CLAUDE.md rule 7).
const SITE = "https://site.api.espn.com/apis/site/v2/sports";
const NEUTRAL_LINE = () => ({ sp: 0, spj: [-110, -110], tot: 45, toj: [-110, -110], ml: [-110, -110] });   // what a game holds before the user's own prices: never shown
const STALE_MS = 6 * 3600e3, TEAMS_MS = 24 * 3600e3, WEEK8 = Date.UTC(2026, 9, 28, 6), NFL_WEEKS = 18;
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
const tvName = n => ({ "NFL Net": "NFL Network" }[n] || n);
const sides = c => [c.competitors.find(x => x.homeAway === "away"), c.competitors.find(x => x.homeAway === "home")];

// One NFL scoreboard event as a row: what the cards, game details and team schedules need.
function nflRow(e) {
  const c = e.competitions[0], [A, H] = sides(c), v = c.venue || {}, a = v.address || {}, wx = e.weather || c.weather || null, fin = !!e.status.type.completed, ms = Date.parse(e.date);
  return {
    ms, t: etIso(e.date), away: A.team.displayName, home: H.team.displayName, aa: A.team.abbreviation, ha: H.team.abbreviation,
    tv: [...new Set((c.broadcasts || []).flatMap(b => b.names))].map(tvName).join(" / "),
    final: fin ? [Number(A.score), Number(H.score)] : null, now: e.status.type.state === "in" ? { score: [Number(A.score), Number(H.score)], clock: e.status.type.shortDetail || "" } : null, note: c.neutralSite && a.city ? a.city : "",
    env: [v.fullName || "", [a.city, a.state || a.country].filter(Boolean).join(", "), v.indoor ? 1 : 0, wx ? wx.displayValue : "", wx && typeof wx.temperature === "number" ? wx.temperature : null, wx ? String(wx.conditionId || "") : ""]
  };
}
const gameOfRow = r => ({ t: r.t, away: r.away, home: r.home, tv: r.tv, ...(r.note ? { note: r.note } : {}), ...(r.final ? { final: r.final } : { noLine: true }), ...(r.now ? { now: r.now } : {}), line: NEUTRAL_LINE() });
const lastName = n => n.split(" ").pop();
const envKey = (w, r) => `${w}|${lastName(r.away)}|${lastName(r.home)}`;
const pullWeek = async w => {
  const rows = ((await getJson(`${SITE}/football/nfl/scoreboard?seasontype=2&week=${w}&dates=2026`)).events || []).map(nflRow).sort((p, q) => p.ms - q.ms);
  keepPull("nfl" + w, rows);
  return rows;
};

const WEEK_GAMES = {}, GAME_ENV = {}, TEAM_INFO = {}, NBA_INFO = {}, nflRows = {};
let pullProblem = "", onRefresh = () => {};
const setRefresh = fn => { onRefresh = fn; };
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
    if (!had || w === now || w === now + 1 || (!rows.every(r => r.final) && Date.now() - had.at > STALE_MS)) due.push(w);
  }
  try { for (const w of due) await refreshWeek(w); onRefresh(); } catch (e) {}
}
setTimeout(refreshStale, 2000);
// Every 10 minutes, or every minute [C] while a game is on and this tab is showing.
let lastWeekPull = 0;
const gameOn = w => (nflRows[w] || []).some(r => r.now || (!r.final && Date.now() >= r.ms && Date.now() - r.ms < 5 * 3600e3));
setInterval(() => {
  const w = espnWeek();
  if (w < 1 || w > NFL_WEEKS || document.hidden) return;
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
const SEVERITY = { Out: 0, Doubtful: 1, Questionable: 2, "Injured Reserve": 3 };
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
  const standings = await getJson(`https://site.api.espn.com/apis/v2/sports/football/nfl/standings?level=3&season=2026&seasontype=2`), injuries = injuryList(await getJson(`${SITE}/football/nfl/injuries`)), out = {};
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

// NBA, only once its league is on: a slate is one Eastern day, from the season's start to 16 days ahead. Codes are Kalshi's, because its tickers end in them.
const NBA_START = Date.UTC(2026, 9, 20), ESPN_TO_KALSHI = { GS: "GSW", NO: "NOP", NY: "NYK", SA: "SAS", UTAH: "UTA", WSH: "WAS" };
const ymd = ms => new Date(ms).toISOString().slice(0, 10).replace(/-/g, "");
const nbaCode = x => ESPN_TO_KALSHI[x.abbreviation] || x.abbreviation;
async function pullNba() {
  const rows = [], today = Math.floor(Date.now() / 864e5) * 864e5;
  for (let d = NBA_START; d <= today + 16 * 864e5; d += 864e5) {
    const key = "nba" + ymd(d), had = keptPull(key);
    let day = had && (d < today - 864e5 && had.at > d + 2 * 864e5 || Date.now() - had.at < TEAMS_MS) ? had.data : null;
    if (!day) {
      try {
        day = ((await getJson(`${SITE}/basketball/nba/scoreboard?dates=${ymd(d)}&limit=40`)).events || []).map(e => ({ e, c: e.competitions && e.competitions[0] })).filter(({ c }) => c && c.competitors.every(x => x.team.abbreviation && Number(x.team.id) < 31)).map(({ e, c }) => {
          const [A, H] = sides(c);
          return { t: etIso(e.date), a: nbaCode(A.team), h: nbaCode(H.team), an: [A.team.displayName, "#" + A.team.color, "#" + A.team.alternateColor], hn: [H.team.displayName, "#" + H.team.color, "#" + H.team.alternateColor], tv: (c.broadcasts && c.broadcasts[0] && c.broadcasts[0].names && c.broadcasts[0].names[0]) || "" };
        });
        keepPull(key, day);
      } catch (e) { day = had ? had.data : []; }
    }
    rows.push(...day);
  }
  rows.forEach(r => { NBA_INFO[r.a] = r.an; NBA_INFO[r.h] = r.hn; });
  return rows;
}
const NBA_SCHEDULE = [];   // only the NFL can be turned on for now

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
export { espnState, GAME_ENV, NBA_INFO, NBA_SCHEDULE, TEAM_INFO, WEEK_GAMES, ensureTeams, etIso, nflRow, gameOfRow, pullNba, pullNcaafb, pullStatus, setRefresh, teamSchedule };
