// Line refreshes: lines, finals and Playbook's history, pulled by the connector for its user from public feeds with no key (PLAN.md B6, Nov 3 2026). The connector runs this file from the page
// it follows, in its engine on a thread of its own, so a change here lands with a page release; a copy is built into the program for when the page's is missing or broken. Carried over from
// the connector's lines.rs and ingest.rs, and checked against them on the same real answers before they were retired (tools/dev/compare-lines.js).
// It reaches the network only through fan.fetch, which keeps to the connector's list of hosts, and saves nothing: the connector saves what it returns and keeps the timer. A feed problem
// comes back as an error for the connector to act on. No retries here, on purpose: the feeds are free (CLAUDE.md rule 7). The page never loads it.
import { SHARED } from "./shared.js?v=mw0xlgwo";

const Lines = (() => {
  const MAX_GAP = 0.08;   // a wider book says nothing about the price
  const DAY = 864e5, HOUR = 36e5;
  const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

  // ---- Small things, each as the Rust had it ----
  const obj = x => (x !== null && typeof x === "object" ? x : {});
  const arr = x => (Array.isArray(x) ? x : []);
  const str = x => (typeof x === "string" ? x : "");
  // A price as Kalshi and Polymarket US write it: a number, or a number as text.
  const num = v => (typeof v === "number" ? v : typeof v === "string" && /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(v) ? Number(v) : null);
  const truthy = v => (v === 0 ? null : v);
  const american = p => (p > 0.5 ? -Math.round(100 * p / (1 - p)) : Math.round(100 * (1 - p) / p));
  const f4 = v => Number(v.toFixed(4));
  const lowest = list => list.reduce((a, b) => Math.min(a, b), Infinity);
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const lastPart = t => t.split("-").pop();
  const fix = (map, c) => (Object.prototype.hasOwnProperty.call(map, c) ? map[c] : c);
  const label = n => n.charAt(0).toUpperCase() + n.slice(1);
  // The pair with the lowest price, the first of equals.
  const cheapest = pairs => pairs.reduce((b, p) => (b && !(p[1] < b[1]) ? b : p), null);
  const utcDay = (y, m, d) => { const t = Date.UTC(y, m - 1, d), x = new Date(t); return y >= 1000 && x.getUTCFullYear() === y && x.getUTCMonth() === m - 1 && x.getUTCDate() === d ? t : 0; };
  // A time written as RFC 3339 ("2026-11-03T01:15:00Z"), in milliseconds, or null.
  const rfc3339 = t => {
    const m = /^(\d{4})-(\d\d)-(\d\d)[Tt ](\d\d):(\d\d):(\d\d)(\.\d+)?([Zz]|([+-])(\d\d):(\d\d))$/.exec(str(t));
    if (!m || !utcDay(+m[1], +m[2], +m[3]) || +m[4] > 23 || +m[5] > 59 || +m[6] > 60) return null;
    const off = m[9] ? (m[9] === "-" ? -1 : 1) * (+m[10] * 60 + +m[11]) * 6e4 : 0;
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) + Math.floor(Number("0" + (m[7] || "")) * 1000) - off;
  };
  const whole = (s, signed) => ((signed ? /^[+-]?\d+$/ : /^\+?\d+$/).test(s) ? Number(s) : null);

  // ---- The leagues, from the shared config ----
  const league = code => { const d = SHARED.leagues[code]; return d && d.kalshi ? { code, ...d, daily: d.slate === "day" } : null; };
  const LEAGUES = Object.keys(SHARED.leagues).map(league).filter(Boolean);
  // A slate's prefix for its game ids: "w8", "w20261102", "nhl20261102", and its meta document, Week 7's predating the tabs.
  const slateTag = (lg, n) => lg.tag + n;
  const metaKey = (lg, n) => (lg.tag === "w" ? (n === 7 ? "meta" : "meta" + n) : "meta" + slateTag(lg, n));
  // Week N's window: from the Wednesday before its Thursday to the Tuesday after (UTC midnights). A daily league's is its day.
  const weekWindow = n => { const thu = Math.floor(SHARED.season.week8 / DAY) * DAY + DAY + (n - 8) * 7 * DAY; return [thu - DAY, thu + 5 * DAY]; };
  const windowOf = (lg, n) => { if (!lg.daily) return weekWindow(n); const d = utcDay(Math.floor(n / 10000), Math.floor(n / 100) % 100, n % 100); return [d, d]; };

  // ---- The network, through the connector ----
  const feedError = (status, message) => Object.assign(new Error(message), { status });
  const hostOf = url => url.split("/")[2] || "";
  const getText = (url, seconds) => { const r = fan.fetch(url, { timeout: seconds }); if (r.status < 200 || r.status > 299) throw feedError(r.status, `${r.status} from ${hostOf(url)}`); return r.text; };
  const getJson = url => { const t = getText(url, 20); try { return JSON.parse(t); } catch (e) { throw feedError(null, `bad answer from ${hostOf(url)}`); } };

  // ---- Kalshi: one events listing per series ----
  const kalshiEvents = (f, series) => {
    const out = [];
    for (let cursor = ""; ;) {
      const r = obj(getJson(`${f.kalshi}/events?series_ticker=${series}&status=open&limit=200&with_nested_markets=true${cursor ? "&cursor=" + cursor : ""}`));
      out.push(...arr(r.events));
      cursor = str(r.cursor);
      if (!cursor) return out;
    }
  };
  // "KXNFLGAME-26OCT29CARGB" with its markets: the away team comes first in the ticker.
  const parseEvent = ev => {
    const key = lastPart(str(obj(ev).event_ticker));
    if (!/^\d\d[A-Z]{3}\d\d[A-Z]+$/.test(key)) return null;
    const month = MONTHS.indexOf(key.slice(2, 5));
    if (month < 0 || !Array.isArray(ev.markets)) return null;
    const date = utcDay(2000 + Number(key.slice(0, 2)), month + 1, Number(key.slice(5, 7))), teams = key.slice(7), codes = [];
    for (const k of ev.markets) { const c = lastPart(str(obj(k).ticker)); if (c && /^[A-Z]+$/.test(c) && teams.includes(c) && !codes.includes(c)) codes.push(c); }
    const away = codes.find(c => teams.startsWith(c));
    const home = away === undefined ? undefined : codes.find(c => c !== away && teams.endsWith(c));
    return home === undefined ? null : { date, rawAway: away, rawHome: home, key };
  };
  // A slate's games from Kalshi: `n` is the NFL week, or a daily league's day as yyyymmdd.
  const kalshi = (f, n, lg) => {
    const [from, to] = windowOf(lg, n), tick = c => fix(lg.codes, c), tag = slateTag(lg, n);
    const games = kalshiEvents(f, lg.kalshi + "GAME"), spreads = kalshiEvents(f, lg.kalshi + "SPREAD"), totals = kalshiEvents(f, lg.kalshi + "TOTAL");
    const find = (list, key) => { for (let i = list.length - 1; i >= 0; i--) if (lastPart(str(obj(list[i]).event_ticker)) === key) return arr(list[i].markets); return []; };
    const out = [];
    for (const ev of games) {
      const e = parseEvent(ev);
      if (!e || e.date < from || e.date > to) continue;
      const away = tick(e.rawAway), home = tick(e.rawHome), mk = ev.markets;
      const starts = mk.map(k => rfc3339(obj(k).occurrence_datetime)).filter(t => t !== null).map(t => t - 3 * HOUR);
      const market = code => mk.find(x => str(obj(x).ticker).endsWith("-" + code));
      const ask = code => { const k = market(code); return k ? num(k.yes_ask_dollars) : null; };
      const tk = code => { const k = market(code); return k && typeof k.ticker === "string" ? k.ticker : null; };
      const a = truthy(ask(e.rawAway)), h = truthy(ask(e.rawHome));
      const g = { id: `${tag}-${away}-${home}`, away, home, start: starts.length ? Math.min(...starts) : null, ml: a !== null && h !== null ? [a, h] : null, mlTk: [tk(e.rawAway), tk(e.rawHome)], spreads: [], totals: [] };
      const quote = k => { const a = truthy(num(k.yes_ask_dollars)), n = truthy(num(k.no_ask_dollars)), b = num(k.yes_bid_dollars), strike = typeof k.floor_strike === "number" ? k.floor_strike : null; return a === null || n === null || b === null || strike === null || a - b > MAX_GAP ? null : { a, n, b, strike }; };
      for (const k of find(spreads, e.key).map(obj)) {
        const q = quote(k);
        if (!q) continue;
        const ticker = str(k.ticker), team = tick(lastPart(ticker).replace(/\d+$/, ""));
        g.spreads.push({ fav: team === away ? "away" : "home", k: q.strike, favAsk: q.a, dogAsk: q.n, mid: (q.a + q.b) / 2, tk: ticker, src: "" });
      }
      for (const k of find(totals, e.key).map(obj)) { const q = quote(k); if (q) g.totals.push({ k: q.strike, over: q.a, under: q.n, mid: (q.a + q.b) / 2 }); }
      const had = out.findIndex(x => x.id === g.id);
      if (had >= 0) out[had] = g; else out.push(g);
    }
    return out;
  };

  // ---- Polymarket US: the exchange US users trade on, from its public gateway, no key ----
  // A league's games come in one listing, each with its moneyline. Each game's full-game spreads and totals are then asked for by name, one request a game: its whole event is megabytes of props.
  // A market is a yes on its long side: a team at a line, or the over. Its best ask buys that side, and one less its best bid buys the other.
  const pmTeam = (ev, id, lg) => { const t = arr(obj(ev).teams).find(t => JSON.stringify(obj(t).id ?? null) === JSON.stringify(id ?? null)); return t && typeof t.abbreviation === "string" ? fix(lg.codes, t.abbreviation.toUpperCase()) : null; };
  const pmLongTeam = (ev, m, lg) => { if (!Array.isArray(obj(m).marketSides)) return null; const s = m.marketSides.find(s => obj(s).long === true); return s ? pmTeam(ev, s.teamId, lg) : null; };
  const pmQuotes = m => { const a = truthy(num(obj(obj(m).bestAskQuote).value)), b = num(obj(obj(m).bestBidQuote).value); return a === null || b === null ? null : [a, b]; };
  const polymarket = (f, n, lg) => {
    const [from, to] = windowOf(lg, n), tag = slateTag(lg, n), pm = lg.polymarket, out = [];
    const list = getJson(`${f.polymarket}/v2/leagues/${lg.code}/events?limit=100`);
    for (const ev of arr(obj(list).events)) {
      const slug = str(obj(ev).slug), p = slug.split("-");   // "nfl-chi-sea-2026-11-02": away, home, the US date, as Kalshi orders them
      if (p.length !== 6 || p[0] !== lg.code) continue;
      const y = whole(p[3], true), mo = whole(p[4]), d = whole(p[5]);
      if (y === null || mo === null || d === null) continue;
      const date = utcDay(y, mo, d);
      if (date < from || date > to) continue;
      const code = s => fix(lg.codes, s.toUpperCase()), away = code(p[1]), home = code(p[2]);
      const m0 = arr(ev.markets).find(m => obj(m).sportsMarketTypeV2 === "SPORTS_MARKET_TYPE_MONEYLINE"), q0 = m0 && pmQuotes(m0), long = q0 ? pmLongTeam(ev, m0, lg) : null;
      const g = { id: `${tag}-${away}-${home}`, away, home, start: rfc3339(ev.startTime), ml: long === null ? null : long === away ? [q0[0], 1 - q0[1]] : [1 - q0[1], q0[0]], mlTk: null, spreads: [], totals: [] };
      const names = [];
      for (let k = 1; k <= pm.spreads; k++) names.push(`asc-${slug}-neg-${k}pt5`, `asc-${slug}-pos-${k}pt5`);
      for (let k = pm.totals[0]; k <= pm.totals[1]; k++) names.push(`tsc-${slug}-${pm.totalWord ? "total-" : ""}${k}pt5`);
      fan.wait(200);
      const ms = getJson(`${f.polymarket}/v1/markets?${names.map(x => "slug=" + x).join("&")}&limit=100`);
      for (const m of arr(obj(ms).markets)) {
        const q = pmQuotes(m), line = typeof obj(m).line === "number" ? m.line : null;
        if (!q || line === null) continue;
        const [a, b] = q;
        if (a - b > MAX_GAP) continue;
        if (str(m.slug).startsWith("tsc-")) { g.totals.push({ k: line, over: a, under: 1 - b, mid: (a + b) / 2 }); continue; }
        const team = pmLongTeam(ev, m, lg);
        if (team === null) continue;
        const first = team === away ? "away" : "home", k = Math.abs(line), mid = (a + b) / 2;
        if (line < 0) g.spreads.push({ fav: first, k, favAsk: a, dogAsk: 1 - b, mid, tk: null, src: "" });
        else g.spreads.push({ fav: first === "away" ? "home" : "away", k, favAsk: 1 - b, dogAsk: a, mid: 1 - mid, tk: null, src: "" });
      }
      const had = out.findIndex(x => x.id === g.id);
      if (had >= 0) out[had] = g; else out.push(g);
    }
    return out;
  };

  // ---- The merge ----
  const avg = a => a.reduce((s, x) => s + x, 0) / a.length;
  // The strike nearest 50% from per-source ladders: strikes quoted by every source win over partial ones.
  const pick = (ladders, key, mid) => {
    const groups = [];
    for (const l of ladders) for (const e of l) { const k = key(e), g = groups.find(g => g[0] === k); if (g) g[1].push(e); else groups.push([k, [e]]); }
    const full = groups.filter(g => g[1].length === ladders.length), pool = full.length ? full : groups;
    const score = g => Math.abs(avg(g[1].map(mid)) - 0.5);
    pool.sort((a, b) => cmp(score(a), score(b)));
    return pool.length ? pool[0][1] : null;
  };
  // "Nov 3, 2026, 9:05 AM MT"
  const asOf = now => { const t = fan.local(now, "America/Denver"), h = t.hour % 12 || 12; return `${label(MONTHS[t.month - 1].toLowerCase())} ${t.day}, ${t.year}, ${h}:${String(t.minute).padStart(2, "0")} ${t.hour < 12 ? "AM" : "PM"} MT`; };

  // sources: [name, games] in order. liveOnly writes only games under way, with no meta. The answer: { docs: [[id, data]], meta: [id, data] or null }.
  const merge = (sources, metaId, liveOnly, now) => {
    const ids = [...new Set(sources.flatMap(s => s[1].map(g => g.id)))].sort(), docs = [];
    for (const id of ids) {
      let gs = sources.flatMap(([n, m]) => { const g = m.find(x => x.id === id); return g ? [[n, { ...g, spreads: g.spreads.map(e => ({ ...e })) }]] : []; });
      const starts = gs.map(x => x[1].start).filter(s => s !== null), first = starts.length ? Math.min(...starts) : null, started = first !== null && now > first;
      if (liveOnly && !started) continue;
      let lad = null;
      if (!liveOnly) {   // the ladder for in-game hedges, with both venues' asks side by side and Kalshi's market tickers
        const mlA = {}, mlH = {}, rungs = [];
        for (const [n, g] of gs) {
          const q = n === "kalshi" ? "k" : "p";
          if (g.ml) { mlA[q] = f4(g.ml[0]); mlH[q] = f4(g.ml[1]); if (q === "k" && g.mlTk) { mlA.tk = g.mlTk[0]; mlH.tk = g.mlTk[1]; } }
          for (const e of g.spreads) {
            const key = `${e.fav}|${e.k}`;
            let r = rungs.find(x => x.key === key);
            if (!r) { r = { key, fav: e.fav, k: e.k, cells: {} }; rungs.push(r); }
            r.cells[q + "f"] = f4(e.favAsk);
            r.cells[q + "d"] = f4(e.dogAsk);
            if (q === "k") r.cells.tk = e.tk;
          }
        }
        const cell = (r, k) => (k in r.cells ? r.cells[k] : null);
        const sp = rungs.filter(r => r.k >= 1.5 && r.k <= 20.5).sort((p, q) => cmp(p.k, q.k) || cmp(p.fav, q.fav)).map(r => [r.fav, r.k, cell(r, "kf"), cell(r, "kd"), cell(r, "tk"), cell(r, "pf"), cell(r, "pd")]);
        const k = gs.find(x => x[0] === "kalshi");
        lad = { v: 2, at: now, ml: { away: mlA, home: mlH }, sp, tot: k ? k[1].totals.map(e => [e.k, f4(e.over), f4(e.under)]) : [] };
      }
      if (started && gs.some(x => x[0] === "kalshi")) gs = gs.filter(x => x[0] === "kalshi");   // in-game the exchanges drift apart: use Kalshi alone, the deeper book
      if (started && now > first + 4 * HOUR) continue;   // finished: keeps its saved lines
      for (const [n, g] of gs) for (const e of g.spreads) e.src = label(n);
      const mls = gs.map(x => x[1].ml).filter(Boolean);
      if (!mls.length) continue;
      const ml = [american(lowest(mls.map(m => m[0]))), american(lowest(mls.map(m => m[1])))];
      const sp = pick(gs.map(x => x[1].spreads).filter(l => l.length), e => `${e.fav}|${e.k}`, e => e.mid), tt = pick(gs.map(x => x[1].totals).filter(l => l.length), e => String(e.k), e => e.mid);
      if (!sp || !tt) continue;
      const fav = sp[0].fav, k = sp[0].k, favAsk = lowest(sp.map(e => e.favAsk)), dogAsk = lowest(sp.map(e => e.dogAsk)), favP = american(favAsk), dogP = american(dogAsk);
      const line = { sp: fav === "away" ? -k : k, spj: fav === "away" ? [favP, dogP] : [dogP, favP], tot: tt[0].k, toj: [american(lowest(tt.map(e => e.over))), american(lowest(tt.map(e => e.under)))], ml };
      const data = {};
      if (started) data.live = { ...line, at: now };
      else {
        // The band the flagged-pair popup builds; see lines.js in the get-lines skill for what each rung means.
        const k2 = Math.floor(k) + 4.5, dogSide = fav === "home" ? "away" : "home";
        const at = (side, strike) => gs.flatMap(x => x[1].spreads).filter(e => e.fav === side && e.k === strike).map(e => [e.src, e.dogAsk]);
        const c2 = cheapest(at(fav, k2));
        if (c2) {
          const band = { fav, K: k, K2: k2, c1: f4(favAsk), c2: f4(c2[1]), src2: c2[0] }, c3 = cheapest(at(dogSide, 3.5));
          if (c3) Object.assign(band, { K3: 3.5, c3: f4(c3[1]), src3: c3[0] });
          data.band = band;
        }
        const mlVenue = away => { const c = cheapest(gs.filter(x => x[1].ml).map(x => [label(x[0]), x[1].ml[away ? 0 : 1]])); return c ? [c[0], f4(c[1])] : null; };
        const leg = of => { const c = cheapest(sp.map(e => [e.src, of(e)])); return c ? [c[0], f4(c[1])] : null; };
        data.line = line;
        data.venue = { ml: { away: mlVenue(true), home: mlVenue(false) }, sp: { fav: leg(e => e.favAsk), dog: leg(e => e.dogAsk) } };
      }
      if (lad) data.lad = lad;
      docs.push([id, data]);
    }
    return { docs, meta: liveOnly ? null : [metaId, { asOf: asOf(now), source: `${sources.map(s => label(s[0])).join(" + ")} best ask`, at: now }] };
  };

  // One pull of a league's slate, from the venues whose prices are on (`prices`). A full pull is Kalshi and, for a league with Polymarket US, it too; live is Kalshi alone.
  const pull = (f, n, live, lg, now, prices) => {
    const on = v => prices.includes(v), id = metaKey(lg, n), none = { docs: [], meta: null };
    if (live || !lg.polymarket) return on("kalshi") ? merge([["kalshi", kalshi(f, n, lg)]], id, live, now) : none;
    const sources = [["kalshi", () => kalshi(f, n, lg)], ["polymarket", () => polymarket(f, n, lg)]].filter(s => on(s[0])).map(([v, get]) => [v, get()]);
    return sources.length ? merge(sources, id, false, now) : none;
  };

  // ---- Final scores from ESPN's public scoreboard: an NFL week's regular-season games, or a daily league's day ----
  const finals = (f, lg, n) => {
    const q = lg.daily ? `dates=${n}&limit=40` : `seasontype=2&week=${n}&dates=${SHARED.season.year}`, docs = [];
    for (const e of arr(obj(getJson(`${f.espn}/apis/site/v2/sports/${lg.espn}/scoreboard?${q}`)).events)) {
      if (obj(obj(obj(e).status).type).completed !== true) continue;
      const list = arr(obj(arr(e.competitions)[0]).competitors), side = h => list.find(x => obj(x).homeAway === h);
      const away = side("away"), home = side("home");
      if (!away || !home) continue;
      const code = x => fix(lg.espnCodes, str(obj(x.team).abbreviation));
      docs.push([`${slateTag(lg, n)}-${code(away)}-${code(home)}`, { final: [num(away.score), num(home.score)] }]);
    }
    return docs;
  };

  // ---- Playbook's history: finished regular-season games with closing lines, from nflverse's public games table ----
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const playbookRows = (text, firstSeason) => {
    const lines = text.trim().split("\n"), head = (lines.shift() || "").split(","), rows = [];
    for (const l of lines) {
      const c = l.split(","), cell = name => { const i = head.indexOf(name); return i >= 0 && i < c.length ? c[i] : ""; };
      const n = name => { const v = cell(name); return v === "" || v === "NA" ? null : num(v); };
      if ((whole(cell("season"), true) || 0) < firstSeason || cell("game_type") !== "REG" || n("home_score") === null || n("spread_line") === null) continue;
      rows.push([n("season"), n("week"), DAYS.indexOf(cell("weekday")), num(cell("gametime").replace(":", "")), cell("away_team"), cell("home_team"), n("away_score"), n("home_score"), n("away_rest"), n("home_rest"), n("away_moneyline"), n("home_moneyline"), n("spread_line"), n("away_spread_odds"), n("home_spread_odds"), n("total_line"), n("under_odds"), n("over_odds"), n("div_game") ? 1 : 0, n("wind")]);
    }
    return rows;
  };

  // ---- What to pull when: the connector asks every 30 seconds, and keeps the 15-minute and 5-minute turns itself ----
  const nflWeek = at => 8 + Math.floor((at - SHARED.season.week8) / (7 * DAY));
  const denver = at => fan.local(at, "America/Denver");
  const ymd = t => t.year * 10000 + t.month * 100 + t.day;
  // NFL live prices: Sunday 7 AM to 11:59 PM MT, Monday and Thursday 6 to 9:59 PM MT.
  const liveWindow = at => { const t = denver(at); return t.weekday === 0 ? t.hour >= 7 : (t.weekday === 1 || t.weekday === 4) && t.hour >= 18 && t.hour <= 21; };
  const dayWindow = at => denver(at).hour >= 9;   // a daily league's refreshes: 9 AM to 11:59 PM MT
  // A step is [kind, league, slate]: "lines", "live" or "finals". prefs: { market (Bet tracking's prices), leagues, prices }.
  const steps = (at, p) => {
    const on = l => p.leagues.includes(l), n = nflWeek(at), out = [];
    if (on("nfl") && n >= 1 && n <= 17) {
      if (p.market) { out.push(["lines", "nfl", n]); if (n < 17) out.push(["lines", "nfl", n + 1]); }
      out.push(["finals", "nfl", n]);
    }
    for (const lg of LEAGUES.filter(l => l.daily && on(l.code))) {   // a daily league: today and tomorrow's lines, today and yesterday's finals
      if (!dayWindow(at)) break;
      const day = shift => ymd(denver(at + shift * DAY));
      if (p.market) out.push(["lines", lg.code, day(0)], ["lines", lg.code, day(1)]);
      out.push(["finals", lg.code, day(0)], ["finals", lg.code, day(-1)]);
    }
    return out;
  };
  // Between full turns, the NFL's games under way, every 5 minutes in its live window.
  const liveSteps = (at, p) => { const n = nflWeek(at); return p.market && p.leagues.includes("nfl") && liveWindow(at) && n >= 1 && n <= 17 ? [["live", "nfl", n], ["finals", "nfl", n]] : []; };

  // One step, for the connector to save: { docs, meta }, or { error: { status, message } }. f: the feeds' addresses, { kalshi, polymarket, espn, gamesTable }.
  const answer = job => { try { return job(); } catch (e) { return { error: { status: e && typeof e.status === "number" ? e.status : null, message: String((e && e.message) || e) } }; } };
  const run = (step, now, prices, f) => answer(() => {
    const [kind, code, n] = step, lg = league(code);
    if (!lg) return { docs: [], meta: null };
    return kind === "finals" ? { docs: finals(f, lg, n), meta: null } : pull(f, n, kind === "live", lg, now, prices);
  });
  const playbook = (firstSeason, f) => answer(() => ({ rows: playbookRows(getText(f.gamesTable, 60), firstSeason) }));

  return { steps, liveSteps, run, playbook, merge, playbookRows, american, nflWeek, parseEvent, liveWindow, kalshi, polymarket, finals, league };
})();
export { Lines };
