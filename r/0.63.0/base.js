
import { WEEK_GAMES, NEWS_SOURCES, pullDaily, pullDivisions, pullLeaders, pullNcaafb, pullNews, pullStatus, setRefresh, wantScores } from "./espn.js?v=mw535r31";
import { SPORTSBOOK_ICONS } from "./data/assets.js?v=mw535r31";
import { HELM_PAD, LEAGUES_LATER, LEAGUE_DEFS, LEAGUE_ORDER, NFL_NICKS, PLATE_STATES, TEAM, abbr, leagueOfSlate, lumOf, metaDocId, slateDocId, slateOfDay, slateTitleOf, teamName, teamOf } from "./leagues.js?v=mw535r31";
import { Calc } from "./calc.js?v=mw535r31";
import { Fan } from "./hosts.js?v=mw535r31";
  
  const later = {};
  
  let panels = [], changeQueued = false;
  const dirtyTopics = new Set();
  const definePanels = list => { panels = list; };
  
  
  
  let pressedAt = 0;
  const pressed = () => pressedAt > 0 && Date.now() - pressedAt < 3000;
  const drawAfter = () => { pressedAt = 0; setTimeout(() => { if (!pressed() && dirtyTopics.size) drawNow(); }, 0); };
  addEventListener("pointerdown", () => { pressedAt = Date.now(); setTimeout(() => { if (pressedAt && !pressed()) drawAfter(); }, 3100); }, true);
  ["pointerup", "pointercancel", "blur"].forEach(e => addEventListener(e, drawAfter, true));
  function drawNow() {
    if (pressed()) { changeQueued = false; return; }   
    changeQueued = false;
    const topics = [...dirtyTopics];
    dirtyTopics.clear();
    panels.forEach(([draw, on]) => { if (on.some(t => topics.includes(t))) { try { draw(); } catch (e) { console.error(e); } } });
  }
  const changed = (...topics) => { topics.forEach(t => dirtyTopics.add(t)); if (!changeQueued) { changeQueued = true; queueMicrotask(() => { if (changeQueued) drawNow(); }); } };
  
  
  const addDailyGame = (l, { t, a, h, tv, venue, eid, final, now }) => {
    const w = slateOfDay(l, Number(t.slice(0, 10).replace(/-/g, ""))), g = { t, away: teamName(l, a), home: teamName(l, h), tv, ...(venue && venue[0] ? { arena: venue } : {}), league: l, ...(eid ? { eid } : {}), ...(final ? { final } : now ? { now } : {}), noLine: true, line: { sp: 0, spj: [-110, -110], tot: LEAGUE_DEFS[l].neutralTotal, toj: [-110, -110], ml: [-110, -110] }, week: w };
    (WEEK_GAMES[w] = WEEK_GAMES[w] || []).push(g);
    return g;
  };
  Object.entries(WEEK_GAMES).forEach(([w, list]) => list.forEach(g => { g.week = Number(w); }));
  let league = "nfl";   
  document.documentElement.dataset.league = league;   
  
  
  const LAYOUTS = [["auto", "Auto"], ["landscape", "Landscape"], ["portrait", "Portrait"]];   
  let layoutPref = "auto";
  try { const v = localStorage.getItem("fan.layout"); if (LAYOUTS.some(([k]) => k === v)) layoutPref = v; } catch (e) {}
  const mq = q => matchMedia(q).matches;
  const LAYOUT_QUERIES = { phone: "(max-width: 760px)", narrow: "(max-width: 920px)", portrait: "(orientation: portrait) and (min-width: 921px)" };
  function applyLayout() {
    const auto = layoutPref === "auto", c = document.documentElement.classList;
    c.toggle("layout-phone", auto && mq(LAYOUT_QUERIES.phone));
    c.toggle("layout-narrow", auto && mq(LAYOUT_QUERIES.narrow));
    c.toggle("layout-portrait", auto ? mq(LAYOUT_QUERIES.portrait) : layoutPref === "portrait");
  }
  applyLayout();
  const layoutLists = Object.values(LAYOUT_QUERIES).map(q => matchMedia(q));   
  layoutLists.forEach(m => m.addEventListener("change", applyLayout));
  addEventListener("resize", applyLayout);
  
  
  
  let lastSize = "", sizeTimer = 0;
  function sendSize() {
    if (!Fan.store || !Fan.hostHello) return;   
    const c = document.documentElement.classList, size = { inner: [innerWidth, innerHeight], outer: [outerWidth, outerHeight], screen: [screen.width, screen.height], room: [screen.availWidth, screen.availHeight],
      zoom: devicePixelRatio, layout: c.contains("layout-phone") ? "phone" : c.contains("layout-narrow") ? "narrow" : c.contains("layout-portrait") ? "portrait" : "landscape", layoutPref, fullscreen: !!document.fullscreenElement, version: APP_VERSION };
    const text = JSON.stringify(size);
    if (text === lastSize) return;
    lastSize = text;
    Fan.store.set("window", "size", { ...size, at: Date.now() }).catch(() => { lastSize = ""; });
  }
  const waitSize = () => { clearTimeout(sizeTimer); sizeTimer = setTimeout(sendSize, 2000); };
  addEventListener("resize", waitSize);
  setTimeout(sendSize, 5000);
  function setLayoutPref(k) { layoutPref = k; try { localStorage.setItem("fan.layout", k); } catch (e) {} applyLayout(); changed("size", "cards"); }
  const isPhone = () => document.documentElement.classList.contains("layout-phone");
  
  const isTall = () => (layoutPref === "auto" ? mq("(orientation: portrait)") : layoutPref === "portrait");
  const LG = () => Calc.RULES.leagues[league];
  const nbaDay = (add = 0) => Number(new Date(Date.now() + add * 864e5).toLocaleDateString("en-CA", { timeZone: "America/New_York" }).replace(/-/g, ""));
  
  let riskGame = null;
  const setRiskGame = g => { riskGame = g; changed("selection"); };
  let detailGame = null;   
  
  
  let previewFrom = null;
  const setDetailGame = (g, from) => { detailGame = g; previewFrom = g ? from || null : null; };
  const inRiskGame = t => { const k = gameKey(riskGame); return t.key === k || (!t.key && t.kickoff === riskGame.t && t.game === gameLabel(riskGame)) || (t.parlay && t.legs.some(l => l.key === k)); };
  
  const ticketsInView = () => riskGame ? tickets.filter(inRiskGame) : tickets;
  const gamesInView = () => riskGame ? [riskGame] : GAMES;
  let curWeek = 7, GAMES = WEEK_GAMES[7] || [], view = "week";   
  
  const SECTIONS = {
    handicap: [{ k: "main", h: "Handicap" }],   
    code: [],   
    ncaafb: [{ k: "main", h: "NCAA FB", stub: "Not built yet." }],
    ledger: [{ k: "balances", h: "Balances" },
      { k: "weeks", h: "By week", stub: "Wagered, won and lost, and net cash for each week." },
      { k: "open", h: "Open bets", stub: "Every bet still undecided, across all weeks and books." },
      { k: "check", h: "Kalshi check" }]
  };
  const subView = { ledger: "balances", handicap: "main", ncaafb: "main" };
  
  async function drawNcaafb() {
    const box = $("ncaafb");
    if (!box.firstChild) box.replaceChildren(el("div", "page-stub", "NCAA FB"), el("p", "page-stub-text", "Asking ESPN…"));
    let slate;
    try { slate = await pullNcaafb(); } catch (e) { box.replaceChildren(el("div", "page-stub", "NCAA FB"), el("p", "page-stub-text", "Couldn't reach ESPN.")); return; }
    const team = s => { const c = el("td", "cfb-team"); if (s.rank) c.append(el("small", null, "#" + s.rank + " ")); c.append(s.name); return c; };
    const rows = slate.games.map(g => {
      const tr = el("tr"), started = g.state !== "pre", net = el("td", "cfb-net"), tvBtn = el("button");
      tvBtn.type = "button"; tvBtn.title = "Live telecast"; tvBtn.setAttribute("aria-label", "Live telecast"); tvBtn.innerHTML = GAME_CARD_ACTIONS.find(([name]) => name === "Live telecast")[1];
      tvBtn.addEventListener("click", () => { later.watchGame(g); });   
      net.append(g.tv, tvBtn);
      tr.append(el("td", null, timeZoned(new Date(g.t))), team(g.away), el("td", "cfb-num", started ? String(g.away.score) : ""), team(g.home), el("td", "cfb-num", started ? String(g.home.score) : ""), el("td", null, started ? g.detail : ""), net);
      return tr;
    });
    const table = el("table", "cfb-list"), head = el("tr");
    ["Kickoff", "Away", "", "Home", "", "Status", "Network"].forEach(h => head.append(el("th", null, h)));
    const thead = el("thead"), tbody = el("tbody"); thead.append(head); tbody.append(...rows); table.append(thead, tbody);
    box.replaceChildren(el("div", "page-stub", "NCAA FB"), el("p", "page-stub-text", `Top 25 teams today. ESPN as of ${timeZoned(new Date(slate.asOf))}: reopen the page to read it again.`), table);
  }
  
  function drawStub(v) {
    if (v === "ncaafb") { drawNcaafb(); return true; }
    if (v === "handicap" && !LG().handicap) { $(v).replaceChildren(el("div", "page-stub", `${LG().code} handicap`), el("p", "page-stub-text", "Not built yet: the NFL first.")); return true; }
    const s = SECTIONS[v].find(x => x.k === subView[v]);
    if (!s.stub) return false;
    $(v).replaceChildren(el("div", "page-stub", s.h), el("p", "page-stub-text", s.stub));
    return true;
  }
  const LEAGUES = [];   
  const leagueNames = () => Object.fromEntries(LEAGUE_ORDER.map(k => [k, LEAGUE_DEFS[k].name]));
  
  const graphGames = () => GAMES.filter(g => !g.final && status(g)[0] === "Upcoming" && !(g.line && (g.line.noSp || g.line.noTot)));   
  const ALL_GAMES = Object.keys(WEEK_GAMES).map(Number).sort((p, q) => p - q).flatMap(w => WEEK_GAMES[w]);
  
  const calc = Calc.make({ games: ALL_GAMES, now: () => Date.now(), abbr: n => abbr(n) });
  const { RULES, leagueId, leagueOf, outcomes, last, nick, gameLabel, gameKey, pts, profitOf, riskOf, decimalOf, ticketPrice, legResult, ticketPL, marginModel, lineOk, FAN_CLASSES, betClass, odds, contractsFor, kalshiCalc, centsOf, americanOf, fillSide, fillAmounts, kalshiMarket, freshPrices, evMoneyline, evPoints, pairFlagged, pairStakes, replyFill } = Calc;
  const { status, settleOf, vigOf, projectedPL, deadFor, shareRisk, shareTerm, extremes, hedgeFor, readTicker, ticketFromFill, kalshiCheck, ledgerRows } = calc;
  
  const gameBets = g => calc.gameBets(g, tickets), parlayShares = g => calc.parlayShares(g, tickets), spentShares = g => calc.spentShares(g, tickets), gameSettledPL = g => calc.gameSettledPL(g, tickets);
  
  function teamLook(g, side) {
    const { bg, fg } = teamOf(g, side);
    return { bg, fg, outline: bg === "#000000" ? fg : null };
  }
  
  const brighterOf = (g, side) => { const { bg, fg } = teamOf(g, side); return lumOf(bg) >= lumOf(fg) ? bg : fg; };
  
  function teamChip(g, side, text, cls) {
    const k = teamLook(g, side), c = el("span", "team-chip" + (cls ? " " + cls : ""), text);
    c.style.background = k.bg; c.style.color = k.fg;
    if (k.outline) c.style.borderColor = k.outline;
    return c;
  }
  
  
  function gdBadge(g, side, label) {
    const nk = nick(g, side), badge = el("div", "gd-badge"), look = teamLook(g, side);
    const [r_, g_, b_] = [1, 3, 5].map(i => { const v = parseInt(look.bg.slice(i, i + 2), 16); return Math.round(v + (255 - v) * .33); }), paper = [26, 31, 38];
    badge.style.background = `rgb(${Math.round((r_ + paper[0]) / 2)} ${Math.round((g_ + paper[1]) / 2)} ${Math.round((b_ + paper[2]) / 2)})`;
    badge.style.color = look.fg;
    if (hasArt(nk)) badge.append(helmImg(nk, "gd-badge-helm"));
    badge.append(el("span", "gd-badge-name", label || last(g[side]).toUpperCase()));
    return badge;
  }

  
  
  const SPORTSBOOK_ABBR = { "DraftKings": "DK", "FanDuel": "FD", "BetMGM": "MGM", "Caesars": "CP", "bet365": "365", "BetRivers": "BR", "ESPN Bet": "ESPN", "Fanatics": "FAN", "Hard Rock Bet": "HR", "Circa Sports": "CIR", "Bally Bet": "BAL", "BetMonarch": "MON", "ClutchBet": "CLU", "SBK": "SBK", "SI Sportsbook": "SI", "Sporttrade": "ST", "Kalshi": "KAL", "Betsafe": "BSF", "Other": "OTH" };
  const sportsbookAbbr = name => SPORTSBOOK_ABBR[name] || name;
  
  function sportsbookTag(name, iconOnly, short) {
    const tag = el("span", "sportsbook-tag"), src = SPORTSBOOK_ICONS[name];
    if (src) { const i = document.createElement("img"); i.className = "sportsbook-icon"; i.src = src; i.alt = ""; i.width = i.height = 16; tag.append(i); }
    if (!(iconOnly && src)) tag.append(document.createTextNode(short ? sportsbookAbbr(name) : name));
    if (short || iconOnly) tag.title = name;
    return tag;
  }

  const APP_VERSION = "0.63.0";   
  const $ = id => document.getElementById(id);
  document.title = "Fan " + APP_VERSION;
  $("appName").textContent = APP_VERSION;   
  $("infoVer").textContent = APP_VERSION;   
  
  
  let PROGRAMS = {};
  window.fetch?.("programs.json").then(r => (r.ok ? r.json() : {})).then(j => { PROGRAMS = j || {}; }, () => {});
  const newestFor = os => (os === "linux" && PROGRAMS.chromebook) || APP_VERSION;
  const programBehind = (v, os) => { const minor = s => s.split(".").slice(0, 2).map(Number); if (!v) return true; const [a, b] = minor(v), [c, d] = minor(newestFor(os)); return a < c || (a === c && b < d); };
  
  
  
  
  const pageRelease = (location.pathname.match(/\/r\/([^/]+)\//) || [])[1] || "";   
  
  
  
  
  const rootPath = location.pathname.replace(/r\/[^/]+\/[^/]*$/, "");
  const versionOrder = (p, q) => { const [a, b] = [p, q].map(s => s.split(".").map(Number)); for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };
  let servedRelease = "", siteRelease = "", siteBase = Fan.hostHello ? "" : rootPath;
  function showNewest() {
    const newest = [servedRelease, siteRelease].filter(v => /^\d+\.\d+\.\d+$/.test(v)).sort(versionOrder).pop() || "";
    const on = !!pageRelease && pageRelease !== "dev" && /^\d+\.\d+\.\d+$/.test(pageRelease) && !!newest && versionOrder(newest, pageRelease) > 0;
    $("newestBtn").hidden = !on;
    $("newestBtn").title = on ? `This window holds ${pageRelease}; ${newest} is out` : "";
  }
  const readSite = () => { if (siteBase && pageRelease && pageRelease !== "dev") window.fetch?.(siteBase + "version.txt?t=" + Date.now(), { cache: "no-store", credentials: "omit" }).then(r => (r.ok ? r.text() : "")).then(t => { siteRelease = t.trim().split(/\s+/)[0]; showNewest(); }, () => {}); };
  readSite(); setInterval(readSite, 600000);
  $("newestBtn").addEventListener("click", async () => {
    $("newestBtn").disabled = true; $("newestBtn").textContent = "Getting the latest client";
    if (Fan.hostHello && siteRelease && (!servedRelease || versionOrder(siteRelease, servedRelease) > 0)) {
      try { await window.fetch("/connector/page", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "take" }) }); } catch (e) {}   
    }
    location.assign(rootPath + location.search);
  });
  function showVersion(v, dev, os, page) {
    servedRelease = (page && page.version) || "";
    if (page && page.source && /^https:\/\//.test(page.source) && siteBase !== page.source) { siteBase = page.source; readSite(); }   
    showNewest();
    const ver = $("infoVer"), behind = !!v && programBehind(v, os), devOn = !!dev;
    const engine = page && page.releases && page.version && pageRelease && pageRelease !== "dev" && page.version !== pageRelease ? page.version : "";
    if (behind === ver.classList.contains("behind") && devOn === ver.classList.contains("dev") && engine === (ver.dataset.engine || "")) return;
    ver.dataset.engine = engine;
    ver.classList.toggle("behind", behind);
    ver.classList.toggle("dev", devOn);
    ver.title = engine ? `This page is release ${pageRelease}; the connector's engine runs ${engine}. This page's risk and Place use ${pageRelease}'s math, the engine's algos and checks ${engine}'s. Open Fan from its root for ${engine}.` : behind ? `The Fan connector is ${v}: update it on the Application tab` : devOn ? `Dev mode: the connector serves the working copy in ${dev}, not the site's page. The next release turns it off.` : "";
    ver.replaceChildren(APP_VERSION);
    if (devOn) ver.append(el("span", "dev-mark", "DEV"));
    if (engine) ver.append(el("span", "engine-mark", "ENGINE " + engine));
    if (behind) { const up = el("span", "up-mark"); up.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 17V7M7.5 11.5 12 7l4.5 4.5"/></svg>'; ver.append(up); }
    fitSlateLine();
  }
  $("infoVer").addEventListener("click", () => { if ($("infoVer").classList.contains("behind")) $("fanBtn").click(); });
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;   
  const dayFmt = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: tz });
  const shortDayFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: tz });
  const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });
  
  const zoneFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz, timeZoneName: "shortGeneric" });
  const timeZoned = d => zoneFmt.formatToParts(d).map(p => p.type === "timeZoneName" && p.value.includes(" ") ? p.value.split(" ").map(w => w[0]).join("") : p.value).join("");
  
  const money = n => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  

  
  
  let allTickets = [], tickets = [], weirdFills = [];   
  const setWeirdFills = w => { weirdFills = w; };
  const weekOf = t => t.week ?? 7;
  
  let trackingOn = false;
  try { trackingOn = localStorage.getItem("fan.tracking") === "on"; } catch (e) {}
  document.documentElement.classList.toggle("tracking-off", !trackingOn);
  
  let scoutWanted = false;   
  try { const p = localStorage.getItem("fan.prices"); scoutWanted = p === "on" || (p == null && trackingOn); } catch (e) {}
  const setScoutWanted = on => { scoutWanted = on; };
  const marketWanted = () => scoutWanted;
  const scoutOn = () => marketWanted() && !!Fan.lines;
  document.documentElement.classList.toggle("scout-off", !trackingOn || !scoutWanted);   
  document.documentElement.classList.add("bet-off");   
  
  let leaguesOn = new Set(["nfl"]);
  
  const ticketLeagueOn = t => { const w = weekOf(t); return !w || leaguesOn.has(leagueOfSlate(w)); };
  const weekTickets = () => (trackingOn ? allTickets.filter(t => weekOf(t) === curWeek) : []);
  
  const rekey = k => {
    if (!k || k === "parlay" || ALL_GAMES.some(g => gameKey(g) === k)) return k;
    const cut = k.indexOf("|"), at = Date.parse(k.slice(0, cut)), label = k.slice(cut + 1), g = ALL_GAMES.find(x => gameLabel(x) === label && Math.abs(Date.parse(x.t) - at) < 8 * 864e5);
    return g ? gameKey(g) : k;
  };
  const setTickets = all => { all.forEach(t => { if (t.key) t.key = rekey(t.key); (t.legs || []).forEach(l => { if (l.key) l.key = rekey(l.key); }); }); allTickets = all; tickets = weekTickets(); changed("tickets"); };
  const setTrackingOn = on => { trackingOn = on; setTickets(allTickets); };
  
  const selectSlate = w => { curWeek = w; GAMES = WEEK_GAMES[w] || (WEEK_GAMES[w] = []); setTickets(allTickets); };
  
  
  let slateDocs = [];
  
  let noteText = "", hostProblem = "";
  function slateNote(text) { noteText = text; if (pullStatus()) text = pullStatus(); if (hostProblem) text = hostProblem; $("slateNote").textContent = text; $("slateNote").classList.toggle("problem", !!hostProblem); fitSlateLine(); }
  
  
  
  const servedDev = [...document.scripts].some(s => s.textContent.includes("/connector/saves"));
  const devFollow = dev => { if (location.origin + "/" !== Fan.localFan || !!dev === servedDev) return; let last = null; try { last = sessionStorage.getItem("fan.devReload"); sessionStorage.setItem("fan.devReload", String(!!dev)); } catch (e) {} if (last !== String(!!dev)) location.replace("/" + location.search); };   
  const askHost = () => { if (Fan.hostHello) Fan.hostHello().then(hi => { setConnectorNews(hi.news); showVersion(hi.version, hi.pageDev, hi.os, hi.page); devFollow(hi.pageDev); return hi.refresh || ""; }, () => "The connector isn't answering").then(p => { if (p !== hostProblem) { hostProblem = p; slateNote(noteText); } }); };
  setTimeout(askHost, 3000); setInterval(askHost, 10000);
  
  let slateAt = 0, linesAt = 0;   
  const staleCheck = () => $("slateNote").classList.toggle("stale", slateAt > 0 && Date.now() - slateAt > 3600000);
  setInterval(staleCheck, 60000);
  
  function fitSlateLine() {
    const line = document.querySelector("fan-info-line"), note = $("slateNote"), wager = document.querySelector(trackingOn ? ".col.left" : ".strip.bottom");   
    if (!line || !wager) return;
    const W = wager.getBoundingClientRect().right - line.getBoundingClientRect().left;
    if (!(W > 0)) return;
    line.style.width = W + "px";
    const box = document.querySelector(".bye-box"), byes = () => box.scrollWidth + 24, rest = () => note.scrollWidth + $("infoVer").scrollWidth + 14 + ($("demoBadge") ? $("demoBadge").offsetWidth + 14 : 0);
    
    const shrink = (holder, need) => { holder.style.setProperty("--slate-fs", "16px"); let fs = Math.max(8, Math.min(16, 16 * W / need())); holder.style.setProperty("--slate-fs", fs + "px"); while (fs > 8 && need() > W) { fs = Math.max(8, fs - .5); holder.style.setProperty("--slate-fs", fs + "px"); } };
    box.style.removeProperty("--slate-fs"); line.style.setProperty("--slate-fs", "16px");
    
    const fold = document.documentElement.classList.contains("layout-narrow") && byes() + rest() > W;
    line.classList.toggle("folded", fold);
    if (fold) { shrink(line, rest); shrink(box, byes); } else shrink(line, () => byes() + rest());
  }
  window.addEventListener("resize", () => fitSlateLine());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fitSlateLine());
  
  const SCHEDULE_LINES = new Map(ALL_GAMES.map(g => [g, { line: g.line, noLine: g.noLine }]));
  function clearPrices() {
    ALL_GAMES.forEach(g => {
      const s = SCHEDULE_LINES.get(g);
      if (!s) return;
      g.line = s.line; if (s.noLine) g.noLine = true; else delete g.noLine;
      delete g.live; delete g.lad; delete g.band; delete g.venue;
    });
  }
  function applySlate(docs) {
    if (docs) slateDocs = docs;
    let meta = null;
    linesAt = 0;
    slateDocs.forEach(d => {
      const v = d.data() || {};
      if (/^meta/.test(d.id) && scoutOn()) linesAt = Math.max(linesAt, Number(v.at) || 0);
      if (d.id === metaDocId(curWeek)) { if (scoutOn()) meta = v; return; }
      const g = ALL_GAMES.find(x => slateDocId(x) === d.id);
      if (!g) return;
      if (Array.isArray(v.final)) g.final = v.final; else if (v.final === null) delete g.final;
      if (!scoutOn()) return;
      const implied = l => (l && l.noSp ? { ...l, sp: Calc.spreadFromMl(l.ml, leagueOf(g).sigma) } : l);   
      if (v.line) { g.line = implied(v.line); delete g.noLine; }
      else if (v.live && g.noLine) { g.line = implied(v.live); delete g.noLine; }   
      if (v.live) g.live = implied(v.live); else delete g.live;
      if (v.lad) g.lad = v.lad; else delete g.lad;   
      if (v.band) g.band = v.band; else delete g.band;
      if (v.venue) g.venue = v.venue; else delete g.venue;   
    });
    slateNote(meta ? `Lines ${meta.at ? `${new Date(meta.at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: tz })}, ${timeZoned(new Date(meta.at))}` : String(meta.asOf).replace(/, \d{4}/, "")}` : "No lines yet");
    slateAt = meta && Number(meta.at) || 0; staleCheck();
    changed("lines");
  }
  function watchSlate() {
    Fan.lines.watch("slate", rows => {
      applySlate(rows.map(r => ({ id: r.id, data: () => r.data })));
    }, () => slateNote("Connection lost: reload the page"));
  }
  const startLines = () => { later.syncScout(); if (Fan.lines) watchSlate(); };
  setRefresh(() => changed("cards"));

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }


  
  const lineOf = g => (g.live && status(g)[1] === "live") ? g.live : g.line;

  
  function helmImg(n, cls) {
    const img = el("img", cls); img.src = TEAM[n].art; img.alt = ""; img.draggable = false;
    if (HELM_PAD[n]) img.style.objectViewBox = `inset(0 0 0 ${HELM_PAD[n]}%)`;
    return img;
  }
  const hasArt = n => !!(TEAM[n] && TEAM[n].art);

  
  const GAME_CARD_ACTIONS = [
    ["Game preview", '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3.500l5 5M8 3.500l-5 5"/><circle cx="5.500" cy="18" r="3"/><circle cx="18.500" cy="18.500" r="2.500"/><path d="M10.500 6c5 0 8 2.500 8 8"/><path d="M15.500 12l3 2.500 2.500-3"/></svg>'],
    ["Box score", '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.500" width="18" height="15" rx="1.500"/><path d="M3 9.500h18M3 14.500h18M9.500 4.500v15M15.250 4.500v15"/></svg>'],
    ["Live telecast", '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7.500" width="18" height="12.500" rx="2"/><path d="M8.500 3l3.500 4.500L15.500 3"/></svg>'],
    ["Tape", '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="1.500"/><circle cx="12" cy="6.500" r="1.500"/><circle cx="12" cy="17.500" r="1.500"/><circle cx="6.500" cy="12" r="1.500"/><circle cx="17.500" cy="12" r="1.500"/></svg>'],
    ["Risk detail", '<svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 13.5c3 0 3.8-1.6 4.8-4.8C6.6 6 7 3 8 3s1.400 3 2.200 5.700c1 3.200 1.800 4.800 4.800 4.800"/></svg>']
  ];
  
  { const first = GAMES.find(g => g.away.endsWith("Packers")) || GAMES[0]; var riskKeyStart = first ? gameKey(first) : ""; }
  let riskKey = riskKeyStart;
  const setRiskKey = k => { riskKey = k; };

  
  
  

  
  
  
  function resultCell(t) {
    const s = settleOf(t), c = el("span", "rk-num res");
    c.append(el("small", null, "Result"),
      el("b", s.state === "won" ? "profit" : s.state === "lost" ? "loss" : "dim", s.state === "pending" ? "Pending" : `${s.state[0].toUpperCase() + s.state.slice(1)} ${money(s.payout)}`),
      el("small", null, s.state === "pending" ? " " : `net ${signedMoney(s.net)}`));
    return c;
  }
  const legGame = l => GAMES.find(g => gameKey(g) === l.key);
  
  const legText = l => {
    const g = ALL_GAMES.find(x => gameKey(x) === l.key), game = g ? `${abbr(nick(g, "away"))} @ ${abbr(nick(g, "home"))}` : (l.game || "").split(" at ").map(n => abbr(last(n))).join(" @ ");
    const s = l.type === "Total" ? l.side : abbr(l.side);
    const price = l.odds != null ? ` (${odds(l.odds)})` : "";
    const what = l.type === "Moneyline" ? `${s} ML${l.line != null ? " " + odds(l.line) : ""}` : l.type === "Spread" ? `${s} ${pts(l.line)}${price}` : `${s} ${l.line}${price}`;
    return `${game} · ${what}`;
  };

  const signedMoney = v => { const r = Math.round(v); return (r < 0 ? "−" : r > 0 ? "+" : "") + money(Math.abs(r)); };

  
  const riskByWeek = Object.fromEntries(Object.keys(WEEK_GAMES).map(w => [w, ""]));
  riskByWeek[7] = riskKey;
  
  
  const nflWeek = () => {
    const now = Date.now(), next = Object.keys(WEEK_GAMES).map(Number).filter(w => w >= 1 && w <= 17).sort((p, q) => p - q).find(w => WEEK_GAMES[w].some(g => !g.final && Date.parse(g.t) + Calc.RULES.leagues.nfl.liveHours * 3600e3 > now));
    return next || Math.max(1, Math.min(17, 8 + Math.floor((now - new Date(2026, 9, 28).getTime()) / 604800000)));
  };
  const weekNow = () => (LG().daily ? slateOfDay(league, nbaDay()) : nflWeek());   
  function graphsOK() {
    const next = LG().daily ? slateOfDay(league, nbaDay(1)) : weekNow() + 1;   
    if (!LG().graphs || (curWeek !== weekNow() && curWeek !== next)) return false;
    const open = graphGames();
    return open.length > 0 && open.every(g => !g.noLine);
  }
  const drawLeagueStub = () => { if (LEAGUES.includes(view)) drawStub(view); };
  function showView(v) {
    view = v;
    $("ledger").hidden = v !== "ledger"; $("graphs").hidden = v !== "graphs"; $("handicap").hidden = v !== "handicap"; $("code").hidden = v !== "code"; $("slate").hidden = v !== "week";
    LEAGUES.forEach(k => { $(k).hidden = v !== k; });
    ["ledger", "graphs", "handicap", "code"].forEach(k => $("tab-" + k).setAttribute("aria-selected", String(v === k)));
    document.querySelectorAll(".strip-tabs [data-week]").forEach(b => { const w = Number(b.dataset.week); b.classList.toggle("now", w === weekNow()); b.setAttribute("aria-selected", String(!SECTIONS[v] && w === curWeek)); });   
    syncDayArrows();
    changed("view", "view:" + v);
    syncLeaguePick();
  }
  $("tab-graphs").addEventListener("click", () => { detailGame = null; if (view === "graphs") { showView("week"); } else showView("graphs"); });   
  
  ["handicap", "ledger", "code"].forEach(k => $("tab-" + k).addEventListener("click", () => { if (view === k) { detailGame = null; switchWeek(weekNow()); } else showView(k); }));
  
  
  
  let dayShift = 0;
  const maxShift = l => LEAGUE_DEFS[l].days - 6;   
  const canShiftBack = l => nbaDay(dayShift - 2) >= seasonDay(l);
  const dayTabs = () => [...document.querySelectorAll(".strip-tabs [data-week]")].slice(0, LEAGUE_DEFS[league].days + 1);
  function openSlot() { const tabs = dayTabs(), i = tabs.findIndex(b => Number(b.dataset.week) === curWeek); return i >= 0 ? i : tabs.findIndex(b => Number(b.dataset.week) === weekNow()); }
  function syncDayArrows() {
    const daily = Calc.RULES.leagues[league].daily, i = daily ? openSlot() : -1;
    $("dayPrev").hidden = $("dayNext").hidden = !daily;
    $("dayPrev").disabled = !daily || (!canShiftBack(league) && i <= 0);
    $("dayNext").disabled = !daily || (dayShift >= maxShift(league) && i >= dayTabs().length - 1);
  }
  function stepDay(by) {
    const i = openSlot();
    let to = i + by;
    if (by > 0 ? dayShift < maxShift(league) : canShiftBack(league)) { dayShift += by; labelTabs(league); to = i; }   
    const b = dayTabs()[to];
    if (!b) return;
    detailGame = null;
    switchWeek(Number(b.dataset.week));
  }
  const seasonDay = l => Number(new Date(LEAGUE_DEFS[l].start).toISOString().slice(0, 10).replace(/-/g, ""));
  function labelTabs(l) {
    const daily = Calc.RULES.leagues[l].daily;
    [...document.querySelectorAll(".strip-tabs [data-week]")].forEach((b, i) => {
      b.style.display = daily && i > LEAGUE_DEFS[l].days ? "none" : "";
      if (!daily) { b.dataset.week = String(i + 1); b.textContent = "Week " + (i + 1); return; }
      const d = new Date(Date.now() + (i - 1 + dayShift) * 864e5);
      b.dataset.week = String(slateOfDay(l, nbaDay(i - 1 + dayShift)));
      b.textContent = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
      b.classList.toggle("now", Number(b.dataset.week) === weekNow());
      b.setAttribute("aria-selected", String(!SECTIONS[view] && Number(b.dataset.week) === curWeek));
    });
    syncDayArrows();
  }
  $("dayPrev").addEventListener("click", () => stepDay(-1));
  $("dayNext").addEventListener("click", () => stepDay(1));
  function setLeague(l) {
    league = l;
    document.documentElement.dataset.league = l;
    dayShift = 0;
    labelTabs(l);
    detailGame = null;
    switchWeek(weekNow());
    later.drawByes();
  }
  
  
  const pickable = () => LEAGUE_ORDER.filter(k => !LEAGUES_LATER.includes(k));
  const closeLeagues = () => { $("leagueList").hidden = true; $("leaguePick").setAttribute("aria-expanded", "false"); };
  function pickLeague(k) {
    closeLeagues();
    if (LEAGUES.includes(k)) showView(k);
    else if (k !== league) setLeague(k);
    else if (LEAGUES.includes(view)) { detailGame = null; switchWeek(weekNow()); }
    if (newsOpen()) drawNews();
    if (leaderboardOpen()) drawLeaderboard();
  }
  function syncLeaguePick() {
    const names = leagueNames(), cur = LEAGUES.includes(view) ? view : league;
    $("leaguePick").replaceChildren(names[cur]);
    $("leagueList").replaceChildren(...pickable().map(k => {
      const li = el("li", "league-tile", names[k]);
      li.setAttribute("role", "option"); li.dataset.v = k; li.dataset.lg = k;
      li.setAttribute("aria-selected", String(k === cur)); li.setAttribute("aria-disabled", String(!leaguesOn.has(k)));
      li.addEventListener("click", () => { if (leaguesOn.has(k)) pickLeague(k); });
      return li;
    }));
  }
  $("leaguePick").addEventListener("click", () => { const open = $("leagueList").hidden; $("leagueList").hidden = !open; $("leaguePick").setAttribute("aria-expanded", String(open)); });
  
  
  
  
  
  const newsOpen = () => !$("newsPage").hidden;
  function closeNews() { $("newsPage").hidden = true; $("newsPage").replaceChildren(); $("newsBtn").setAttribute("aria-expanded", "false"); }
  const sinceText = ms => { const m = Math.max(0, Math.round((Date.now() - ms) / 60000)); return m < 60 ? m + "m ago" : m < 1440 ? Math.round(m / 60) + "h ago" : Math.round(m / 1440) + "d ago"; };
  let newsOff = {};
  try { newsOff = JSON.parse(localStorage.getItem("fan.news.off")) || {}; } catch (e) {}
  const keepNewsOff = () => { try { localStorage.setItem("fan.news.off", JSON.stringify(newsOff)); } catch (e) {} };
  
  let sourcesOff = new Set();
  try { sourcesOff = new Set(JSON.parse(localStorage.getItem("fan.news.sources.off")) || []); } catch (e) {}
  const keepSourcesOff = () => { try { localStorage.setItem("fan.news.sources.off", JSON.stringify([...sourcesOff])); } catch (e) {} };
  const setSourceOff = (key, off) => { if (off) sourcesOff.add(key); else sourcesOff.delete(key); keepSourcesOff(); };
  
  let connectorNews = null;   
  const setConnectorNews = list => { connectorNews = Array.isArray(list) ? list : null; };
  const sourceWhyNot = (s, l) => !s.connector ? "" : !Fan.hostHello ? "Needs the Fan connector" : !connectorNews || !connectorNews.some(x => x.source === s.key) ? "Needs a newer connector program" : l && !connectorNews.some(x => x.source === s.key && x.leagues.includes(l)) ? "No feed for this league" : "";
  
  function fitScreen(screen) {
    const top = document.querySelector(".strip:not(.bottom)").getBoundingClientRect(), bottom = document.querySelector(".strip.bottom").getBoundingClientRect(), page = screen.style;
    page.top = top.bottom + 8 + "px"; page.left = top.left + "px"; page.width = top.width + "px"; page.height = Math.max(200, bottom.top - top.bottom - 16) + "px";
  }
  
  const espnCodeOf = l => { const back = Object.fromEntries(Object.entries(LEAGUE_DEFS[l].espnCodes || {}).map(([e, o]) => [o, e])); return c => back[c] || c; };
  async function drawNews() {
    const l = LEAGUES.includes(view) ? view : league, page = $("newsPage"), board = el("div", "news-board");
    const teams = Object.fromEntries(Object.entries(TEAM).filter(([, t]) => t.lg === l).map(([nk, t]) => [t.code, { nk, t }]));
    const off = new Set((newsOff[l] || []).filter(c => teams[c]));
    const closeBtn = el("button", "gd-close", "\u00d7"); closeBtn.type = "button"; closeBtn.title = "Close"; closeBtn.setAttribute("aria-label", "Close news"); closeBtn.addEventListener("click", closeNews);
    
    const sourceRow = el("div", "news-sources");
    sourceRow.append(...NEWS_SOURCES.map(s => {
      const label = el("label", "news-source"), box = el("input");
      const why = sourceWhyNot(s, l);
      box.type = "checkbox"; box.checked = !sourcesOff.has(s.key) && !why; box.disabled = !!why; if (why) label.title = why;
      box.addEventListener("change", () => { setSourceOff(s.key, !box.checked); drawNewsList(); });
      label.append(box, el("span", null, s.name));
      return label;
    }));
    page.replaceChildren(el("h2", "news-head", leagueNames()[l] + " news"), sourceRow, board, closeBtn);
    page.dataset.lg = l;
    board.append(el("p", "news-note", "Getting the divisions"));
    let groups;
    try { groups = await pullDivisions(l); } catch (e) { groups = [{ name: leagueNames()[l], codes: Object.keys(teams).sort() }]; }   
    if (!newsOpen() || page.dataset.lg !== l) return;
    groups = groups.map(g => ({ name: g.name, codes: g.codes.filter(c => teams[c]) })).filter(g => g.codes.length);
    const columns = [{ name: "League", codes: [] }, ...groups], boxes = [];
    board.replaceChildren();
    board.style.gridTemplateColumns = `repeat(${columns.length}, minmax(0, 1fr))`;
    const saveOff = () => { newsOff[l] = [...off]; if (!newsOff[l].length) delete newsOff[l]; keepNewsOff(); drawNewsList(); };
    const lists = columns.map((column, i) => {
      const head = el("h3", "news-group", column.name), badges = el("div", "news-teams"), list = el("ol", "news-list");
      [head, badges, list].forEach((n, row) => { n.style.gridColumn = i + 1; n.style.gridRow = row + 1; });
      if (!i) {
        const allBtn = el("button", "news-all", "All"), noneBtn = el("button", "news-all", "None");
        allBtn.type = noneBtn.type = "button";
        allBtn.addEventListener("click", () => { off.clear(); boxes.forEach(b => { b.checked = true; }); saveOff(); });
        noneBtn.addEventListener("click", () => { Object.keys(teams).forEach(c => off.add(c)); boxes.forEach(b => { b.checked = false; }); saveOff(); });
        badges.append(allBtn, noneBtn);
      }
      badges.append(...column.codes.map(c => {
        const { nk, t } = teams[c], badge = el("label", "news-team"), box = el("input");
        box.type = "checkbox"; box.checked = !off.has(c); boxes.push(box);
        badge.style.background = t.bg; badge.style.color = t.fg; badge.title = t.name;
        box.addEventListener("change", () => { if (box.checked) off.delete(c); else off.add(c); saveOff(); });
        badge.append(box);
        if (t.art) badge.append(helmImg(nk, "news-team-art"));
        badge.append(el("span", "news-team-code", c));
        return badge;
      }));
      board.append(head, badges, list);
      return list;
    });
    
    const columnOf = n => { const mine = n.codes.filter(c => !off.has(c)); if (!mine.length || n.codes.length > 4) return 0; const i = groups.findIndex(g => g.codes.includes(mine[0])); return i + 1; };
    
    let asked = 0, wait = null;
    function drawNewsList() { clearTimeout(wait); wait = setTimeout(pull, 400); }
    const note = text => { lists.forEach(list => list.replaceChildren()); lists[0].append(el("li", "news-note", text)); };
    async function pull() {
      const mine = ++asked, codeOf = espnCodeOf(l), checked = Object.keys(teams).filter(c => !off.has(c));
      const sources = NEWS_SOURCES.filter(s => !sourcesOff.has(s.key) && !sourceWhyNot(s, l)).map(s => s.key);
      note(!sources.length ? "No sources checked" : checked.length ? "Getting the news" : "No teams checked");
      if (!checked.length || !sources.length) return;
      let news;
      try { news = await pullNews(l, off.size ? checked.map(codeOf) : null, sources); } catch (e) { if (mine === asked) note("No news: " + (pullStatus() || e.message)); return; }
      if (mine !== asked || !newsOpen() || page.dataset.lg !== l) return;
      lists.forEach(list => list.replaceChildren());
      if (!news.length) { note("No news"); return; }
      news.forEach(n => {
        const li = el("li", "news-item"), card = el(n.link ? "a" : "div", "news-card");
        if (n.link) { card.href = n.link; card.target = "_blank"; card.rel = "noopener"; }
        const frame = el("div", "news-image");
        if (n.image) { const img = el("img"); img.src = n.image; img.alt = ""; img.loading = "lazy"; img.referrerPolicy = "no-referrer"; frame.append(img); }
        card.append(frame, el("span", "news-title", n.title), el("span", "news-line", [n.source, n.kind, isFinite(n.ms) ? sinceText(n.ms) : ""].filter(Boolean).join(" \u00b7 ")));
        li.append(card);
        lists[columnOf(n)].append(li);
      });
      lists.forEach(list => { const room = list.getBoundingClientRect().bottom; [...list.children].forEach(li => { if (li.getBoundingClientRect().bottom > room + 1) li.remove(); }); });
    }
    pull();
  }  $("newsBtn").addEventListener("click", () => { if (newsOpen()) { closeNews(); return; } closeLeagues(); closeLeaderboard(); $("newsPage").hidden = false; $("newsBtn").setAttribute("aria-expanded", "true"); fitScreen($("newsPage")); drawNews(); });
  window.addEventListener("resize", () => { if (newsOpen()) { fitScreen($("newsPage")); drawNews(); } if (leaderboardOpen()) { fitScreen($("leaderboardPage")); drawLeaderboard(); } });
  document.addEventListener("keydown", e => { if (e.key !== "Escape") return; if (newsOpen()) { closeNews(); $("newsBtn").focus(); } if (leaderboardOpen()) { closeLeaderboard(); $("leaderboardBtn").focus(); } });
  
  
  const leaderboardOpen = () => !$("leaderboardPage").hidden;
  function closeLeaderboard() { $("leaderboardPage").hidden = true; $("leaderboardPage").replaceChildren(); $("leaderboardBtn").setAttribute("aria-expanded", "false"); }
  async function drawLeaderboard() {
    const l = LEAGUES.includes(view) ? view : league, page = $("leaderboardPage"), board = el("div", "leader-board");
    const teams = Object.fromEntries(Object.values(TEAM).filter(t => t.lg === l).map(t => [t.code, t]));
    const closeBtn = el("button", "gd-close", "\u00d7"); closeBtn.type = "button"; closeBtn.title = "Close"; closeBtn.setAttribute("aria-label", "Close leaderboard"); closeBtn.addEventListener("click", closeLeaderboard);
    page.replaceChildren(el("h2", "news-head", leagueNames()[l] + " leaderboard"), board, closeBtn);
    page.dataset.lg = l;
    board.append(el("p", "news-note", "Getting the leaders"));
    let groups;
    try { groups = await pullLeaders(l); } catch (e) { if (page.dataset.lg === l) board.replaceChildren(el("p", "news-note", "No leaders: " + (pullStatus() || e.message))); return; }
    if (!leaderboardOpen() || page.dataset.lg !== l) return;
    if (!groups.length) { board.replaceChildren(el("p", "news-note", "No leaders yet")); return; }
    board.replaceChildren(...groups.map(g => {
      const block = el("section", "leader-group"), list = el("ol", "leader-list");
      list.append(...g.leaders.map((x, i) => {
        const li = el("li"), row = el(x.link ? "a" : "div", "leader-row"), face = el("span", "leader-face"), badge = el("span", "leader-team", x.code), t = teams[x.code];
        if (x.link) { row.href = x.link; row.target = "_blank"; row.rel = "noopener"; }
        if (x.image) { const img = el("img"); img.src = x.image; img.alt = ""; img.loading = "lazy"; img.referrerPolicy = "no-referrer"; face.append(img); }
        if (t) { badge.style.background = t.bg; badge.style.color = t.fg; badge.title = t.name; }
        row.append(el("span", "leader-rank", String(i + 1)), face, el("span", "leader-name", x.name), badge, el("span", "leader-value", x.value));
        li.append(row);
        return li;
      }));
      block.append(el("h3", "news-group", g.name), list);
      return block;
    }));
    const room = board.getBoundingClientRect().bottom;
    [...board.children].forEach(b => { if (b.getBoundingClientRect().bottom > room + 1) b.remove(); });
  }
  $("leaderboardBtn").addEventListener("click", () => { if (leaderboardOpen()) { closeLeaderboard(); return; } closeLeagues(); closeNews(); $("leaderboardPage").hidden = false; $("leaderboardBtn").setAttribute("aria-expanded", "true"); fitScreen($("leaderboardPage")); drawLeaderboard(); });
  $("leaguePick").dataset.keys = "arrows";   
  $("leaguePick").addEventListener("keydown", e => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const on = pickable().filter(k => leaguesOn.has(k)), next = on[on.indexOf(LEAGUES.includes(view) ? view : league) + (e.key === "ArrowDown" ? 1 : -1)];
    if (next) pickLeague(next);
  });
  document.addEventListener("click", e => { if (!$("leagueList").hidden && !e.composedPath().includes($("leagueBox"))) closeLeagues(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("leagueList").hidden) { closeLeagues(); $("leaguePick").focus(); } });
  syncLeaguePick();
  
  function leaveOffLeague() {
    const stubOn = LEAGUES.includes(view), active = stubOn ? view : league;
    if (leaguesOn.has(active)) return;
    const first = LEAGUE_ORDER.find(k => leaguesOn.has(k));
    if (LEAGUES.includes(first)) showView(first);
    else if (first !== league) setLeague(first);
    else { detailGame = null; switchWeek(weekNow()); }
  }
  async function setLeagueOn(k, on) {
    if (on && LEAGUE_DEFS[k].slate === "day" && !ALL_GAMES.some(g => g.league === k)) {   
      (await pullDaily(k)).forEach(r => { const g = addDailyGame(k, r); ALL_GAMES.push(g); SCHEDULE_LINES.set(g, { line: g.line, noLine: g.noLine }); });
    }
    if (on) leaguesOn.add(k); else if (leaguesOn.size > 1) leaguesOn.delete(k);
    try { localStorage.setItem("fan.leagues", JSON.stringify([...leaguesOn])); } catch (e) {}
    Fan.setLeagues([...leaguesOn]);
    wantScores([...leaguesOn]);
    leaveOffLeague();
    syncLeaguePick();
    later.sendManifest();
    changed("leagues");
  }
  
  
  const HOTKEYS = new Set(["Escape", "Tab"]);   
  const typing = t => t && (t.isContentEditable || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || (t.tagName === "INPUT" && !["checkbox", "radio", "button", "submit", "reset", "range", "color", "file"].includes(t.type)));
  document.addEventListener("keydown", e => {
    if (HOTKEYS.has(e.key) || e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/.test(e.key) || typing(e.target) || (e.target && e.target.closest && e.target.closest("[data-keys]"))) return;
    e.preventDefault(); e.stopPropagation();
  }, true);   
  function closePreview() {
    const back = previewFrom;
    detailGame = null; previewFrom = null;
    if (back && back.week != null && back.week !== curWeek) switchWeek(back.week);
    showView(back && back.view ? back.view : "week");
  }
  document.addEventListener("keydown", e => { if (e.key === "Escape" && detailGame) closePreview(); });   
  function clearRiskQuietly() { const col = document.querySelector(".col.left"), rc = $("riskDetail"); col.classList.remove("has-selection"); rc.classList.add("rk-off"); rc.classList.remove("rk-over"); rc.setAttribute("aria-hidden", "true"); }
  function switchWeek(w) {
    if (w === curWeek) { if (view !== "week") showView("week"); return; }
    riskByWeek[curWeek] = riskKey; riskGame = null; clearRiskQuietly();
    riskKey = riskByWeek[w] || "";
    selectSlate(w);
    $("slate").setAttribute("aria-labelledby", "tab-week-" + w);
    $("slateTitle").textContent = slateTitleOf(w); later.drawByes();
    later.weekChanged();
    applySlate(); showView("week");
  }
  document.querySelectorAll(".strip-tabs [data-week]").forEach(b => b.addEventListener("click", () => { const had = !!detailGame; detailGame = null; const w = Number(b.dataset.week); if (had && w === curWeek) showView("week"); else switchWeek(w); }));
export { sourcesOff, setSourceOff, sourceWhyNot, closePreview, nflWeek, ticketFromFill, weirdFills, setWeirdFills, programBehind, newestFor, LAYOUTS, isTall, layoutPref, setLayoutPref, nick, changed, definePanels, drawLeagueStub, drawNow, $, ALL_GAMES, APP_VERSION, FAN_CLASSES, GAMES, LG, RULES, allTickets, americanOf, applySlate, gdBadge, betClass, sportsbookAbbr, sportsbookTag, calc, centsOf, contractsFor, curWeek, dayFmt, deadFor, decimalOf, detailGame, drawStub, el, evMoneyline, evPoints, extremes, fillAmounts, fillSide, freshPrices, gameBets, gameKey, gameLabel, gameSettledPL, gamesInView, graphGames, hedgeFor, helmImg, startLines, kalshiCalc, kalshiCheck, kalshiMarket, last, later, league, leagueId, leagueNames, leagueOf, leaguesOn, leaveOffLeague, ledgerRows, legGame, legResult, legText, lineOf, lineOk, marginModel, money, nbaDay, odds, outcomes, pairFlagged, pairStakes, parlayShares, profitOf, projectedPL, pts, readTicker, replyFill, resultCell, riskGame, riskKey, riskOf, selectSlate, setDetailGame, marketWanted, scoutOn, scoutWanted, trackingOn, clearPrices, setLeagueOn, setRiskGame, setTickets, setScoutWanted, setTrackingOn, settleOf, shareRisk, shareTerm, shortDayFmt, showView, signedMoney, slateAt, linesAt, spentShares, status, subView, switchWeek, teamLook, ticketLeagueOn, ticketPL, ticketPrice, tickets, ticketsInView, timeFmt, timeZoned, tz, view, vigOf, weekNow, setRiskKey, GAME_CARD_ACTIONS, teamChip, hasArt, brighterOf, fitSlateLine, graphsOK, SECTIONS, isPhone, mq };
