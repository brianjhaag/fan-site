// Runs last: opens the page on the current week, draws it and connects the sockets.
import "./base.js?v=mw15yroz";
import "./risk.js?v=mw15yroz";
import "./panels.js?v=mw15yroz";
import "./tracker.js?v=mw15yroz";
import "./trade.js?v=mw15yroz";
import "./wall.js?v=mw15yroz";
import "./settings.js?v=mw15yroz";
import { renderCode } from "./code.js?v=mw15yroz";
import { Fan } from "./hosts.js?v=mw15yroz";
import { WEEK_GAMES } from "./espn.js?v=mw15yroz";
import { setTrackingOn, setLeagueOn, changed, curWeek, definePanels, drawLeagueStub, drawNow, initLines, leaguesOn, leaveOffLeague, marketWanted, renderByes, renderGames, renderSectionTabs, switchWeek, view, weekNow } from "./base.js?v=mw15yroz";
import { LEAGUES_READY } from "./leagues.js?v=mw15yroz";
import { renderRisk, renderTotals, selectionAfter, selectionBefore } from "./risk.js?v=mw15yroz";
import { renderPlaybook, renderSeason, renderXY } from "./panels.js?v=mw15yroz";
import { renderLedger, renderPick, renderTickets, startRecords } from "./tracker.js?v=mw15yroz";
import { fillSettings, findConnector } from "./settings.js?v=mw15yroz";
  // What redraws when something changes, in drawing order. tickets: a wager, the week or Track. lines: prices and finals. cards: scores, badges or the card layout. selection: the game in the risk detail. exec: an order being sent. settings: what the settings window shows, such as what the connector offers.
  const BOARD = ["tickets", "lines", "cards", "selection"];
  const whenShowing = (v, draw) => () => { if (view === v) draw(); };
  definePanels([
    [selectionBefore, ["selection"]],
    [renderTickets, ["tickets", "selection"]],
    [renderTotals, [...BOARD, "view:week"]],
    [whenShowing("ledger", renderLedger), [...BOARD, "view:ledger", "balances", "leagues"]],
    [whenShowing("xy", renderXY), [...BOARD, "view:xy", "size"]],
    [whenShowing("season", renderSeason), [...BOARD, "view:season", "size"]],
    [whenShowing("playbook", renderPlaybook), ["view:playbook", "playbook", "size"]],
    [whenShowing("code", renderCode), ["view:code"]],
    [drawLeagueStub, ["view"]],
    [renderGames, [...BOARD, "view:week"]],
    [renderRisk, ["tickets", "lines", "selection", "exec", "size", "view:week"]],
    [renderSectionTabs, ["view"]],
    [selectionAfter, ["selection"]],
    [fillSettings, ["settings"]],
  ]);
  Fan.setMarket(marketWanted());
  // the page opens on the CURRENT week: NFL weeks run Wednesday to Tuesday, and Week 8 starts Wed Oct 28 2026 (the same window the lines script uses)
  { const w0 = weekNow(); document.querySelectorAll(".weektabs [data-week]").forEach(b => b.classList.toggle("now", Number(b.dataset.week) === w0)); if (WEEK_GAMES[w0] && w0 !== curWeek) switchWeek(w0); }
  // ignore hover until the pointer really moves: the spot under a stationary mouse at load must not light anything up. A touch screen has no hover, and this would swallow its first tap
  if (!navigator.maxTouchPoints) { const root = document.documentElement; root.classList.add("nohover"); const on = () => { root.classList.remove("nohover"); removeEventListener("mousemove", on, true); removeEventListener("pointerdown", on, true); removeEventListener("touchstart", on, true); }; addEventListener("mousemove", on, true); addEventListener("pointerdown", on, true); addEventListener("touchstart", on, true); }
  Fan.setLeagues([...leaguesOn]);
  leaveOffLeague();
  renderByes(); changed("tickets"); drawNow(); renderPick();
  (async () => {
    // The connector first: it doesn't wait on ESPN, so the Application tab shows it at once, however long the daily leagues' pulls take (Nov 3 2026).
    try { await Fan.connectStore(); } catch (e) {}
    if (Fan.door && Fan.door.here) { setTrackingOn(false); document.documentElement.classList.add("remote"); }   // a remote is Watch and the wall only (the user's, Nov 3 2026): no Track, Price, Bet or Code
    findConnector();
    changed("settings");
    // The leagues this browser had on besides the NFL, with the NHL's games from ESPN (its saved copies, mostly), and the NFL off if it was.
    try { const saved = JSON.parse(localStorage.getItem("fan.leagues") || "[]"); for (const k of saved) if (k !== "nfl" && LEAGUES_READY.includes(k)) await setLeagueOn(k, true); if (saved.some(k => k !== "nfl" && leaguesOn.has(k)) && !saved.includes("nfl")) await setLeagueOn("nfl", false); } catch (e) {}
    await startRecords();
    changed("settings");
    initLines();
  })();
  // The chart is drawn at the card's width, so redraw when the window changes size.
  let resizeTimer;
  window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => changed("size"), 150); });
