// Runs last: opens the page on the current week, draws it and connects the sockets.
import "./base.js?v=mvxat2k7";
import "./risk.js?v=mvxat2k7";
import "./panels.js?v=mvxat2k7";
import "./tracker.js?v=mvxat2k7";
import "./trade.js?v=mvxat2k7";
import { Fan } from "./hosts.js?v=mvxat2k7";
import { WEEK_GAMES } from "./espn.js?v=mvxat2k7";
import { curWeek, fillSettings, initLines, leaguesOn, leaveOffLeague, marketWanted, renderByes, renderGames, switchWeek, view, weekNow } from "./base.js?v=mvxat2k7";
import { renderRisk } from "./risk.js?v=mvxat2k7";
import { renderSeason, renderXY } from "./panels.js?v=mvxat2k7";
import { renderPick, renderTickets, startRecords } from "./tracker.js?v=mvxat2k7";
  Fan.setMarket(marketWanted());
  // the page opens on the CURRENT week: NFL weeks run Wednesday to Tuesday, and Week 8 starts Wed Oct 28 2026 (the same window the lines script uses)
  { const w0 = weekNow(); document.querySelectorAll(".weektabs [data-week]").forEach(b => b.classList.toggle("now", Number(b.dataset.week) === w0)); if (WEEK_GAMES[w0] && w0 !== curWeek) switchWeek(w0); }
  // ignore hover until the pointer really moves: the spot under a stationary mouse at load must not light anything up. A touch screen has no hover, and this would swallow its first tap
  if (!navigator.maxTouchPoints) { const root = document.documentElement; root.classList.add("nohover"); const on = () => { root.classList.remove("nohover"); removeEventListener("mousemove", on, true); removeEventListener("pointerdown", on, true); removeEventListener("touchstart", on, true); }; addEventListener("mousemove", on, true); addEventListener("pointerdown", on, true); addEventListener("touchstart", on, true); }
  Fan.setLeagues([...leaguesOn]);
  leaveOffLeague();
  renderByes(); renderTickets(); renderGames(); renderRisk(); renderPick();
  (async () => {
    try { await Fan.connectStore(); } catch (e) {}
    await startRecords();
    fillSettings();
    initLines();
  })();
  // The chart is drawn at the card's width, so redraw when the window changes size.
  let resizeTimer;
  window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { renderRisk(); if (view === "xy") renderXY(); if (view === "season") renderSeason(); }, 150); });
