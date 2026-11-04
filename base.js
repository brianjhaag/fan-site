// The page's core: state, formats, tabs and menus. The game cards are cards.js.
import { WEEK_GAMES, pullDaily, pullNcaafb, pullStatus, setRefresh, wantScores } from "./espn.js?v=mw2czbex";
import { BOOK_ICONS } from "./data/assets.js?v=mw2czbex";
import { HELM_PAD, LEAGUES_LATER, LEAGUE_DEFS, LEAGUE_ORDER, NFL_NICKS, PLATE_STATES, TEAM, abbr, leagueOfSlate, lumOf, metaDocId, slateDocId, slateOfDay, slateTitleOf, teamName, teamOf } from "./leagues.js?v=mw2czbex";
import { Calc } from "./calc.js?v=mw2czbex";
import { Fan } from "./hosts.js?v=mw2czbex";
  // What a file calls in the files loaded after it. Each file adds its own names as it loads (test/modules.test.js checks them), so no file imports a later one.
  const later = {};
  // Auto-render. Whatever changes the page's data says so with changed(topic), and the panels that depend on that topic redraw once, right after the running code ends, in the order of the table in start.js.
  let panels = [], changeQueued = false;
  const dirtyTopics = new Set();
  const definePanels = list => { panels = list; };
  function drawNow() {
    changeQueued = false;
    const topics = [...dirtyTopics];
    dirtyTopics.clear();
    panels.forEach(([draw, on]) => { if (on.some(t => topics.includes(t))) { try { draw(); } catch (e) { console.error(e); } } });
  }
  const changed = (...topics) => { topics.forEach(t => dirtyTopics.add(t)); if (!changeQueued) { changeQueued = true; queueMicrotask(() => { if (changeQueued) drawNow(); }); } };
  // The page shows one slate at a time, a week or a day: GAMES and tickets always hold the selected slate's games and wagers.
  // A daily league's game (the NBA, the NHL), from its pull: on its day's slate (leagues.js numbers them), with a neutral line until its own prices come.
  const addDailyGame = (l, { t, a, h, tv, venue, eid, final, now }) => {
    const w = slateOfDay(l, Number(t.slice(0, 10).replace(/-/g, ""))), g = { t, away: teamName(l, a), home: teamName(l, h), tv, ...(venue && venue[0] ? { arena: venue } : {}), league: l, ...(eid ? { eid } : {}), ...(final ? { final } : now ? { now } : {}), noLine: true, line: { sp: 0, spj: [-110, -110], tot: LEAGUE_DEFS[l].neutralTotal, toj: [-110, -110], ml: [-110, -110] }, week: w };
    (WEEK_GAMES[w] = WEEK_GAMES[w] || []).push(g);
    return g;
  };
  Object.entries(WEEK_GAMES).forEach(([w, list]) => list.forEach(g => { g.week = Number(w); }));
  let league = "nfl";   // the league on screen, chosen with the league picker
  document.documentElement.dataset.league = league;   // fan.css dresses a league's page by it (the NHL's rink and boards)
  // The layout (Look/feel's Layout, on the user's word, Nov 2 2026): Auto follows the window as before, or the user picks Landscape or Portrait. Phone isn't a choice: a phone is too tight to be of use, so only Auto reaches the phone rules, kept as they are. It's classes on the page that
  // fan.css's layout rules hang on: lay-narrow (920px or less), lay-phone (760px or less), lay-portrait (a portrait window over 920px). Kept per browser.
  const LAYOUTS = [["auto", "Auto"], ["landscape", "Landscape"], ["portrait", "Portrait"]];   // a saved "phone" falls back to Auto
  let layoutPref = "auto";
  try { const v = localStorage.getItem("fan.layout"); if (LAYOUTS.some(([k]) => k === v)) layoutPref = v; } catch (e) {}
  const mq = q => matchMedia(q).matches;
  const LAYOUT_QUERIES = { phone: "(max-width: 760px)", narrow: "(max-width: 920px)", portrait: "(orientation: portrait) and (min-width: 921px)" };
  function applyLayout() {
    const auto = layoutPref === "auto", c = document.documentElement.classList;
    c.toggle("lay-phone", auto && mq(LAYOUT_QUERIES.phone));
    c.toggle("lay-narrow", auto && mq(LAYOUT_QUERIES.narrow));
    c.toggle("lay-portrait", auto ? mq(LAYOUT_QUERIES.portrait) : layoutPref === "portrait");
  }
  applyLayout();
  const layoutLists = Object.values(LAYOUT_QUERIES).map(q => matchMedia(q));   // kept: a media list nothing holds can be dropped with its listener, and the layout then stuck where the page loaded
  layoutLists.forEach(m => m.addEventListener("change", applyLayout));
  addEventListener("resize", applyLayout);
  function setLayoutPref(k) { layoutPref = k; try { localStorage.setItem("fan.layout", k); } catch (e) {} applyLayout(); changed("size", "cards"); }
  const isPhone = () => document.documentElement.classList.contains("lay-phone");
  // A tall window, for the panels that run down to the bottom strip: a portrait one, or a phone held upright.
  const isTall = () => (layoutPref === "auto" ? mq("(orientation: portrait)") : layoutPref === "portrait");
  const LG = () => Calc.RULES.leagues[league];
  const nbaDay = (add = 0) => Number(new Date(Date.now() + add * 864e5).toLocaleDateString("en-CA", { timeZone: "America/New_York" }).replace(/-/g, ""));
  // The Risk detail icon FILTERS the totals and the saved tickets to that game and draws its graph over the wager ticket.
  let riskGame = null;
  const setRiskGame = g => { riskGame = g; changed("selection"); };
  let detailGame = null;   // the game whose detail replaces the cards (null = the cards)
  const setDetailGame = g => { detailGame = g; };
  const inRiskGame = t => { const k = gameKey(riskGame); return t.key === k || (!t.key && t.kickoff === riskGame.t && t.game === gameLabel(riskGame)) || (t.parlay && t.legs.some(l => l.key === k)); };
  // What the totals and the saved tickets show: the selected game and its wagers, or the whole week.
  const ticketsInView = () => riskGame ? tickets.filter(inRiskGame) : tickets;
  const gamesInView = () => riskGame ? [riskGame] : GAMES;
  let curWeek = 7, GAMES = WEEK_GAMES[7] || [], view = "week";   // view: "week" and "xy" (Graphs) belong to the selected week; a key of SECTIONS is one of the other top buttons
  // The top strip's tabs other than the weeks, and the bottom strip's buttons for each; an entry with `stub` is a placeholder saying what it will show. A section with one view has no bottom buttons. A new section or view is one entry here.
  const SECTIONS = {
    handicap: [{ k: "main", h: "Handicap" }],   // every league (the user, Nov 4 2026); Playbook's Trends moved under Season stats' graphs
    code: [],   // the Code section (code.js): one page, no views
    ncaafb: [{ k: "main", h: "NCAA FB", stub: "Not built yet." }],
    season: [{ k: "margins", h: "Margins" },
      { k: "keys", h: "Key numbers", stub: "How often games land on 3, 7, 10 and the other key numbers this season, against the long-run shares." },
      { k: "teams", h: "Teams", stub: "Each team's season: record, scoring, form and ranks." }],
    ledger: [{ k: "balances", h: "Balances" },
      { k: "weeks", h: "By week", stub: "Wagered, won and lost, and net cash for each week." },
      { k: "open", h: "Open bets", stub: "Every bet still undecided, across all weeks and books." },
      { k: "check", h: "Kalshi check" }]
  };
  const subView = { season: "margins", ledger: "balances", handicap: "main", ncaafb: "main" };
  // NCAA FB isn't a full league yet: today's games involving a top 25 team, this browser's own read of ESPN, as a read-only list.
  async function drawNcaafb() {
    const box = $("ncaafb");
    if (!box.firstChild) box.replaceChildren(el("div", "pg-stub", "NCAA FB"), el("p", "pg-stub-t", "Asking ESPN…"));
    let slate;
    try { slate = await pullNcaafb(); } catch (e) { box.replaceChildren(el("div", "pg-stub", "NCAA FB"), el("p", "pg-stub-t", "Couldn't reach ESPN.")); return; }
    const team = s => { const c = el("td", "cfb-team"); if (s.rank) c.append(el("small", null, "#" + s.rank + " ")); c.append(s.name); return c; };
    const rows = slate.games.map(g => {
      const tr = el("tr"), started = g.state !== "pre", net = el("td", "cfb-net"), tvBtn = el("button");
      tvBtn.type = "button"; tvBtn.title = "Live telecast"; tvBtn.setAttribute("aria-label", "Live telecast"); tvBtn.innerHTML = CARD_ACTIONS.find(([name]) => name === "Live telecast")[1];
      tvBtn.addEventListener("click", () => { later.watchGame(g); });   // always on here: a list read once can't say what's live now
      net.append(g.tv, tvBtn);
      tr.append(el("td", null, timeZoned(new Date(g.t))), team(g.away), el("td", "cfb-num", started ? String(g.away.score) : ""), team(g.home), el("td", "cfb-num", started ? String(g.home.score) : ""), el("td", null, started ? g.detail : ""), net);
      return tr;
    });
    const table = el("table", "cfb-list"), head = el("tr");
    ["Kickoff", "Away", "", "Home", "", "Status", "Network"].forEach(h => head.append(el("th", null, h)));
    const thead = el("thead"), tbody = el("tbody"); thead.append(head); tbody.append(...rows); table.append(thead, tbody);
    box.replaceChildren(el("div", "pg-stub", "NCAA FB"), el("p", "pg-stub-t", `Top 25 teams today. ESPN as of ${timeZoned(new Date(slate.asOf))}: reopen the page to read it again.`), table);
  }
  // A stub view draws itself and answers true; the section's first view answers false and draws as usual.
  function drawStub(v) {
    if (v === "ncaafb") { drawNcaafb(); return true; }
    if (v === "handicap" && !LG().handicap) { $(v).replaceChildren(el("div", "pg-stub", `${LG().code} handicap`), el("p", "pg-stub-t", "Not built yet: the NFL first.")); return true; }
    if (v === "season" && !LG().stats && LG().season) return false;   // a league with only Margins built (the NBA, the NHL) draws it, whatever view the NFL left picked
    if (!LG().stats && v === "season") { $(v).replaceChildren(el("div", "pg-stub", `${LG().code} season stats`), el("p", "pg-stub-t", "Not built yet.")); return true; }
    const s = SECTIONS[v].find(x => x.k === subView[v]);
    if (!s.stub) return false;
    $(v).replaceChildren(el("div", "pg-stub", s.h), el("p", "pg-stub-t", s.stub));
    return true;
  }
  const LEAGUES = [];   // the league picker's leagues that are stubs: none now. NCAA FB's list (drawNcaafb) is off, on the user's word: adding "ncaafb" here and to leagues.js brings it back
  const leagueNames = () => Object.fromEntries(LEAGUE_ORDER.map(k => [k, LEAGUE_DEFS[k].name]));
  // The games the Graphs panel plots: those of the selected week still to kick off.
  const graphGames = () => GAMES.filter(g => !g.final && status(g)[0] === "Upcoming" && !(g.line && (g.line.noSp || g.line.noTot)));   // a game missing its spread or total has nothing to graph yet
  const ALL_GAMES = Object.keys(WEEK_GAMES).map(Number).sort((p, q) => p - q).flatMap(w => WEEK_GAMES[w]);
  // The calculations live in calc.js; here they are bound to the page's games and tickets.
  const calc = Calc.make({ games: ALL_GAMES, now: () => Date.now(), abbr: n => abbr(n) });
  const { RULES, leagueId, leagueOf, outcomes, last, nick, gameLabel, gameKey, pts, profitOf, riskOf, decimalOf, ticketPrice, legResult, ticketPL, marginModel, lineOk, FAN_CLASSES, betClass, odds, contractsFor, kalshiCalc, centsOf, americanOf, fillSide, fillAmounts, kalshiMarket, freshPrices, evMoneyline, evPoints, pairFlagged, pairStakes, pbStats, replyFill } = Calc;
  const { status, settleOf, vigOf, projectedPL, deadFor, shareRisk, shareTerm, extremes, hedgeFor, readTicker, ticketFromFill, kalshiCheck, ledgerRows } = calc;
  // These take the selected week's tickets.
  const gameBets = g => calc.gameBets(g, tickets), parlayShares = g => calc.parlayShares(g, tickets), spentShares = g => calc.spentShares(g, tickets), gameSettledPL = g => calc.gameSettledPL(g, tickets);
  // A team's colors, from leagues.js's table: background, text, and an outline in its text color on a black background.
  function teamLook(g, side) {
    const { bg, fg } = teamOf(g, side);
    return { bg, fg, outline: bg === "#000000" ? fg : null };
  }
  // The brighter of a team's two colors (by relative luminance): used for its moneyline value on the game cards.
  const brighterOf = (g, side) => { const { bg, fg } = teamOf(g, side); return lumOf(bg) >= lumOf(fg) ? bg : fg; };
  // A team name as a chip in the team's colors.
  function teamChip(g, side, text, cls) {
    const k = teamLook(g, side), c = el("span", "tchip" + (cls ? " " + cls : ""), text);
    c.style.background = k.bg; c.style.color = k.fg;
    if (k.outline) c.style.borderColor = k.outline;
    return c;
  }
  // The game overview's badge (also used on the risk detail): the card's coloring as it LOOKS on the card (the team's background lightened a third,
  // blended 50% with the card paper #1a1f26, drawn opaque), the team's own text color, the helmet overhanging at the left, the nickname in caps.
  function bdBadge(g, side, label) {
    const nk = nick(g, side), badge = el("div", "bd-badge"), look = teamLook(g, side);
    const [r_, g_, b_] = [1, 3, 5].map(i => { const v = parseInt(look.bg.slice(i, i + 2), 16); return Math.round(v + (255 - v) * .33); }), paper = [26, 31, 38];
    badge.style.background = `rgb(${Math.round((r_ + paper[0]) / 2)} ${Math.round((g_ + paper[1]) / 2)} ${Math.round((b_ + paper[2]) / 2)})`;
    badge.style.color = look.fg;
    if (hasArt(nk)) badge.append(helmImg(nk, "bd-bhelm"));
    badge.append(el("span", "bd-bname", label || last(g[side]).toUpperCase()));
    return badge;
  }

  // Sportsbook icons (the files are kept in icons/): site favicons embedded as data URIs. ClutchBet's is a generated initials badge (no favicon could be fetched). "Other" has none.
  // Short names for the saved tickets and the game detail (the dropdown, Ledger and wager card keep the full names).
  const BOOK_ABBR = { "DraftKings": "DK", "FanDuel": "FD", "BetMGM": "MGM", "Caesars": "CP", "bet365": "365", "BetRivers": "BR", "ESPN Bet": "ESPN", "Fanatics": "FAN", "Hard Rock Bet": "HR", "Circa Sports": "CIR", "Bally Bet": "BAL", "BetMonarch": "MON", "ClutchBet": "CLU", "SBK": "SBK", "SI Sportsbook": "SI", "Sporttrade": "ST", "Kalshi": "KAL", "Betsafe": "BSF", "Other": "OTH" };
  const bookAbbr = name => BOOK_ABBR[name] || name;
  // A sportsbook's icon followed by its name (the short name with short); icon only with iconOnly; just the name when it has no icon.
  function bookTag(name, iconOnly, short) {
    const tag = el("span", "bk"), src = BOOK_ICONS[name];
    if (src) { const i = document.createElement("img"); i.className = "bico"; i.src = src; i.alt = ""; i.width = i.height = 16; tag.append(i); }
    if (!(iconOnly && src)) tag.append(document.createTextNode(short ? bookAbbr(name) : name));
    if (short || iconOnly) tag.title = name;
    return tag;
  }

  const APP_VERSION = "0.51.2";   // the label in the settings window and the title. Claude sets it at each build, as major.minor.patch
  const $ = id => document.getElementById(id);
  document.title = "Fan " + APP_VERSION;
  $("appName").textContent = APP_VERSION;   // in the settings window's header, so it shows whether or not Bet tracking is on
  $("infoVer").textContent = APP_VERSION;   // and at the info line's far right
  // A connector whose program is a minor version behind this page (the Update button's rule).
  // An optional build (the Chromebook's, Nov 4 2026) is made only when asked, so its newest program can be older than this page: programs.json, beside the page, names it.
  let PROGRAMS = {};
  window.fetch?.("programs.json").then(r => (r.ok ? r.json() : {})).then(j => { PROGRAMS = j || {}; }, () => {});
  const newestFor = os => (os === "linux" && PROGRAMS.chromebook) || APP_VERSION;
  const programBehind = (v, os) => { const minor = s => s.split(".").slice(0, 2).map(Number); if (!v) return true; const [a, b] = minor(v), [c, d] = minor(newestFor(os)); return a < c || (a === c && b < d); };
  // The info line's version, highlighted with an upgrade mark while the connector's program is behind (the user's, Nov 2 2026); a press opens the settings window, where Update is.
  // DEV beside it while the connector serves the working copy (dev mode, its page-dev.txt; the user, Nov 4 2026), so a dev page is never taken for a release.
  function showVersion(v, dev, os) {
    const ver = $("infoVer"), behind = !!v && programBehind(v, os), devOn = !!dev;
    if (behind === ver.classList.contains("behind") && devOn === ver.classList.contains("dev")) return;
    ver.classList.toggle("behind", behind);
    ver.classList.toggle("dev", devOn);
    ver.title = behind ? `The Fan connector is ${v}: update it on the Application tab` : devOn ? `Dev mode: the connector serves the working copy in ${dev}, not the site's page. The next release turns it off.` : "";
    ver.replaceChildren(APP_VERSION);
    if (devOn) ver.append(el("span", "dev-mark", "DEV"));
    if (behind) { const up = el("span", "up-mark"); up.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 17V7M7.5 11.5 12 7l4.5 4.5"/></svg>'; ver.append(up); }
    fitSlateLine();
  }
  $("infoVer").addEventListener("click", () => { if ($("infoVer").classList.contains("behind")) $("fanBtn").click(); });
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;   // times show in the viewer's own zone
  const dayFmt = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: tz });
  const shortDayFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: tz });
  const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });
  // A time with its zone, such as "11:00 AM MT". A long zone name shortens to its initials ("Japan Time" is JT): the viewer knows where they are.
  const zoneFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz, timeZoneName: "shortGeneric" });
  const timeZoned = d => zoneFmt.formatToParts(d).map(p => p.type === "timeZoneName" && p.value.includes(" ") ? p.value.split(" ").map(w => w[0]).join("") : p.value).join("");
  // Calculations keep full precision; displayed dollars are rounded to whole dollars.
  const money = n => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  // A game named with its point spread, visitor first: "Broncos −4.5 @ Cardinals". The short form uses team abbreviations.

  // Saved tickets (per-browser convenience only)
  // allTickets holds every week's wagers; tickets is the selected week's slice (a wager with no week belongs to Week 7).
  let allTickets = [], tickets = [], weirdFills = [];   // weirdFills: markets of fills Fan can't place in a game (calc.js's withFills), for the Application tab's Records
  const setWeirdFills = w => { weirdFills = w; };
  const weekOf = t => t.week ?? 7;
  // Bet tracking is the user's yes or no to all of it, whatever records exist: off, no position reaches a view. The settings window's checkbox sets it; off until the user turns it on.
  let trackingOn = false;
  try { trackingOn = localStorage.getItem("fan.tracking") === "on"; } catch (e) {}
  document.documentElement.classList.toggle("tracking-off", !trackingOn);
  // Prices are the step past Bet tracking: wagers typed by hand need no market data, and a browser with no connector has none. The settings window's checkbox sets it, on unless turned off. Tracking off means no prices either.
  let pricesWanted = false;   // only Watch starts on. A browser already tracking from before this default keeps its prices
  try { const p = localStorage.getItem("fan.prices"); pricesWanted = p === "on" || (p == null && trackingOn); } catch (e) {}
  const setPricesWanted = on => { pricesWanted = on; };
  const marketWanted = () => pricesWanted;
  const pricesOn = () => marketWanted() && !!Fan.lines;
  document.documentElement.classList.toggle("prices-off", !trackingOn || !pricesWanted);   // until the sockets answer: a plain page never flashes the price columns
  // A league's checkbox in the settings window is the same kind of yes or no: off, the page and the refreshes do nothing for it. NFL is on until the user says otherwise (leagues.js says which can be). At least one stays on.
  let leaguesOn = new Set(["nfl"]);
  // Which league a ticket belongs to, from its week (leagues.js); week 0 is a market in no league.
  const ticketLeagueOn = t => { const w = weekOf(t); return !w || leaguesOn.has(leagueOfSlate(w)); };
  const weekTickets = () => (trackingOn ? allTickets.filter(t => weekOf(t) === curWeek) : []);
  // A ticket finds its game by kickoff and teams. The schedule is live, so a moved kickoff has to find it again by the teams and a nearby date. This changes the copy on the page; the saved ticket stays as it was until something else saves it.
  const rekey = k => {
    if (!k || k === "parlay" || ALL_GAMES.some(g => gameKey(g) === k)) return k;
    const cut = k.indexOf("|"), at = Date.parse(k.slice(0, cut)), label = k.slice(cut + 1), g = ALL_GAMES.find(x => gameLabel(x) === label && Math.abs(Date.parse(x.t) - at) < 8 * 864e5);
    return g ? gameKey(g) : k;
  };
  const setTickets = all => { all.forEach(t => { if (t.key) t.key = rekey(t.key); (t.legs || []).forEach(l => { if (l.key) l.key = rekey(l.key); }); }); allTickets = all; tickets = weekTickets(); changed("tickets"); };
  const setTrackingOn = on => { trackingOn = on; setTickets(allTickets); };
  // Puts a week's games and wagers in view, with nothing redrawn.
  const selectSlate = w => { curWeek = w; GAMES = WEEK_GAMES[w] || (WEEK_GAMES[w] = []); setTickets(allTickets); };
  // The slate (lines and final scores) comes through Fan.lines, one document per game plus "meta". The page follows it, so new lines and scores show as soon as they're saved.
  // Their ids: leagues.js's slateDocId and metaDocId.
  let slateDocs = [];
  // A problem at the connector takes the note's place until it clears: a stopped line refresh, or no answer at all.
  let noteText = "", hostProblem = "";
  function slateNote(text) { noteText = text; if (pullStatus()) text = pullStatus(); if (hostProblem) text = hostProblem; $("slateNote").textContent = text; $("slateNote").classList.toggle("problem", !!hostProblem); fitSlateLine(); }
  const askHost = () => { if (Fan.hostHello) Fan.hostHello().then(hi => { showVersion(hi.version, hi.pageDev, hi.os); return hi.refresh || ""; }, () => "The connector isn't answering").then(p => { if (p !== hostProblem) { hostProblem = p; slateNote(noteText); } }); };
  setTimeout(askHost, 3000); setInterval(askHost, 30000);
  // the update text turns amber when the lines are more than an hour old (checked every minute)
  let slateAt = 0, linesAt = 0;   // the slate on screen's lines, and the newest refresh of any league's, for the Prices row (the user, Nov 3 2026)
  const staleCheck = () => $("slateNote").classList.toggle("stale", slateAt > 0 && Date.now() - slateAt > 3600000);
  setInterval(staleCheck, 60000);
  // The update text and the byes share one line under the game cards AND the wager ticket (left edge of the cards to the right edge of the ticket): 22px, smaller when they would not fit.
  function fitSlateLine() {
    const line = document.querySelector(".sec-title.one-line"), note = $("slateNote"), wager = document.querySelector(trackingOn ? ".col.left" : ".tabrows.bottom");   // with tracking off there's no wager ticket: the line runs to the strip's right edge
    if (!line || !wager) return;
    const W = wager.getBoundingClientRect().right - line.getBoundingClientRect().left;
    if (!(W > 0)) return;
    line.style.width = W + "px";
    const box = document.querySelector(".bye-box"), byes = () => box.scrollWidth + 24, rest = () => note.scrollWidth + $("infoVer").scrollWidth + 14 + ($("demoBadge") ? $("demoBadge").offsetWidth + 14 : 0);
    // Type from 16px down to 8 until it fits; the byes' helmets don't shrink with it, so the first guess can run over.
    const shrink = (holder, need) => { holder.style.setProperty("--slate-fs", "16px"); let fs = Math.max(8, Math.min(16, 16 * W / need())); holder.style.setProperty("--slate-fs", fs + "px"); while (fs > 8 && need() > W) { fs = Math.max(8, fs - .5); holder.style.setProperty("--slate-fs", fs + "px"); } };
    box.style.removeProperty("--slate-fs"); line.style.setProperty("--slate-fs", "16px");
    // A narrow layout folds a line that doesn't fit (the user's, Nov 2 2026): the byes over the rest, each line then shrinking on its own only if it still doesn't fit.
    const fold = document.documentElement.classList.contains("lay-narrow") && byes() + rest() > W;
    line.classList.toggle("folded", fold);
    if (fold) { shrink(line, rest); shrink(box, byes); } else shrink(line, () => byes() + rest());
  }
  window.addEventListener("resize", () => fitSlateLine());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fitSlateLine());
  // The prices step's data: nothing here ships a price. A user's prices come only from their own pull, through Fan.lines. With prices off the games hold only the schedule's neutral placeholder, and the slate gives only final scores.
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
      if (/^meta/.test(d.id) && pricesOn()) linesAt = Math.max(linesAt, Number(v.at) || 0);
      if (d.id === metaDocId(curWeek)) { if (pricesOn()) meta = v; return; }
      const g = ALL_GAMES.find(x => slateDocId(x) === d.id);
      if (!g) return;
      if (Array.isArray(v.final)) g.final = v.final; else if (v.final === null) delete g.final;
      if (!pricesOn()) return;
      const implied = l => (l && l.noSp ? { ...l, sp: Calc.spreadFromMl(l.ml, leagueOf(g).sigma) } : l);   // no spread market yet: the moneyline's, for the models; the card dashes it
      if (v.line) { g.line = implied(v.line); delete g.noLine; }
      else if (v.live && g.noLine) { g.line = implied(v.live); delete g.noLine; }   // first seen after tipoff: no pre-game line was saved
      if (v.live) g.live = implied(v.live); else delete g.live;
      if (v.lad) g.lad = v.lad; else delete g.lad;   // the cross-venue ladder (cheapest asks on Kalshi and Polymarket) for hedge suggestions   // the in-game prices (Kalshi), kept next to the saved pre-game line
      if (v.band) g.band = v.band; else delete g.band;
      if (v.venue) g.venue = v.venue; else delete g.venue;   // where each leg was cheapest, for the Graphs popup's transaction list   // market prices for the flagged-pair band bet (see the Graphs popup)
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
  const initLines = () => { later.syncPrices(); if (Fan.lines) watchSlate(); };
  setRefresh(() => changed("cards"));

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }


  // The prices the card shows: the live in-game prices while a game is under way and some have been saved, else the saved pre-game line.
  const lineOf = g => (g.live && status(g)[1] === "live") ? g.live : g.line;

  // A team's helmet or logo, by its key, for the left of its badge. A helmet with transparent padding on its left is trimmed (leagues.js's HELM_PAD).
  function helmImg(n, cls) {
    const img = el("img", cls); img.src = TEAM[n].art; img.alt = ""; img.draggable = false;
    if (HELM_PAD[n]) img.style.objectViewBox = `inset(0 0 0 ${HELM_PAD[n]}%)`;
    return img;
  }
  const hasArt = n => !!(TEAM[n] && TEAM[n].art);

  // The game card's gutter: one button per thing a game can open, always all five. Game preview, Live telecast before a game ends and, with tracking on, Risk detail work; the rest are dim. Which are dim when is Claude's guess, for now.
  const CARD_ACTIONS = [
    ["Game preview", '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3.500l5 5M8 3.500l-5 5"/><circle cx="5.500" cy="18" r="3"/><circle cx="18.500" cy="18.500" r="2.500"/><path d="M10.500 6c5 0 8 2.500 8 8"/><path d="M15.500 12l3 2.500 2.500-3"/></svg>'],
    ["Box score", '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.500" width="18" height="15" rx="1.500"/><path d="M3 9.500h18M3 14.500h18M9.500 4.500v15M15.250 4.500v15"/></svg>'],
    ["Live telecast", '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7.500" width="18" height="12.500" rx="2"/><path d="M8.500 3l3.500 4.500L15.500 3"/></svg>'],
    ["Tape", '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="1.500"/><circle cx="12" cy="6.500" r="1.500"/><circle cx="12" cy="17.500" r="1.500"/><circle cx="6.500" cy="12" r="1.500"/><circle cx="17.500" cy="12" r="1.500"/></svg>'],
    ["Risk detail", '<svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 13.5c3 0 3.8-1.6 4.8-4.8C6.6 6 7 3 8 3s1.400 3 2.200 5.700c1 3.200 1.800 4.800 4.800 4.800"/></svg>']
  ];
  // The game the risk detail is showing.
  { const first = GAMES.find(g => g.away.endsWith("Packers")) || GAMES[0]; var riskKeyStart = first ? gameKey(first) : ""; }
  let riskKey = riskKeyStart;
  const setRiskKey = k => { riskKey = k; };

  // Accounting: profit/loss of a game's wagers at every final margin (home minus visitor), in whole points.
  // Spread and moneyline wagers are graded exactly; totals depend on combined points, so they are added at face value.
  // Spread prices are not recorded yet, so they are assumed -110.

  // Expected (central-tendency) P/L. A wager's win chance is read from its price, less the book's margin; a parlay has one price,
  // so its chance is split evenly across its legs. Expected value adds up across wagers whatever their correlation, so nothing
  // here needs the games' outcomes to be handled jointly. Settled legs use the real result. Cash view: a lost bonus wager costs $0.
  function resultCell(t) {
    const s = settleOf(t), c = el("span", "rk-num res");
    c.append(el("small", null, "Result"),
      el("b", s.state === "won" ? "pos" : s.state === "lost" ? "neg" : "dim", s.state === "pending" ? "Pending" : `${s.state[0].toUpperCase() + s.state.slice(1)} ${money(s.payout)}`),
      el("small", null, s.state === "pending" ? " " : `net ${signedMoney(s.net)}`));
    return c;
  }
  const legGame = l => GAMES.find(g => gameKey(g) === l.key);
  // A parlay leg has no price of its own (the ticket has one); older legs that carry a price still show it. The game is always in short form, whichever week or game is on screen.
  const legText = l => {
    const g = ALL_GAMES.find(x => gameKey(x) === l.key), game = g ? `${abbr(nick(g, "away"))} @ ${abbr(nick(g, "home"))}` : (l.game || "").split(" at ").map(n => abbr(last(n))).join(" @ ");
    const s = l.type === "Total" ? l.side : abbr(l.side);
    const price = l.odds != null ? ` (${odds(l.odds)})` : "";
    const what = l.type === "Moneyline" ? `${s} ML${l.line != null ? " " + odds(l.line) : ""}` : l.type === "Spread" ? `${s} ${pts(l.line)}${price}` : `${s} ${l.line}${price}`;
    return `${game} · ${what}`;
  };

  const signedMoney = v => { const r = Math.round(v); return (r < 0 ? "−" : r > 0 ? "+" : "") + money(Math.abs(r)); };

  // Week tabs: each week has its own games, saved tickets, totals and Risk detail. Switching swaps GAMES and tickets and redraws.
  const riskByWeek = Object.fromEntries(Object.keys(WEEK_GAMES).map(w => [w, ""]));
  riskByWeek[7] = riskKey;
  // Graphs is for the current week and the next, while every game still to kick off has a line and at least one is left.
  // The current NFL week is the week of the next game, or of one under way (the user's, Nov 3 2026): Tuesday, after Monday night's game, is already the next week. By the calendar, Wednesday to Tuesday, only with no games known.
  const nflWeek = () => {
    const now = Date.now(), next = Object.keys(WEEK_GAMES).map(Number).filter(w => w >= 1 && w <= 17).sort((p, q) => p - q).find(w => WEEK_GAMES[w].some(g => !g.final && Date.parse(g.t) + Calc.RULES.leagues.nfl.liveHours * 3600e3 > now));
    return next || Math.max(1, Math.min(17, 8 + Math.floor((now - new Date(2026, 9, 28).getTime()) / 604800000)));
  };
  const weekNow = () => (LG().daily ? slateOfDay(league, nbaDay()) : nflWeek());   // the current slate of the league on screen
  function graphsOK() {
    const next = LG().daily ? slateOfDay(league, nbaDay(1)) : weekNow() + 1;   // this slate and the next: today and tomorrow for a daily league
    if (!LG().graphs || (curWeek !== weekNow() && curWeek !== next)) return false;
    const open = graphGames();
    return open.length > 0 && open.every(g => !g.noLine);
  }
  const drawLeagueStub = () => { if (LEAGUES.includes(view)) drawStub(view); };
  function showView(v) {
    view = v;
    $("ledger").hidden = v !== "ledger"; $("xy").hidden = v !== "xy"; $("season").hidden = v !== "season"; $("handicap").hidden = v !== "handicap"; $("code").hidden = v !== "code"; $("panel").hidden = v !== "week";
    LEAGUES.forEach(k => { $(k).hidden = v !== k; });
    ["ledger", "xy", "season", "handicap", "code"].forEach(k => $("tab-" + k).setAttribute("aria-selected", String(v === k)));
    document.querySelectorAll(".weektabs [data-week]").forEach(b => { const w = Number(b.dataset.week); b.classList.toggle("now", w === weekNow()); b.setAttribute("aria-selected", String(!SECTIONS[v] && w === curWeek)); });   // Graphs belongs to the selected week; one top tab is active at a time
    syncDayArrows();
    changed("view", "view:" + v);
    syncLeaguePick();
  }
  $("tab-xy").addEventListener("click", () => { detailGame = null; if (view === "xy") { showView("week"); } else showView("xy"); });   // clicking Graphs again goes back to the cards
  // Season stats, Handicap and Ledger: clicking the active one closes it, onto the current week's cards.
  ["season", "handicap", "ledger", "code"].forEach(k => $("tab-" + k).addEventListener("click", () => { if (view === k) { detailGame = null; switchWeek(weekNow()); } else showView(k); }));
  // The week tabs follow the league: Weeks 1-17, or for a daily league (the NBA, the NHL) yesterday, for its results, then its days from today (leagues.js), the spare tabs hidden.
  // A daily league's arrows step the open day, one a press, through the season (the user's, Nov 3 2026): the dates slide under the highlight, which stays in its slot,
  // until the tabs reach the season's first day or the last day pulled (today + days), and then the highlight moves along them instead. dayShift: days later than the usual eight.
  let dayShift = 0;
  const maxShift = l => LEAGUE_DEFS[l].days - 6;   // the last tab on the last day pulled
  const canShiftBack = l => nbaDay(dayShift - 2) >= seasonDay(l);
  const dayTabs = () => [...document.querySelectorAll(".weektabs [data-week]")].slice(0, LEAGUE_DEFS[league].days + 1);
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
    if (by > 0 ? dayShift < maxShift(league) : canShiftBack(league)) { dayShift += by; labelTabs(league); to = i; }   // the dates slide under the highlight
    const b = dayTabs()[to];
    if (!b) return;
    detailGame = null;
    switchWeek(Number(b.dataset.week));
  }
  const seasonDay = l => Number(new Date(LEAGUE_DEFS[l].start).toISOString().slice(0, 10).replace(/-/g, ""));
  function labelTabs(l) {
    const daily = Calc.RULES.leagues[l].daily;
    [...document.querySelectorAll(".weektabs [data-week]")].forEach((b, i) => {
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
    later.renderByes();
  }
  // The league picker (the user's, Nov 2 2026: graphical, like the wager ticket's pickers): a button with the league on screen in its own type, opening a list of every league but
  // those waiting for next year, each dressed as its own strip, the ones that are off dimmed and not choosable. Its arrows step through the leagues that are on, as the Book picker's do.
  const pickable = () => LEAGUE_ORDER.filter(k => !LEAGUES_LATER.includes(k));
  const closeLeagues = () => { $("leagueList").hidden = true; $("leaguePick").setAttribute("aria-expanded", "false"); };
  function pickLeague(k) {
    closeLeagues();
    if (LEAGUES.includes(k)) showView(k);
    else if (k !== league) setLeague(k);
    else if (LEAGUES.includes(view)) { detailGame = null; switchWeek(weekNow()); }
  }
  function syncLeaguePick() {
    const names = leagueNames(), cur = LEAGUES.includes(view) ? view : league;
    $("leaguePick").replaceChildren(names[cur]);
    $("leagueList").replaceChildren(...pickable().map(k => {
      const li = el("li", "lg-tile", names[k]);
      li.setAttribute("role", "option"); li.dataset.v = k; li.dataset.lg = k;
      li.setAttribute("aria-selected", String(k === cur)); li.setAttribute("aria-disabled", String(!leaguesOn.has(k)));
      li.addEventListener("click", () => { if (leaguesOn.has(k)) pickLeague(k); });
      return li;
    }));
  }
  $("leaguePick").addEventListener("click", () => { const open = $("leagueList").hidden; $("leagueList").hidden = !open; $("leaguePick").setAttribute("aria-expanded", String(open)); });
  $("leaguePick").dataset.keys = "arrows";   // it handles its own keys, past the page's key layer
  $("leaguePick").addEventListener("keydown", e => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const on = pickable().filter(k => leaguesOn.has(k)), next = on[on.indexOf(LEAGUES.includes(view) ? view : league) + (e.key === "ArrowDown" ? 1 : -1)];
    if (next) pickLeague(next);
  });
  document.addEventListener("click", e => { if (!$("leagueList").hidden && !e.composedPath().includes($("leagueBox"))) closeLeagues(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("leagueList").hidden) { closeLeagues(); $("leaguePick").focus(); } });
  syncLeaguePick();
  // Onto the first league that's on, if the one on screen isn't.
  function leaveOffLeague() {
    const stubOn = LEAGUES.includes(view), active = stubOn ? view : league;
    if (leaguesOn.has(active)) return;
    const first = LEAGUE_ORDER.find(k => leaguesOn.has(k));
    if (LEAGUES.includes(first)) showView(first);
    else if (first !== league) setLeague(first);
    else { detailGame = null; switchWeek(weekNow()); }
  }
  async function setLeagueOn(k, on) {
    if (on && LEAGUE_DEFS[k].slate === "day" && !ALL_GAMES.some(g => g.league === k)) {   // a daily league's games are pulled only once it's on
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
  // THE KEYS. One layer in front of every key, on the user's word (Nov 2 2026): a key Fan hasn't chosen does nothing, so a stray one can't press a focused Place or scroll the page.
  // Through: typing in a text or number field, a part that handles its own keys (data-keys), the browser's own shortcuts (Ctrl, Cmd or Alt, and the F keys), and the hotkeys below. A new hotkey is a line in HOTKEYS.
  const HOTKEYS = new Set(["Escape", "Tab"]);   // Escape closes what's open (each part listens for it); Tab moves between controls
  const typing = t => t && (t.isContentEditable || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || (t.tagName === "INPUT" && !["checkbox", "radio", "button", "submit", "reset", "range", "color", "file"].includes(t.type)));
  document.addEventListener("keydown", e => {
    if (HOTKEYS.has(e.key) || e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/.test(e.key) || typing(e.target) || (e.target && e.target.closest && e.target.closest("[data-keys]"))) return;
    e.preventDefault(); e.stopPropagation();
  }, true);   // before anything else hears it
  document.addEventListener("keydown", e => { if (e.key === "Escape" && detailGame) { detailGame = null; showView("week"); } });   // back from a game preview to the cards
  function clearRiskQuietly() { const col = document.querySelector(".col.left"), rc = $("riskCard"); col.classList.remove("has-sel"); rc.classList.add("rk-off"); rc.classList.remove("rk-over"); rc.setAttribute("aria-hidden", "true"); }
  function switchWeek(w) {
    if (w === curWeek) { if (view !== "week") showView("week"); return; }
    riskByWeek[curWeek] = riskKey; riskGame = null; clearRiskQuietly();
    riskKey = riskByWeek[w] || "";
    selectSlate(w);
    $("panel").setAttribute("aria-labelledby", "tab-w" + w);
    $("slateTitle").textContent = slateTitleOf(w); later.renderByes();
    later.weekChanged();
    applySlate(); showView("week");
  }
  document.querySelectorAll(".weektabs [data-week]").forEach(b => b.addEventListener("click", () => { const had = !!detailGame; detailGame = null; const w = Number(b.dataset.week); if (had && w === curWeek) showView("week"); else switchWeek(w); }));
export { nflWeek, ticketFromFill, weirdFills, setWeirdFills, programBehind, newestFor, LAYOUTS, isTall, layoutPref, setLayoutPref, nick, changed, definePanels, drawLeagueStub, drawNow, $, ALL_GAMES, APP_VERSION, FAN_CLASSES, GAMES, LG, RULES, allTickets, americanOf, applySlate, bdBadge, betClass, bookAbbr, bookTag, calc, centsOf, contractsFor, curWeek, dayFmt, deadFor, decimalOf, detailGame, drawStub, el, evMoneyline, evPoints, extremes, fillAmounts, fillSide, freshPrices, gameBets, gameKey, gameLabel, gameSettledPL, gamesInView, graphGames, hedgeFor, helmImg, initLines, kalshiCalc, kalshiCheck, kalshiMarket, last, later, league, leagueId, leagueNames, leagueOf, leaguesOn, leaveOffLeague, ledgerRows, legGame, legResult, legText, lineOf, lineOk, marginModel, money, nbaDay, odds, outcomes, pairFlagged, pairStakes, parlayShares, pbStats, profitOf, projectedPL, pts, readTicker, replyFill, resultCell, riskGame, riskKey, riskOf, selectSlate, setDetailGame, marketWanted, pricesOn, pricesWanted, trackingOn, clearPrices, setLeagueOn, setRiskGame, setTickets, setPricesWanted, setTrackingOn, settleOf, shareRisk, shareTerm, shortDayFmt, showView, signedMoney, slateAt, linesAt, spentShares, status, subView, switchWeek, teamLook, ticketLeagueOn, ticketPL, ticketPrice, tickets, ticketsInView, timeFmt, timeZoned, tz, view, vigOf, weekNow, setRiskKey, CARD_ACTIONS, teamChip, hasArt, brighterOf, fitSlateLine, graphsOK, SECTIONS, isPhone, mq };
