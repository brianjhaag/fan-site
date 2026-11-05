// The page's strips and fitting (the refactor, Nov 3 2026, from base.js): the bottom strip's tabs and its rows, the section tabs, the page fitted to the window, the ticket column,
// the band, the left column's two folding cards, and the game strip's arrows.
import { $, LG, el, last, later, league, trackingOn, showView, subView, tickets, view, graphsOK, SECTIONS, isPhone, mq } from "./base.js?v=mw47fl4w";

// The bottom strip: a tab for every game of the selected week (kickoff order), first half in the top row, the rest under it. A click opens the game detail tab.
// The bottom strip belongs to the button highlighted on top. A week: its games, plus Graphs when the slate has lines. Another section: that section's own buttons.
function drawSectionTabs() {
  later.syncPlace();   // new slate data can bring the ticket's Kalshi market
  if (view === "graphs" && !graphsOK()) { showView("week"); return; }
  const other = !!SECTIONS[view], row = $("bottomSectionTabs");
  document.querySelector(".strip-tabs.graphs-tab").style.display = !other && graphsOK() ? "" : "none";
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
  if (view === "graphs") document.querySelector(".bye-box").style.display = "";
  row.replaceChildren();   // a week's strip has only Graphs
  fitStripRows();
}
// The rows rule (the user's, Nov 2 2026): buttons go on the top strip's top row and the bottom strip's bottom row. In a portrait or narrow layout a strip whose row doesn't fit
// collapses: the top strip puts its right side (the league picker and Fan) over its tabs, the bottom strip its left side (Graphs or a section's buttons) over Season stats, Playbook and Ledger.
// Measured from what doesn't move when it collapses, so it never flips back and forth.
// The league picker sits halfway between the column divide and Fan, or just left of Fan with no divide or a collapsed strip.
let divideX = null;
function fitStripRows() {
  const c = document.documentElement.classList, folds = c.contains("layout-portrait") || c.contains("layout-narrow");
  const bottom = document.querySelector(".strip.bottom"), right = [".page-tabs", ".ledger-tab"].reduce((s, q) => s + document.querySelector(q).offsetWidth, 0);
  bottom.classList.toggle("collapsed", folds && document.querySelector(".strip-left").scrollWidth + right + 26 > bottom.clientWidth);
  const top = document.querySelector(".strip:not(.bottom)");
  top.classList.toggle("collapsed", folds && document.querySelector(".strip-tabs.wk2").offsetWidth + $("leaguePick").offsetWidth + $("fanBtn").offsetWidth + 18 > top.clientWidth);
  const box = $("leagueBox"), room = divideX != null && !top.classList.contains("collapsed") ? $("fanBtn").getBoundingClientRect().left - divideX : 0;
  box.style.marginRight = Math.max(0, room / 2 - box.offsetWidth / 2) + "px";
}
const rowWatch = new ResizeObserver(() => fitStripRows());   // held here, so it keeps watching: the picker's width, the DEMO badge, a section's buttons (not Fan's box, which the picker's margin resizes)
[$("leagueBox"), $("fanBtn"), document.querySelector(".strip-left"), document.querySelector(".page-tabs"), document.querySelector(".ledger-tab")].forEach(e => rowWatch.observe(e));

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
  const g = { left: g0.left, width: wr.left > g0.left ? wr.left - g0.left : document.querySelector(".strip:not(.bottom)").clientWidth };   // a narrow layout puts the stack above the cards: the weeks take the strip's width, and fitStripRows puts Fan over them
  // the two week rows are as wide as the game cards (the strips themselves stay the width of the screen)
  document.querySelectorAll(".strip-tabs.wk2").forEach(r => { r.style.width = g.width + "px"; r.style.setProperty("--cell", (g.width / 9) + "px"); });
  fitStripRows();
}
// The week view must not scroll vertically: if the page is taller than the window, the games area (and the card height) shrinks by the overflow. It always tries the full size
// first, so a window that grows later gets the room back at the next render; nothing is sized from the window directly, which is what made an auto-sized frame run away before.
// On a phone the week tabs scroll sideways, so the open week is brought into view.
function showOpenWeek() { if (isPhone()) document.querySelectorAll(".strip-tabs.wk2 [aria-selected=true]").forEach(b => { const r = b.closest(".strip"); r.scrollLeft = b.getBoundingClientRect().left - r.getBoundingClientRect().left + r.scrollLeft - 40; }); }
function fitViewportHeight() {
  showOpenWeek();
  if (view !== "week") return;
  const root = document.documentElement;
  if (isPhone()) { root.style.setProperty("--card-h", "150px"); return; }   // a phone's page scrolls
  // measured with the wager ticket in place (not the selected game's graph card), so selecting a game never changes the card sizes
  const col = document.querySelector(".col.left"), rc = $("riskDetail"), sel = col.classList.contains("has-selection");
  if (sel) { col.classList.remove("has-selection"); rc.classList.add("rk-off"); rc.classList.remove("rk-over"); }
  col.style.height = ""; col.style.alignSelf = "";   // the column's height from the last fit must not feed this measurement: same inputs, same card size every time
  root.style.setProperty("--games-h", "728px"); root.style.setProperty("--card-h", "165px");
  const over = root.scrollHeight - window.innerHeight;
  if (sel) { col.classList.add("has-selection"); rc.classList.remove("rk-off"); rc.classList.add("rk-over"); }
  if (over <= 1) return;
  const gh = Math.max(560, 728 - over), ch = Math.max(120, Math.min(165, Math.floor((gh - 38) / 4)));
  root.style.setProperty("--games-h", gh + "px"); root.style.setProperty("--card-h", ch + "px");
}
// The wager ticket column ends level with the bottom of the fourth row of game cards (the last row if fewer), so the update text line can run underneath it; the saved tickets list, the flexing item, gives up the height.
// It also stays 8px above the pinned bottom tab strip when the window is shorter than the page (the page scrolls). An auto-sized frame (no scrolling) is not sized from the
// window: that would feed back into the frame's own height.
function fitTicketColumn() {
  const col = document.querySelector(".col.left"), strip = document.querySelector(".strip.bottom"), games = $("games");
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
  if (!allDone && document.documentElement.classList.contains("layout-portrait") && mq("(max-width: 1347px)")) { col.style.alignSelf = "start"; col.style.height = Math.max(r.height, window.innerHeight - strip.offsetHeight - 36 - 8 - (r.top + window.scrollY)) + "px"; return; }
  const h = bottom - (r.top + window.scrollY);
  if (h > 0 && h < r.height - 1) { col.style.alignSelf = "start"; col.style.height = Math.max(300, h) + "px"; }
}
// The background image fills the band from the top strip's bottom edge to the bottom strip's top edge, behind the info line too: pinned to the window with the bottom strip, or measured on the page where that strip scrolls with it (a phone).
function fitBand() { const t = document.querySelector(".strip:not(.bottom)").getBoundingClientRect(), strip = document.querySelector(".strip.bottom"), b = strip.getBoundingClientRect(), band = $("band"), pinned = getComputedStyle(strip).position === "fixed"; band.style.position = pinned ? "fixed" : "absolute"; band.style.top = (t.bottom + window.scrollY) + "px"; band.style.bottom = pinned ? b.height + "px" : "auto"; band.style.height = pinned ? "" : Math.max(0, b.top - t.bottom) + "px"; const win = $("settingsWindow"), info = document.querySelector("fan-info-line").offsetHeight; win.style.top = pinned ? (t.bottom + 8) + "px" : ""; win.style.bottom = pinned ? (b.height + 2 + info + 2) + "px" : ""; const code = $("code"); code.style.top = win.style.top; code.style.bottom = win.style.bottom; win.style.height = pinned ? "auto" : ""; }   // the settings window too: the usable space, from the top strip down to the info line, its bottom held to the strip so it follows the window's height
const bandWatch = new ResizeObserver(fitBand);   // held here, so it keeps watching
bandWatch.observe(document.body); bandWatch.observe(document.querySelector(".strip:not(.bottom)"));
window.addEventListener("resize", () => { fitViewportHeight(); fitSectionTabs(); fitTicketColumn(); fitBand(); });
// The narrow layout's accordion (the user's, Nov 2 2026): Saved tickets and the wager ticket as title bars under the game cards, one open at a time (fan.css). Filling the ticket opens it.
let foldOpen = "";
function setFold(k) {
  foldOpen = k;
  const col = document.querySelector(".col.left");
  col.classList.toggle("fold-saved", k === "saved"); col.classList.toggle("fold-ticket", k === "ticket");
  $("foldSaved").setAttribute("aria-expanded", String(k === "saved")); $("foldTicket").setAttribute("aria-expanded", String(k === "ticket"));
}
$("foldSaved").addEventListener("click", () => setFold(foldOpen === "saved" ? "" : "saved"));
$("foldTicket").addEventListener("click", () => setFold(foldOpen === "ticket" ? "" : "ticket"));
window.addEventListener("load", () => fitTicketColumn());
window.addEventListener("resize", () => fitSectionTabs());
document.addEventListener("dragstart", e => { if (e.target.closest && e.target.closest(".strip")) e.preventDefault(); });   // the bottom strip tabs are fixed in place (no dragging)
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fitSectionTabs());

// Hover arrows for the game strip (mouse): a tap scrolls one card column, holding scrolls steadily. Only shown while the strip can scroll that way.
let gArrows = null;
function updateGameArrows() {
  const g = $("games");
  if (!gArrows) {
    const wrap = g.parentElement;
    wrap.classList.add("game-arrows"); wrap.style.position = "relative";
    const mk = dir => {
      const b = el("button", "game-arrow " + (dir < 0 ? "side-left" : "side-right"));
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
  const can = g.classList.contains("kickoff-windows") && !g.classList.contains("gd") && g.scrollWidth > g.clientWidth + 1;
  gArrows[0].classList.toggle("on", can && g.scrollLeft > 1);
  gArrows[1].classList.toggle("on", can && g.scrollLeft < g.scrollWidth - g.clientWidth - 1);
}

export { divideX, drawSectionTabs, fitSectionTabs, fitViewportHeight, fitTicketColumn, setFold, updateGameArrows };
