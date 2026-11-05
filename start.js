// Runs last: opens the page on the current week, draws it and connects the sockets.
import "./base.js?v=mw3soqv0";
import "./layout.js?v=mw3soqv0";
import "./risk.js?v=mw3soqv0";
import "./panels.js?v=mw3soqv0";
import "./handicap.js?v=mw3soqv0";
import "./tracker.js?v=mw3soqv0";
import "./trade.js?v=mw3soqv0";
import "./telecasts.js?v=mw3soqv0";
import "./cards.js?v=mw3soqv0";
import "./settings.js?v=mw3soqv0";
import { drawCode, useOwnMethods } from "./code.js?v=mw3soqv0";
import { Fan } from "./hosts.js?v=mw3soqv0";
import { WEEK_GAMES } from "./espn.js?v=mw3soqv0";
import { sendManifest, useWallLinks } from "./telecasts.js?v=mw3soqv0";
import { setTrackingOn, setLeagueOn, changed, curWeek, definePanels, drawLeagueStub, drawNow, startLines, leaguesOn, leaveOffLeague, marketWanted, switchWeek, view, weekNow } from "./base.js?v=mw3soqv0";
import { drawSectionTabs } from "./layout.js?v=mw3soqv0";
import { drawByes, drawGameCards } from "./cards.js?v=mw3soqv0";
import { LEAGUES_READY } from "./leagues.js?v=mw3soqv0";
import { drawRiskDetail, drawTotals, selectionAfter, selectionBefore } from "./risk.js?v=mw3soqv0";
import { drawSeasonStats, drawGraphs } from "./panels.js?v=mw3soqv0";
import { drawHandicap } from "./handicap.js?v=mw3soqv0";
import { drawLedger, drawPick, drawSavedTickets, startRecords } from "./tracker.js?v=mw3soqv0";
import { drawSettings, findConnector } from "./settings.js?v=mw3soqv0";
  // What redraws when something changes, in drawing order. tickets: a wager, the week or Track. lines: prices and finals. cards: scores, badges or the card layout. selection: the game in the risk detail. exec: an order being sent. settings: what the settings window shows, such as what the connector offers.
  const BOARD = ["tickets", "lines", "cards", "selection"];
  const whenShowing = (v, draw) => () => { if (view === v) draw(); };
  definePanels([
    [selectionBefore, ["selection"]],
    [drawSavedTickets, ["tickets", "selection"]],
    [drawTotals, [...BOARD, "view:week"]],
    [whenShowing("ledger", drawLedger), [...BOARD, "view:ledger", "balances", "leagues"]],
    [whenShowing("graphs", drawGraphs), [...BOARD, "view:graphs", "size"]],
    [whenShowing("season", drawSeasonStats), [...BOARD, "view:season", "size", "past", "playbook"]],
    [whenShowing("handicap", drawHandicap), ["view:handicap", "lines", "cards", "past", "size"]],
    [whenShowing("code", drawCode), ["view:code"]],
    [drawLeagueStub, ["view"]],
    [drawGameCards, [...BOARD, "view:week"]],
    [drawRiskDetail, ["tickets", "lines", "selection", "exec", "size", "view:week"]],
    [drawSectionTabs, ["view"]],
    [selectionAfter, ["selection"]],
    [drawSettings, ["settings"]],
  ]);
  Fan.setMarket(marketWanted());
  // the page opens on the CURRENT week: NFL weeks run Wednesday to Tuesday, and Week 8 starts Wed Oct 28 2026 (the same window the lines script uses)
  { const w0 = weekNow(); document.querySelectorAll(".strip-tabs [data-week]").forEach(b => b.classList.toggle("now", Number(b.dataset.week) === w0)); if (WEEK_GAMES[w0] && w0 !== curWeek) switchWeek(w0); }
  // ignore hover until the pointer really moves: the spot under a stationary mouse at load must not light anything up. A touch screen has no hover, and this would swallow its first tap
  if (!navigator.maxTouchPoints) { const root = document.documentElement; root.classList.add("no-hover"); const on = () => { root.classList.remove("no-hover"); removeEventListener("mousemove", on, true); removeEventListener("pointerdown", on, true); removeEventListener("touchstart", on, true); }; addEventListener("mousemove", on, true); addEventListener("pointerdown", on, true); addEventListener("touchstart", on, true); }
  Fan.setLeagues([...leaguesOn]);
  leaveOffLeague();
  drawByes(); changed("tickets"); drawNow(); drawPick();
  (async () => {
    // The connector first: it doesn't wait on ESPN, so the Application tab shows it at once, however long the daily leagues' pulls take (Nov 3 2026).
    try { await Fan.connectStore(); } catch (e) {}
    await useOwnMethods();   // the user's own methods, from the connector, in Fan's place before anything decides on them (PLAN.md E)
    if (Fan.door && Fan.door.here) { setTrackingOn(false); document.documentElement.classList.add("remote"); }   // a remote is Watch and the wall only (the user's, Nov 3 2026): no Track, Price, Bet or Code
    if (Fan.door && Fan.door.here) {   // a remote takes the wall computer's links and leagues (its manifest)
      try { const w = await Fan.wall.get(), m = (w && w.manifest) || {}; useWallLinks(m.links); for (const k of m.leagues || []) if (LEAGUES_READY.includes(k) && !leaguesOn.has(k)) await setLeagueOn(k, true); } catch (e) {}
    } else sendManifest();
    findConnector();
    changed("settings");
    // The leagues this browser had on besides the NFL, with the NHL's games from ESPN (its saved copies, mostly), and the NFL off if it was.
    try { const saved = JSON.parse(localStorage.getItem("fan.leagues") || "[]"); for (const k of saved) if (k !== "nfl" && LEAGUES_READY.includes(k)) await setLeagueOn(k, true); if (saved.some(k => k !== "nfl" && leaguesOn.has(k)) && !saved.includes("nfl")) await setLeagueOn("nfl", false); } catch (e) {}
    await startRecords();
    changed("settings");
    startLines();
  })();
  // The chart is drawn at the card's width, so redraw when the window changes size.
  let resizeTimer;
  window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => changed("size"), 150); });
