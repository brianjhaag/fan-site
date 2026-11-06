
import "./base.js?v=mw49jmu7";
import "./layout.js?v=mw49jmu7";
import "./risk.js?v=mw49jmu7";
import "./panels.js?v=mw49jmu7";
import "./handicap.js?v=mw49jmu7";
import "./tracker.js?v=mw49jmu7";
import "./trade.js?v=mw49jmu7";
import "./telecasts.js?v=mw49jmu7";
import "./cards.js?v=mw49jmu7";
import "./settings.js?v=mw49jmu7";
import { drawCode, useOwnMethods } from "./code.js?v=mw49jmu7";
import { Fan } from "./hosts.js?v=mw49jmu7";
import { WEEK_GAMES } from "./espn.js?v=mw49jmu7";
import { sendManifest, useWallLinks } from "./telecasts.js?v=mw49jmu7";
import { setTrackingOn, setLeagueOn, changed, curWeek, definePanels, drawLeagueStub, drawNow, startLines, leaguesOn, leaveOffLeague, marketWanted, switchWeek, view, weekNow } from "./base.js?v=mw49jmu7";
import { drawSectionTabs } from "./layout.js?v=mw49jmu7";
import { drawByes, drawGameCards } from "./cards.js?v=mw49jmu7";
import { LEAGUES_READY } from "./leagues.js?v=mw49jmu7";
import { drawRiskDetail, drawTotals, selectionAfter, selectionBefore } from "./risk.js?v=mw49jmu7";
import { drawSeasonStats, drawGraphs } from "./panels.js?v=mw49jmu7";
import { drawHandicap } from "./handicap.js?v=mw49jmu7";
import { drawLedger, drawPick, drawSavedTickets, startRecords } from "./tracker.js?v=mw49jmu7";
import { drawSettings, findConnector } from "./settings.js?v=mw49jmu7";
  
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
  
  { const w0 = weekNow(); document.querySelectorAll(".strip-tabs [data-week]").forEach(b => b.classList.toggle("now", Number(b.dataset.week) === w0)); if (WEEK_GAMES[w0] && w0 !== curWeek) switchWeek(w0); }
  
  if (!navigator.maxTouchPoints) { const root = document.documentElement; root.classList.add("no-hover"); const on = () => { root.classList.remove("no-hover"); removeEventListener("mousemove", on, true); removeEventListener("pointerdown", on, true); removeEventListener("touchstart", on, true); }; addEventListener("mousemove", on, true); addEventListener("pointerdown", on, true); addEventListener("touchstart", on, true); }
  Fan.setLeagues([...leaguesOn]);
  leaveOffLeague();
  drawByes(); changed("tickets"); drawNow(); drawPick();
  (async () => {
    
    try { await Fan.connectStore(); } catch (e) {}
    await useOwnMethods();   
    if (Fan.door && Fan.door.here) { setTrackingOn(false); document.documentElement.classList.add("remote"); }   
    if (Fan.door && Fan.door.here) {   
      try { const w = await Fan.wall.get(), m = (w && w.manifest) || {}; useWallLinks(m.links); for (const k of m.leagues || []) if (LEAGUES_READY.includes(k) && !leaguesOn.has(k)) await setLeagueOn(k, true); } catch (e) {}
    } else sendManifest();
    findConnector();
    changed("settings");
    
    try { const saved = JSON.parse(localStorage.getItem("fan.leagues") || "[]"); for (const k of saved) if (k !== "nfl" && LEAGUES_READY.includes(k)) await setLeagueOn(k, true); if (saved.some(k => k !== "nfl" && leaguesOn.has(k)) && !saved.includes("nfl")) await setLeagueOn("nfl", false); } catch (e) {}
    await startRecords();
    changed("settings");
    startLines();
  })();
  
  let resizeTimer;
  window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => changed("size"), 150); });
