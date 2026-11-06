

import { $, LG, el, last, later, league, trackingOn, showView, subView, tickets, view, graphsOK, SECTIONS, isPhone, mq } from "./base.js?v=mw5bbx45";



function drawSectionTabs() {
  later.syncPlace();   
  if (view === "graphs" && !graphsOK()) { showView("week"); return; }
  const other = !!SECTIONS[view], row = $("bottomSectionTabs");
  document.querySelector(".strip-tabs.graphs-tab").style.display = !other && graphsOK() ? "" : "none";
  if (other) {
    document.querySelector(".bye-box").style.display = "none";
    row.replaceChildren(...(SECTIONS[view].length < 2 ? [] : SECTIONS[view].map(s => {
      const b = el("button", null, s.h);
      b.type = "button"; b.draggable = false; b.setAttribute("aria-selected", String(subView[view] === s.k));
      b.addEventListener("click", () => { subView[view] = s.k; showView(view); });
      return b;
    })));
    fitStripRows();
    return;
  }
  if (view === "graphs") document.querySelector(".bye-box").style.display = "";
  row.replaceChildren();   
  fitStripRows();
}




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
const rowWatch = new ResizeObserver(() => fitStripRows());   
[$("leagueBox"), $("fanBtn"), document.querySelector(".strip-left"), document.querySelector(".page-tabs"), document.querySelector(".ledger-tab")].forEach(e => rowWatch.observe(e));


function fitSectionTabs() {
  const g0 = $("games").getBoundingClientRect(), wager = document.querySelector(".col.left");
  if (!(g0.width > 0) || !wager) return;
  
  const rootEl = document.documentElement;
  rootEl.classList.remove("tracking-off");
  const wr = wager.getBoundingClientRect();
  rootEl.classList.toggle("tracking-off", !trackingOn);
  divideX = wr.left > g0.left ? wr.left : null;   
  const g = { left: g0.left, width: wr.left > g0.left ? wr.left - g0.left : document.querySelector(".strip:not(.bottom)").clientWidth };   
  
  document.querySelectorAll(".strip-tabs.wk2").forEach(r => { r.style.width = g.width + "px"; r.style.setProperty("--cell", (g.width / 9) + "px"); });
  fitStripRows();
}



function showOpenWeek() { if (isPhone()) document.querySelectorAll(".strip-tabs.wk2 [aria-selected=true]").forEach(b => { const r = b.closest(".strip"); r.scrollLeft = b.getBoundingClientRect().left - r.getBoundingClientRect().left + r.scrollLeft - 40; }); }
function fitViewportHeight() {
  showOpenWeek();
  if (view !== "week") return;
  const root = document.documentElement;
  if (isPhone()) { root.style.setProperty("--card-h", "150px"); return; }   
  
  const col = document.querySelector(".col.left"), rc = $("riskDetail"), sel = col.classList.contains("has-selection");
  if (sel) { col.classList.remove("has-selection"); rc.classList.add("rk-off"); rc.classList.remove("rk-over"); }
  col.style.height = ""; col.style.alignSelf = "";   
  root.style.setProperty("--games-h", "728px"); root.style.setProperty("--card-h", "165px");
  const over = root.scrollHeight - window.innerHeight;
  if (sel) { col.classList.add("has-selection"); rc.classList.remove("rk-off"); rc.classList.add("rk-over"); }
  if (over <= 1) return;
  const gh = Math.max(560, 728 - over), ch = Math.max(120, Math.min(165, Math.floor((gh - 38) / 4)));
  root.style.setProperty("--games-h", gh + "px"); root.style.setProperty("--card-h", ch + "px");
}



function fitTicketColumn() {
  const col = document.querySelector(".col.left"), strip = document.querySelector(".strip.bottom"), games = $("games");
  if (!col || !strip || !games) return;
  col.style.height = ""; col.style.alignSelf = "";
  const cr = [...games.querySelectorAll(".game")].map(c => c.getBoundingClientRect()).filter(q => q.width > 0).sort((p, q) => p.top - q.top);
  const r = col.getBoundingClientRect();
  let bottom = games.getBoundingClientRect().bottom + window.scrollY;
  
  const allDone = col.classList.contains("all-final");
  if (cr.length && !allDone) { const tops = []; cr.forEach(q => { if (!tops.length || q.top - tops[tops.length - 1] > 3) tops.push(q.top); }); const t = tops[Math.min(3, tops.length - 1)]; bottom = Math.max(...cr.filter(q => Math.abs(q.top - t) <= 3).map(q => q.bottom)) + window.scrollY + Math.max(0, 4 - tops.length) * (cr[0].height + 4); }   
  if (document.documentElement.scrollHeight > window.innerHeight + 1) bottom = Math.min(bottom, window.innerHeight - strip.offsetHeight - 36 - 8);
  if (cr.length || allDone) fitTicketColumn.bottom = bottom; else if (fitTicketColumn.bottom != null) bottom = fitTicketColumn.bottom;   
  
  if (!allDone && document.documentElement.classList.contains("layout-portrait") && mq("(max-width: 1347px)")) { col.style.alignSelf = "start"; col.style.height = Math.max(r.height, window.innerHeight - strip.offsetHeight - 36 - 8 - (r.top + window.scrollY)) + "px"; return; }
  const h = bottom - (r.top + window.scrollY);
  if (h > 0 && h < r.height - 1) { col.style.alignSelf = "start"; col.style.height = Math.max(300, h) + "px"; }
}

function fitBand() { const t = document.querySelector(".strip:not(.bottom)").getBoundingClientRect(), strip = document.querySelector(".strip.bottom"), b = strip.getBoundingClientRect(), band = $("band"), pinned = getComputedStyle(strip).position === "fixed"; band.style.position = pinned ? "fixed" : "absolute"; band.style.top = (t.bottom + window.scrollY) + "px"; band.style.bottom = pinned ? b.height + "px" : "auto"; band.style.height = pinned ? "" : Math.max(0, b.top - t.bottom) + "px"; const win = $("settingsWindow"), info = document.querySelector("fan-info-line").offsetHeight; win.style.top = pinned ? (t.bottom + 8) + "px" : ""; win.style.bottom = pinned ? (b.height + 2 + info + 2) + "px" : ""; const code = $("code"); code.style.top = win.style.top; code.style.bottom = win.style.bottom; win.style.height = pinned ? "auto" : ""; }   
const bandWatch = new ResizeObserver(fitBand);   
bandWatch.observe(document.body); bandWatch.observe(document.querySelector(".strip:not(.bottom)"));
window.addEventListener("resize", () => { fitViewportHeight(); fitSectionTabs(); fitTicketColumn(); fitBand(); });

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
document.addEventListener("dragstart", e => { if (e.target.closest && e.target.closest(".strip")) e.preventDefault(); });   
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fitSectionTabs());


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
