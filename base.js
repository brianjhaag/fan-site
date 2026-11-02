// The page's core: state, formats, the game cards, tabs and menus.
import { WEEK_GAMES, pullDaily, pullNcaafb, pullStatus, setRefresh } from "./espn.js?v=mvzurx0y";
import { BOOK_ICONS } from "./data/assets.js?v=mvzurx0y";
import { HELM_PAD, LEAGUES_LATER, LEAGUE_DEFS, LEAGUE_ORDER, NFL_NICKS, PLATE_STATES, TEAM, abbr, leagueOfSlate, lumOf, metaDocId, slateDocId, slateOfDay, slateTitleOf, teamName, teamOf } from "./leagues.js?v=mvzurx0y";
import { Calc } from "./calc.js?v=mvzurx0y";
import { Fan } from "./hosts.js?v=mvzurx0y";
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
  const addDailyGame = (l, { t, a, h, tv }) => {
    const w = slateOfDay(l, Number(t.slice(0, 10).replace(/-/g, ""))), g = { t, away: teamName(l, a), home: teamName(l, h), tv, league: l, noLine: true, line: { sp: 0, spj: [-110, -110], tot: LEAGUE_DEFS[l].neutralTotal, toj: [-110, -110], ml: [-110, -110] }, week: w };
    (WEEK_GAMES[w] = WEEK_GAMES[w] || []).push(g);
    return g;
  };
  Object.entries(WEEK_GAMES).forEach(([w, list]) => list.forEach(g => { g.week = Number(w); }));
  // The page was called Bet until Oct 31 2026: a browser's settings under the old name carry over once.
  try { for (const k of ["tracking", "leagues", "badges", "tickets", "game"]) { const v = localStorage.getItem("bet." + k); if (v != null && localStorage.getItem("fan." + k) == null) localStorage.setItem("fan." + k, v); } } catch (e) {}
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
  let lastSavedTabKey = "";
  const inRiskGame = t => { const k = gameKey(riskGame); return t.key === k || (!t.key && t.kickoff === riskGame.t && t.game === gameLabel(riskGame)) || (t.parlay && t.legs.some(l => l.key === k)); };
  // What the totals and the saved tickets show: the selected game and its wagers, or the whole week.
  const ticketsInView = () => riskGame ? tickets.filter(inRiskGame) : tickets;
  const gamesInView = () => riskGame ? [riskGame] : GAMES;
  let curWeek = 7, GAMES = WEEK_GAMES[7] || [], view = "week";   // view: "week" and "xy" (Graphs) belong to the selected week; a key of SECTIONS is one of the other top buttons
  // The top strip's tabs other than the weeks, and the bottom strip's buttons for each; an entry with `stub` is a placeholder saying what it will show. A section with one view has no bottom buttons. A new section or view is one entry here.
  const SECTIONS = {
    playbook: [{ k: "main", h: "Trends" }],
    ncaafb: [{ k: "main", h: "NCAA FB", stub: "Not built yet." }],
    season: [{ k: "margins", h: "Margins" },
      { k: "keys", h: "Key numbers", stub: "How often games land on 3, 7, 10 and the other key numbers this season, against the long-run shares." },
      { k: "teams", h: "Teams", stub: "Each team's season: record, scoring, form and ranks." }],
    ledger: [{ k: "balances", h: "Balances" },
      { k: "weeks", h: "By week", stub: "Wagered, won and lost, and net cash for each week." },
      { k: "open", h: "Open bets", stub: "Every bet still undecided, across all weeks and books." },
      { k: "check", h: "Kalshi check" }]
  };
  const subView = { season: "margins", ledger: "balances", playbook: "main", ncaafb: "main" };
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
      tvBtn.addEventListener("click", () => { watchGame(g); });   // always on here: a list read once can't say what's live now
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
    if (!LG().stats && (v === "season" || v === "playbook")) { $(v).replaceChildren(el("div", "pg-stub", `${LG().code} ${v === "season" ? "season stats" : "playbook"}`), el("p", "pg-stub-t", "Not built yet.")); return true; }
    const s = SECTIONS[v].find(x => x.k === subView[v]);
    if (!s.stub) return false;
    $(v).replaceChildren(el("div", "pg-stub", s.h), el("p", "pg-stub-t", s.stub));
    return true;
  }
  // The networks the slates name, each with a link the user pastes in the settings window. Claude's default list. Kept per browser.
  const NETWORKS = ["CBS", "Fox", "NBC", "ABC", "ESPN", "ESPN2", "SEC Network", "BTN", "CW", "Peacock", "NFL Network", "Prime Video"];
  let networkLinks = {};
  try { const v = JSON.parse(localStorage.getItem("fan.networks")); if (v && typeof v === "object") networkLinks = v; } catch (e) {}
  function setNetworkLink(n, url) {
    if (url.trim()) networkLinks[n] = url.trim(); else delete networkLinks[n];
    try { localStorage.setItem("fan.networks", JSON.stringify(networkLinks)); } catch (e) {}
    changed("cards");
  }
  // Which monitor and layout telecasts use, picked in the settings window. Null: Fan's suggestion. Kept per browser.
  const TELECAST_LAYOUTS = [["1", 1, 1], ["2 stacked", 2, 1], ["3 stacked", 3, 1], ["2 across", 1, 2], ["2x2", 2, 2]];
  let telecastPref = null;
  try { const v = JSON.parse(localStorage.getItem("fan.telecast")); if (v && v.label) telecastPref = v; } catch (e) {}
  function setTelecastPref(p) {
    telecastPref = p;
    try { if (p) localStorage.setItem("fan.telecast", JSON.stringify(p)); else localStorage.removeItem("fan.telecast"); } catch (e) {}
  }
  // How this browser's user watches (the Application tab's Networks box): YouTube TV, with a link pasted per network, or an HDHomeRun on their network, with the channel each broadcast network is on there. Kept per browser.
  const WATCH_SETUPS = [["youtubetv", "YouTube TV"], ["hdhomerun", "HDHomeRun"]];   // HDHomeRun on the user's word (Nov 2 2026): an antenna's channels, played in VLC
  const BROADCAST = ["CBS", "Fox", "NBC", "ABC", "CW"];   // the networks an antenna gets
  let watchSetup = "youtubetv", hdhr = { ip: "", channels: {} };
  try { watchSetup = localStorage.getItem("fan.watchSetup") || "youtubetv"; const v = JSON.parse(localStorage.getItem("fan.hdhomerun")); if (v && typeof v === "object") hdhr = { ip: String(v.ip || ""), channels: v.channels && typeof v.channels === "object" ? v.channels : {} }; } catch (e) {}
  function setWatchSetup(s) { watchSetup = s; try { localStorage.setItem("fan.watchSetup", s); } catch (e) {} changed("cards"); }
  function setHdhr(patch) { hdhr = { ...hdhr, ...patch }; try { localStorage.setItem("fan.hdhomerun", JSON.stringify(hdhr)); } catch (e) {} changed("cards"); }
  // A game's networks: ESPN's list ("ESPN / ABC" is two), plus what ESPN's data leaves out, one rule a line: [when, has, add].
  const isMonday = g => new Date(g.t).toLocaleDateString("en-US", { weekday: "short", timeZone: "America/New_York" }) === "Mon";
  const NETWORK_RULES = [[isMonday, "ESPN", "ABC"]];   // ESPN's Monday night games are on ABC too [U, Nov 2 2026]
  const gameNetworks = g => { const nets = String(g.tv || "").split("/").map(n => n.trim()).filter(Boolean); NETWORK_RULES.forEach(([when, has, add]) => { if (nets.includes(has) && !nets.includes(add) && when(g)) nets.push(add); }); return nets; };
  // What a game's Live telecast button does, so also whether it's lit: one decision for both. An HDHomeRun channel for one of its networks, when that's how the user watches;
  // else a pasted https link for one of them; else null.
  function telecastFor(g) {
    const nets = gameNetworks(g), ch = watchSetup === "hdhomerun" && hdhr.ip ? nets.find(n => hdhr.channels[n]) : null;
    if (ch) return { how: "hdhr", network: ch, channel: hdhr.channels[ch] };
    const ln = nets.find(n => /^https:\/\//i.test(networkLinks[n] || ""));
    return ln ? { how: "link", network: ln, url: networkLinks[ln] } : null;
  }
  // A word at the bottom of the screen for a few seconds, for what a press couldn't do.
  function toast(text) { let t = document.querySelector(".fan-toast"); if (!t) { t = el("div", "fan-toast"); document.body.append(t); } t.textContent = text; t.hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => { t.hidden = true; }, 7000); }
  // Pressed: the HDHomeRun channel, tuned in VLC when that's installed, or else which channel to pick in the HDHomeRun app (which has no documented way to be opened on a channel);
  // or the network's link. NCAA FB's list, always on, opens YouTube TV's site when nothing is set.
  function watchGame(g) {
    const d = telecastFor(g);
    if (d && d.how === "hdhr") {
      const say = `${d.network} is ${d.channel} on your HDHomeRun: open it in the HDHomeRun app`;
      if (!Fan.playHdhr) { toast(say); return; }
      Fan.playHdhr(hdhr.ip, d.channel).then(r => { if (!r.ok) toast(/VLC isn't installed/.test(r.error) ? say : "HDHomeRun: " + r.error); }, () => toast(say));
      return;
    }
    Fan.openTelecast(d ? d.url : "https://tv.youtube.com/", telecastPref);
  }
  const LEAGUES = [];   // the league picker's leagues that are stubs: none now. NCAA FB's list (drawNcaafb) is off, on the user's word: adding "ncaafb" here and to leagues.js brings it back
  const leagueNames = () => Object.fromEntries(LEAGUE_ORDER.map(k => [k, LEAGUE_DEFS[k].name]));
  // The games the Graphs panel plots: those of the selected week still to kick off.
  const graphGames = () => GAMES.filter(g => !g.final && status(g)[0] === "Upcoming");
  const ALL_GAMES = Object.keys(WEEK_GAMES).map(Number).sort((p, q) => p - q).flatMap(w => WEEK_GAMES[w]);
  // The calculations live in calc.js; here they are bound to the page's games and tickets.
  const calc = Calc.make({ games: ALL_GAMES, now: () => Date.now(), abbr: n => abbr(n) });
  const { RULES, leagueId, leagueOf, outcomes, last, nick, gameLabel, gameKey, profitOf, riskOf, decimalOf, ticketPrice, legResult, ticketPL, marginModel, lineOk, FAN_CLASSES, betClass, odds, contractsFor, kalshiCalc, centsOf, americanOf, fillSide, fillAmounts, kalshiMarket, freshPrices, evMoneyline, evPoints, pairFlagged, pairStakes, pbStats, replyFill } = Calc;
  const { status, settleOf, vigOf, projectedPL, deadFor, shareRisk, shareTerm, extremes, hedgeFor, readTicker, kalshiCheck, ledgerRows } = calc;
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

  const APP_VERSION = "0.35.15";   // the label in the settings window and the title. Claude sets it at each build, as major.minor.patch
  const $ = id => document.getElementById(id);
  document.title = "Fan " + APP_VERSION;
  $("appName").textContent = APP_VERSION;   // in the settings window's header, so it shows whether or not Bet tracking is on
  $("infoVer").textContent = APP_VERSION;   // and at the info line's far right
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
  const pts = n => (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n);

  // Saved tickets (per-browser convenience only)
  // allTickets holds every week's wagers; tickets is the selected week's slice (a wager with no week belongs to Week 7).
  let allTickets = [], tickets = [];
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
  setInterval(() => { if (Fan.hostHello) Fan.hostHello().then(hi => hi.refresh || "", () => "The connector isn't answering").then(p => { if (p !== hostProblem) { hostProblem = p; slateNote(noteText); } }); }, 30000);
  // the update text turns amber when the lines are more than an hour old (checked every minute)
  let slateAt = 0;
  const staleCheck = () => $("slateNote").classList.toggle("stale", slateAt > 0 && Date.now() - slateAt > 3600000);
  setInterval(staleCheck, 60000);
  // The update text and the byes share one line under the game cards AND the wager ticket (left edge of the cards to the right edge of the ticket): 22px, smaller when they would not fit.
  function fitSlateLine() {
    const line = document.querySelector(".sec-title.one-line"), note = $("slateNote"), wager = document.querySelector(trackingOn ? ".col.left" : ".tabrows.bottom");   // with tracking off there's no wager ticket: the line runs to the strip's right edge
    if (!line || !wager) return;
    const W = wager.getBoundingClientRect().right - line.getBoundingClientRect().left;
    if (!(W > 0)) return;
    line.style.width = W + "px";
    line.style.setProperty("--slate-fs", "16px");
    const need = note.scrollWidth + document.querySelector(".bye-box").scrollWidth + $("infoVer").scrollWidth + 38;
    line.style.setProperty("--slate-fs", Math.max(8, Math.min(16, 16 * W / need)) + "px");
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
    slateDocs.forEach(d => {
      const v = d.data() || {};
      if (d.id === metaDocId(curWeek)) { if (pricesOn()) meta = v; return; }
      const g = ALL_GAMES.find(x => slateDocId(x) === d.id);
      if (!g) return;
      if (Array.isArray(v.final)) g.final = v.final; else if (v.final === null) delete g.final;
      if (!pricesOn()) return;
      if (v.line) { g.line = v.line; delete g.noLine; }
      else if (v.live && g.noLine) { g.line = v.live; delete g.noLine; }   // first seen after tipoff: no pre-game line was saved
      if (v.live) g.live = v.live; else delete g.live;
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
  // A final NFL game's replays on nfl.com, in the user's own browser, where their sign-in is. Condensed Replay is a button on that tab. Every 2026 game to Week 8 answered at this address, Nov 1 2026.
  const tapeLink = g => `https://www.nfl.com/games/${nick(g, "away").toLowerCase()}-at-${nick(g, "home").toLowerCase()}-2026-reg-${g.week}?tab=highlights-replays`;
  function cardGutter(g) {
    const box = el("div", "g-gut");
    box.addEventListener("click", e => e.stopPropagation());   // a click here isn't a click on the card
    const st = status(g)[1];
    CARD_ACTIONS.forEach(([name, icon]) => {
      const b = el("button"), live = name === "Game preview" ? leagueOf(g).gameDetails : name === "Live telecast" ? st !== "final" && !!telecastFor(g) : name === "Tape" ? st === "final" && leagueOf(g).code === "NFL" : name === "Box score" ? (st === "live" || st === "final") && !!g.eid : name === "Risk detail" && trackingOn;
      b.type = "button"; b.disabled = !live; b.title = name; b.setAttribute("aria-label", name); b.innerHTML = icon;
      if (name === "Live telecast" && st === "live") b.classList.add("on-air");
      if (name === "Risk detail" && riskGame === g) { b.classList.add("active"); b.setAttribute("aria-pressed", "true"); }
      if (live) b.addEventListener("click", name === "Game preview" ? () => { detailGame = g; showView("week"); } : name === "Live telecast" ? () => { watchGame(g); } : name === "Tape" ? () => { window.open(tapeLink(g), "_blank", "noopener"); } : name === "Box score" ? () => { window.open(`https://www.espn.com/nfl/boxscore/_/gameId/${g.eid}`, "_blank", "noopener"); } : () => { setRiskGame(riskGame === g ? null : g); if (riskGame) riskKey = gameKey(g); });
      box.append(b);
    });
    return box;
  }

  // The game card's team badge, by named style. Each colors a chip that already has its text; a final game's card has no badge.
  const BADGE_STYLES = {
    plain: { label: "Plain", draw(chip, g, side) {   // the badge color is lightened 33% toward white, then faded 50%; the helmet stays solid
      const [r_, g_, b_] = [1, 3, 5].map(i => { const v = parseInt(teamLook(g, side).bg.slice(i, i + 2), 16); return Math.round(v + (255 - v) * .33); });
      chip.style.background = `rgb(${r_} ${g_} ${b_} / .5)`;
    } },
    license: { label: "License", draw(chip, g, side) {   // the team's colors on its home state's plate: state on top, the team stamped below
      const k = teamLook(g, side), nk = nick(g, side);
      chip.classList.add("plate");
      chip.style.backgroundColor = k.bg; chip.style.borderColor = k.fg;
      const code = el("b", "pl-no", abbr(nk)), box = el("span", "tn-txt");
      const state = PLATE_STATES[TEAM[nk] && TEAM[nk].state] || "";
      box.append(el("small", "pl-st" + (state.length > 11 ? " long" : ""), state), code);
      const old = chip.querySelector(".tn-txt");
      if (old) old.replaceWith(box); else chip.replaceChildren(box);
    } }
  };
  let badgeStyle = "license";
  try { const s = localStorage.getItem("fan.badges"); if (BADGE_STYLES[s]) badgeStyle = s; } catch (e) {}
  function setBadgeStyle(s) {
    badgeStyle = s;
    try { localStorage.setItem("fan.badges", s); } catch (e) {}
    changed("cards");
  }

  // A game under way, by ESPN: its card has the clock, and each plate the team's score, with or without prices.
  const showsNow = g => !g.final && !!g.now;
  const scoreOf = g => g.final || null;
  function teamRow(g, side, over) {
    const L = lineOf(g), away = side === "away", n = away ? 0 : 1;
    const tr = el("tr");
    const name = el("td", "tn");
    const chip = teamChip(g, side, leagueOf(g).codeChips ? abbr(nick(g, side)) : nick(g, side), "tname");
    chip.style.borderColor = "transparent";   // no outline on black badges here (the other views keep it)
    if (hasArt(nick(g, side))) {   // the helmet or logo sits at the left of the badge
      const img = helmImg(nick(g, side), "helm");
      chip.replaceChildren(img, el("span", "tn-txt", abbr(nick(g, side)))); chip.classList.add("has-helm");
    }
    BADGE_STYLES[over ? "plain" : badgeStyle].draw(chip, g, side);
    if (!over && showsNow(g)) {   // a black plate holding what a final's card shows: team and score in scoreboard type, the leader lit
      const box = el("span", "tn-txt live-sc"), old = chip.querySelector(".tn-txt"), s = g.now.score;
      box.append(el("span", null, abbr(nick(g, side))), el("span", null, String(s[n])));
      if (old) old.replaceWith(box); else chip.replaceChildren(box);
      chip.classList.add("live"); if (s[n] > s[1 - n]) chip.classList.add("lead");    }
    name.append(chip);
    if (over) {
      // final: no badge; helmet, name and score share one cell, the name centered between helmet and score in the scoreboard font
      const shown = scoreOf(g), won = shown && shown[n] > shown[1 - n];
      chip.classList.add("over"); if (won) chip.classList.add("win");
      chip.style.setProperty("--score-cells", leagueId(g) === "nba" ? 3 : 2);   // the NBA's scores run to three digits
      if (g.final && g.final[n] < g.final[1 - n]) chip.classList.add("lost");   // the losing team's helmet is faded to 25% opacity
      chip.append(el("span", "sc", shown ? String(shown[n]) : "–"));
      name.colSpan = 3;
      tr.append(name);   // no moneyline once the game is over
      if (away) { const f = el("td", "fin", g.final ? "F" : ""); f.rowSpan = 2; if (g.final) f.setAttribute("aria-label", "Final"); tr.append(f); }
      return tr;
    }
    // The favorite's spread is the underdog's mirrored, so only the underdog's row shows it. The favorite's row shows its chance to win there instead.
    const sp = away ? L.sp : -L.sp;
    const nl = !!g.noLine;   // no market yet (a far-off week): dashes instead of the placeholder numbers
    const ml = el("td", "ml", !pricesOn() ? "" : nl ? "—" : odds(L.ml[n]));   // tracking off: no prices anywhere, not dashes
    ml.style.color = brighterOf(g, side);
    if (!nl && pricesOn() && trackingOn) { ml.classList.add("ml-go"); ml.addEventListener("click", e => { e.stopPropagation(); later.fillMoneyline(g, n); }); }   // a moneyline click fills the wager ticket instead of selecting the card
    const spc = el("td", "sp", !pricesOn() || nl ? "" : sp < 0 ? Calc.winPct(L.ml, away) + "%" : pts(sp).replace(/\d+(\.\d+)?/, v => Number(v).toFixed(1)));   // one decimal always: +4.0, +3.5
    spc.style.color = brighterOf(g, side);
    if (spc.textContent.endsWith("%")) spc.classList.add("wp");
    if (!nl && sp >= 0 && pricesOn() && trackingOn) { spc.classList.add("ml-go"); spc.addEventListener("click", e => { e.stopPropagation(); later.fillSpread(g, n); }); }   // the spread shows on the underdog's row, so a click fills the underdog
    tr.append(ml, name, spc);
    // The total is the same for both teams: one cell on the first row spanning both, centered between them.
    if (away) {
      const tot = el("td", "tot", !pricesOn() ? "" : nl ? "—" : Number(L.tot).toFixed(1)); tot.rowSpan = 2;
      if (!nl && pricesOn() && trackingOn) { tot.classList.add("ml-go"); tot.title = "Top half: over. Bottom half: under."; tot.addEventListener("click", e => { e.stopPropagation(); const r = tot.getBoundingClientRect(); later.fillTotal(g, e.clientY < r.top + r.height / 2 ? 0 : 1); }); }   // a total click fills the wager ticket
      tr.append(tot);
    }
    return tr;
  }

  // The game the risk detail is showing.
  { const first = GAMES.find(g => g.away.endsWith("Packers")) || GAMES[0]; var riskKeyStart = first ? gameKey(first) : ""; }
  let riskKey = riskKeyStart;

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

  // The bottom strip: a tab for every game of the selected week (kickoff order), first half in the top row, the rest under it. A click opens the game detail tab.
  // The bottom strip belongs to the button highlighted on top. A week: its games, plus Graphs when the slate has lines. Another section: that section's own buttons.
  function renderSectionTabs() {
    later.syncPlace();   // new slate data can bring the ticket's Kalshi market
    if (view === "xy" && !graphsOK()) { showView("week"); return; }
    const other = !!SECTIONS[view], row = $("sectiontabs1");
    document.querySelector(".weektabs.grf").style.display = !other && graphsOK() ? "" : "none";
    if (other) {
      document.querySelector(".bye-box").style.display = "none";
      row.replaceChildren(...(SECTIONS[view].length < 2 || (!LG().stats && view === "season") ? [] : SECTIONS[view].map(s => {
        const b = el("button", null, s.h);
        b.type = "button"; b.draggable = false; b.setAttribute("aria-selected", String(subView[view] === s.k));
        b.addEventListener("click", () => { subView[view] = s.k; showView(view); });
        return b;
      })));
      fitStripRows();
      return;
    }
    if (view === "xy") document.querySelector(".bye-box").style.display = "";
    row.replaceChildren();   // a week's strip has only Graphs
    fitStripRows();
  }
  // The rows rule (the user's, Nov 2 2026): buttons go on the top strip's top row and the bottom strip's bottom row. In a portrait or narrow layout a strip whose row doesn't fit
  // collapses: the top strip puts its right side (the league picker and Fan) over its tabs, the bottom strip its left side (Graphs or a section's buttons) over Season stats, Playbook and Ledger.
  // Measured from what doesn't move when it collapses, so it never flips back and forth.
  // The league picker sits halfway between the column divide and Fan, or just left of Fan with no divide or a collapsed strip.
  let divideX = null;
  function fitStripRows() {
    const c = document.documentElement.classList, folds = c.contains("lay-portrait") || c.contains("lay-narrow");
    const bottom = document.querySelector(".tabrows.bottom"), right = [".pagetabs", ".ledgertab"].reduce((s, q) => s + document.querySelector(q).offsetWidth, 0);
    bottom.classList.toggle("collapsed", folds && document.querySelector(".strip-left").scrollWidth + right + 26 > bottom.clientWidth);
    const top = document.querySelector(".tabrows:not(.bottom)");
    top.classList.toggle("collapsed", folds && document.querySelector(".weektabs.wk2").offsetWidth + $("leaguePick").offsetWidth + $("fanBtn").offsetWidth + 18 > top.clientWidth);
    const box = $("leagueBox"), room = divideX != null && !top.classList.contains("collapsed") ? $("fanBtn").getBoundingClientRect().left - divideX : 0;
    box.style.marginRight = Math.max(0, room / 2 - box.offsetWidth / 2) + "px";
  }
  const rowWatch = new ResizeObserver(() => fitStripRows());   // held here, so it keeps watching: the picker's width, the DEMO badge, a section's buttons (not Fan's box, which the picker's margin resizes)
  [$("leagueBox"), $("fanBtn"), document.querySelector(".strip-left"), document.querySelector(".pagetabs"), document.querySelector(".ledgertab")].forEach(e => rowWatch.observe(e));

  // The bottom strip stays the width of the screen; its two tab rows run from the left edge of the game cards to the left edge of the right-hand stack (the wager ticket column).
  function fitSectionTabs() {
    const g0 = $("games").getBoundingClientRect(), wager = document.querySelector(".col.left");
    if (!(g0.width > 0) || !wager) return;
    // The top strip's tabs stay where they are with tracking off, so they're measured against the column as it would be.
    const rootEl = document.documentElement;
    rootEl.classList.remove("tracking-off");
    const wr = wager.getBoundingClientRect();
    rootEl.classList.toggle("tracking-off", !trackingOn);
    divideX = wr.left > g0.left ? wr.left : null;   // the column divide, where there are two columns side by side
    const g = { left: g0.left, width: wr.left > g0.left ? wr.left - g0.left : document.querySelector(".tabrows:not(.bottom)").clientWidth };   // a narrow layout puts the stack above the cards: the weeks take the strip's width, and fitStripRows puts Fan over them
    // the two week rows are as wide as the game cards (the strips themselves stay the width of the screen)
    document.querySelectorAll(".weektabs.wk2").forEach(r => { r.style.width = g.width + "px"; r.style.setProperty("--cell", (g.width / 9) + "px"); });
    fitStripRows();
  }
  // The week view must not scroll vertically: if the page is taller than the window, the games area (and the card height) shrinks by the overflow. It always tries the full size
  // first, so a window that grows later gets the room back at the next render; nothing is sized from the window directly, which is what made an auto-sized frame run away before.
  // On a phone the week tabs scroll sideways, so the open week is brought into view.
  function showOpenWeek() { if (isPhone()) document.querySelectorAll(".weektabs.wk2 [aria-selected=true]").forEach(b => { const r = b.closest(".tabrows"); r.scrollLeft = b.getBoundingClientRect().left - r.getBoundingClientRect().left + r.scrollLeft - 40; }); }
  function fitViewportHeight() {
    showOpenWeek();
    if (view !== "week") return;
    const root = document.documentElement;
    if (isPhone()) { root.style.setProperty("--card-h", "150px"); return; }   // a phone's page scrolls
    // measured with the wager ticket in place (not the selected game's graph card), so selecting a game never changes the card sizes
    const col = document.querySelector(".col.left"), rc = $("riskCard"), sel = col.classList.contains("has-sel");
    if (sel) { col.classList.remove("has-sel"); rc.classList.add("rk-off"); rc.classList.remove("rk-over"); }
    col.style.height = ""; col.style.alignSelf = "";   // the column's height from the last fit must not feed this measurement: same inputs, same card size every time
    root.style.setProperty("--games-h", "728px"); root.style.setProperty("--card-h", "165px");
    const over = root.scrollHeight - window.innerHeight;
    if (sel) { col.classList.add("has-sel"); rc.classList.remove("rk-off"); rc.classList.add("rk-over"); }
    if (over <= 1) return;
    const gh = Math.max(560, 728 - over), ch = Math.max(120, Math.min(165, Math.floor((gh - 38) / 4)));
    root.style.setProperty("--games-h", gh + "px"); root.style.setProperty("--card-h", ch + "px");
  }
  // The wager ticket column ends level with the bottom of the fourth row of game cards (the last row if fewer), so the update text line can run underneath it; the saved tickets list, the flexing item, gives up the height.
  // It also stays 8px above the pinned bottom tab strip when the window is shorter than the page (the page scrolls). An auto-sized frame (no scrolling) is not sized from the
  // window: that would feed back into the frame's own height.
  function fitTicketColumn() {
    const col = document.querySelector(".col.left"), strip = document.querySelector(".tabrows.bottom"), games = $("games");
    if (!col || !strip || !games) return;
    col.style.height = ""; col.style.alignSelf = "";
    const cr = [...games.querySelectorAll(".game")].map(c => c.getBoundingClientRect()).filter(q => q.width > 0).sort((p, q) => p.top - q.top);
    const r = col.getBoundingClientRect();
    let bottom = games.getBoundingClientRect().bottom + window.scrollY;
    // the ticket ends level with the bottom of the fourth row of game cards (a week with fewer rows is measured as if it had four)
    const allDone = col.classList.contains("all-final");
    if (cr.length && !allDone) { const tops = []; cr.forEach(q => { if (!tops.length || q.top - tops[tops.length - 1] > 3) tops.push(q.top); }); const t = tops[Math.min(3, tops.length - 1)]; bottom = Math.max(...cr.filter(q => Math.abs(q.top - t) <= 3).map(q => q.bottom)) + window.scrollY + Math.max(0, 4 - tops.length) * (cr[0].height + 4); }   // a week with fewer than four rows is measured as if it had four
    if (document.documentElement.scrollHeight > window.innerHeight + 1) bottom = Math.min(bottom, window.innerHeight - strip.offsetHeight - 36 - 8);
    if (cr.length || allDone) fitTicketColumn.bottom = bottom; else if (fitTicketColumn.bottom != null) bottom = fitTicketColumn.bottom;   // game detail: same bottom as the cards view
    // a narrowed ticket column in a portrait window takes the height it has down to the bottom row, so the saved tickets get room
    if (!allDone && document.documentElement.classList.contains("lay-portrait") && mq("(max-width: 1347px)")) { col.style.alignSelf = "start"; col.style.height = Math.max(r.height, window.innerHeight - strip.offsetHeight - 36 - 8 - (r.top + window.scrollY)) + "px"; return; }
    const h = bottom - (r.top + window.scrollY);
    if (h > 0 && h < r.height - 1) { col.style.alignSelf = "start"; col.style.height = Math.max(300, h) + "px"; }
  }
  // The background image fills the band from the top strip's bottom edge to the bottom strip's top edge, behind the info line too: pinned to the window with the bottom strip, or measured on the page where that strip scrolls with it (a phone).
  function fitBand() { const t = document.querySelector(".tabrows:not(.bottom)").getBoundingClientRect(), strip = document.querySelector(".tabrows.bottom"), b = strip.getBoundingClientRect(), band = $("bgBand"), pinned = getComputedStyle(strip).position === "fixed"; band.style.position = pinned ? "fixed" : "absolute"; band.style.top = (t.bottom + window.scrollY) + "px"; band.style.bottom = pinned ? b.height + "px" : "auto"; band.style.height = pinned ? "" : Math.max(0, b.top - t.bottom) + "px"; }
  const bandWatch = new ResizeObserver(fitBand);   // held here, so it keeps watching
  bandWatch.observe(document.body); bandWatch.observe(document.querySelector(".tabrows:not(.bottom)"));
  window.addEventListener("resize", () => { fitViewportHeight(); fitSectionTabs(); fitTicketColumn(); fitBand(); });
  window.addEventListener("load", () => fitTicketColumn());
  window.addEventListener("resize", () => fitSectionTabs());
  document.addEventListener("dragstart", e => { if (e.target.closest && e.target.closest(".tabrows")) e.preventDefault(); });   // the bottom strip tabs are fixed in place (no dragging)
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fitSectionTabs());

  // Hover arrows for the game strip (mouse): a tap scrolls one card column, holding scrolls steadily. Only shown while the strip can scroll that way.
  let gArrows = null;
  function updateGameArrows() {
    const g = $("games");
    if (!gArrows) {
      const wrap = g.parentElement;
      wrap.classList.add("gwrap"); wrap.style.position = "relative";
      const mk = dir => {
        const b = el("button", "garrow " + (dir < 0 ? "l" : "r"));
        b.type = "button"; b.setAttribute("aria-label", dir < 0 ? "Scroll games left" : "Scroll games right");
        b.innerHTML = '<svg viewBox="0 0 18 28" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="' + (dir < 0 ? "M14 3 L4 14 L14 25" : "M4 3 L14 14 L4 25") + '"/></svg>';
        let timer = 0, raf = 0, held = false;
        const stop = () => { clearTimeout(timer); clearInterval(raf); };
        const loop = () => { raf = setInterval(() => { g.scrollLeft += dir * 14; }, 16); };
        b.addEventListener("pointerdown", e => { if (e.button !== 0) return; held = false; timer = setTimeout(() => { held = true; loop(); }, 250); });
        const release = () => { if (!timer && !held) return; const wasHeld = held; stop(); timer = 0; held = false; if (!wasHeld) g.scrollBy({ left: dir * 388, behavior: "smooth" }); };
        b.addEventListener("pointerup", release);
        b.addEventListener("pointerleave", () => { if (held) { stop(); held = false; } timer && clearTimeout(timer); timer = 0; });
        wrap.append(b);
        return b;
      };
      gArrows = [mk(-1), mk(1)];
      g.addEventListener("scroll", updateGameArrows, { passive: true });
      window.addEventListener("resize", updateGameArrows);
    }
    const can = g.classList.contains("strip") && !g.classList.contains("bd") && g.scrollWidth > g.clientWidth + 1;
    gArrows[0].classList.toggle("on", can && g.scrollLeft > 1);
    gArrows[1].classList.toggle("on", can && g.scrollLeft < g.scrollWidth - g.clientWidth - 1);
  }

  // The hover explanation of a game card's lock or hedge icon. One element on the page; a redraw of the cards removes it, since the icon under the pointer is replaced without a mouseleave.
  let tradeTip = null;
  const hideTradeTip = () => { if (tradeTip) { tradeTip.remove(); tradeTip = null; } };
  function showTradeTip(anchor, h) {
    hideTradeTip();
    const tip = el("div", "trade-tip");
    tip.append(el("b", null, `Buy ${h.n} contracts: ${h.txt} at ${Math.round(h.ask * 100)}¢ on Kalshi, ${money(h.cost)}`),
      el("div", null, `Worst ${signedMoney(h.worstBefore)} → ${signedMoney(h.worstAfter)}, best ${signedMoney(h.bestBefore)} → ${signedMoney(h.bestAfter)}`));
    document.body.append(tip);
    tradeTip = tip;
    const a = anchor.getBoundingClientRect(), t = tip.getBoundingClientRect();
    tip.style.left = Math.max(8, Math.min(window.innerWidth - t.width - 8, a.left + a.width / 2 - t.width / 2)) + "px";
    tip.style.top = (a.top - t.height - 8 >= 8 ? a.top - t.height - 8 : a.bottom + 8) + "px";
  }
  let cardsScroll = null;
  function renderGames() {
    hideTradeTip();
    const box = $("games");
    // A week whose games are all final has no wager ticket; the saved tickets card shows its Summary tab by default (set once per week, and when the week becomes final).
    const allFinal = GAMES.length > 0 && GAMES.every(g => g.final);
    document.querySelector(".col.left").classList.toggle("all-final", allFinal);
    document.querySelector(".bye-box").style.display = !LG().byes || allFinal || (detailGame && GAMES.includes(detailGame)) ? "none" : "";   // no byes line for a finished week, or while a game detail is open
    fitSlateLine();
    if (curWeek + ":" + allFinal !== lastSavedTabKey) { lastSavedTabKey = curWeek + ":" + allFinal; later.showSaved(allFinal ? "summary" : "tickets"); }
    const shownDetail = detailGame && GAMES.includes(detailGame) ? detailGame : null;
    const wasDetail = box.classList.contains("bd");
    if (shownDetail && !wasDetail) cardsScroll = { week: curWeek, league, x: box.scrollLeft, y: window.scrollY };   // closing the preview puts the cards back where they were
    box.classList.toggle("bd", !!shownDetail);
    // a game preview takes over the ticket column's room: the totals, saved tickets and wager ticket are hidden (their space stays) and the preview card widens across it
    { const topEl = document.querySelector(".top"), cl = document.querySelector(".col.left"); topEl.classList.toggle("bd-open", !!shownDetail); topEl.style.setProperty("--bdx", (cl.getBoundingClientRect().width + 20) + "px"); }
    if (shownDetail) { box.classList.remove("strip", "flat"); later.renderGameDetail(box, shownDetail); { const x = el("button", "bd-close", "×"); x.type = "button"; x.title = "Close"; x.setAttribute("aria-label", "Close game preview"); x.addEventListener("click", () => { detailGame = null; showView("week"); }); box.append(x); } renderSectionTabs(); fitViewportHeight(); fitSectionTabs(); fitTicketColumn(); updateGameArrows(); return; }
    box.replaceChildren();
    box.classList.add("strip");   // every week: the cards sit in columns by kickoff window, with a scrollbar along the bottom
    const made = [];
    GAMES.forEach(g => {
      const mine = gameBets(g);
      const shares = parlayShares(g);
      const spent = spentShares(g);
      const staked = mine.filter(t => !t.bonus).reduce((s, t) => s + t.amount, 0) + spent.filter(s => !s.t.bonus).reduce((a, s) => a + s.share, 0);
      const bonusStaked = mine.filter(t => t.bonus).reduce((s, t) => s + t.amount, 0) + spent.filter(s => s.t.bonus).reduce((a, s) => a + s.share, 0);
      const [stText, stCls] = status(g);
      const over = stCls === "final" && !showsNow(g);

      const card = el("article", "game" + (over ? " is-final" : "") + (riskGame === g ? " sel" : ""));
      if (pricesOn() && g.live && stCls === "live") { const P = g.line, sgn = v => (v > 0 ? "+" : "") + v; card.title = `Live prices (Kalshi). Pre-game: ${nick(g, "away")} ${pts(P.sp)} @ ${nick(g, "home")}, total ${P.tot}, moneyline ${sgn(P.ml[0])} / ${sgn(P.ml[1])}`; }   // hover shows the saved pre-game line

      // Top: when and where to watch
      const top = el("div", "g-top" + (stCls === "live" ? " live" : "") + (stText === "Upcoming" ? " upcoming" : ""));
      // Under way, the day and time are moot and the status badge sits mid-card, so only the network is left beside it.
      // A game in progress shows only its network, outlined in red like an "on air" button (no In progress badge).
      if (showsNow(g)) top.append(el("span", "g-air", [g.now.clock, g.tv].filter(Boolean).join(" · ")));
      else if (stCls === "live") top.append(el("span", "g-air", g.tv || "Live"));
      else top.append(el("span", "g-when", `${shortDayFmt.format(new Date(g.t))} · ${timeZoned(new Date(g.t))} · ${g.tv}`));

      // Middle: lines, or the score once the game is over
      const mid = el("div", "g-mid");
      const table = el("table", over ? "board" : "board lines");
      const tbody = el("tbody");
      tbody.append(teamRow(g, "away", over), teamRow(g, "home", over));
      table.append(tbody);
      mid.append(table);

      // Bottom: risk and profit/loss
      const bot = el("div", "g-bot");
      const wagered = el("div", "stat"), risk = el("div", "stat mid"), pl = el("div", "stat");
      const nd = t => t.split("$").join("");   // the values on game cards carry no dollar signs
      const noBets = !mine.length && !spent.length && !shares.length;   // no bets on this game: dashes instead of zeros
      const hedge = g.final ? null : hedgeFor(g, mine, shares);   // Lock or Hedge when the game's risk detail has a suggested bet
      const tb = hedge ? el("b", hedge.kind === "lock" ? "dhi tico" : "dhg tico") : null;
      if (hedge) {
        const lock = hedge.kind === "lock", name = lock ? "Locks in a profit" : "Suggested hedge";
        tb.addEventListener("mouseenter", () => showTradeTip(tb, hedge));
        tb.addEventListener("mouseleave", hideTradeTip);
        tb.innerHTML = lock
          ? '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4.75 7V5a3.25 3.25 0 0 1 6.5 0v2"/><rect x="2.75" y="7" width="10.5" height="7.5" rx="1.5" fill="currentColor" stroke="none"/></svg>'
          : '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M1 13.5c3 0 3.8-1.6 4.8-4.8C6.6 6 7 3 8 3s1.400 3 2.200 5.700c1 3.200 1.800 4.800 4.800 4.800"/></svg>';
        tb.setAttribute("aria-label", name);
      }
      const wb = el("b", null, noBets ? "—" : nd(money(staked)));
      if (bonusStaked) wb.append(el("span", "bsub", " + B" + nd(money(bonusStaked))));
      wagered.append(el("span", "lbl", mine.length + spent.length ? `Wagers (${mine.length + spent.length})` : "Wagers"), wb);
      const maxRisk = (mine.length ? extremes(g, mine).maxRisk : 0) + shareRisk(shares);
      const rv = el("span", "rk-val"); rv.append(el("b", !g.final && maxRisk >= 500 ? "dlo" : null, noBets ? "—" : nd(money(maxRisk))), ...(tb ? [tb] : []));
      risk.append(el("span", "lbl", "Risk"), rv);   // red highlight from $500 of risk on a game still to be played
      // A final game with a score is settled: grade every wager against the final margin and total, and double-underline the result.
      let plText = "—", plCls = "dim";
      const settled = gameSettledPL(g);
      if (settled !== null) { plText = nd(signedMoney(settled)); plCls = "settled " + (settled > 0.004 ? "pos" : settled < -0.004 ? "neg" : "dim"); }
      else if (stCls === "live" && g.live && (mine.length || shares.length)) {   // under way with live prices: the expected P/L at the live win chances, in a P/L-coded outline like the network
        const e = mine.reduce((s, t) => s + projectedPL(t), 0) + shares.reduce((s, q) => s + q.f * projectedPL(q.t), 0);
        plText = nd(signedMoney(e)); plCls = "livepl " + (e > 0.5 ? "pos" : e < -0.5 ? "neg" : "dim");
      }
      pl.append(el("span", "lbl", "P/L"), el("b", plCls, plText));
      if (g.final) { bot.classList.add("done"); bot.append(pl); }   // a final game: the bottom row is just its P/L, in its usual column
      else bot.append(wagered, risk, pl);

      if (!over) card.append(top);   // a final game has no top line: the F on its board says it
      card.append(mid, bot, cardGutter(g));
      made.push([g, card]);
    });
    windowColumns(box, made);
    renderSectionTabs();
    fitViewportHeight();
    fitSectionTabs();
    fitTicketColumn();
    if (wasDetail && cardsScroll && cardsScroll.week === curWeek && cardsScroll.league === league) { box.scrollLeft = cardsScroll.x; window.scrollTo(window.scrollX, cardsScroll.y); }
    updateGameArrows();
  }

  // Games that kick off within an hour of each other share a column. The column is named by its slot (Eastern time, since the
  // slots are the league's) and carries its day and first kickoff in the viewer's time; six or more games take two card-columns.
  function windowColumns(box, made) {
    if (!made.length) { box.classList.remove("flat"); box.replaceChildren(el("p", "pg-stub-t", "No games this day.")); return; }
    const allFinal = made.every(([g]) => g.final);
    box.classList.toggle("flat", allFinal);
    if (allFinal) { flatGrid(box, [...made].sort((a, b) => new Date(a[0].t) - new Date(b[0].t)).map(m => m[1])); return; }
    const wins = [];
    const etDay = t => new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/New_York" }).format(new Date(t));
    [...made].sort((a, b) => new Date(a[0].t) - new Date(b[0].t)).forEach(([g, card]) => {
      const w = wins[wins.length - 1];
      // within an hour of the window's first game, or any Thursday game after a Thursday window: same column
      if (w && (new Date(g.t) - new Date(w.t) <= 3600e3 || (etDay(g.t) === "Thu" && etDay(w.t) === "Thu"))) w.cards.push(card); else wins.push({ t: g.t, cards: [card] });
    });
    const et = (t, o) => new Intl.DateTimeFormat("en-US", { ...o, timeZone: "America/New_York" }).format(new Date(t));
    const slotName = t => {
      if (GAMES[0] && leagueOf(GAMES[0]).daily) return timeZoned(new Date(t));   // NBA: columns by tipoff time
      const day = et(t, { weekday: "short" }), hr = Number(et(t, { hour: "numeric", hour12: false }));
      if (day === "Sun") return hr >= 19 ? "Sunday night" : hr >= 15 ? "Late window" : hr >= 12 ? "Main slate" : "Sunday morning";
      if (day === "Mon") return "Monday night";
      if (day === "Wed") return "Wednesday night";
      if (day === "Thu") return hr >= 19 ? "Thursday night" : "Thursday";
      if (day === "Fri") return "Friday";
      return day;
    };
    // A Sunday morning game (the international one) goes in the Thursday column, two rows below its last Thursday card, under its own heading.
    // Sunday night and Monday night are stacked the same way.
    [["Sunday morning", /^Thursday/], ["Monday night", /^Sunday night/]].forEach(([name, host]) => {
      const i = wins.findIndex(w => slotName(w.t) === name), hw = wins.find(w => host.test(slotName(w.t)));
      if (i >= 0 && hw && hw.cards.length <= 2) hw.sun = wins.splice(i, 1)[0];
    });
    wins.forEach(w => {
      const cols = w.cards.length >= 9 ? 3 : w.cards.length >= 6 ? 2 : 1, slot = el("section", "slot"), grid = el("div", "slot-cards");
      grid.style.setProperty("--rows", Math.ceil(w.cards.length / cols) + (w.sun ? 2 + w.sun.cards.length - 1 : 0));
      grid.style.setProperty("--cols", cols);
      slot.append(el("h3", "slot-h", slotName(w.t)), grid);
      grid.append(...w.cards);
      if (w.sun) {
        const r = w.cards.length + 2, h = el("h3", "slot-h sun-h", slotName(w.sun.t));
        h.style.gridRow = String(r - 1);
        w.sun.cards.forEach((c, i) => { c.style.gridRow = String(r + i); });
        grid.append(h, ...w.sun.cards);
      }
      box.append(slot);
    });
  }

  // A week with every game final has nothing left to watch: no columns or headings, just a grid of cards in kickoff order. The
  // cards keep their 376 x 150 layout and the grid is scaled (zoom) so nothing on a card can overlap; the column count is the one
  // that allows the biggest scale in the box (width and height both have to fit).
  function flatGrid(box, cards) {
    const grid = el("div", "flat-cards");
    grid.append(...cards);
    box.append(grid);
    let best = null;
    for (let cols = cards.length === 16 ? 4 : 1; cols <= (cards.length === 16 ? 4 : cards.length); cols++) {   // 16 games: always 4 x 4
      const rows = Math.ceil(cards.length / cols), w = cols * 376 + (cols - 1) * 4, h = rows * 165 + (rows - 1) * 4;
      const scale = Math.min(1, (box.clientWidth - 1) / w, (box.clientHeight - 8) / h);
      if (!best || scale > best.scale) best = { cols, scale };
    }
    grid.style.setProperty("--cols", best.cols);
    grid.style.setProperty("zoom", best.scale);
  }
  window.addEventListener("resize", () => { const b = $("games"); if (b && b.classList.contains("flat")) changed("cards"); });


  // The teams not playing this week: every team in the color table that is on no game of the selected week.
  function renderByes() {
    const playing = new Set(GAMES.flatMap(g => [nick(g, "away"), nick(g, "home")]));
    const off = LG().byes ? NFL_NICKS.filter(t => !playing.has(t)).sort() : [];   // only the NFL has byes
    const box = $("byes");
    box.replaceChildren();
    $("byeLabel").hidden = !off.length;
    box.append(...off.map(t => {
      // a team chip like the Graphs badges: team colors, abbreviation, helmet overhanging at the left
      const { bg, fg } = TEAM[t], c = el("span", "bye-chip");
      c.style.background = bg; c.style.color = fg; c.title = t;
      if (hasArt(t)) c.append(helmImg(t, "bye-helm"));
      c.append(el("span", null, abbr(t)));
      return c;
    }));
    fitSlateLine();
  }

  // Week tabs: each week has its own games, saved tickets, totals and Risk detail. Switching swaps GAMES and tickets and redraws.
  const riskByWeek = Object.fromEntries(Object.keys(WEEK_GAMES).map(w => [w, ""]));
  riskByWeek[7] = riskKey;
  // Graphs is for the current week and the next, while every game still to kick off has a line and at least one is left.
  const nflWeek = () => Math.max(1, Math.min(17, 8 + Math.floor((Date.now() - new Date(2026, 9, 28).getTime()) / 604800000)));
  const weekNow = () => (LG().daily ? slateOfDay(league, nbaDay()) : nflWeek());   // the current slate of the league on screen
  function graphsOK() {
    if (!LG().graphs || (curWeek !== weekNow() && curWeek !== weekNow() + 1)) return false;   // the graphs are built on the NFL's margins
    const open = graphGames();
    return open.length > 0 && open.every(g => !g.noLine);
  }
  const drawLeagueStub = () => { if (LEAGUES.includes(view)) drawStub(view); };
  function showView(v) {
    view = v;
    $("ledger").hidden = v !== "ledger"; $("xy").hidden = v !== "xy"; $("season").hidden = v !== "season"; $("playbook").hidden = v !== "playbook"; $("panel").hidden = v !== "week";
    LEAGUES.forEach(k => { $(k).hidden = v !== k; });
    ["ledger", "xy", "season", "playbook"].forEach(k => $("tab-" + k).setAttribute("aria-selected", String(v === k)));
    document.querySelectorAll(".weektabs [data-week]").forEach(b => { const w = Number(b.dataset.week); b.classList.toggle("now", w === weekNow()); b.setAttribute("aria-selected", String(!SECTIONS[v] && w === curWeek)); });   // Graphs belongs to the selected week; one top tab is active at a time
    changed("view", "view:" + v);
    syncLeaguePick();
  }
  $("tab-xy").addEventListener("click", () => { detailGame = null; if (view === "xy") { showView("week"); } else showView("xy"); });   // clicking Graphs again goes back to the cards
  // Season stats, Playbook and Ledger: clicking the active one closes it, onto the current week's cards.
  ["season", "playbook", "ledger"].forEach(k => $("tab-" + k).addEventListener("click", () => { if (view === k) { detailGame = null; switchWeek(weekNow()); } else showView(k); }));
  // The week tabs follow the league: Weeks 1-17, or for a daily league (the NBA, the NHL) its days from today (leagues.js), the spare tabs hidden.
  function setLeague(l) {
    league = l;
    document.documentElement.dataset.league = l;
    const tabs = [...document.querySelectorAll(".weektabs [data-week]")];
    tabs.forEach((b, i) => {
      b.style.display = Calc.RULES.leagues[l].daily && i >= LEAGUE_DEFS[l].days ? "none" : "";
      if (!Calc.RULES.leagues[l].daily) { b.dataset.week = String(i + 1); b.textContent = "Week " + (i + 1); return; }
      const d = new Date(Date.now() + i * 864e5);
      b.dataset.week = String(slateOfDay(l, nbaDay(i)));
      b.textContent = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
    });
    detailGame = null;
    switchWeek(weekNow());
    renderByes();
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
    leaveOffLeague();
    syncLeaguePick();
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
    $("slateTitle").textContent = slateTitleOf(w); renderByes();
    later.weekChanged();
    applySlate(); showView("week");
  }
  document.querySelectorAll(".weektabs [data-week]").forEach(b => b.addEventListener("click", () => { const had = !!detailGame; detailGame = null; const w = Number(b.dataset.week); if (had && w === curWeek) showView("week"); else switchWeek(w); }));
export { LAYOUTS, isTall, layoutPref, setLayoutPref, WATCH_SETUPS, nick, telecastFor, BROADCAST, hdhr, setHdhr, setWatchSetup, watchSetup, changed, definePanels, drawLeagueStub, drawNow, renderSectionTabs, $, ALL_GAMES, APP_VERSION, BADGE_STYLES, FAN_CLASSES, GAMES, LG, NETWORKS, RULES, TELECAST_LAYOUTS, allTickets, americanOf, applySlate, badgeStyle, bdBadge, betClass, bookAbbr, bookTag, calc, centsOf, contractsFor, curWeek, dayFmt, deadFor, decimalOf, detailGame, drawStub, el, evMoneyline, evPoints, extremes, fillAmounts, fillSide, fitTicketColumn, freshPrices, gameBets, gameKey, gameLabel, gameSettledPL, gamesInView, graphGames, hedgeFor, helmImg, initLines, kalshiCalc, kalshiCheck, kalshiMarket, last, later, league, leagueId, leagueNames, leagueOf, leaguesOn, leaveOffLeague, ledgerRows, legGame, legResult, legText, lineOf, lineOk, marginModel, money, nbaDay, networkLinks, odds, outcomes, pairFlagged, pairStakes, parlayShares, pbStats, profitOf, projectedPL, pts, readTicker, renderByes, renderGames, replyFill, resultCell, riskGame, riskKey, riskOf, selectSlate, setBadgeStyle, setDetailGame, setNetworkLink, setTelecastPref, marketWanted, pricesOn, pricesWanted, trackingOn, clearPrices, setLeagueOn, setRiskGame, setTickets, setPricesWanted, setTrackingOn, settleOf, shareRisk, shareTerm, shortDayFmt, showView, signedMoney, slateAt, spentShares, status, subView, switchWeek, teamLook, telecastPref, ticketLeagueOn, ticketPL, ticketPrice, tickets, ticketsInView, timeFmt, timeZoned, tz, updateGameArrows, view, vigOf, weekNow };
